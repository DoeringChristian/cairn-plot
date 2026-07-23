/**
 * Unit tests for the pure region-rect edit math (region-edit.ts) — move/resize
 * clamped to image bounds + min size, and screen-space handle hit-testing.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/region-edit.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRectEdit, hitTestRect } from "./region-edit.ts";

const bounds = { w: 100, h: 80 };
const rect = { x0: 10, y0: 10, x1: 40, y1: 30 };

test("move translates the rect and preserves its size", () => {
  const r = applyRectEdit(rect, "move", 5, -4, bounds);
  assert.deepEqual(r, { x0: 15, y0: 6, x1: 45, y1: 26 });
});

test("move clamps so the rect stays fully inside the image", () => {
  const r = applyRectEdit(rect, "move", 1000, 1000, bounds);
  // size preserved (30x20), pinned to the bottom-right corner.
  assert.deepEqual(r, { x0: 69, y0: 59, x1: 99, y1: 79 });
});

test("resize se moves the far corner, clamped to the image", () => {
  const r = applyRectEdit(rect, "se", 1000, 1000, bounds);
  assert.deepEqual(r, { x0: 10, y0: 10, x1: 99, y1: 79 });
});

test("resize nw moves the near corner", () => {
  const r = applyRectEdit(rect, "nw", -5, -6, bounds);
  assert.deepEqual(r, { x0: 5, y0: 4, x1: 40, y1: 30 });
});

test("resize e enforces the minimum inclusive size (does not cross the pivot)", () => {
  const r = applyRectEdit(rect, "e", -1000, 0, { w: 100, h: 80 }, 3);
  // x1 can't go below x0 + (minSize-1) = 10 + 2 = 12.
  assert.equal(r.x1, 12);
  assert.equal(r.x0, 10);
});

test("resize n clamps to the top edge (0)", () => {
  const r = applyRectEdit(rect, "n", 0, -1000, bounds);
  assert.equal(r.y0, 0);
  assert.equal(r.y1, 30);
});

test("edge resize only moves its own axis", () => {
  const r = applyRectEdit(rect, "e", 7, 999, bounds);
  assert.deepEqual(r, { x0: 10, y0: 10, x1: 47, y1: 30 });
});

// --- hit-testing (screen space) -------------------------------------------
const box = { left: 100, top: 50, width: 80, height: 40 }; // right=180, bottom=90
const pad = 8;

test("hitTestRect detects corners (corner wins over edge)", () => {
  assert.equal(hitTestRect(box, 100, 50, pad), "nw");
  assert.equal(hitTestRect(box, 180, 50, pad), "ne");
  assert.equal(hitTestRect(box, 100, 90, pad), "sw");
  assert.equal(hitTestRect(box, 180, 90, pad), "se");
});

test("hitTestRect detects edges", () => {
  assert.equal(hitTestRect(box, 140, 50, pad), "n");
  assert.equal(hitTestRect(box, 140, 90, pad), "s");
  assert.equal(hitTestRect(box, 100, 70, pad), "w");
  assert.equal(hitTestRect(box, 180, 70, pad), "e");
});

test("hitTestRect returns 'move' for the interior and null well outside", () => {
  assert.equal(hitTestRect(box, 140, 70, pad), "move");
  assert.equal(hitTestRect(box, 300, 300, pad), null);
});

test("hitTestRect honors a larger coarse-pointer pad", () => {
  // 12px left of the left edge, mid-height (clear of both corners): a miss at
  // pad=8, a west-edge hit at pad=14.
  assert.equal(hitTestRect(box, 88, 70, 8), null);
  assert.equal(hitTestRect(box, 88, 70, 14), "w");
});
