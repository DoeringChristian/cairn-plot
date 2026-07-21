/**
 * Node test: instantiate the COMMITTED inline-base64 WASM module (no cargo, no
 * fetch) and decode the shared PIZ fixture, asserting the same ground truth the
 * Rust + TS decoder tests use.
 *
 *   node --experimental-strip-types --test \
 *     wasm/exr-decode/inline/wasm-exr-inline.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadExrDecoder } from "./wasm-exr-inline.ts";

const FIXTURE = new URL(
  "../../../ui/src/lib/cairn-plot/image/decoders/fixtures/rgb-piz-half-64x48.exr",
  import.meta.url,
);

function halfToF32(bits: number): number {
  const s = (bits & 0x8000) >> 15;
  const e = (bits & 0x7c00) >> 10;
  const f = bits & 0x03ff;
  let val: number;
  if (e === 0) val = (f / 1024) * Math.pow(2, -14);
  else if (e === 0x1f) val = f ? NaN : Infinity;
  else val = (1 + f / 1024) * Math.pow(2, e - 15);
  return s ? -val : val;
}

test("inline WASM module instantiates from base64 and decodes the PIZ fixture", async () => {
  const { decode_exr } = await loadExrDecoder();
  const bytes = new Uint8Array(readFileSync(FIXTURE));
  const img = decode_exr(bytes);

  assert.equal(img.width, 64);
  assert.equal(img.height, 48);
  assert.equal(img.channels, 3);
  assert.equal(img.precision, "f16-bits");

  const half = img.halfBits;
  assert.ok(half instanceof Uint16Array, "half payload present");
  assert.equal(img.floats, undefined);
  assert.equal(half!.length, 64 * 48 * 3);

  // Interleaved, top-to-bottom: (x,y,c) at (y*64 + x)*3 + c.
  const px = (x: number, y: number) => {
    const i = (y * 64 + x) * 3;
    return [halfToF32(half![i]!), halfToF32(half![i + 1]!), halfToF32(half![i + 2]!)];
  };
  assert.deepEqual(px(0, 0), [0, 0, 0]);
  assert.deepEqual(px(1, 0), [0.5, 0, 0.125]);
  assert.deepEqual(px(5, 10), [2.5, 2.5, 1.875]);
  assert.deepEqual(px(7, 20), [3.5, 1, 1.375]);
});
