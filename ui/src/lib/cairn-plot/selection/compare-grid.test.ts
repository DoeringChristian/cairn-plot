/**
 * Pure unit tests for the selection-stage planner (`compare-grid.ts`). Runs
 * under Node's built-in test runner with TypeScript type-stripping — no DOM/
 * React (the module is framework-free):
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/selection/compare-grid.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gridColumns,
  planCompareGrid,
  imageCompatibleCount,
  type SelEntry,
} from "./compare-grid.ts";

const img = (paneId: string): SelEntry => ({ paneId, imageCompatible: true });
const other = (paneId: string): SelEntry => ({ paneId, imageCompatible: false });

test("gridColumns is ceil(sqrt(N)) — roughly square, clamped to >=1", () => {
  assert.equal(gridColumns(0), 1);
  assert.equal(gridColumns(1), 1);
  assert.equal(gridColumns(2), 2);
  assert.equal(gridColumns(3), 2);
  assert.equal(gridColumns(4), 2);
  assert.equal(gridColumns(5), 3);
  assert.equal(gridColumns(9), 3);
  assert.equal(gridColumns(10), 4);
  assert.equal(gridColumns(16), 4);
});

test("planCompareGrid: N image panes -> N-1 comparisons, each vs the reference", () => {
  const plan = planCompareGrid([img("a"), img("b"), img("c")], "c");
  assert.equal(plan.referenceId, "c");
  assert.deepEqual(
    plan.pairs.map((p) => p.foregroundId),
    ["a", "b"],
    "every non-reference image is compared, in selection order",
  );
  assert.ok(plan.pairs.every((p) => p.referenceId === "c"));
});

test("planCompareGrid: exactly 2 image panes -> 1 comparison", () => {
  const plan = planCompareGrid([img("a"), img("b")], "b");
  assert.equal(plan.referenceId, "b");
  assert.deepEqual(plan.pairs, [{ foregroundId: "a", referenceId: "b" }]);
});

test("planCompareGrid: 3D/chart panes are ignored (image-only)", () => {
  // b is a 3D/chart pane; only a and c are image-compatible.
  const plan = planCompareGrid([img("a"), other("b"), img("c")], "c");
  assert.equal(plan.referenceId, "c");
  assert.deepEqual(
    plan.pairs.map((p) => p.foregroundId),
    ["a"],
    "only the image-compatible non-reference pane forms a comparison",
  );
});

test("planCompareGrid: fewer than two image panes -> no comparisons", () => {
  assert.deepEqual(planCompareGrid([img("a"), other("b")], "a"), {
    referenceId: null,
    pairs: [],
  });
  assert.deepEqual(planCompareGrid([], null), { referenceId: null, pairs: [] });
});

test("planCompareGrid: a non-image requested reference falls back to the last image pane", () => {
  // Reference is the (non-image) 'b'; the effective reference becomes the last
  // image-compatible entry 'c'.
  const plan = planCompareGrid([img("a"), img("c"), other("b")], "b");
  assert.equal(plan.referenceId, "c");
  assert.deepEqual(
    plan.pairs.map((p) => p.foregroundId),
    ["a"],
  );
});

test("planCompareGrid: re-picking the reference recomputes the comparisons", () => {
  const entries = [img("a"), img("b"), img("c")];
  const first = planCompareGrid(entries, "c");
  assert.deepEqual(first.pairs.map((p) => p.foregroundId), ["a", "b"]);
  // Re-pick 'a' as the reference: now b and c are compared against a.
  const second = planCompareGrid(entries, "a");
  assert.equal(second.referenceId, "a");
  assert.deepEqual(second.pairs.map((p) => p.foregroundId), ["b", "c"]);
  assert.ok(second.pairs.every((p) => p.referenceId === "a"));
});

test("imageCompatibleCount counts only image-compatible entries", () => {
  assert.equal(imageCompatibleCount([img("a"), other("b"), img("c")]), 2);
  assert.equal(imageCompatibleCount([other("a"), other("b")]), 0);
});
