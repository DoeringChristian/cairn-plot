/**
 * The ONE comparison-selection resolution, tested behaviourally.
 *
 * `resolveComparisonSelection` is the single place the raw store selection, the
 * authored HOME defaults (the cell defaults the host already computes) and the
 * ACTIVE backend's capabilities are folded into what a pane renders. Both
 * callers — the host adapter (`runtime/view.tsx`) and the offscreen compositor
 * (`runtime/compare-compositor.tsx`) — go through it, so these cases pin the
 * behaviour for both without importing either `.tsx`.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/runtime/comparison-selection.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { defineImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { comparisonMenuOptions } from "./comparison-menu.ts";
import { resolveComparisonSelection } from "./comparison-selection.ts";

/** A backend that advertises the FULL public catalogue (both real backends do). */
const FULL = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});

/** A hypothetical backend without HDR-FLIP — the capability-fallback case. */
const NO_HDR_FLIP = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS.filter((id) => id !== "flip-hdr"),
  displayOperations: DISPLAY_OPERATION_IDS,
});

const FULL_OPTIONS = comparisonMenuOptions(FULL);
const NO_HDR_FLIP_OPTIONS = comparisonMenuOptions(NO_HDR_FLIP);

test("HOME of an authored flip-hdr / split-0.3 node is NOT modified", () => {
  const selection = resolveComparisonSelection({
    // At HOME the store holds exactly what the cell defaults seeded.
    selected: "flip-hdr",
    presentation: "difference",
    cellDefaults: { "compare.operation": "flip-hdr", "compare.split": 0.3 },
    splitSetting: 0.3,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.authoredDefault, "flip-hdr");
  assert.equal(selection.defaultSplit, 0.3);
  assert.equal(selection.raw, "flip-hdr");
  assert.equal(selection.effective, "flip-hdr");
  assert.equal(selection.operationId, "flip-hdr");
  assert.equal(selection.mode, "diff");
  assert.equal(selection.fallback, null);
  assert.equal(selection.compareModified, false);
});

test("HOME of an authored flip-hdr node with no stored selection is NOT modified", () => {
  const selection = resolveComparisonSelection({
    selected: undefined,
    presentation: "difference",
    cellDefaults: { "compare.operation": "flip-hdr", "compare.split": 0.3 },
    splitSetting: undefined,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.raw, "flip-hdr");
  assert.equal(selection.compareModified, false);
});

test("a user operation change is modified", () => {
  const selection = resolveComparisonSelection({
    selected: "absolute",
    presentation: "difference",
    cellDefaults: { "compare.operation": "flip-hdr", "compare.split": 0.3 },
    splitSetting: 0.3,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.raw, "absolute");
  assert.equal(selection.effective, "absolute");
  assert.equal(selection.compareModified, true);
});

test("a user split change is modified", () => {
  const selection = resolveComparisonSelection({
    selected: "flip-hdr",
    presentation: "difference",
    cellDefaults: { "compare.operation": "flip-hdr", "compare.split": 0.3 },
    splitSetting: 0.6,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.compareModified, true);
});

test("an unsupported selection renders split, keeps the raw id, and reports the fallback", () => {
  const selection = resolveComparisonSelection({
    selected: "flip-hdr",
    presentation: "difference",
    cellDefaults: { "compare.operation": "flip-hdr" },
    splitSetting: undefined,
    options: NO_HDR_FLIP_OPTIONS,
    capabilities: NO_HDR_FLIP,
  });
  assert.equal(selection.raw, "flip-hdr", "the store selection is never rewritten by a projection");
  assert.equal(selection.effective, "split");
  assert.equal(selection.mode, "split");
  assert.deepEqual(selection.fallback, {
    kind: "comparison",
    requested: "flip-hdr",
    effective: "split",
  });
  // The seeded kernel a switch INTO diff would restore must be one the menu
  // actually offers — never the unsupported id, and never something absent.
  assert.ok(
    NO_HDR_FLIP_OPTIONS.some((option) => option.id === selection.operationId),
    `operationId ${selection.operationId} must be a member of operationOptions`,
  );
  assert.equal(selection.compareModified, false, "a projection is not a user change");
});

test("empty options degrade to split", () => {
  const selection = resolveComparisonSelection({
    selected: "absolute",
    presentation: "difference",
    cellDefaults: {},
    splitSetting: undefined,
    options: [],
    capabilities: FULL,
  });
  assert.equal(selection.operationId, "split");
  assert.equal(selection.mode, "split");
});

test("presentation split with no selection is split", () => {
  const selection = resolveComparisonSelection({
    selected: undefined,
    presentation: "split",
    cellDefaults: {},
    splitSetting: undefined,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.raw, "split");
  assert.equal(selection.effective, "split");
  assert.equal(selection.mode, "split");
  assert.equal(selection.authoredDefault, "split");
  assert.equal(selection.defaultSplit, 0.5);
  assert.equal(selection.compareModified, false);
  assert.ok(
    FULL_OPTIONS.some((option) => option.id === selection.operationId),
    "split still seeds a real diff kernel for a switch into diff",
  );
});

test("a difference presentation with no defaults falls back to the first offered operation", () => {
  const selection = resolveComparisonSelection({
    selected: undefined,
    presentation: "difference",
    cellDefaults: {},
    splitSetting: undefined,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.authoredDefault, FULL_OPTIONS[0]!.id);
  assert.equal(selection.raw, FULL_OPTIONS[0]!.id);
  assert.equal(selection.mode, "diff");
  assert.equal(selection.compareModified, false);
});

test("split selected over a difference default is a user change", () => {
  const selection = resolveComparisonSelection({
    selected: "split",
    presentation: "difference",
    cellDefaults: { "compare.operation": "absolute" },
    splitSetting: undefined,
    options: FULL_OPTIONS,
    capabilities: FULL,
  });
  assert.equal(selection.mode, "split");
  assert.equal(selection.compareModified, true);
  assert.equal(selection.authoredDefault, "absolute");
});
