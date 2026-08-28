import type { RhiCapabilities, RhiSurface, WebGpuRhi } from "./rhi.ts";

export interface WebGpuSurfaceOptions {
  hdr?: boolean;
}

/**
 * Acquired page-engine context. `device` is the transitional low-level RHI
 * used by reusable passes; plot backends should prefer the named operations.
 */
export interface WebGpuEngineContext {
  readonly capabilities: Readonly<RhiCapabilities>;
  readonly rhi: WebGpuRhi;
  createSurface(canvas: HTMLCanvasElement, options?: WebGpuSurfaceOptions): RhiSurface;
  readSurface(surface: RhiSurface): Promise<Uint8Array | Float32Array>;
}
