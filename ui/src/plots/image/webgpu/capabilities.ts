/**
 * What the WebGPU image backend advertises: the full public registries — the
 * identical set the CPU backend declares.
 *
 * Kept out of `backend.ts` so tests (and any Node-side consumer) can read the
 * declaration without importing the backend's `.tsx` view or the device probe.
 * The module-load guard below runs on every import of the backend, so an id
 * that lost its kernel fails loudly at load instead of at the first render.
 */
import { defineImageBackendCapabilities, type ImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { getWebGpuImageOperation } from "./image-operations.ts";
import { getWebGpuDisplayOperation } from "./display.ts";

for (const id of IMAGE_OPERATION_IDS) {
  if (!getWebGpuImageOperation(id)) {
    throw new Error(`webgpu image backend advertises image operation ${id} without an implementation`);
  }
}
for (const id of DISPLAY_OPERATION_IDS) {
  if (!getWebGpuDisplayOperation(id)) {
    throw new Error(`webgpu image backend advertises display operation ${id} without an implementation`);
  }
}

export const WEBGPU_CAPABILITIES: ImageBackendCapabilities = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});
