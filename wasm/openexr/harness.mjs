// Ad-hoc Phase-1 harness: drive the OpenEXR wasm C-ABI directly (mirrors the
// glue that will live in wasm-exr-inline.ts), decode a fixture, dump metadata.
// Usage: node harness.mjs <opt=Oz|O3> <file.exr>
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const opt = process.argv[2] || "Oz";
const file = process.argv[3];

const factory = (await import(resolve(here, `build/${opt}/cairn_openexr.mjs`))).default;
const wasmBinary = readFileSync(resolve(here, `build/${opt}/cairn_openexr.wasm`));
// Fetch-free instantiation from bytes (works in node + browser + worker): the
// MODULARIZE glue honors Module.instantiateWasm as the instantiation hook.
const Module = await factory({
  instantiateWasm(imports, done) {
    WebAssembly.instantiate(new Uint8Array(wasmBinary), imports).then((o) => done(o.instance));
    return {};
  },
});

// Result struct field order (see binding.cpp DecodeResult): 9 x int32.
const F = { status:0, width:1, height:2, channels:3, precision:4, data:5, dataLen:6, errCode:7, errMsg:8 };

export function decode(Module, bytes) {
  const n = bytes.length;
  const inPtr = Module._malloc(n);
  Module.HEAPU8.set(bytes, inPtr);
  const rPtr = Module._cairn_exr_decode(inPtr, n);
  Module._free(inPtr);
  const base = rPtr >> 2;
  const H = Module.HEAP32;
  const status = H[base + F.status];
  if (status !== 0) {
    const code = Module.UTF8ToString(H[base + F.errCode]);
    const msg = Module.UTF8ToString(H[base + F.errMsg]);
    Module._cairn_exr_free(rPtr);
    const e = new Error(msg); e.code = code; throw e;
  }
  const width = H[base + F.width], height = H[base + F.height];
  const channels = H[base + F.channels], precision = H[base + F.precision];
  const dataPtr = H[base + F.data] >>> 0, dataLen = H[base + F.dataLen];
  let data;
  if (precision === 0) data = Module.HEAPU16.slice(dataPtr >> 1, (dataPtr >> 1) + dataLen);
  else data = Module.HEAPF32.slice(dataPtr >> 2, (dataPtr >> 2) + dataLen);
  Module._cairn_exr_free(rPtr);
  return { width, height, channels, precision: precision === 0 ? "f16-bits" : "f32", data };
}

if (file) {
  const bytes = new Uint8Array(readFileSync(file));
  try {
    const img = decode(Module, bytes);
    console.log(JSON.stringify({ width: img.width, height: img.height, channels: img.channels, precision: img.precision, len: img.data.length, sample: Array.from(img.data.slice(0, 8)) }));
  } catch (e) {
    console.log("ERROR", e.code, e.message);
  }
}
export { Module };
