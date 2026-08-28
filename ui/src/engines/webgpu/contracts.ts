import type {
  Capabilities,
  Device,
  Surface,
} from "./types.ts";
import type { WebGpuRhi } from "./rhi.ts";

export interface WebGpuSurfaceOptions {
  hdr?: boolean;
}

/**
 * Acquired page-engine context. `device` is the transitional low-level RHI
 * used by reusable passes; plot backends should prefer the named operations.
 */
export interface WebGpuEngineContext {
  readonly capabilities: Readonly<Capabilities>;
  /** Stable plot-agnostic interface for new GPU backends and shared passes. */
  readonly rhi: WebGpuRhi;
  /** @internal Transitional access for legacy image-specific extensions. */
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
