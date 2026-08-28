/**
 * Unit tests for the FORMAT-AGNOSTIC channel slice (`channel-slice.ts`) over
 * the SELF-DESCRIBING pixel buffer — pinning the regression where the slice
 * still read the pre-`FloatPixels` `source.data` field, threw on every
 * resolved source, and the failed-decode revert silently undid the user's
 * channel pick (surfacing as the enlarge-view flicker/kick-out).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyChannelSlice } from "./channel-slice.ts";
import { floatValues, halfBits, type FloatPixels } from "../runtime/pixel-buffer.ts";

function floatSource(pixels: FloatPixels, shape: number[]): Record<string, unknown> {
  return { dtype: "float", pixels, shape, deep: { marker: true } };
}

test("slices a values-pixels source, preserving the constructor and dropping deep", async () => {
  // 2x2 RGB: pixel p has channels [p, 10+p, 20+p].
  const data = new Float32Array(12);
  for (let p = 0; p < 4; p++) {
    data[p * 3] = p;
    data[p * 3 + 1] = 10 + p;
    data[p * 3 + 2] = 20 + p;
  }
  const dataProps = { source: floatSource(floatValues(data), [2, 2, 3]) };
  const out = (await applyChannelSlice(dataProps, "G")) as { source: Record<string, unknown> };
  const src = out.source;
  const px = src.pixels as FloatPixels;
  assert.equal(px.kind, "values");
  const values = (px as { values: Float32Array }).values;
  assert.ok(values instanceof Float32Array);
  assert.deepEqual([...values], [10, 11, 12, 13]);
  assert.deepEqual(src.shape, [2, 2, 1]);
  // A sliced frame is a static copy — the live deep controller must be dropped.
  assert.equal(src.deep, undefined);
});

test("slices an f16-bits source AS BITS (representation preserved)", async () => {
  // 1x2 RGB of raw half bit patterns — must copy through untouched.
  const bits = new Uint16Array([0x3c00, 0x4000, 0x4200, 0x4400, 0x4500, 0x4600]);
  const dataProps = { source: floatSource(halfBits(bits), [1, 2, 3]) };
  const out = (await applyChannelSlice(dataProps, ["R", "B"])) as { source: Record<string, unknown> };
  const px = out.source.pixels as FloatPixels;
  assert.equal(px.kind, "f16-bits");
  assert.deepEqual([...(px as { bits: Uint16Array }).bits], [0x3c00, 0x4200, 0x4400, 0x4600]);
  assert.deepEqual(out.source.shape, [1, 2, 2]);
});

test("legacy data-field sources still slice (hand-built descriptors)", async () => {
  const dataProps = {
    source: { dtype: "float", data: new Float32Array([1, 2, 3, 4, 5, 6]), shape: [1, 2, 3] },
  };
  const out = (await applyChannelSlice(dataProps, "B")) as { source: Record<string, unknown> };
  assert.deepEqual([...(out.source.data as Float32Array)], [3, 6]);
  assert.equal(out.source.pixels, undefined);
});

test("no selection / empty layer is a no-op", async () => {
  const dataProps = { source: floatSource(floatValues(new Float32Array(6)), [1, 2, 3]) };
  assert.equal(await applyChannelSlice(dataProps, undefined), dataProps);
  assert.equal(await applyChannelSlice(dataProps, ""), dataProps);
});
