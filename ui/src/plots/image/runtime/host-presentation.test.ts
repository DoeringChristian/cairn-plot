import assert from "node:assert/strict";
import test from "node:test";

import { composeImageComparisonPresentation } from "./host-presentation.ts";

const leaf = {
  kind: "plot" as const,
  type: "image",
  data: { kind: "image" as const, hash: "reference" },
};

test("comparison composition contains only semantic comparison content", () => {
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
    // Deliberately DIFFERENT from `props.operation` below: the props are the
    // pre-builder authoring, the settings seed is what HOME actually means.
    cellDefaults: { "compare.operation": "flip-hdr", "compare.split": 0.3 },
  };
  const split = composeImageComparisonPresentation({
    leaf,
    resolved,
    comparison: base,
  });
  const difference = composeImageComparisonPresentation({
    leaf,
    resolved,
    comparison: {
      ...base,
      node: { ...base.node, presentation: "difference" as const, props: { operation: "signed" } },
    },
  });
  assert.equal((split.comparison as { presentation: string }).presentation, "split");
  assert.equal((difference.comparison as { presentation: string }).presentation, "difference");
  // HOME passes through the cell's settings seed, NOT `node.props`: the public
  // builders move the authored operation/split into `compare.*` before emission.
  assert.deepEqual(
    (difference.comparison as { cellDefaults: unknown }).cellDefaults,
    { "compare.operation": "flip-hdr", "compare.split": 0.3 },
  );
  assert.equal("defaultOperation" in (difference.comparison as object), false);
  assert.equal("colormap" in (difference.comparison as object), false);
  assert.equal("onComparisonOperationChange" in (difference.comparison as object), false);
  assert.equal("syncedSettings" in split, false);
});
