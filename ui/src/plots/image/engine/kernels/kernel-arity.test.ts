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
import { getImageOperation, listImageOperations, listMultipassImageOperations } from "../../model/content-ops/index.ts";

test("every multipass operation declares scalar display output", () => {
  const operations = listMultipassImageOperations();
  assert.ok(operations.length >= 4, "expected the multipass FLIP/SSIM implementations");
  for (const operation of operations) assert.equal(operation.outputArity, 1, `${operation.id} must be scalar`);
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
    assert.equal(getImageOperation(id)?.outputArity, 1, `${id} must be scalar`);
  }
  for (const id of perChannel) {
    const operation = getImageOperation(id);
    assert.ok(operation?.implementation.kind === "inline", `${id} must be an inline image operation`);
    assert.equal(operation.outputArity, 1, `${id} exposes scalar display gating while retaining channel values`);
  }
});

test("pointwise differences and multipass metrics share the image-operation registry", () => {
  const pointwise = listImageOperations().filter(
    (operation) => operation.implementation.kind === "inline" && operation.inputCount === 2 && operation.outputArity === 1,
  );
  assert.equal(pointwise.length, 6);
  for (const operation of pointwise) assert.equal(operation.implementation.kind, "inline");
});
