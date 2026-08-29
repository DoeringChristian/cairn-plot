import { useEffect, useSyncExternalStore } from "react";

import { warnGpuUnavailable } from "../../../primitives/components/capability-notice.ts";
import CpuImagePane from "../cpu/view.tsx";
import GpuImagePane from "../webgpu/view.tsx";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "../components/gpu-image-gate.ts";
import type { ImageBackendView, RenderMode } from "./contracts.ts";
import type { ImageBackendCapabilities } from "./backend-capabilities.ts";
import { CPU_IMAGE_BACKEND_CAPABILITIES } from "../cpu/capabilities.ts";
import { WEBGPU_IMAGE_BACKEND_CAPABILITIES } from "../webgpu/capabilities.ts";

let warnedForcedGpuUnavailable = false;

export interface SelectedImageBackend {
  readonly id: "cpu" | "webgpu";
  readonly View: ImageBackendView;
  readonly capabilities: ImageBackendCapabilities;
}

const CPU_BACKEND: SelectedImageBackend = {
  id: "cpu",
  View: CpuImagePane,
  capabilities: CPU_IMAGE_BACKEND_CAPABILITIES,
};
const WEBGPU_BACKEND: SelectedImageBackend = {
  id: "webgpu",
  View: GpuImagePane,
  capabilities: WEBGPU_IMAGE_BACKEND_CAPABILITIES,
};

/** Select one fixed image backend and expose its queryable operation coverage. */
export function useImageBackend(mode: RenderMode): SelectedImageBackend {
  const gate = useSyncExternalStore(subscribeGpuImageGate, gpuImageGateState, gpuImageGateState);
  useEffect(() => {
    if (mode !== "cpu") ensureGpuImageProbe();
  }, [mode]);
  if (typeof window === "undefined" || mode === "cpu") return CPU_BACKEND;
  if (mode === "gpu") {
    if (gate === "ready") return WEBGPU_BACKEND;
    if (gate === "unavailable") {
      if (!("gpu" in navigator)) {
        warnGpuUnavailable();
      } else if (!warnedForcedGpuUnavailable) {
        warnedForcedGpuUnavailable = true;
        console.warn(
          'cairn-plot: render mode "gpu" was forced but the WebGPU image backend is unavailable — ' +
            "falling back to the CPU backend",
        );
      }
    }
    return CPU_BACKEND;
  }
  return gate === "ready" ? WEBGPU_BACKEND : CPU_BACKEND;
}
