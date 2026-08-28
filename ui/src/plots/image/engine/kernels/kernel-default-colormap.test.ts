/** Comparison display policy is global display state, not kernel metadata. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIFF_ENCODING, listDiffKernels } from "./index.ts";
import { getContentOp } from "../../model/content-ops/index.ts";
import { getEncoding } from "../../model/encodings/index.ts";

test("the shared comparison default is the registered Linear display operation", () => {
  assert.equal(DEFAULT_DIFF_ENCODING, "linear");
  assert.equal(getEncoding(DEFAULT_DIFF_ENCODING)?.id, "linear");
});

test("kernels do not own colormap defaults", () => {
  for (const kernel of listDiffKernels()) {
    assert.equal("defaultColormap" in kernel, false, `${kernel.id} must not own display policy`);
  }
});

test("every diff content op uses the shared default", () => {
  for (const kernel of listDiffKernels()) {
    const op = getContentOp(kernel.id);
    if (op) assert.equal(op.defaultEncoding, DEFAULT_DIFF_ENCODING);
  }
});
