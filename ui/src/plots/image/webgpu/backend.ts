import { defineImageBackendCapabilities, type ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "../runtime/contracts.ts";
import { listWebGpuDisplayOperations } from "./display.ts";
import { WEBGPU_IMAGE_OPERATIONS } from "./image-operations.ts";
import GpuImagePane from "./view.tsx";

/** Complete retained-surface WebGPU image backend definition. */
export const webGpuImageBackend: ImageBackend<ImageBackendView> = Object.freeze({
  id: "webgpu",
  View: GpuImagePane,
  capabilities: defineImageBackendCapabilities({
    imageOperations: WEBGPU_IMAGE_OPERATIONS.map(({ definition }) => definition),
    displayOperations: listWebGpuDisplayOperations().map(({ definition }) => definition),
  }),
});
