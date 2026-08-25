/**
 * Pins the self-describing float pixel buffer (`image/pixel-buffer.ts`): the
 * representation travels WITH the bytes; ambiguous construction is refused
 * loudly (the silent bits-as-values misread was the 2^14 compare-exposure
 * bug); accessors widen half → f32 on read.
 *
 *   node --experimental-strip-types --test src/lib/cairn-plot/image/pixel-buffer.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  floatPixelReader,
  floatPixelsFrom,
  floatPixelsLength,
  floatPixelsRaw,
  floatValues,
  halfBits,
  readFloatPixel,
  widenFloatPixels,
} from "./pixel-buffer.ts";
// Known binary16 bit patterns (the numbers a misread would leak as values).
const HALF_ONE = 0x3c00; // bits of half 1.0  == integer 15360
const HALF_HALF = 0x3800; // bits of half 0.5 == integer 14336

test("values buffer reads directly (f32 and f64 storage)", () => {
  for (const arr of [new Float32Array([0.25, 2, -1]), new Float64Array([0.25, 2, -1])]) {
    const px = floatValues(arr);
    assert.equal(floatPixelsLength(px), 3);
    assert.equal(readFloatPixel(px, 1), 2);
    const rd = floatPixelReader(px);
    assert.equal(rd(2), -1);
  }
});

test("f16-bits buffer widens ON READ — bit patterns never leak as values", () => {
  const px = halfBits(new Uint16Array([HALF_ONE, HALF_HALF]));
  // 1.0's bits are 15360 — the accessor must return 1.0, not 15360 (the bug).
  assert.equal(readFloatPixel(px, 0), 1.0);
  assert.equal(readFloatPixel(px, 1), 0.5);
  assert.equal(floatPixelReader(px)(0), 1.0);
  const wide = widenFloatPixels(px);
  assert.ok(wide instanceof Float32Array);
  assert.equal(wide[0], 1.0);
});

test("floatPixelsFrom refuses AMBIGUOUS construction (untagged Uint16Array)", () => {
  assert.throws(() => floatPixelsFrom(new Uint16Array([HALF_ONE]), undefined));
  assert.throws(() => floatPixelsFrom(new Float32Array([1]) as never, "f16-bits"));
  // Tagged forms construct fine.
  assert.equal(floatPixelsFrom(new Uint16Array([HALF_ONE]), "f16-bits").kind, "f16-bits");
  assert.equal(floatPixelsFrom(new Float32Array([1]), "f32").kind, "values");
  assert.equal(floatPixelsFrom(new Float64Array([1]), undefined).kind, "values");
});

test("widenFloatPixels is pass-through for f32 storage (no copy)", () => {
  const arr = new Float32Array([1, 2]);
  assert.equal(widenFloatPixels(floatValues(arr)), arr);
});

test("floatPixelsRaw exposes the underlying array (size/clone only)", () => {
  const bits = new Uint16Array([HALF_ONE]);
  assert.equal(floatPixelsRaw(halfBits(bits)), bits);
});
