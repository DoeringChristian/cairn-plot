import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { defineImageBackendCapabilities } from "../backend.ts";
import { IMAGE_OPERATION_EVALUATORS } from "../resources/image-operation-evaluator.ts";
import { CPU_DISPLAY_OPERATIONS } from "../cpu/display-operations.ts";
import { WEBGPU_IMAGE_OPERATIONS } from "../webgpu/image-operations.ts";
import { listWebGpuDisplayOperations } from "../webgpu/display.ts";
import { getImageOperation } from "../definition/image-operations.ts";

const cpuCapabilities = defineImageBackendCapabilities({
  imageOperations: [
    ...IMAGE_OPERATION_EVALUATORS.map(({ definition }) => definition),
    getImageOperation("flip")!,
    getImageOperation("ssim")!,
  ],
  displayOperations: CPU_DISPLAY_OPERATIONS.map(({ definition }) => definition),
});
const webGpuCapabilities = defineImageBackendCapabilities({
  imageOperations: WEBGPU_IMAGE_OPERATIONS.map(({ definition }) => definition),
  displayOperations: listWebGpuDisplayOperations().map(({ definition }) => definition),
});
const capabilities = [cpuCapabilities, webGpuCapabilities];

test("image backends advertise executable image and display operations", () => {
  assert.equal(cpuCapabilities.supportsImageOperation("absolute"), true);
  assert.equal(cpuCapabilities.supportsImageOperation("flip"), true);
  assert.equal(cpuCapabilities.supportsImageOperation("ssim"), true);
  assert.equal(webGpuCapabilities.supportsImageOperation("flip"), true);

  for (const id of ["linear", "srgb", "aces", "turbo", "magma", "red-green"]) {
    assert.equal(cpuCapabilities.supportsDisplayOperation(id), true, `cpu/${id}`);
    assert.equal(webGpuCapabilities.supportsDisplayOperation(id), true, `webgpu/${id}`);
  }
});

test("capabilities advertise stages independently rather than duplicating a pair matrix", () => {
  for (const advertised of capabilities) {
    assert.equal("pipelines" in advertised, false);
    assert.equal("compatibility" in advertised, false);
    assert.ok(advertised.imageOperations.length > 0);
    assert.ok(advertised.displayOperations.length > 0);
  }
});

test("each concrete backend exports one complete backend object", () => {
  for (const path of ["../cpu/backend.ts", "../webgpu/backend.ts"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /ImageBackend<ImageBackendView>/);
    assert.match(source, /id:/);
    assert.match(source, /View:/);
    assert.match(source, /capabilities:/);
  }
  const compositionRoot = readFileSync(new URL("../../register-core.tsx", import.meta.url), "utf8");
  assert.match(compositionRoot, /ensureImagePlotType\(ImagePlotView, \[webGpuImageBackend, cpuImageBackend\]\)/);
  const view = readFileSync(new URL("./view.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(view, /useImageBackend|resolveRenderMode/,
    "the image view consumes the backend selected by the generic host");
});
