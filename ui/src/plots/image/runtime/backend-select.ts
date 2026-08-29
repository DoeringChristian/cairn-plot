import { useEffect, useSyncExternalStore } from "react";

import { warnGpuUnavailable } from "../../../primitives/components/capability-notice.ts";
import type { ImageBackend } from "../backend.ts";
import { cpuImageBackend } from "../cpu/backend.ts";
import { webGpuImageBackend } from "../webgpu/backend.ts";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "./gpu-image-gate.ts";
import type { ImageBackendView, RenderMode } from "./contracts.ts";

let warnedForcedGpuUnavailable = false;

export type SelectedImageBackend = ImageBackend<ImageBackendView>;

/** Select one fixed image backend and expose its queryable operation coverage. */
export function useImageBackend(mode: RenderMode): SelectedImageBackend {
  const gate = useSyncExternalStore(subscribeGpuImageGate, gpuImageGateState, gpuImageGateState);
  useEffect(() => {
    if (mode !== "cpu") ensureGpuImageProbe();
  }, [mode]);
  if (typeof window === "undefined" || mode === "cpu") return cpuImageBackend;
  if (mode === "gpu") {
    if (gate === "ready") return webGpuImageBackend;
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
    return cpuImageBackend;
  }
  return gate === "ready" ? webGpuImageBackend : cpuImageBackend;
}
