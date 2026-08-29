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

test("FLIP mode selects an internal implementation only for float sources", () => {
  assert.equal(resolveComparisonOperationId("flip", true), "hdr-flip");
  assert.equal(resolveComparisonOperationId("flip", true, "hdr"), "hdr-flip");
  assert.equal(resolveComparisonOperationId("flip", true, "sdr"), "flip-sdr-float");
  assert.equal(resolveComparisonOperationId("flip", false, "hdr"), "flip");
  assert.equal(resolveComparisonOperationId("flip", false, "sdr"), "flip");
});
