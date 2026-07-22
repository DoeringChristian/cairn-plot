/**
 * Node test: EVERY registered diff kernel declares a valid result `output`
 * arity, and the FLIP family is `"scalar"` while the six pointwise diffs are
 * `"per-channel"`. This arity is what the diff-mode TEV overlay reads to decide
 * how many numbers to print — a FLIP kernel produces ONE metric per pixel, so
 * printing three channel-tinted numbers (the reported bug) is wrong.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/engine/kernels/kernel-arity.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listDiffKernels, getDiffKernel } from "./index.ts";

test("every registered kernel declares a valid output arity", () => {
  const kernels = listDiffKernels();
  assert.ok(kernels.length >= 8, "expected the six pointwise diffs + the FLIP family");
  for (const k of kernels) {
    assert.ok(
      k.output === "scalar" || k.output === "per-channel",
      `kernel "${k.id}" has invalid output arity ${JSON.stringify(k.output)}`,
    );
  }
});

test("the FLIP family is scalar, the pointwise diffs are per-channel", () => {
  const scalar = ["flip", "flip-ldr-forced", "hdr-flip", "ssim"];
  const perChannel = [
    "signed",
    "absolute",
    "squared",
    "relative_signed",
    "relative_absolute",
    "relative_squared",
  ];
  for (const id of scalar) {
    assert.equal(getDiffKernel(id)?.output, "scalar", `${id} must be scalar`);
  }
  for (const id of perChannel) {
    assert.equal(getDiffKernel(id)?.output, "per-channel", `${id} must be per-channel`);
  }
});
