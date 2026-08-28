import type {
  Capabilities,
  Device,
  Surface,
} from "../../lib/cairn-plot/engine/types.ts";

export interface WebGpuSurfaceOptions {
  hdr?: boolean;
}

/**
 * Acquired page-engine context. `device` is the transitional low-level RHI
 * used by reusable passes; plot backends should prefer the named operations.
 */
export interface WebGpuEngineContext {
  readonly capabilities: Readonly<Capabilities>;
  readonly device: Device;
  createSurface(canvas: HTMLCanvasElement, options?: WebGpuSurfaceOptions): Surface;
  readSurface(surface: Surface): ReturnType<Device["readback"]>;
}

export interface WebGpuEngine {
  isAvailable(): boolean;
  acquire(): Promise<WebGpuEngineContext>;
  /** Device-loss/test recovery. Existing contexts become invalid. */
  reset(): void;
}
