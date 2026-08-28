/** Plot-agnostic WebGPU rendering interface consumed by reusable GPU passes. */

export type RhiTextureFormat =
  | "rgba8unorm"
  | "rgba16float"
  | "rgba32float"
  | "r32float";

export interface RhiCapabilities {
  readonly hdr: boolean;
  readonly compute: boolean;
  readonly float16: boolean;
}

export interface RhiTexture {
  readonly width: number;
  readonly height: number;
  readonly format: RhiTextureFormat;
  write(data: ArrayBufferView): void;
  destroy(): void;
}

export interface RhiSampler { readonly _s: unknown }
export interface RhiRenderPipeline { readonly _p: unknown }
export interface RhiComputePipeline { readonly _c: unknown }
export interface RhiBindGroup {
  readonly _b: unknown;
  destroy?(): void;
}
export interface RhiSurface {
  readonly canvas: HTMLCanvasElement;
  readonly hdr: boolean;
  configure(width: number, height: number): void;
  getCurrentTextureView(): unknown;
}

export interface RhiBindGroupEntry {
  binding: number;
  resource: RhiTexture | RhiSampler | { uniform: ArrayBufferView };
}

export interface WebGpuRhi {
  readonly capabilities: RhiCapabilities;
  createTexture(width: number, height: number, format: RhiTextureFormat): RhiTexture;
  createSampler(options?: { filter?: "nearest" | "linear" }): RhiSampler;
  createRenderPipeline(spec: {
    shaderWGSL: string;
    targetFormat: RhiTextureFormat;
  }): RhiRenderPipeline;
  createComputePipeline?(spec: { shaderWGSL: string }): RhiComputePipeline;
  createBindGroup(
    pipeline: RhiRenderPipeline,
    entries: RhiBindGroupEntry[],
  ): RhiBindGroup;
  createSurface(canvas: HTMLCanvasElement, options: { hdr: boolean }): RhiSurface;
  renderFullscreen(
    target: RhiSurface | RhiTexture,
    pipeline: RhiRenderPipeline,
    bindGroup: RhiBindGroup,
  ): void;
  readback(source: RhiSurface | RhiTexture): Promise<Uint8Array | Float32Array>;
  isContextLost(): boolean;
}
