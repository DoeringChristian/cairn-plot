/**
 * Node test: `computeCompareMapping` — the pure align/fit overlap math that the
 * diff compute, metrics reduction and pane framing all share.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/engine/compare-align.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompareMapping, mappingKey, type CompareAlign } from "./compare-align.ts";

const A = { w: 160, h: 120 }; // reference (a) — wider & taller here
const B = { w: 96, h: 64 }; // foreground/primary (b) — smaller

test("top-left crop = legacy behavior: min-crop, zero offsets", () => {
  const m = computeCompareMapping(A, B, "top-left", "crop", "b");
  assert.deepEqual(m.result, { w: 96, h: 64 }); // min(A,B)
  assert.deepEqual(m.offsetA, { x: 0, y: 0 });
  assert.deepEqual(m.offsetB, { x: 0, y: 0 });
  assert.equal(m.fit, "crop");
});

test("equal-size pair: identity mapping under every align", () => {
  const S = { w: 128, h: 96 };
  for (const align of ["top-left", "center", "top-right", "bottom-left", "bottom-right"] as CompareAlign[]) {
    const m = computeCompareMapping(S, S, align, "crop", "b");
    assert.deepEqual(m.result, S);
    assert.deepEqual(m.offsetA, { x: 0, y: 0 });
    assert.deepEqual(m.offsetB, { x: 0, y: 0 });
  }
});

test("center crop: the smaller extent sits centered inside the larger", () => {
  const m = computeCompareMapping(A, B, "center", "crop", "b");
  assert.deepEqual(m.result, { w: 96, h: 64 });
  // A is larger on both axes → centered offset = floor((A - overlap)/2).
  assert.deepEqual(m.offsetA, { x: Math.floor((160 - 96) / 2), y: Math.floor((120 - 64) / 2) }); // {32, 28}
  // B == overlap on both axes → offset 0 (the smaller extent).
  assert.deepEqual(m.offsetB, { x: 0, y: 0 });
});

test("bottom-right crop: overlap anchored to each source's bottom-right", () => {
  const m = computeCompareMapping(A, B, "bottom-right", "crop", "b");
  assert.deepEqual(m.offsetA, { x: 160 - 96, y: 120 - 64 }); // {64, 56}
  assert.deepEqual(m.offsetB, { x: 0, y: 0 });
});

test("top-right / bottom-left crop: anchor one axis each", () => {
  const tr = computeCompareMapping(A, B, "top-right", "crop", "b");
  assert.deepEqual(tr.offsetA, { x: 160 - 96, y: 0 });
  const bl = computeCompareMapping(A, B, "bottom-left", "crop", "b");
  assert.deepEqual(bl.offsetA, { x: 0, y: 120 - 64 });
});

test("mixed dims (A wider, B taller): overlap = min per-axis, per-source centered offsets", () => {
  const wide = { w: 200, h: 50 };
  const tall = { w: 40, h: 100 };
  const m = computeCompareMapping(wide, tall, "center", "crop", "b");
  assert.deepEqual(m.result, { w: 40, h: 50 }); // min widths, min heights
  // wide: x centered (200-40)/2=80, y 0 (50 == overlap.h)
  assert.deepEqual(m.offsetA, { x: 80, y: 0 });
  // tall: x 0 (40 == overlap.w), y centered (100-50)/2=25
  assert.deepEqual(m.offsetB, { x: 0, y: 25 });
});

test("fill: result = PRIMARY dims, zero offsets, align irrelevant", () => {
  for (const align of ["top-left", "center", "bottom-right"] as CompareAlign[]) {
    const mb = computeCompareMapping(A, B, align, "fill", "b");
    assert.deepEqual(mb.result, B); // primary = b
    assert.deepEqual(mb.offsetA, { x: 0, y: 0 });
    assert.deepEqual(mb.offsetB, { x: 0, y: 0 });
    assert.equal(mb.fit, "fill");
    const ma = computeCompareMapping(A, B, align, "fill", "a");
    assert.deepEqual(ma.result, A); // primary = a
  }
});

test("mappingKey distinguishes align + fit variants", () => {
  const tl = mappingKey(computeCompareMapping(A, B, "top-left", "crop", "b"));
  const c = mappingKey(computeCompareMapping(A, B, "center", "crop", "b"));
  const f = mappingKey(computeCompareMapping(A, B, "center", "fill", "b"));
  assert.notEqual(tl, c);
  assert.notEqual(c, f);
  // stable/deterministic
  assert.equal(c, mappingKey(computeCompareMapping(A, B, "center", "crop", "b")));
});
