import { useEffect, useSyncExternalStore } from "react";

import { warnGpuUnavailable } from "../../lib/cairn-plot/primitives/capability-notice.ts";
import CpuImagePane from "../../lib/cairn-plot/renderers/CpuImagePane.tsx";
import GpuImagePane from "../../lib/cairn-plot/renderers/GpuImagePane.tsx";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "../../lib/cairn-plot/renderers/gpu-image-gate.ts";
import type { ImageBackend, RenderMode } from "../../lib/cairn-plot/renderers/image-backend.ts";

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
