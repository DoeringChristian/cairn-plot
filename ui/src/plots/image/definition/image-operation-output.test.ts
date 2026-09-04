/**
 * Every registered comparison operation declares its display arity. The FLIP
 * family produces one scalar metric while pointwise operations retain source
 * channel arity. The TEV overlay uses this to decide
 * how many numbers to print — FLIP must print one metric per pixel, so
 * printing three channel-tinted numbers (the reported bug) is wrong.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/model/image-operation-output.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getImageOperation, listImageOperations } from "../definition/image-operations.ts";
import { getWebGpuImageOperation, WEBGPU_IMAGE_OPERATIONS } from "../webgpu/image-operations.ts";

test("every multipass operation declares scalar display output", () => {
  const operations = WEBGPU_IMAGE_OPERATIONS.filter((operation) => operation.kind === "multipass");
  assert.ok(operations.length >= 3, "expected the multipass FLIP/SSIM implementations");
  for (const operation of operations) assert.equal(operation.definition.output.arity, 1, `${operation.definition.id} must be scalar`);
});

test("the FLIP family is scalar, the pointwise diffs are per-channel", () => {
  const scalar = ["flip", "flip-hdr", "ssim"];
  const perChannel = [
    "signed",
    "absolute",
    "squared",
    "relative_signed",
    "relative_absolute",
    "relative_squared",
  ];
  for (const id of scalar) {
    assert.equal(getImageOperation(id)?.output.arity, 1, `${id} must be scalar`);
  }
  for (const id of perChannel) {
    const operation = getImageOperation(id);
    assert.equal(getWebGpuImageOperation(id)?.kind, "inline", `${id} must be an inline WebGPU image operation`);
    assert.equal(operation?.output.arity, "source", `${id} must retain source channel arity`);
  }
});

test("pointwise differences and multipass metrics share the image-operation registry", () => {
  const pointwise = listImageOperations().filter((operation) =>
    getWebGpuImageOperation(operation.id)?.kind === "inline" && operation.inputs === 2 && operation.output.arity === "source",
  );
  assert.equal(pointwise.length, 6);
  for (const operation of pointwise) assert.equal(getWebGpuImageOperation(operation.id)?.kind, "inline");
});
