import type { Device } from "../../lib/cairn-plot/engine/types.ts";

export interface DisposableDevice { destroy(): void }

/** Generic single-page async device lifetime, independently testable from WebGPU. */
export class SharedDeviceProvider<T extends DisposableDevice> {
  private current: Promise<T> | null = null;
  private readonly create: () => Promise<T>;

  constructor(create: () => Promise<T>) {
    this.create = create;
  }

  get(): Promise<T> {
    return (this.current ??= this.create());
  }

  reset(): void {
    const previous = this.current;
    this.current = null;
    previous?.then((device) => device.destroy()).catch(() => {
      // A device that never resolved owns nothing to release.
    });
  }
}

async function createPageDevice(): Promise<Device> {
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
    throw new Error(
      "cairn-plot WebGPU engine: navigator.gpu is unavailable; select a different plot backend",
    );
  }
  const { createWebGPUDevice } = await import("../../lib/cairn-plot/engine/webgpu/device.ts");
  return createWebGPUDevice();
}

const pageDevice = new SharedDeviceProvider(createPageDevice);

/** The one low-level WebGPU RHI device shared by every plot on this page. */
export function getSharedWebGpuDevice(): Promise<Device> {
  return pageDevice.get();
}

/** Test/recovery seam: dispose the current device and lazily create a new one. */
export function resetSharedWebGpuDevice(): void {
  pageDevice.reset();
}
