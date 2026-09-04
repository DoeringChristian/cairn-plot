import type { ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "../runtime/contracts.ts";
import { WEBGPU_CAPABILITIES } from "./capabilities.ts";
import GpuImagePane from "./view.tsx";
import type { RenderEnvironment } from "../../../backends/contracts.ts";
import { resolveRenderMode } from "../runtime/contracts.ts";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "./availability.ts";

/** Complete retained-surface WebGPU image backend definition. */
export const webGpuImageBackend: ImageBackend<ImageBackendView> = Object.freeze({
  id: "webgpu",
  technology: "webgpu",
  priority: 10,
  View: GpuImagePane,
  prepare: ensureGpuImageProbe,
  subscribeSupport: subscribeGpuImageGate,
  supportSnapshot: gpuImageGateState,
  supports: (environment: RenderEnvironment) => ({
    supported: resolveRenderMode() !== "cpu" && environment.webgpu && gpuImageGateState() === "ready",
    priority: 10,
    reason: environment.webgpu ? undefined : "WebGPU is unavailable",
  }),
  capabilities: WEBGPU_CAPABILITIES,
});
