/** Comparison display policy is global display state, not kernel metadata. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COMPARISON_DISPLAY_OPERATION_ID, getEncoding } from "../../model/encodings/index.ts";

test("the shared comparison default is the registered Linear display operation", () => {
  assert.equal(DEFAULT_COMPARISON_DISPLAY_OPERATION_ID, "linear");
  assert.equal(getEncoding(DEFAULT_COMPARISON_DISPLAY_OPERATION_ID)?.id, "linear");
});
