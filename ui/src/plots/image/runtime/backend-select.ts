import { useEffect, useSyncExternalStore } from "react";

import { warnGpuUnavailable } from "../../../primitives/components/capability-notice.ts";
import CpuImagePane from "../cpu/view.tsx";
import GpuImagePane from "../webgpu/view.tsx";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "../components/gpu-image-gate.ts";
import type { ImageBackend, RenderMode } from "./contracts.ts";

let warnedForcedGpuUnavailable = false;

/** Select the image backend while capability discovery settles asynchronously. */
export function useImageBackend(mode: RenderMode): ImageBackend {
  const gate = useSyncExternalStore(subscribeGpuImageGate, gpuImageGateState, gpuImageGateState);
  useEffect(() => {
    if (mode !== "cpu") ensureGpuImageProbe();
  }, [mode]);
  if (typeof window === "undefined" || mode === "cpu") return CpuImagePane;
  if (mode === "gpu") {
    if (gate === "ready") return GpuImagePane;
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
    return CpuImagePane;
  }
  return gate === "ready" ? GpuImagePane : CpuImagePane;
}
