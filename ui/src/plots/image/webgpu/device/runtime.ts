import type { Device, Surface } from "./device-contract.ts";
import { getSharedWebGpuDevice, resetSharedWebGpuDevice } from "./device-provider.ts";

export interface ImageWebGpuRuntime {
  readonly device: Device;
  createSurface(canvas: HTMLCanvasElement, options?: { hdr?: boolean }): Surface;
  readSurface(surface: Surface): ReturnType<Device["readback"]>;
}

let runtimePromise: Promise<ImageWebGpuRuntime> | null = null;

/** Image-owned extensions layered over the reusable WebGPU RHI. */
export const imageWebGpuRuntime = {
  acquire(): Promise<ImageWebGpuRuntime> {
    return (runtimePromise ??= getSharedWebGpuDevice().then((device) => ({
      device,
      createSurface: (canvas, options = {}) =>
        device.createSurface(canvas, { hdr: options.hdr ?? false }),
      readSurface: (surface) => device.readback(surface),
    })));
  },
  reset(): void {
    runtimePromise = null;
    resetSharedWebGpuDevice();
  },
};
