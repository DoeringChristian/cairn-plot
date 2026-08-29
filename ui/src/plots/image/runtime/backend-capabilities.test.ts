import assert from "node:assert/strict";
import test from "node:test";

import { CPU_IMAGE_BACKEND_CAPABILITIES } from "../cpu/capabilities.ts";
import { WEBGPU_IMAGE_BACKEND_CAPABILITIES } from "../webgpu/capabilities.ts";

test("image backends advertise executable image and display operations", () => {
  assert.equal(CPU_IMAGE_BACKEND_CAPABILITIES.supportsImageOperation("absolute"), true);
  assert.equal(CPU_IMAGE_BACKEND_CAPABILITIES.supportsImageOperation("flip"), false);
  assert.equal(WEBGPU_IMAGE_BACKEND_CAPABILITIES.supportsImageOperation("flip"), true);

  for (const id of ["linear", "srgb", "aces", "turbo", "magma", "red-green"]) {
    assert.equal(CPU_IMAGE_BACKEND_CAPABILITIES.supportsDisplayOperation(id), true, `cpu/${id}`);
    assert.equal(WEBGPU_IMAGE_BACKEND_CAPABILITIES.supportsDisplayOperation(id), true, `webgpu/${id}`);
  }
});

test("capabilities advertise stages independently rather than duplicating a pair matrix", () => {
  for (const capabilities of [CPU_IMAGE_BACKEND_CAPABILITIES, WEBGPU_IMAGE_BACKEND_CAPABILITIES]) {
    assert.equal("pipelines" in capabilities, false);
    assert.equal("compatibility" in capabilities, false);
    assert.ok(capabilities.imageOperations.length > 0);
    assert.ok(capabilities.displayOperations.length > 0);
  }
});

