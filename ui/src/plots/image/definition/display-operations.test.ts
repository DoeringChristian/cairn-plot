import { test } from "node:test";
import assert from "node:assert/strict";
import { CPU_DISPLAY_OPERATIONS } from "../cpu/display-operations.ts";
import { listWebGpuDisplayOperations } from "../webgpu/display.ts";
import { DISPLAY_OPERATIONS } from "./display-operations.ts";

test("display operation metadata contains no backend implementation", () => {
  const ids = DISPLAY_OPERATIONS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes("none"), false);
  for (const operation of DISPLAY_OPERATIONS) assert.equal("implementation" in operation, false);
});

test("CPU and WebGPU implement every semantic display operation in the same order", () => {
  const declared = DISPLAY_OPERATIONS.map(({ id }) => id);
  assert.deepEqual(CPU_DISPLAY_OPERATIONS.map(({ definition }) => definition.id), declared);
  assert.deepEqual(listWebGpuDisplayOperations().map(({ definition }) => definition.id), declared);
});

test("backend implementations point to canonical definition objects", () => {
  for (const operation of [...CPU_DISPLAY_OPERATIONS, ...listWebGpuDisplayOperations()]) {
    assert.equal(DISPLAY_OPERATIONS.includes(operation.definition), true, operation.definition.id);
  }
});
