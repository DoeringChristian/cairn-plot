import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnchoredPosition, type Rect } from "./toolbar-popover.ts";

const VIEW = { width: 1000, height: 800 };

// A small trigger button near the top of the viewport.
const topTrigger: Rect = { left: 100, right: 130, top: 20, bottom: 42 };

test("opens BELOW the trigger by default, left-aligned", () => {
  const p = computeAnchoredPosition(topTrigger, { width: 120, height: 150 }, VIEW, "left");
  assert.equal(p.flipped, false);
  assert.equal(p.top, 42 + 4); // trigger.bottom + gap
  assert.equal(p.left, 100); // trigger.left
});

test("right-align anchors the popover's RIGHT edge to the trigger's right", () => {
  const p = computeAnchoredPosition(topTrigger, { width: 120, height: 150 }, VIEW, "right");
  assert.equal(p.left, 130 - 120); // trigger.right - width
});

test("FLIPS above when it does not fit below and there is more room above", () => {
  // Trigger near the bottom: little room below, lots above.
  const low: Rect = { left: 100, right: 130, top: 700, bottom: 722 };
  const p = computeAnchoredPosition(low, { width: 120, height: 300 }, VIEW, "left");
  assert.equal(p.flipped, true);
  assert.equal(p.top, 700 - 4 - 300); // trigger.top - gap - height
});

test("does NOT flip when it fits below even if near bottom", () => {
  const low: Rect = { left: 100, right: 130, top: 700, bottom: 722 };
  const p = computeAnchoredPosition(low, { width: 120, height: 60 }, VIEW, "left");
  assert.equal(p.flipped, false);
  assert.equal(p.top, 722 + 4);
});

test("clamps horizontally so a wide popover never runs off the right edge", () => {
  const nearRight: Rect = { left: 950, right: 980, top: 20, bottom: 42 };
  const p = computeAnchoredPosition(nearRight, { width: 200, height: 100 }, VIEW, "left");
  assert.equal(p.left, VIEW.width - 200 - 4); // clamped to viewport.width - width - gap
});

test("clamps left edge to the gap (never negative)", () => {
  const nearLeft: Rect = { left: 2, right: 30, top: 20, bottom: 42 };
  const p = computeAnchoredPosition(nearLeft, { width: 200, height: 100 }, VIEW, "right");
  // right-align would put it at 30-200 = -170; clamp to gap.
  assert.equal(p.left, 4);
});

test("a popover taller than the viewport pins to the top gap (relies on max-h scroll)", () => {
  const p = computeAnchoredPosition(topTrigger, { width: 120, height: 2000 }, VIEW, "left");
  assert.equal(p.top, 4);
});
