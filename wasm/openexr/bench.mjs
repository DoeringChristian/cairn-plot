// Phase-1 gate benchmark + correctness: OpenEXR-wasm (this pivot) vs the current
// Rust exr-crate wasm vs the pure-TS decoder, on the committed small fixtures and
// a large 1024x1024 PIZ. Reports decode wall-time (median) and bit-exactness of
// the f16 payloads. Run:  node --experimental-strip-types bench.mjs
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const UI = resolve(here, "../../ui/src/lib/cairn-plot/image/decoders");

// --- current baselines: Rust wasm inline module + pure-TS decoder ----------
const { loadExrDecoder } = await import(resolve(UI, "wasm-inline/wasm-exr-inline.ts"));
const { decodeExrBuffer } = await import(resolve(UI, "exr-full.ts"));

// --- OpenEXR wasm (C-ABI) ---------------------------------------------------
const F = { status:0, width:1, height:2, channels:3, precision:4, data:5, dataLen:6, errCode:7, errMsg:8 };
async function loadOpenExr(opt) {
  const factory = (await import(resolve(here, `build/${opt}/cairn_openexr.mjs`))).default;
  const wasmBinary = readFileSync(resolve(here, `build/${opt}/cairn_openexr.wasm`));
  return factory({
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(new Uint8Array(wasmBinary), imports).then((o) => done(o.instance));
      return {};
    },
  });
}
function decodeOpenExr(Module, bytes) {
  const inPtr = Module._malloc(bytes.length);
  Module.HEAPU8.set(bytes, inPtr);
  const rPtr = Module._cairn_exr_decode(inPtr, bytes.length);
  Module._free(inPtr);
  const H = Module.HEAP32, base = rPtr >> 2;
  if (H[base + F.status] !== 0) {
    const code = Module.UTF8ToString(H[base + F.errCode]);
    Module._cairn_exr_free(rPtr);
    const e = new Error(code); e.code = code; throw e;
  }
  const width = H[base + F.width], height = H[base + F.height];
  const channels = H[base + F.channels], precision = H[base + F.precision];
  const ptr = H[base + F.data] >>> 0, len = H[base + F.dataLen];
  const data = precision === 0
    ? Module.HEAPU16.slice(ptr >> 1, (ptr >> 1) + len)
    : Module.HEAPF32.slice(ptr >> 2, (ptr >> 2) + len);
  Module._cairn_exr_free(rPtr);
  return { width, height, channels, precision: precision === 0 ? "f16-bits" : "f32", data };
}

const median = (xs) => { const s=[...xs].sort((a,b)=>a-b); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
function timeIt(fn, iters) { const ts=[]; for (let i=0;i<iters;i++){const t=performance.now(); fn(); ts.push(performance.now()-t);} return median(ts); }

const oz = await loadOpenExr("Oz");
const o3 = await loadOpenExr("O3");
const { decode_exr: rustDecode } = await loadExrDecoder();

const FIX = resolve(here, "fixtures/out");
const cases = [
  ["rgb-zip-half-64x48", "fixtures/out/rgb-zip-half-64x48.exr"],
  ["rgb-piz-half-64x48 (committed)", resolve(UI, "fixtures/rgb-piz-half-64x48.exr")],
  ["rgb-piz-half-1024x1024", "fixtures/out/rgb-piz-half-1024x1024.exr"],
];

console.log("\n== correctness (OpenEXR f16-bits vs Rust f16-bits, exact) + timing ==\n");
const rows = [];
for (const [name, rel] of cases) {
  const path = resolve(here, rel);
  if (!existsSync(path)) { console.log(`skip ${name} (missing)`); continue; }
  const buf = readFileSync(path);
  const u8 = new Uint8Array(buf);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const oxr = decodeOpenExr(oz, u8);
  let rustMism = "-", tsMism = "-";
  try {
    const r = rustDecode(u8);
    const rHalf = r.halfBits;
    if (rHalf && oxr.precision === "f16-bits") {
      let m = 0; for (let i=0;i<oxr.data.length;i++) if (oxr.data[i]!==rHalf[i]) m++;
      rustMism = String(m);
    }
    r.free();
  } catch (e) { rustMism = `rust-err:${e.code||e.message}`; }
  try {
    const ts = decodeExrBuffer(ab);  // f32
    // widen openexr half → f32 and compare
    let m = 0;
    for (let i=0;i<oxr.data.length;i++) {
      const b = oxr.data[i];
      const s=(b&0x8000)>>15,e=(b&0x7c00)>>10,f=b&0x03ff;
      let v; if(e===0)v=(f/1024)*2**-14; else if(e===31)v=f?NaN:Infinity; else v=(1+f/1024)*2**(e-15);
      v = s?-v:v;
      if (v !== ts.data[i]) m++;
    }
    tsMism = String(m);
  } catch (e) { tsMism = `ts-err:${e.message}`; }

  const bytes = buf.byteLength;
  const iters = bytes < 200_000 ? 50 : 12;
  const ozMs = timeIt(() => decodeOpenExr(oz, u8), iters);
  const o3Ms = timeIt(() => decodeOpenExr(o3, u8), iters);
  const rustMs = timeIt(() => rustDecode(u8).free(), iters);
  const tsMs = timeIt(() => decodeExrBuffer(ab), iters);
  rows.push({ name, dims:`${oxr.width}x${oxr.height}x${oxr.channels}`, prec:oxr.precision,
    ozMs, o3Ms, rustMs, tsMs, ratio: ozMs/rustMs, rustMism, tsMism });
}

const head = ["fixture","dims","prec","OXR-Oz ms","OXR-O3 ms","Rust ms","TS ms","Oz/Rust","≠Rust","≠TS"];
const fmt = (r)=>[r.name,r.dims,r.prec,r.ozMs.toFixed(3),r.o3Ms.toFixed(3),r.rustMs.toFixed(3),r.tsMs.toFixed(3),`${r.ratio.toFixed(2)}x`,r.rustMism,r.tsMism];
const table=[head,...rows.map(fmt)];
const w=head.map((_,c)=>Math.max(...table.map(r=>String(r[c]).length)));
for (const r of table) console.log(r.map((c,i)=>String(c).padEnd(w[i])).join("  "));
console.log();
