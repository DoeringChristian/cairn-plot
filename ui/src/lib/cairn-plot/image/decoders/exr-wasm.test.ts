/**
 * Tests for the WASM-first EXR decode core (`exr-wasm.ts`, P4 Phase B). Runs
 * under Node's built-in runner with type-stripping (no Worker/DOM needed — this
 * IS the testable core the browser Worker runs):
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/image/decoders/exr-wasm.test.ts
 *
 * Coverage:
 *  1. On the committed PIZ fixture, `decodeExrPreferWasm` takes the WASM path
 *     (`precision:"f16-bits"`) and its output is BIT-EXACT with the TS decoder:
 *     the raw f16 bit patterns widen to the exact f32 values `decodeExrBuffer`
 *     produces (both decode the same all-HALF source).
 *  2. A forced typed `unsupported-compression` error falls back to the TS
 *     decoder and returns the TS `precision:"f32"` output unchanged.
 *  3. A WASM instantiation failure (loader rejects) falls back to TS too.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeExrPreferWasm, isWasmUnsupportedError } from "./exr-wasm.ts";
import { decodeExrBuffer } from "./exr-full.ts";
import { f16BitsToFloat32 } from "../half.ts";

function fixture(): ArrayBuffer {
  const bytes = readFileSync(new URL("./fixtures/rgb-piz-half-64x48.exr", import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// 1. WASM path + bit-exact equivalence with the TS decoder.
// ---------------------------------------------------------------------------
test("decodeExrPreferWasm uses WASM (f16-bits) and is bit-exact with the TS decoder", async () => {
  const buf = fixture();
  const wasm = await decodeExrPreferWasm(buf);

  // The all-HALF PIZ source comes back as raw f16 bit patterns via WASM.
  assert.equal(wasm.kind, "f32");
  assert.equal(wasm.precision, "f16-bits");
  assert.ok(wasm.data instanceof Uint16Array, "f16-bits payload is a Uint16Array");
  assert.equal(wasm.width, 64);
  assert.equal(wasm.height, 48);
  assert.equal(wasm.channels, 3);
  assert.equal(wasm.data.length, 64 * 48 * 3);

  // Widen the half bits and compare to the TS decoder's f32 values — exact
  // (every half value widens losslessly, and both decode the same pixels).
  const widened = f16BitsToFloat32(wasm.data as Uint16Array);
  const ts = decodeExrBuffer(buf);
  assert.equal(ts.precision, "f32");
  assert.equal(widened.length, ts.data.length);
  assert.deepEqual(Array.from(widened), Array.from(ts.data as Float32Array));
});

// ---------------------------------------------------------------------------
// 2. Forced typed-unsupported error → TS fallback.
// ---------------------------------------------------------------------------
test("a typed unsupported-compression error falls back to the TS decoder", async () => {
  const buf = fixture();
  let wasmCalled = false;
  const failing = async () => ({
    decode_exr: (_bytes: Uint8Array) => {
      wasmCalled = true;
      const err = new Error("HTJ2K compression is not supported") as Error & { code: string };
      err.code = "unsupported-compression";
      throw err;
    },
    // DecodedImage class is unused on this path.
    DecodedImage: class {} as never,
  });

  const out = await decodeExrPreferWasm(buf, failing as never);
  assert.ok(wasmCalled, "the WASM decode was attempted first");
  // Fell back to TS: genuine f32 values, matching a direct TS decode.
  assert.equal(out.precision, "f32");
  assert.ok(out.data instanceof Float32Array);
  const ts = decodeExrBuffer(buf);
  assert.deepEqual(Array.from(out.data as Float32Array), Array.from(ts.data as Float32Array));
});

// ---------------------------------------------------------------------------
// 3. WASM instantiation failure → TS fallback.
// ---------------------------------------------------------------------------
test("a WASM instantiation failure falls back to the TS decoder", async () => {
  const buf = fixture();
  const brokenLoader = async () => {
    throw new Error("WebAssembly.instantiate failed");
  };
  const out = await decodeExrPreferWasm(buf, brokenLoader as never);
  assert.equal(out.precision, "f32");
  const ts = decodeExrBuffer(buf);
  assert.deepEqual(Array.from(out.data as Float32Array), Array.from(ts.data as Float32Array));
});

// ---------------------------------------------------------------------------
// The typed-error predicate.
// ---------------------------------------------------------------------------
test("isWasmUnsupportedError recognizes the typed fallback codes only", () => {
  assert.equal(isWasmUnsupportedError({ code: "unsupported-compression" }), true);
  assert.equal(isWasmUnsupportedError({ code: "unsupported-channel-layout" }), true);
  assert.equal(isWasmUnsupportedError({ code: "some-other-error" }), false);
  assert.equal(isWasmUnsupportedError(new Error("boom")), false);
  assert.equal(isWasmUnsupportedError(null), false);
});
