/**
 * What the Canvas/CPU image backend advertises: the full public registries.
 *
 * Kept out of `backend.ts` so tests (and any Node-side consumer) can read the
 * declaration without importing the backend's `.tsx` view. The module-load
 * guard below runs on every import of the backend, so an id that lost its CPU
 * implementation fails loudly at load instead of at the first render.
 */
import { defineImageBackendCapabilities, type ImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { getImageOperationEvaluator } from "../resources/image-operation-evaluator.ts";
import { getCpuDisplayOperation } from "./display-operations.ts";
import { CPU_METRIC_OPERATION_IDS } from "./source-metrics.ts";

/**
 * Operations the CPU backend serves from its reference metrics path
 * (`cpu/source-metrics.ts`) rather than from a per-pixel evaluator — declared
 * by that module, so the two can never drift apart.
 */
const CPU_METRIC_OPERATIONS: ReadonlySet<string> = new Set<string>(CPU_METRIC_OPERATION_IDS);

function hasCpuImageOperation(id: string): boolean {
  return getImageOperationEvaluator(id) !== undefined || CPU_METRIC_OPERATIONS.has(id);
}

for (const id of IMAGE_OPERATION_IDS) {
  if (!hasCpuImageOperation(id)) {
    throw new Error(`cpu image backend advertises image operation ${id} without an implementation`);
  }
}
for (const id of DISPLAY_OPERATION_IDS) {
  if (!getCpuDisplayOperation(id)) {
    throw new Error(`cpu image backend advertises display operation ${id} without an implementation`);
  }
}

export const CPU_CAPABILITIES: ImageBackendCapabilities = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});
