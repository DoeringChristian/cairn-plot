/**
 * Node test: EVERY registered diff kernel declares a valid result `output`
 * arity, and the FLIP family is `"scalar"` while the six pointwise diffs are
 * `"per-channel"`. This arity is what the diff-mode TEV overlay reads to decide
 * how many numbers to print — a FLIP kernel produces ONE metric per pixel, so
 * printing three channel-tinted numbers (the reported bug) is wrong.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/engine/kernels/kernel-arity.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listDiffKernels, getDiffKernel } from "./index.ts";
import { getImageOperation, listImageOperations } from "../../model/content-ops/index.ts";

test("every registered kernel declares a valid output arity", () => {
  const kernels = listDiffKernels();
  assert.ok(kernels.length >= 4, "expected the multipass FLIP/SSIM implementations");
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
    const operation = getImageOperation(id);
    assert.ok(operation?.implementation.kind === "inline", `${id} must be an inline image operation`);
    assert.equal(operation.outputArity, 1, `${id} exposes scalar display gating while retaining channel values`);
  }
});

test("pointwise differences exist only in the image-operation registry", () => {
  const pointwise = listImageOperations().filter(
    (operation) => operation.implementation.kind === "inline" && operation.inputCount === 2 && operation.outputArity === 1,
  );
  assert.equal(pointwise.length, 6);
  for (const operation of pointwise) assert.equal(getDiffKernel(operation.id), undefined);
});
