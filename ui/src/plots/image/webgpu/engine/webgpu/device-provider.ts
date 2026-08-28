import { SharedDeviceProvider } from "../../../../../engines/webgpu/device-provider.ts";
import type { Device } from "./device-contract.ts";
import { createWebGPUDevice } from "./device.ts";

async function createImageDevice(): Promise<Device> {
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
    throw new Error(
      "cairn-plot image WebGPU backend: navigator.gpu is unavailable",
    );
  }
  return createWebGPUDevice();
}

const pageDevice = new SharedDeviceProvider(createImageDevice);

/** One extended image device per page; all image surfaces share it. */
export function getSharedWebGpuDevice(): Promise<Device> {
  return pageDevice.get();
}

/** Device-loss/test recovery seam. */
export function resetSharedWebGpuDevice(): void {
  pageDevice.reset();
}
