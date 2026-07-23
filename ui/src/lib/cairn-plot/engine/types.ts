/**
 * `"webgpu"` is the only backend the engine produces (see `engine/device.ts`'s
 * module doc — the removed WebGL2 backend used to be the second value here).
 * Kept as a named type (rather than inlining the literal) so `Device.backend`
 * still reads as a real discriminant and callers/tests don't hardcode a bare
 * string.
 */
export type Backend = "webgpu";
/** WebGPU is the engine's only backend and is always full-featured. */
export interface Capabilities { hdr: boolean; compute: boolean; float16: boolean; }
export type TextureFormat = "rgba8unorm" | "rgba16float" | "rgba32float" | "r32float";
export interface Texture { readonly width: number; readonly height: number; readonly format: TextureFormat; write(data: ArrayBufferView): void; destroy(): void; }
export interface Sampler { readonly _s: unknown; }
export interface RenderPipeline { readonly _p: unknown; }
export interface ComputePipeline { readonly _c: unknown; }
export interface BindGroupEntry { binding: number; resource: Texture | Sampler | { uniform: ArrayBufferView }; }
/**
 * `destroy?()` is optional because a bind group implementation MAY own no
 * GPU resources of its own. WebGPU bind groups (`engine/webgpu/device.ts`'s
 * `WGPUBindGroup`) DO allocate owned `GPUBuffer`s per `createBindGroup()`
 * call (one per declared uniform binding) and MUST implement `destroy()` to
 * release them — callers that rebuild bind groups per frame (a real render
 * loop) must call `bindGroup.destroy?.()` once a bind group is no longer
 * needed, or those buffers leak until `Device.destroy()`.
 */
export interface BindGroup { readonly _b: unknown; destroy?(): void; }
/**
 * GPU-resident deep-EXR samples (storage buffers) for the depth-composite pass.
 * Created once from a {@link DeepGpuCsrSpec} (uploaded offsets/colors/zs), then
 * re-composited at any Z cutoff via {@link Device.compositeDeep} with no
 * re-upload. `destroy()` frees the underlying GPU buffers.
 */
export interface DeepSampleBuffers { readonly width: number; readonly height: number; destroy(): void; }
/** Z-sorted deep samples to upload — see `wasm/openexr` `DeepGpuCsr`. */
export interface DeepGpuCsrSpec {
  width: number; height: number;
  /** pixels+1 prefix sums. */
  offsets: Uint32Array;
  /** 4·total premultiplied RGBA (one vec4 per sample). */
  colors: Float32Array;
  /** total per-sample Z, ascending within each pixel. */
  zs: Float32Array;
}
export interface Surface { readonly canvas: HTMLCanvasElement; readonly hdr: boolean; configure(width: number, height: number): void; getCurrentTextureView(): unknown; }
export interface Device {
  readonly backend: Backend;
  readonly capabilities: Capabilities;
  createTexture(width: number, height: number, format: TextureFormat): Texture;
  createSampler(opts?: { filter?: "nearest" | "linear" }): Sampler;
  createRenderPipeline(spec: { shaderWGSL: string; targetFormat: TextureFormat; }): RenderPipeline;
  createComputePipeline?(spec: { shaderWGSL: string }): ComputePipeline;
  createBindGroup(pipeline: RenderPipeline, entries: BindGroupEntry[]): BindGroup;
  createSurface(canvas: HTMLCanvasElement, opts: { hdr: boolean }): Surface;
  /**
   * True iff THIS BROWSER can actually configure a canvas with the true-HDR
   * `toneMapping:{mode:"extended"}` path — probed by configuring a throwaway
   * context and reading `getConfiguration()` back (NOT `capabilities.hdr`,
   * which is a hardcoded backend flag). Distinguishes the "browser lacks
   * extended tone mapping" limitation (e.g. Firefox) from a merely non-HDR
   * display. Optional/defensive on the interface; always present on the
   * WebGPU backend, memoized per device.
   */
  probeExtendedToneMapping?(): boolean;
  renderFullscreen(target: Surface | Texture, pipeline: RenderPipeline, bindGroup: BindGroup): void;
  /**
   * Upload Z-sorted deep samples to GPU storage buffers for the depth-composite
   * pass (the deep depth slider on GPU-backed panes). Optional/defensive on the
   * interface; always present on the WebGPU backend. See
   * `engine/shaders/deep-composite.wgsl.ts`.
   */
  createDeepSampleBuffers?(spec: DeepGpuCsrSpec): DeepSampleBuffers;
  /**
   * Composite retained deep samples over the Z WINDOW [`zNear`, `zFar`] into
   * `target` (an `rgba16float` texture, front-to-back OVER of samples with
   * `zNear ≤ Z ≤ zFar`) — a uniform write + one fullscreen fragment pass. Pairs
   * with {@link createDeepSampleBuffers}. `zNear = -Infinity` = single far cutoff.
   */
  compositeDeep?(buffers: DeepSampleBuffers, target: Texture, zNear: number, zFar: number): void;
  readback(source: Surface | Texture): Promise<Uint8Array | Float32Array>;
  /**
   * GPU-side parallel reduction (Task 7) over the `[0,width)x[0,height)`
   * region of `texA`/`texB` (RGB channels only): sum of squared per-channel
   * diffs (`sumSq`) and sum of absolute per-channel diffs (`sumAbs`), used by
   * `engine/image-engine.ts`'s `computeMetrics`. Always present on the
   * engine's one backend (WebGPU); optional in the type as a defensive
   * contract — `computeMetrics` still has a `readback()` + CPU-loop fallback
   * for a hypothetical device without it. `width`/`height` may be smaller
   * than either texture's own dimensions (the caller passes the
   * `min(texA,texB)` comparison region).
   */
  reduceDiffSumSquaredAbs?(
    texA: Texture,
    texB: Texture,
    width: number,
    height: number,
  ): Promise<{ sumSq: number; sumAbs: number }>;
  destroy(): void;
  /**
   * True while this device's underlying GPU context is LOST and awaiting
   * (asynchronous) browser restoration. WebGPU's `createSurface` is always a
   * safe idempotent re-configure (see `webgpu/device.ts`'s doc), so this
   * always returns `false` in practice — kept on the interface as a forward-
   * looking safety hook rather than removed outright.
   */
  isContextLost(): boolean;
}
