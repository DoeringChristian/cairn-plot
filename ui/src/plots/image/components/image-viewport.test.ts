import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveImageViewport, clampBacking } from "./image-viewport.ts";

test("deriveImageViewport is null until dims and a positive box exist", () => {
  assert.equal(deriveImageViewport({ box: { width: 0, height: 0 }, backing: { width: 0, height: 0 }, view: { zoom: 1, pan: { x: 0, y: 0 } }, natural: { w: 8, h: 4 }, interpolation: "auto" }), null);
  assert.equal(deriveImageViewport({ box: { width: 100, height: 50 }, backing: { width: 200, height: 100 }, view: { zoom: 1, pan: { x: 0, y: 0 } }, natural: null, interpolation: "auto" }), null);
});

test("deriveImageViewport composes quad, uv, texel size, filter and dpr", () => {
  const v = deriveImageViewport({
    box: { width: 642, height: 277.5 },
    backing: { width: 1284, height: 555 },
    view: { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } },
    natural: { w: 512, h: 512 },
    interpolation: "auto",
  })!;
  assert.ok(Math.abs(v.dpr - 2) < 1e-12);
  assert.ok(Math.abs(v.quad.left - (-44091.4 + 242.257 * 182.25)) < 1e-9);
  assert.ok(Math.abs(v.pxPerTexel - 242.257 * (277.5 / 512)) < 1e-9);
  assert.equal(v.filter, "nearest");
  assert.ok(Math.abs(v.uv.w - 642 / (242.257 * 277.5)) < 1e-12);
});

test("deriveImageViewport picks linear below the threshold and nearest for explicit pixelated", () => {
  const base = { box: { width: 640, height: 480 }, backing: { width: 640, height: 480 }, natural: { w: 512, h: 512 } };
  assert.equal(deriveImageViewport({ ...base, view: { zoom: 1, pan: { x: 0, y: 0 } }, interpolation: "auto" })!.filter, "linear");
  assert.equal(deriveImageViewport({ ...base, view: { zoom: 1, pan: { x: 0, y: 0 } }, interpolation: "pixelated" })!.filter, "nearest");
  assert.equal(deriveImageViewport({ ...base, view: { zoom: 40, pan: { x: 0, y: 0 } }, interpolation: "auto" })!.filter, "nearest");
});

test("clampBacking bounds each axis to 16384 and the area to 2^28", () => {
  assert.deepEqual(clampBacking(1284, 555), { width: 1284, height: 555 });
  assert.deepEqual(clampBacking(20000, 100), { width: 16384, height: 100 });
  const big = clampBacking(16384, 16384);
  assert.ok(big.width * big.height <= 2 ** 28);
  assert.deepEqual(clampBacking(0, 0), { width: 1, height: 1 });
});
