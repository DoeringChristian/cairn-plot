import { test } from "node:test";
import assert from "node:assert/strict";
import {
  axisValueAt,
  panAxis,
  sliceAxis,
  zoomAxis,
  type AxisDomain,
} from "./axis-space.ts";

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} !== ${b}`);

// ---------------------------------------------------------------------------
// The screen is uniform in MAPPED space: on a log axis the middle pixel is the
// geometric mean of the bounds, not the arithmetic one. Every gesture below is
// expressed as a screen FRACTION, so all of them inherit that rule.
// ---------------------------------------------------------------------------

test("the value under a screen fraction follows the axis mapping", () => {
  close(axisValueAt([0, 100], 0.5, "linear"), 50);
  // [1, 1000] on a log axis: mid-screen is 10^1.5 ≈ 31.62, NOT 500.5.
  close(axisValueAt([1, 1000], 0.5, "log"), Math.sqrt(1 * 1000));
  close(axisValueAt([1, 1000], 1 / 3, "log"), 10);
});

test("zoom keeps the value under the cursor pinned — linear", () => {
  const [lo, hi] = zoomAxis([0, 100], 0.25, 0.5, "linear");
  close(axisValueAt([lo, hi], 0.25, "linear"), 25);
  close(hi - lo, 50);
});

test("zoom keeps the value under the cursor pinned — log", () => {
  const domain: [number, number] = [1, 1000];
  const anchorFrac = 0.25;
  const anchor = axisValueAt(domain, anchorFrac, "log");
  const [lo, hi] = zoomAxis(domain, anchorFrac, 0.5, "log");
  // The anchor is still under the same pixel...
  close(axisValueAt([lo, hi], anchorFrac, "log"), anchor);
  // ...and the span halved in DECADES, not in raw units.
  close(Math.log10(hi) - Math.log10(lo), (Math.log10(1000) - Math.log10(1)) / 2);
});

test("a log axis never zooms out to a non-positive bound", () => {
  // The linear-space bug: 1 - 4*(1000-1)/2 is deeply negative, which a log
  // axis cannot render at all.
  const [lo, hi] = zoomAxis([1, 1000], 0.5, 4, "log");
  assert.ok(lo > 0, `lo must stay positive, got ${lo}`);
  assert.ok(hi > lo);
});

test("pan translates in mapped space — a log pan is multiplicative", () => {
  close(panAxis([0, 100], 0.25, "linear")[0], -25);
  // Dragging a log axis by a third of the plot width shifts it one decade.
  const [lo, hi] = panAxis([1, 1000], 1 / 3, "log");
  close(lo, 0.1);
  close(hi, 100);
  assert.ok(lo > 0);
});

test("pan preserves the span in mapped space, at every offset", () => {
  const [lo, hi] = panAxis([1, 1000], -0.75, "log");
  close(Math.log10(hi) - Math.log10(lo), 3);
  assert.ok(lo > 0);
});

test("box zoom maps the dragged fractions through the scale", () => {
  const linear = sliceAxis([0, 100], 0.25, 0.75, "linear");
  close(linear[0], 25);
  close(linear[1], 75);
  // Selecting the middle third of a 3-decade log axis yields exactly [10, 100].
  const log = sliceAxis([1, 1000], 1 / 3, 2 / 3, "log");
  close(log[0], 10);
  close(log[1], 100);
});

test("a non-positive LOWER bound on a log axis still yields a positive window", () => {
  // Auto domains follow the data extent, and a metric that logged a zero (or a
  // negative) hands us a domain a log axis cannot place. As long as the upper
  // bound is positive there is a renderable window, and gestures must produce
  // a strictly positive, ordered domain rather than NaN.
  for (const domain of [[0, 100], [-5, 100]] as [number, number][]) {
    const zoomed = zoomAxis(domain, 0.5, 0.5, "log");
    const panned = panAxis(domain, 0.2, "log");
    const sliced = sliceAxis(domain, 0.1, 0.9, "log");
    for (const [lo, hi] of [zoomed, panned, sliced]) {
      assert.ok(Number.isFinite(lo) && Number.isFinite(hi), `${lo}..${hi}`);
      assert.ok(lo > 0, `lo must stay positive, got ${lo}`);
      assert.ok(hi > lo, `${lo} !< ${hi}`);
    }
  }
});

test("a log domain with no positive part leaves gestures inert", () => {
  // Nothing here is renderable on a log axis; a gesture must not invent a
  // window, it simply has nothing to act on.
  const domain: AxisDomain = [-10, -1];
  assert.deepEqual(zoomAxis(domain, 0.5, 0.5, "log"), domain);
  assert.deepEqual(panAxis(domain, 0.2, "log"), domain);
  assert.deepEqual(sliceAxis(domain, 0.1, 0.9, "log"), domain);
});

test("a degenerate or non-finite domain is left alone", () => {
  assert.deepEqual(zoomAxis([5, 5], 0.5, 0.5, "linear"), [5, 5]);
  assert.deepEqual(panAxis([Number.NaN, 1], 0.5, "linear"), [Number.NaN, 1]);
});
