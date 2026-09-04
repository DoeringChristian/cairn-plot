import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { defineImageBackendCapabilities } from "../backend.ts";
/**
 * The backend modules themselves import their `.tsx` view, which Node's
 * type-stripping loader cannot resolve, so the capability declarations live in
 * their own modules. The source assertion below pins each backend object to the
 * very declaration this test checks.
 */
import { CPU_CAPABILITIES } from "../cpu/capabilities.ts";
import { WEBGPU_CAPABILITIES } from "../webgpu/capabilities.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";

const sorted = (ids: readonly string[]) => [...ids].sort();
const capabilities = [CPU_CAPABILITIES, WEBGPU_CAPABILITIES];

test("both backends advertise the identical, registry-complete capability sets", () => {
  assert.deepEqual(sorted(CPU_CAPABILITIES.imageOperations), sorted(IMAGE_OPERATION_IDS));
  assert.deepEqual(sorted(WEBGPU_CAPABILITIES.imageOperations), sorted(IMAGE_OPERATION_IDS));
  assert.deepEqual(sorted(CPU_CAPABILITIES.displayOperations), sorted(DISPLAY_OPERATION_IDS));
  assert.deepEqual(sorted(WEBGPU_CAPABILITIES.displayOperations), sorted(DISPLAY_OPERATION_IDS));

  for (const [path, declaration] of [
    ["../cpu/backend.ts", "CPU_CAPABILITIES"],
    ["../webgpu/backend.ts", "WEBGPU_CAPABILITIES"],
  ] as const) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, new RegExp(`capabilities: ${declaration}`), path);
  }
});

test("capabilities reject ids that are not public registry entries", () => {
  assert.throws(
    () => defineImageBackendCapabilities({ imageOperations: ["hdr-flip"], displayOperations: [] }),
    /unknown image operation/,
  );
  assert.throws(
    () => defineImageBackendCapabilities({ imageOperations: [], displayOperations: ["viridis"] }),
    /unknown display operation/,
  );
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
