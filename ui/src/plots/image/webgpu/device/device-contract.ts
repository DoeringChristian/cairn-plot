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
 * `destroy?()` is optional because a bind group implementation MAY own no GPU
 * resources. WebGPU bind groups own one updateable buffer per declared uniform;
 * retained render passes update those buffers in place and destroy the binding
 * when their surface is parked or disposed.
 */
export interface BindGroup {
  readonly _b: unknown;
  /** Update an existing uniform buffer without rebuilding the bind group. */
  updateUniform?(binding: number, value: ArrayBufferView): void;
  destroy?(): void;
}
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
/**
 * Input to {@link Device.computeTevTextureHistogram}: which texel components
 * are real channels, and the series to bin — each series a vec4 of
 * per-component weights (one-hot for a single channel; luma/mean coefficients
 * for a combined series; zero components are never read, so a NaN in a
 * non-contributing channel cannot poison the series value). Built by
 * `renderers/image-histogram.ts`'s `seriesWeightsFor`.
 */
export interface TexHistogramSpec {
  /** Real channels in the texel (components `0..channelCount-1`), ≤ 4. */
  channelCount: number;
  /** Number of series (≤ 4). */
  seriesCount: number;
  /** `seriesCount×4` row-major component weights. */
  seriesWeights: Float32Array;
  /** Histogram resolution (tev parity: 400). */
  bins: number;
  /** `rgba8unorm` sources: samples are `round(texel·255)` raw code values
   *  (matching the CPU `ImageData` reader); float sources pass `false`. */
  u8Scale: boolean;
}
/** Output of {@link Device.computeTevTextureHistogram} — the RAW folds; the
 *  caller derives the symlog mapping + tev display normalization on the host
 *  (`tevBinMapping` / `tevNormalizeCounts`, shared with the CPU path). */
export interface TexHistogramResult {
  /** Per texel channel over FINITE samples, length = `channelCount`. */
  channelStats: { min: number; max: number; mean: number; count: number }[];
  /** min/max over all series values, or `null` when none is finite. */
  range: { min: number; max: number } | null;
  /** `seriesCount×bins` series-major raw bin counts. */
  counts: Uint32Array;
}
/** Output of {@link Device.computeDeepDepthHistogram} — alpha-weighted Z bin
 *  weights (de-quantized from the fixed-point accumulation) over the finite-Z
 *  `[zMin, zMax]` symlog mapping. */
export interface DeepDepthHistogramResult {
  zMin: number;
  zMax: number;
  /** Per-bin summed alpha weight. */
  weights: Float64Array;
  totalWeight: number;
}
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
  /** Resolves after all GPU work submitted before this call completes. */
  submittedWorkDone?(): Promise<void>;
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
  /**
   * GPU-side parallel MEAN of ONE channel over the `[0,width)x[0,height)` region
   * of `tex` (the reduction family's `channel` program under the `mean` op —
   * `engine/reduce/registry.ts`). Drives the SSIM error-map mean scalar
   * (`diff-engine.ts`'s `ensureSsimScalar` → `1 - mean`) WITHOUT the full
   * result-texture readback the CPU loop needed — only a small per-workgroup
   * partial buffer is read back. Always present on the engine's WebGPU backend;
   * optional in the type as a defensive contract — the SSIM scalar keeps a
   * readback + CPU-average fallback for a device without it. `width`/`height`
   * are the RESULT grid (the mapped/compared region). Returns `NaN` for an
   * empty region.
   */
  reduceTextureChannelMean?(tex: Texture, channel: number, width: number, height: number): Promise<number>;
  /**
   * GPU tev-parity VALUE HISTOGRAM over the `[0,width)x[0,height)` region of
   * `tex` at FULL pixel coverage (the info panel's M2 compute — see
   * `engine/histogram/compute.ts`): a stats pass (per-channel min/max/mean +
   * the shared series range, KB partial readback) then an atomic 400×k
   * binning pass through the symmetric-log₂ mapping derived from that range.
   * Binning math is f32 (the CPU reference is f64) — equal away from bin
   * edges. Always present on the engine's WebGPU backend; optional as the
   * defensive contract — callers (the pool) fall back to the CPU reader loop.
   */
  computeTevTextureHistogram?(
    tex: Texture,
    width: number,
    height: number,
    spec: TexHistogramSpec,
  ): Promise<TexHistogramResult>;
  /**
   * GPU alpha-weighted DEPTH HISTOGRAM over a deep CSR's GPU-resident sample
   * buffers (the deep info-panel section): finite-Z min/max reduction, then
   * fixed-point-atomic binning of each sample's alpha through the symlog Z
   * mapping. Pairs with {@link createDeepSampleBuffers}. Returns `null` when
   * the CSR holds no finite-Z sample.
   */
  computeDeepDepthHistogram?(
    buffers: DeepSampleBuffers,
    bins: number,
  ): Promise<DeepDepthHistogramResult | null>;
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
