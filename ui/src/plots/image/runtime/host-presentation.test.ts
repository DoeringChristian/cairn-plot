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
    cellDefaults: {},
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
  assert.equal((difference.comparison as { defaultOperation: string }).defaultOperation, "signed");
  assert.equal("colormap" in (difference.comparison as object), false);
  assert.equal("onComparisonOperationChange" in (difference.comparison as object), false);
  assert.equal("syncedSettings" in split, false);
});
