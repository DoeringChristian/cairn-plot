import assert from "node:assert/strict";
import test from "node:test";

import { composeImageComparisonPresentation } from "./host-presentation.ts";

const leaf = {
  kind: "plot" as const,
  type: "image",
  data: { kind: "image" as const, hash: "reference" },
};

test("comparison composition changes image operationeration without choosing an encoding", () => {
  const resolved = {
    source: { dtype: "uint8" as const, url: "reference.png" },
    __diffB: { dtype: "uint8" as const, url: "foreground.png" },
    __diffContentKeyA: "reference",
    __diffContentKeyB: "foreground",
  };
  const base = {
    node: {
      kind: "compare" as const,
      operands: [leaf.data, { kind: "image" as const, hash: "foreground" }],
    },
    colormap: "turbo" as const,
    cellDefaults: {},
    splitPosition: 0.5,
    inStackedGrid: true,
    inOverlay: false,
    onComparisonOperationChange: () => {},
    onCompareModeChange: () => {},
    onSplitPositionChange: () => {},
    compareModified: false,
  };
  const split = composeImageComparisonPresentation({
    leaf,
    resolved,
    comparison: { ...base, mode: "split", comparisonOperationId: "absolute" },
    enlargeControl: { enlarged: false, setEnlarged: () => {} },
  });
  const difference = composeImageComparisonPresentation({
    leaf,
    resolved,
    comparison: { ...base, mode: "diff", comparisonOperationId: "signed" },
    enlargeControl: { enlarged: false, setEnlarged: () => {} },
  });
  assert.equal((split.compareSource as { colormap: string }).colormap, "turbo");
  assert.equal((difference.compareSource as { colormap: string }).colormap, "turbo");
  assert.equal((split.compareSource as { mode: string }).mode, "split");
  assert.equal((difference.compareSource as { opId: string }).opId, "signed");
  assert.equal("syncedSettings" in split, false);
});
