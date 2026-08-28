import type { Device } from "../../lib/cairn-plot/engine/types.ts";
import {
  getSharedWebGpuDevice,
  resetSharedWebGpuDevice,
} from "./device-provider.ts";
import type {
  WebGpuEngine,
  WebGpuEngineContext,
  WebGpuSurfaceOptions,
} from "./contracts.ts";

export function createWebGpuEngineContext(device: Device): WebGpuEngineContext {
  return {
    capabilities: device.capabilities,
    device,
    createSurface(canvas: HTMLCanvasElement, options: WebGpuSurfaceOptions = {}) {
      return device.createSurface(canvas, { hdr: options.hdr ?? false });
    },
    readSurface(surface) {
      return device.readback(surface);
    },
  };
}

let contextPromise: Promise<WebGpuEngineContext> | null = null;

export const webGpuEngine: WebGpuEngine = {
  isAvailable() {
    return typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
  },
  acquire() {
    return (contextPromise ??= getSharedWebGpuDevice().then(createWebGpuEngineContext));
  },
  reset() {
    contextPromise = null;
    resetSharedWebGpuDevice();
  },
};
