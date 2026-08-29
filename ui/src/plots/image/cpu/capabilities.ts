import { CPU_DISPLAY_OPERATIONS } from "./display-operations.ts";
import { IMAGE_OPERATION_EVALUATORS } from "../resources/image-operation-evaluator.ts";
import { defineImageBackendCapabilities } from "../runtime/backend-capabilities.ts";

/** Executable operation coverage advertised by the CPU image backend. */
export const CPU_IMAGE_BACKEND_CAPABILITIES = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_EVALUATORS.map(({ definition }) => definition),
  displayOperations: CPU_DISPLAY_OPERATIONS.map(({ definition }) => definition),
});

