import { defineImageBackendCapabilities, type ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "../runtime/contracts.ts";
import { IMAGE_OPERATION_EVALUATORS } from "../resources/image-operation-evaluator.ts";
import { CPU_DISPLAY_OPERATIONS } from "./display-operations.ts";
import CpuImagePane from "./view.tsx";

/** Complete Canvas/CPU image backend definition. */
export const cpuImageBackend: ImageBackend<ImageBackendView> = Object.freeze({
  id: "cpu",
  technology: "canvas2d",
  priority: 1,
  View: CpuImagePane,
  supports: () => ({ supported: true, priority: 1 }),
  capabilities: defineImageBackendCapabilities({
    imageOperations: IMAGE_OPERATION_EVALUATORS.map(({ definition }) => definition),
    displayOperations: CPU_DISPLAY_OPERATIONS.map(({ definition }) => definition),
  }),
});
