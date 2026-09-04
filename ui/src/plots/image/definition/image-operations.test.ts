import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_OPERATION_EVALUATORS, getImageOperationEvaluator } from "../resources/image-operation-evaluator.ts";
import { buildImageOperationWGSL, getWebGpuImageOperation, WEBGPU_IMAGE_OPERATIONS } from "../webgpu/image-operations.ts";
import {
  IMAGE_OPERATIONS,
  listComparisonOperationPublicNames,
  listImageOperations,
  operationIdForPublicName,
} from "./image-operations.ts";

const POINTWISE = ["absolute", "signed", "squared", "relative_absolute", "relative_signed", "relative_squared"];

test("semantic image operations have unique backend-neutral definitions", () => {
  const ids = IMAGE_OPERATIONS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["identity", ...POINTWISE, "split", "flip", "flip-hdr", "ssim"]);
  for (const operation of IMAGE_OPERATIONS) {
    assert.equal("implementation" in operation, false);
  }
});

test("WebGPU implements every declared image operation", () => {
  assert.deepEqual(
    WEBGPU_IMAGE_OPERATIONS.map(({ definition }) => definition.id),
    IMAGE_OPERATIONS.map(({ id }) => id),
  );
});

test("pointwise image operations preserve RGB while scalar fields expand to gray", () => {
  const absolute = getWebGpuImageOperation("absolute");
  assert.equal(absolute?.kind, "inline");
  if (absolute?.kind !== "inline") return;
  assert.doesNotMatch(buildImageOperationWGSL(absolute), /let scalar =/);

  const identity = getWebGpuImageOperation("identity");
  assert.equal(identity?.kind, "inline");
  if (identity?.kind !== "inline") return;
  assert.doesNotMatch(buildImageOperationWGSL(identity), /let scalar =/);
});

test("CPU implements the pointwise subset and reports unsupported multipass operations", () => {
  assert.deepEqual(IMAGE_OPERATION_EVALUATORS.map(({ definition }) => definition.id), ["identity", ...POINTWISE, "split"]);
  for (const id of ["flip", "flip-hdr", "ssim"]) assert.equal(getImageOperationEvaluator(id), undefined);
});

test("CPU pointwise implementations retain comparison math", () => {
  const a = [0.8, 0.5, 0.2];
  const b = [0.3, 0.6, 0.2];
  assert.deepEqual(getImageOperationEvaluator("signed")!.evaluate([a, b], 3), [0.5, -0.09999999999999998, 0]);
  assert.deepEqual(getImageOperationEvaluator("absolute")!.evaluate([a, b], 3), [0.5, 0.09999999999999998, 0]);
});

test("WebGPU JIT compiles one inline backend implementation at a time", () => {
  for (const operation of WEBGPU_IMAGE_OPERATIONS) {
    if (operation.kind === "inline") {
      const wgsl = buildImageOperationWGSL(operation);
      assert.ok(wgsl.includes(operation.wgsl.trim()), operation.definition.id);
      assert.doesNotMatch(wgsl, /operationId|IMAGE_OPERATION_ID/);
      for (const other of WEBGPU_IMAGE_OPERATIONS) {
        if (other.kind === "inline" && other !== operation) {
          assert.ok(!wgsl.includes(other.wgsl.trim()), `${operation.definition.id} contains ${other.definition.id}`);
        }
      }
    }
  }
  for (const id of ["flip", "flip-hdr", "ssim"]) assert.equal(getWebGpuImageOperation(id)?.kind, "multipass");
});

test("SDR FLIP and HDR FLIP are two public registry entries and no kernel id exists", () => {
  const byId = new Map(listImageOperations().map((o) => [o.id, o]));
  assert.deepEqual([byId.get("flip")?.label, byId.get("flip")?.publicName], ["FLIP", "flip"]);
  assert.deepEqual([byId.get("flip-hdr")?.label, byId.get("flip-hdr")?.publicName], ["HDR-FLIP", "flip_hdr"]);
  assert.equal(byId.has("hdr-flip"), false);
  assert.equal(byId.has("flip-sdr"), false);
  for (const o of listImageOperations()) {
    if (o.inputs === 2 && o.id !== "split") assert.ok(o.publicName, `${o.id} has a public name`);
  }
});

test("public names round-trip to registry ids", () => {
  assert.equal(operationIdForPublicName("flip"), "flip");
  assert.equal(operationIdForPublicName("flip_hdr"), "flip-hdr");
  assert.equal(operationIdForPublicName("ssim"), "ssim");
  assert.deepEqual(
    [...listComparisonOperationPublicNames()].sort(),
    ["abs", "flip", "flip_hdr", "rel_abs", "rel_signed", "rel_square", "signed", "square", "ssim"],
  );
});
