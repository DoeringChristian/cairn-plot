import { test } from "node:test";
import assert from "node:assert/strict";

import {
  listComparisonOperationOptions,
  resolveComparisonOperationId,
} from "./comparison-operations.ts";

test("FLIP is one public comparison operation", () => {
  const ids = listComparisonOperationOptions().map(({ id }) => id);
  assert.equal(ids.filter((id) => id === "flip").length, 1);
  assert.equal(ids.includes("hdr-flip"), false);
});

test("FLIP mode selects an implementation without source-storage branching", () => {
  assert.equal(resolveComparisonOperationId("flip"), "hdr-flip");
  assert.equal(resolveComparisonOperationId("flip", "hdr"), "hdr-flip");
  assert.equal(resolveComparisonOperationId("flip", "sdr"), "flip-sdr");
});
