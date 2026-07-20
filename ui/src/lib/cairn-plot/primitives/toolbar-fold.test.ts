/**
 * Pure unit tests for the toolbar fold decision. Runs under Node's built-in
 * test runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/primitives/toolbar-fold.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeToolbarFold,
  selectedMenuIndex,
  TOOLBAR_FOLD_SAFETY_PX,
} from "./toolbar-fold.ts";

test("folds when the pane is narrower than the expanded toolbar + safety", () => {
  // expanded toolbar is 200px; pane is 150px -> must fold.
  assert.equal(computeToolbarFold(150, 200, false), true);
});

test("stays expanded when the pane comfortably fits the toolbar", () => {
  assert.equal(computeToolbarFold(400, 200, false), false);
});

test("the safety gap is required beyond the raw expanded width", () => {
  // pane exactly equals expanded width -> still folds (needs +safety).
  assert.equal(computeToolbarFold(200, 200, false), true);
  // pane equals expanded width + safety -> just fits, stays expanded.
  assert.equal(computeToolbarFold(200 + TOOLBAR_FOLD_SAFETY_PX, 200, false), false);
});

test("holds the current state when no expanded width is measured yet", () => {
  assert.equal(computeToolbarFold(150, 0, false), false);
  assert.equal(computeToolbarFold(150, 0, true), true);
});

test("holds the current state when the container width is unknown", () => {
  assert.equal(computeToolbarFold(0, 200, true), true);
  assert.equal(computeToolbarFold(0, 200, false), false);
});

test("no oscillation at the boundary: a folded toolbar only unfolds past the threshold", () => {
  const expanded = 260;
  // Folded, pane grows to exactly the threshold -> still folded (needs to
  // exceed it). The caller keeps `expanded` cached while folded, so this is a
  // stable comparison, not a re-measurement of the collapsed "⋯" button.
  assert.equal(computeToolbarFold(expanded, expanded, true), true);
  assert.equal(computeToolbarFold(expanded + TOOLBAR_FOLD_SAFETY_PX, expanded, true), false);
});

const opts = [{ id: "flip" }, { id: "absolute" }, { id: "ssim" }];

test("selectedMenuIndex returns the matching option's index", () => {
  assert.equal(selectedMenuIndex(opts, "flip"), 0);
  assert.equal(selectedMenuIndex(opts, "absolute"), 1);
  assert.equal(selectedMenuIndex(opts, "ssim"), 2);
});

test("selectedMenuIndex clamps a non-matching value to 0 (never -1)", () => {
  assert.equal(selectedMenuIndex(opts, "does-not-exist"), 0);
  assert.equal(selectedMenuIndex(opts, ""), 0);
});

test("selectedMenuIndex is 0 for an empty option list", () => {
  assert.equal(selectedMenuIndex([], "anything"), 0);
});
