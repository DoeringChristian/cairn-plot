import { listWebGpuDisplayOperations } from "./display.ts";
import { WEBGPU_IMAGE_OPERATIONS } from "./image-operations.ts";
import { defineImageBackendCapabilities } from "../runtime/backend-capabilities.ts";

/** Executable operation coverage advertised by the WebGPU image backend. */
export const WEBGPU_IMAGE_BACKEND_CAPABILITIES = defineImageBackendCapabilities({
  imageOperations: WEBGPU_IMAGE_OPERATIONS.map(({ definition }) => definition),
  displayOperations: listWebGpuDisplayOperations().map(({ definition }) => definition),
});

