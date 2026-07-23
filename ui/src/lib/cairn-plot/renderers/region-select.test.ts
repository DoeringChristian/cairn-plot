/**
 * Unit tests for the pure screen→texel mapping (region-select.ts) behind the
 * deep pane's "select depth from region" marquee.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/region-select.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { screenToTexel, screenRectToTexelRect } from "./region-select.ts";

// A 100x50 source displayed object-contain into a 200x200 box at client (10,20):
// scale = min(200/100, 200/50) = 2 (width-limited), dispW=200, dispH=100,
// image top-left in client space = (10 + (200-200)/2, 20 + (200-100)/2) = (10, 70).
const box = { left: 10, top: 20, width: 200, height: 200 };
const p = { box, naturalWidth: 100, naturalHeight: 50 };

test("screenToTexel maps the image top-left corner to texel (0,0)", () => {
  const t = screenToTexel(10, 70, p);
  assert.ok(Math.abs(t.x - 0) < 1e-9);
  assert.ok(Math.abs(t.y - 0) < 1e-9);
});

test("screenToTexel maps a mid point through the object-contain scale", () => {
  // client (110, 120): (110-10)/2 = 50 in x; (120-70)/2 = 25 in y.
  const t = screenToTexel(110, 120, p);
  assert.ok(Math.abs(t.x - 50) < 1e-9);
  assert.ok(Math.abs(t.y - 25) < 1e-9);
});

test("screenRectToTexelRect returns an inclusive, clamped integer rect", () => {
  // Drag from client (30,90) → (150,150): x 10..70, y 10..40 (all in-bounds).
  const r = screenRectToTexelRect(30, 90, 150, 150, p)!;
  assert.deepEqual(r, { x0: 10, y0: 10, x1: 70, y1: 40 });
});

test("screenRectToTexelRect normalizes inverted drags (bottom-right → top-left)", () => {
  const a = screenRectToTexelRect(30, 90, 150, 150, p)!;
  const b = screenRectToTexelRect(150, 150, 30, 90, p)!;
  assert.deepEqual(a, b);
});

test("screenRectToTexelRect clamps a rect that spills past the image edges", () => {
  // Way outside on the right/bottom → clamped to the last texel (99,49).
  const r = screenRectToTexelRect(150, 120, 9999, 9999, p)!;
  assert.equal(r.x1, 99);
  assert.equal(r.y1, 49);
});

test("screenRectToTexelRect returns null for a rect entirely outside the image", () => {
  // Far left of the image (image spans client x in [10,210], texels via scale):
  // a tiny rect at client x≈0 maps to negative texels only.
  const r = screenRectToTexelRect(-500, -500, -400, -400, p);
  assert.equal(r, null);
});

test("screenToTexel honors a GPU sourceWindow crop (uvRect)", () => {
  // Displaying only the right half [0.5,1] of a 100-wide source into the box:
  // srcOriginX = 50, visibleW = 50. scale = min(200/50, 200/50)=4; dispW=dispH=200;
  // imgLeft=10, imgTop=20. client (10,20) → texel (50, 0).
  const t = screenToTexel(10, 20, {
    box,
    naturalWidth: 100,
    naturalHeight: 50,
    sourceWindow: { x: 0.5, y: 0, w: 0.5, h: 1 },
  });
  assert.ok(Math.abs(t.x - 50) < 1e-9);
  assert.ok(Math.abs(t.y - 0) < 1e-9);
});
