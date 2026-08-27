/** Diff colormap policy is global display state, not kernel metadata. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIFF_COLORMAP, listDiffKernels } from "./index.ts";
import { getContentOp } from "../../image/content-ops/index.ts";
import { COLORMAP_NAMES } from "../../colormaps/lut.ts";

test("the shared diff default is a registered colormap", () => {
  assert.ok((COLORMAP_NAMES as readonly string[]).includes(DEFAULT_DIFF_COLORMAP));
});

test("kernels do not own colormap defaults", () => {
  for (const kernel of listDiffKernels()) {
    assert.equal("defaultColormap" in kernel, false, `${kernel.id} must not own display policy`);
  }
});

test("every diff content op uses the shared default", () => {
  for (const kernel of listDiffKernels()) {
    const op = getContentOp(kernel.id);
    if (op) assert.equal(op.defaultEncoding, DEFAULT_DIFF_COLORMAP);
  }
});
