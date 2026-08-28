import type { WebGpuEngineContext, WebGpuSurfaceOptions } from "./contracts.ts";
import type { WebGpuRhi } from "./rhi.ts";

/** Wrap a plot-agnostic RHI without adding plot-specific operations. */
export function createWebGpuEngineContext(rhi: WebGpuRhi): WebGpuEngineContext {
  return {
    capabilities: rhi.capabilities,
    rhi,
    createSurface(canvas: HTMLCanvasElement, options: WebGpuSurfaceOptions = {}) {
      return rhi.createSurface(canvas, { hdr: options.hdr ?? false });
    },
    readSurface(surface) {
      return rhi.readback(surface);
    },
  };
}
