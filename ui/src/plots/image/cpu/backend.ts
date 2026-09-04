import type { ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "../runtime/contracts.ts";
import { CPU_CAPABILITIES } from "./capabilities.ts";
import CpuImagePane from "./view.tsx";

/** Complete Canvas/CPU image backend definition. */
export const cpuImageBackend: ImageBackend<ImageBackendView> = Object.freeze({
  id: "cpu",
  technology: "canvas2d",
  priority: 1,
  View: CpuImagePane,
  supports: () => ({ supported: true, priority: 1 }),
  capabilities: CPU_CAPABILITIES,
});
