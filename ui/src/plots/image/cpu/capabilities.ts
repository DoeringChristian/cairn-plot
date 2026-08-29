import { CPU_DISPLAY_OPERATIONS } from "./display-operations.ts";
import { CPU_IMAGE_OPERATIONS } from "./image-operations.ts";
import { defineImageBackendCapabilities } from "../runtime/backend-capabilities.ts";

/** Executable operation coverage advertised by the CPU image backend. */
export const CPU_IMAGE_BACKEND_CAPABILITIES = defineImageBackendCapabilities({
  imageOperations: CPU_IMAGE_OPERATIONS.map(({ definition }) => definition),
  displayOperations: CPU_DISPLAY_OPERATIONS.map(({ definition }) => definition),
});

