/**
 * IMAGE render pass (Task 5 of the WebGPU engine, Sub-project 1) — the first
 * real renderer built on top of the RHI (`engine/types.ts`) + backends
 * (Tasks 1-4). `renderImage(device, target, src, params)` runs a fullscreen
 * fragment pipeline that turns a float/8-bit image texture into displayed
 * pixels via `exposure -> [colormap] -> tone-map operator -> output-encode`,
 * PARITY-CRITICAL with the CPU pipeline in `image/tonemap.ts` (see
 * `engine/shaders/image.wgsl.ts`'s module doc comment for the shader-level
 * porting notes and the exact uniform layout).
 *
 * ## Pipeline (matches image/tonemap.ts's HDR-A pipeline, module doc comment)
 *   1. sample `src` at the `params.uv` window (zoom/pan rect, [0,1] source-space)
 *   2. exposure:  rgb *= 2^exposureEV                     (applyExposure)
 *   3. [scalar]:  rgb = colormapLUT(rgb.r)                 (GPU-only stage;
 *      no existing CPU renderer applies a colormap at this pipeline point —
 *      see image.wgsl.ts's doc comment)
 *   4. operator:  rgb = TONEMAP_OPERATORS[operator](rgb)   (HDR [0,∞) -> [0,1]
 *      for every operator EXCEPT `"extended"`, which is a pure identity —
 *      see `image/tonemap.ts`'s doc comment on that entry — so values above
 *      1.0 survive this stage on purpose when paired with `hdrOut:true` and
 *      a real HDR (`rgba16float`/`toneMapping:'extended'`) target.)
 *   5. encode:    out = hdrOut ? extendedOutputEncode(rgb, gamma)
 *                              : outputEncode(rgb, gamma)
 *      (the hdrOut branch runs the EXTENDED, unclamped transfer encode — a
 *      float16 srgb/display-p3 canvas stores NON-LINEAR signals per W3C
 *      ColorWeb-CG. See image/tonemap.ts's extendedOutputEncode.)
 *
 * ## Not wired into any renderer/bundle entry point yet
 * Per the Task 5 brief: this module (and its shaders) may be imported by a
 * future "image-engine" consumer, but must NOT be reachable from `core`
 * (any always-loaded module, in particular `index.ts`'s barrel) until a
 * later task finalizes bundling (Task 6's `GpuImagePane`, Task 8). Nothing
 * in `cairn-plot` currently imports this file.
 */
import type { BindGroup, Device, RenderPipeline, Surface, Texture, TextureFormat } from "./webgpu/device-contract";
import { imageWGSL } from "./shaders/image.wgsl.ts";
import { compareSplitWGSL, compareBlendWGSL } from "./shaders/compare.wgsl.ts";
import { computeCompareMapping, type CompareMapping } from "./compare-align";
import { EXTENDED_TONEMAP_PEAK_DEFAULT } from "../model/tonemap";
// The operatorId uniform values are GENERATED from the display-encoding registry
// (image/encodings) — the SAME source the shader's assembled `applyOperator`
// dispatch keys on, so the CPU packing here and the GPU dispatch can never drift.
import { OPERATOR_ID, NORM_ID, REDUCE_ID, type NormMode, type ReduceMode } from "../model/encodings/index.ts";

export interface ImageParams {
  /** Exposure in EV stops, applied in scene-linear space: v * 2**ev. */
  exposureEV: number;
  /** TEV display offset — added to the scene value AFTER exposure and BEFORE
   *  the colormap / tone-map / output-encode stages. Unset = 0 (identity), so
   *  omitting it renders bit-for-bit as before. */
  offset?: number;
  /** Registered display operation id. The registry is the sole authority; the
   * engine has no parallel closed union of operation names. */
  displayOperationId: string;
  /** Output-encode gamma override. Unset/<=0 = sRGB OETF (matches outputEncode's `undefined` case). */
  gamma?: number;
  /** 256x4 (RGBA-float, [0,1]) colormap LUT, flattened row-major. Required iff `isScalar`. */
  colormap?: Float32Array;
  /** When true, `rgb.r` (post-exposure) indexes `colormap` instead of being tone-mapped directly. */
  isScalar: boolean;
  /**
   * DATA-encoding norm (Phase 4) — the nonlinear reshape of the LUT index on the
   * scalar/LUT path. Unset = `"linear"` (identity), so a colormap with no norm
   * renders exactly as before. `"power"` reuses `gamma` as its exponent (the lut
   * path leaves gamma otherwise unused). Ignored when `isScalar` is false.
   */
  norm?: NormMode;
  /**
   * DATA-encoding BOUNDS (Phase 4) — the ALTERNATIVE domain skin to exposure/
   * offset: the LUT index becomes `(scalar - normMin)/(normMax - normMin)`.
   * Engaged iff BOTH are finite numbers (seeded from the descriptor colorRange);
   * otherwise the exposure/offset sensitivity is the sole affine (the two are
   * skins over one affine — never composed). Ignored when `isScalar` is false.
   */
  normMin?: number;
  normMax?: number;
  /**
   * DATA-encoding multi-channel REDUCE (the multi-channel-colormap follow-up) —
   * how a k>1 sample collapses to the scalar the LUT indexes, applied BEFORE the
   * norm/bounds. `"luminance"` (Rec.709) or `"mean"`. Ignored when `isScalar` is
   * false OR when `channelCount` ≤ 1 (the scalar IS the channel). Unset → treated
   * as `"mean"` on the GPU only if `channelCount` > 1, but callers always pass the
   * resolved mode; at k≤1 the shader's guard makes it moot.
   */
  reduce?: ReduceMode;
  /**
   * Source channel arity `k` for the scalar/LUT reduce (the multi-channel-colormap
   * follow-up). Unset/≤1 → the LUT reads channel 0 unchanged (scalar colormap, the
   * pre-follow-up behavior). Ignored when `isScalar` is false.
   */
  channelCount?: number;
  /**
   * ANALYTIC data encoding (the tev-style signed red-green follow-up) — on the
   * `isScalar` path, COMPUTE the color (`cairnSignedAnalyticColor`: negative →
   * red, positive → green, amplitude `2*|v|`) instead of sampling `colormap`, and
   * run it through the SHARED output-encode (so `|v|>1` survives on an `hdrOut`
   * surface, `|v|<=1` renders identically on SDR). No LUT is bound/read. Ignored
   * when `isScalar` is false; `norm`/`normMin`/`normMax` are ignored under it (the
   * analytic map is intrinsically linear in `|v|`). Unset = false.
   */
  analytic?: boolean;
  /**
   * Scalar Linear display operation — on
   * the `isScalar` path, produce the SCENE-LINEAR gray `vec3(idx)` (where `idx` is
   * the SAME `cairnDataIndex` the LUT path computes: linear norm + no bounds = the
   * RAW value passed through UNCLAMPED; log/power/bounds map it to `[0,1]`) and run
   * it through the SHARED output-encode instead of sampling `colormap`. So the SDR
   * surface clamps to `[0,1]` (byte-identical to the old srgb/linear/gamma curve for
   * in-range values) while an `hdrOut` surface lets `idx>1` SURVIVE — the directive's
   * "none colormap on a single channel supports HDR natively". No LUT is bound/read.
   * Mutually exclusive with `analytic`. Ignored when `isScalar` is false; the encode
   * transfer is {@link scalarTransferGamma}. Unset = false. */
  scalarTransfer?: boolean;
  /**
   * TURBO false-color (the tev-exact follow-up) — on the `isScalar` path, index
   * the bound `colormap` (the turbo table) at tev's FIXED log2 mapping
   * (`cairnTurboDataIndex`: `clamp(log2(scalar + 2⁻⁵)/10 + 0.5, 0, 1)`) instead of
   * the user-facing `cairnDataIndex` norm/bounds path. `norm`/`normMin`/`normMax`
   * are ignored under it (turbo bakes its own index); `reduce` still applies
   * (default `mean`, tev's RGB average) and exposure/offset apply BEFORE the log2.
   * Requires `colormap` to be the turbo table. Mutually exclusive with
   * `analytic`/`scalarTransfer`. Ignored when `isScalar` is false. Unset = false. */
  turbo?: boolean;
  /** Scalar-transfer output encoding (only read when {@link scalarTransfer}): `0`/unset →
   *  the sRGB OETF (matching the default `srgb` transfer), `1` → linear identity
   *  encode, `γ` → the `1/γ` power curve (the `gamma` transfer). This is the CURVE's
   *  own encode-gamma (`resolveEncodeGamma`); it is a SEPARATE slot from the power-
   *  NORM exponent (which still rides `gamma`/`u_bind2.z`), so a scalar image can
   *  carry both a display transfer and a power norm without collision. */
  scalarTransferGamma?: number;
  /** When true, run the EXTENDED output-encode (unclamped, origin-mirrored sRGB
   *  OETF / power curve) and write the transfer-encoded float to `target` — the
   *  hdrOut / extended-surface path. (Formerly this SKIPPED the encode and wrote
   *  raw scene-linear; per W3C ColorWeb-CG a float16 srgb/display-p3 canvas
   *  stores non-linear signals, so the encode is required. See image/tonemap.ts's
   *  extendedOutputEncode doc block.) */
  hdrOut: boolean;
  /** When true, sRGB-DECODE the sampled source to linear BEFORE exposure — an
   *  8-bit sRGB source going through the SDR display-transfer pipeline (tev-style
   *  decode→exposure→operator→encode). Unset = false: the HDR/float path leaves a
   *  scene-linear source untouched, so omitting it renders bit-for-bit as before. */
  srgbDecode?: boolean;
  /** Peak white (×SDR white) for the extended roll-off operators
   *  (`extended-reinhard`/`extended-aces`). Unset defaults to
   *  `EXTENDED_TONEMAP_PEAK_DEFAULT` (4); ignored by every other operator. */
  peak?: number;
  /** Source-space [0,1] viewport window (zoom/pan): sampled UV = uv.xy + rawUV * uv.wh. */
  uv: { x: number; y: number; w: number; h: number };
  /**
   * Source-texture filter mode (Q20). `"linear"` (the default when unset) is
   * a manual bilinear blend of the 4 neighboring texels — see
   * `image.wgsl.ts`'s "Source filtering" doc note for why this is hand-rolled
   * in-shader rather than a real `Device.createSampler` + `textureSample`
   * (the HDR `rgba32float` path would need the optional `float32-filterable`
   * WebGPU feature for that, which isn't guaranteed available).
   * `"nearest"` is a single exact texel fetch (crisp/blocky) — callers
   * (`GpuImagePane`) switch to this once a source pixel is large enough
   * on-screen for `PixelValueOverlay`'s per-pixel numbers to appear, so the
   * two visual cues change in lockstep. Defaulting to `"linear"` does not
   * change any EXISTING byte-exact parity-test case: at exact texel-aligned
   * sampling (every case in `image-pass.browser.ts`/`compare-pass.browser.ts`)
   * the bilinear weight is exactly 0, degenerating to the same value nearest
   * would produce.
   */
  filter?: "nearest" | "linear";
  /**
   * SECOND source slot `b` (the reference/baseline of an arity-2 diff CONTENT op)
   * — sampled at the same source UV as `src` and fed to `cairnContent(a, b, opId)`.
   * Only read when {@link contentOpId} selects a `direct` diff op; for the
   * single-image (identity) path it is omitted and a 1x1 placeholder is bound
   * (WebGPU requires every declared binding to have a resource). See
   * `image/content-ops` + `image.wgsl.ts`'s t_bind11.
   */
  srcB?: Texture;
  /**
   * CONTENT-op dispatch id (`image/content-ops`' `CONTENT_OP_ID`): 0 = IDENTITY
   * (passthrough of `src`; the default, so omitting it renders bit-for-bit as
   * before), 1.. = the direct pointwise diff ops (signed/absolute/…). Packed into
   * the u_bind12 uniform. Cached metrics (FLIP/SSIM) are NOT dispatched here —
   * they render into a result texture bound as `src` + identity. Unset = 0.
   */
  contentOpId?: number;
  /**
   * COMPOSITOR param (Phase 3) — the per-frame scalar the split/blend content ops
   * read from `u_bind13.x`: the split DIVIDER position (`[0,1]` dest-space, the
   * reference is shown where `uv.x < contentParam`) or the blend ALPHA
   * (`mix(reference, foreground, contentParam)`). Only the compositor ops read it;
   * the diff/identity ops ignore it, so omitting it (default 0) leaves every other
   * path bit-for-bit unchanged. Driven live (divider drag / blend slider) — only
   * this uniform changes, NO pipeline recompile.
   */
  contentParam?: number;
  /**
   * DISPLAY-space post-processing (the 8-bit `ImageProcessing` block's
   * brightness/contrast/flipSign) — applied as a FINAL affine in the ENCODED
   * (display) color space AFTER the output-encode, the numeric mirror of the CPU
   * SDR pane's CSS `filter` (`applyDisplayAdjust1` in image/tonemap.ts). Packed
   * into u_bind14 as [brightness, contrast, flipSign?1:0, 0]. All unset/omitted →
   * the zero-filled identity (bit-for-bit the pre-processing path). exposure/offset
   * are NOT here — those are scene-linear (exposureEV/offset). Unset = identity. */
  brightness?: number;
  /** See {@link brightness}. CSS `contrast(1 + contrast)` gain; unset = 0 (identity). */
  contrast?: number;
  /** See {@link brightness}. CSS `invert(1)` sign flip; unset = false (identity). */
  flipSign?: boolean;
  /**
   * TEST-ONLY oracle tag (never read by the shader / render path). Set true by the
   * pane whenever a COMPARE is intended (`hasCompare`), so the pool's render-log
   * oracle can flag a PIPELINE MISMATCH: a plain identity/image-pipeline present
   * (`mode:"image"`, no `contentOpId`) that fires while the pane is semantically in
   * compare mode — i.e. a raw blit of the REFERENCE primary that slipped onto the
   * visible surface before the diff result. Costs one boolean copy; unused in
   * production (only the render log reads it, and only when a harness armed it).
   */
  compareIntended?: boolean;
}

/** One compiled pipeline per (Device, target TextureFormat) — pipelines are format-specific (targetFormat is baked into createRenderPipeline). */
const pipelineCache = new WeakMap<Device, Map<TextureFormat, RenderPipeline>>();

function getImagePipeline(device: Device, targetFormat: TextureFormat): RenderPipeline {
  let byFormat = pipelineCache.get(device);
  if (!byFormat) {
    byFormat = new Map();
    pipelineCache.set(device, byFormat);
  }
  let pipeline = byFormat.get(targetFormat);
  if (!pipeline) {
    pipeline = device.createRenderPipeline({ shaderWGSL: imageWGSL, targetFormat });
    byFormat.set(targetFormat, pipeline);
  }
  return pipeline;
}

function targetFormatOf(target: Surface | Texture): TextureFormat {
  if ("canvas" in target) {
    return (target as Surface).hdr ? "rgba16float" : "rgba8unorm";
  }
  return (target as Texture).format;
}

/**
 * Builds the `t_bind1` colormap-LUT texture for this call. When
 * `params.colormap` is absent (non-scalar path), a 1x1 placeholder is still
 * created — WebGPU's `GPUBindGroupLayout` requires EVERY declared texture
 * binding to have a bound resource (see `webgpu/device.ts`'s
 * `createBindGroup` doc note), and the shader never reads it unless
 * `isScalar` is set, so its contents are irrelevant in that case.
 *
 * When a `colormap` IS provided it must be EXACTLY `256*4` floats (a 256x4
 * RGBA-float LUT, per `ImageParams.colormap`'s doc comment) — the shader's
 * LUT index is clamped to `[0, 255]` (see `image.wgsl.ts`/`image.glsl.ts`),
 * so a shorter/longer/mis-shaped array would either silently truncate (data
 * loss, no error) or leave the tail out of range; both are caller bugs
 * that are cheap to catch here instead of surfacing as a subtly-wrong
 * render.
 */
function buildColormapTexture(device: Device, colormap: Float32Array | undefined): Texture {
  if (colormap) {
    if (colormap.length !== 256 * 4) {
      throw new Error(
        `renderImage: params.colormap must have exactly 256*4=1024 floats (256x4 RGBA LUT), got ${colormap.length}`,
      );
    }
    const tex = device.createTexture(256, 1, "rgba32float");
    tex.write(colormap);
    return tex;
  }
  const tex = device.createTexture(1, 1, "rgba32float");
  tex.write(new Float32Array([0, 0, 0, 1]));
  return tex;
}

/**
 * Runs the IMAGE render pass: samples `src` through the exposure/colormap/
 * tone-map/output-encode pipeline (see module doc comment) and writes the
 * result to `target`. Allocates (and frees) a per-call colormap texture and
 * bind group — Task 6+ may cache these for a real per-frame render loop;
 * Task 5's scope is correctness/parity, not a hot-path allocation budget.
 */
export function renderImage(device: Device, target: Surface | Texture, src: Texture, params: ImageParams): void {
  const targetFormat = targetFormatOf(target);
  const pipeline = getImagePipeline(device, targetFormat);
  const lut = buildColormapTexture(device, params.isScalar ? params.colormap : undefined);

  const gamma = typeof params.gamma === "number" && params.gamma > 0 ? params.gamma : 0;
  const operatorId = OPERATOR_ID[params.displayOperationId];
  if (operatorId === undefined) throw new Error(`unknown display operation ${JSON.stringify(params.displayOperationId)}`);

  // Field order MUST match image.wgsl.ts / image.glsl.ts's u_bind2/u_bind3/u_bind4 doc comments.
  const paramsVec = new Float32Array([params.exposureEV, operatorId, gamma, params.isScalar ? 1 : 0]);
  const uvRect = new Float32Array([params.uv.x, params.uv.y, params.uv.w, params.uv.h]);
  const hdrFlag = new Float32Array([params.hdrOut ? 1 : 0]);
  // Field order MUST match image.wgsl.ts / image.glsl.ts's u_bind5 doc
  // comment. Default "linear" when unset — see ImageParams.filter's doc.
  const filterFlag = new Float32Array([params.filter === "nearest" ? 0 : 1]);
  // u_bind6 = TEV display offset (default 0 = identity).
  const offsetVec = new Float32Array([params.offset ?? 0]);
  // u_bind7 = PEAK white (×SDR white) for the extended roll-off operators
  // (ids 5/6). Default 4 when unset; ignored by every other operator.
  const peakVec = new Float32Array([params.peak ?? EXTENDED_TONEMAP_PEAK_DEFAULT]);
  // u_bind8 = srgbDecode flag (default 0 = no decode; the HDR/float path).
  const srgbDecodeVec = new Float32Array([params.srgbDecode ? 1 : 0]);
  // u_bind9 = DATA-encoding norm params (scalar/LUT path only): normMode id,
  // boundsMin, boundsMax, boundsActive. boundsActive iff BOTH bounds are finite
  // (the min/max skin; else the exposure/offset skin — never composed).
  const normId = NORM_ID[params.norm ?? "linear"] ?? 0;
  const hasBounds =
    typeof params.normMin === "number" && Number.isFinite(params.normMin) &&
    typeof params.normMax === "number" && Number.isFinite(params.normMax);
  const normVec = new Float32Array([
    normId,
    hasBounds ? (params.normMin as number) : 0,
    hasBounds ? (params.normMax as number) : 0,
    hasBounds ? 1 : 0,
  ]);
  // u_bind10 = DATA-encoding multi-channel REDUCE (scalar/LUT path only): reduce
  // mode id, channelCount k, reserved, reserved. At k<=1 the shader returns
  // channel 0 regardless of the mode (the pre-follow-up scalar path), so a scalar
  // colormap renders bit-for-bit as before.
  const reduceId = REDUCE_ID[params.reduce ?? "mean"] ?? 0;
  const channelCount = typeof params.channelCount === "number" ? params.channelCount : 1;
  // u_bind10.z = SCALAR-MODE enum (scalar/LUT path only): 0 = LUT sample, 1 =
  // ANALYTIC signed color (tev red-green), 2 = scalar Linear transfer
  // encoding), 3 = TURBO false-color (tev-exact: the bound turbo table sampled at
  // the FIXED log2 index, bypassing the norm path). u_bind10.w = scalar-transfer
  // encode-gamma (0 = sRGB OETF, >0 = 1/γ power curve) — a separate slot from the
  // power-norm exponent (which rides gamma/u_bind2.z). Both default to 0.
  const scalarMode = params.analytic ? 1 : params.scalarTransfer ? 2 : params.turbo ? 3 : 0;
  const scalarTransferGamma =
    typeof params.scalarTransferGamma === "number" && params.scalarTransferGamma > 0 ? params.scalarTransferGamma : 0;
  const reduceVec = new Float32Array([reduceId, channelCount, scalarMode, scalarTransferGamma]);

  // u_bind12 = CONTENT-op dispatch id (0 = identity passthrough, the default).
  const contentOpIdVec = new Float32Array([params.contentOpId ?? 0]);
  // u_bind13 = COMPOSITOR param (split divider position / blend alpha) in .x;
  // .yzw reserved. Default 0 — the diff/identity ops ignore it.
  const contentParamVec = new Float32Array([params.contentParam ?? 0, 0, 0, 0]);
  // u_bind14 = DISPLAY-space post-processing (brightness/contrast/flipSign) —
  // [brightness, contrast, flipSign?1:0, 0]. Default vec4(0) = cairnDisplayAdjust
  // identity, so an image with no processing renders bit-for-bit as before.
  const displayAdjustVec = new Float32Array([
    params.brightness ?? 0,
    params.contrast ?? 0,
    params.flipSign ? 1 : 0,
    0,
  ]);
  // Logical binding 11 = the SECOND source slot `b` (arity-2 diff ops). Bind the
  // caller's srcB, or a 1x1 placeholder for the single-image path — WebGPU
  // requires every declared texture binding to have a resource, and the IDENTITY
  // op ignores it. A placeholder is allocated (+ freed) only when srcB is absent.
  const placeholderB = params.srcB ? undefined : buildColormapTexture(device, undefined);
  const srcB = params.srcB ?? (placeholderB as Texture);

  let bindGroup: BindGroup | undefined;
  try {
    bindGroup = device.createBindGroup(pipeline, [
      { binding: 0, resource: src },
      { binding: 1, resource: lut },
      { binding: 2, resource: { uniform: paramsVec } },
      { binding: 3, resource: { uniform: uvRect } },
      { binding: 4, resource: { uniform: hdrFlag } },
      { binding: 5, resource: { uniform: filterFlag } },
      { binding: 6, resource: { uniform: offsetVec } },
      { binding: 7, resource: { uniform: peakVec } },
      { binding: 8, resource: { uniform: srgbDecodeVec } },
      { binding: 9, resource: { uniform: normVec } },
      { binding: 10, resource: { uniform: reduceVec } },
      { binding: 11, resource: srcB },
      { binding: 12, resource: { uniform: contentOpIdVec } },
      { binding: 13, resource: { uniform: contentParamVec } },
      { binding: 14, resource: { uniform: displayAdjustVec } },
    ]);
    device.renderFullscreen(target, pipeline, bindGroup);
  } finally {
    bindGroup?.destroy?.();
    lut.destroy();
    placeholderB?.destroy();
  }
}

// ===========================================================================
// COMPOSE render pass — split / blend view compositions over TWO textures.
// (Diff moved to the cached kernel path — see `engine/diff-engine.ts`. The
// `diffChannel` switch + mode/submode uniforms were DELETED per the
// diff-kernel spec; split/blend are now two switch-free specialized pipelines
// built from the shared prelude — see `engine/shaders/compare.wgsl.ts`.)
// ===========================================================================

/** Pane-facing compare mode. `diff` is handled by the diff-engine, not the
 *  compose pipelines here — see `renderCompose`. */
export type CompareMode = "split" | "blend" | "diff";

export interface CompareParams extends ImageParams {
  /** Compose mode. Only `split`/`blend` are rendered here; `diff` is a caller
   *  error (routed to the diff-engine instead). */
  mode: CompareMode;
  /** Split-divider screen-space fraction `[0,1]` — reference (texA) shown where `uv.x < split`. */
  split: number;
  /** Blend factor `[0,1]` for `mode:"blend"` — `mix(texA, texB, alpha)`. */
  alpha: number;
  /** sRGB-DECODE the A side (reference/texA) to scene-linear BEFORE exposure —
   *  set for a u8 sRGB operand so the unified operator×peak pipeline runs on
   *  linear light; a float (scene-linear) operand leaves it off. Per-SIDE (not
   *  the shared `ImageParams.srgbDecode`) because a compare pane can mix a u8 and
   *  a float operand. Unset = false. */
  srgbDecodeA?: boolean;
  /** sRGB-DECODE the B side (foreground/texB) to scene-linear. See {@link srgbDecodeA}. */
  srgbDecodeB?: boolean;
}

// One compiled pipeline per (Device, split|blend shader, target format).
const composeCache = new WeakMap<Device, Map<string, RenderPipeline>>();

function getComposePipeline(device: Device, mode: "split" | "blend", targetFormat: TextureFormat): RenderPipeline {
  let byKey = composeCache.get(device);
  if (!byKey) {
    byKey = new Map();
    composeCache.set(device, byKey);
  }
  const key = `${mode}:${targetFormat}`;
  let pipeline = byKey.get(key);
  if (!pipeline) {
    pipeline = device.createRenderPipeline({
      shaderWGSL: mode === "split" ? compareSplitWGSL : compareBlendWGSL,
      targetFormat,
    });
    byKey.set(key, pipeline);
  }
  return pipeline;
}

/**
 * Runs the COMPOSE render pass: samples `texA` (reference/baseline, the "A"
 * role: left side / alpha=0 endpoint) and `texB` (foreground/comparison)
 * through the shared exposure/scalar-LUT/tonemap/encode pipeline, then
 * composites them per `params.mode` (split | blend) into `target` using the
 * matching switch-free specialized pipeline. `mode:"diff"` is NOT valid here —
 * the pane routes diff through `engine/diff-engine.ts` (cached kernel result +
 * `renderDiffDisplay`).
 */
export function renderCompose(
  device: Device,
  target: Surface | Texture,
  texA: Texture,
  texB: Texture,
  params: CompareParams,
): void {
  if (params.mode === "diff") {
    throw new Error("renderCompose: mode 'diff' is handled by the diff-engine, not renderCompose");
  }
  const targetFormat = targetFormatOf(target);
  const pipeline = getComposePipeline(device, params.mode, targetFormat);
  const lut = buildColormapTexture(device, params.isScalar ? params.colormap : undefined);

  const gamma = typeof params.gamma === "number" && params.gamma > 0 ? params.gamma : 0;
  const operatorId = OPERATOR_ID[params.displayOperationId];
  if (operatorId === undefined) throw new Error(`unknown display operation ${JSON.stringify(params.displayOperationId)}`);

  // u_img: exposureEV, operatorId, gamma, isScalar.
  const imgVec = new Float32Array([params.exposureEV, operatorId, gamma, params.isScalar ? 1 : 0]);
  // u_uv: uvRect.xy, uvRect.wh.
  const uvRect = new Float32Array([params.uv.x, params.uv.y, params.uv.w, params.uv.h]);
  // u_compose: split, alpha, hdrOut, filterMode.
  const composeVec = new Float32Array([
    params.split,
    params.alpha,
    params.hdrOut ? 1 : 0,
    params.filter === "nearest" ? 0 : 1,
  ]);
  // u_extra: offset, peak, srgbDecodeA, srgbDecodeB. offset is the TEV display
  // offset (default 0 = identity); peak is the PEAK white ceiling for the
  // extended operators (default 4); srgbDecodeA/B sRGB-DECODE each u8 side to
  // scene-linear (default 0 = a scene-linear/float side) — see CompareParams.
  const extraVec = new Float32Array([
    params.offset ?? 0,
    params.peak ?? EXTENDED_TONEMAP_PEAK_DEFAULT,
    params.srgbDecodeA ? 1 : 0,
    params.srgbDecodeB ? 1 : 0,
  ]);

  let bindGroup: BindGroup | undefined;
  try {
    bindGroup = device.createBindGroup(pipeline, [
      { binding: 0, resource: texA },
      { binding: 1, resource: texB },
      { binding: 2, resource: lut },
      { binding: 3, resource: { uniform: imgVec } },
      { binding: 4, resource: { uniform: uvRect } },
      { binding: 5, resource: { uniform: composeVec } },
      { binding: 6, resource: { uniform: extraVec } },
    ]);
    device.renderFullscreen(target, pipeline, bindGroup);
  } finally {
    bindGroup?.destroy?.();
    lut.destroy();
  }
}

// ===========================================================================
// Diff metrics (Task 7): MSE / PSNR / MAE over the raw (un-tonemapped) source
// pixels of texA vs texB — computed via a GPU reduction pass.
// ===========================================================================

export interface DiffMetrics {
  /** Mean squared error, averaged over all RGB channels of the comparison region. */
  mse: number;
  /** Peak signal-to-noise ratio in dB (peak = 1.0); `Infinity` when `mse === 0`. */
  psnr: number;
  /** Mean absolute error, averaged over all RGB channels. */
  mae: number;
}

/** Turns per-channel `sumSq`/`sumAbs` (over `channelCount` RGB samples) into
 *  `{mse, psnr, mae}` — the ONE formula both backends funnel through, so a
 *  GPU-reduced and a CPU-reduced result are identical up to float rounding. */
function metricsFromSums(sumSq: number, sumAbs: number, channelCount: number): DiffMetrics {
  if (channelCount <= 0) return { mse: 0, psnr: Infinity, mae: 0 };
  const mse = sumSq / channelCount;
  const mae = sumAbs / channelCount;
  const psnr = mse <= 0 ? Infinity : 10 * Math.log10(1 / mse);
  return { mse, psnr, mae };
}

/**
 * Computes `{mse, psnr, mae}` between `texA` and `texB` over their overlapping
 * `min(width) x min(height)` region (RGB channels; peak = 1.0). The O(N)
 * per-pixel diffing runs on the GPU (`Device.reduceDiffSumSquaredAbs` -> the
 * reduction family's `diffSqAbs`/`sum` variant, `engine/reduce/registry.ts`); a
 * `readback()` + CPU-loop path below is
 * kept as a defensive fallback for a device that doesn't implement the GPU
 * reduction (the engine's one backend, WebGPU, always does) — same
 * `metricsFromSums` formula either way, so the two paths agree.
 *
 * Both textures must be readable float/byte textures the active backend's
 * `readback()` supports (the CPU fallback path) — for the metrics use case
 * they are the exact source textures a pane already uploaded.
 */
export async function computeMetrics(
  device: Device,
  texA: Texture,
  texB: Texture,
  mapping?: CompareMapping,
): Promise<DiffMetrics> {
  const map =
    mapping ??
    computeCompareMapping({ w: texA.width, h: texA.height }, { w: texB.width, h: texB.height }, "top-left", "crop", "b");
  const width = map.result.w;
  const height = map.result.h;
  const channelCount = width * height * 3;
  if (channelCount <= 0) return { mse: 0, psnr: Infinity, mae: 0 };

  // Fast path — the DEFAULT top-left crop (zero offsets, `fit:"crop"`) reduces
  // exactly the top-left `min(A,B)` region the GPU reduction already covers, so
  // the common case stays on the GPU. Any alignment offset or `fit:"fill"` needs
  // the mapped CPU reduction below (readback), so the metrics honor the SAME
  // mapping the displayed diff / TEV numbers use — overlap region under crop,
  // full common grid under fill.
  const isDefault =
    map.fit === "crop" &&
    map.offsetA.x === 0 && map.offsetA.y === 0 &&
    map.offsetB.x === 0 && map.offsetB.y === 0;
  if (isDefault && device.reduceDiffSumSquaredAbs) {
    const { sumSq, sumAbs } = await device.reduceDiffSumSquaredAbs(texA, texB, width, height);
    return metricsFromSums(sumSq, sumAbs, channelCount);
  }

  // Readback + CPU reduce, applying the align/fit mapping per source (mirrors
  // SOURCE_MAP_WGSL): integer texel offset under crop; normalized-uv bilinear
  // rescale under fill. Also the defensive fallback for a device with no GPU
  // reduction.
  const a = await device.readback(texA);
  const b = await device.readback(texB);
  const normA = a instanceof Uint8Array ? 255 : 1;
  const normB = b instanceof Uint8Array ? 255 : 1;
  const sampleA = makeCpuMapSampler(a, texA.width, texA.height, normA, map.offsetA, map.fit === "fill", width, height);
  const sampleB = makeCpuMapSampler(b, texB.width, texB.height, normB, map.offsetB, map.fit === "fill", width, height);
  let sumSq = 0;
  let sumAbs = 0;
  const va = [0, 0, 0];
  const vb = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sampleA(x, y, va);
      sampleB(x, y, vb);
      for (let c = 0; c < 3; c++) {
        const d = va[c]! - vb[c]!;
        sumSq += d * d;
        sumAbs += Math.abs(d);
      }
    }
  }
  return metricsFromSums(sumSq, sumAbs, channelCount);
}

/**
 * A CPU replica of `SOURCE_MAP_WGSL`'s `mapSample` for one source: maps a RESULT
 * pixel `(x,y)` to the source's RGB (normalized) via an integer texel offset
 * (crop) or normalized-uv bilinear rescale (fill), writing into `out[0..2]`.
 * Keeps `computeMetrics` byte-consistent with the GPU diff / TEV mapping.
 * Exported so the SSIM scalar's CPU fallback (`diff-engine.ts`
 * `ensureSsimScalar` → `ssim-reference.ts`) samples the SAME mapped region.
 */
export function makeCpuMapSampler(
  data: Uint8Array | Float32Array,
  srcW: number,
  srcH: number,
  norm: number,
  offset: { x: number; y: number },
  fill: boolean,
  resW: number,
  resH: number,
): (x: number, y: number, out: number[]) => void {
  const at = (sx: number, sy: number, c: number): number => data[(sy * srcW + sx) * 4 + c] ?? 0;
  if (!fill) {
    return (x, y, out) => {
      const sx = Math.min(Math.max(x + offset.x, 0), srcW - 1);
      const sy = Math.min(Math.max(y + offset.y, 0), srcH - 1);
      out[0] = at(sx, sy, 0) / norm;
      out[1] = at(sx, sy, 1) / norm;
      out[2] = at(sx, sy, 2) / norm;
    };
  }
  const maxX = srcW - 1;
  const maxY = srcH - 1;
  return (x, y, out) => {
    const u = (x + 0.5) / resW;
    const v = (y + 0.5) / resH;
    const tx = u * srcW - 0.5;
    const ty = v * srcH - 0.5;
    const bx = Math.floor(tx);
    const by = Math.floor(ty);
    const fx = tx - bx;
    const fy = ty - by;
    const x0 = Math.min(Math.max(bx, 0), maxX);
    const x1 = Math.min(Math.max(bx + 1, 0), maxX);
    const y0 = Math.min(Math.max(by, 0), maxY);
    const y1 = Math.min(Math.max(by + 1, 0), maxY);
    for (let c = 0; c < 3; c++) {
      const c00 = at(x0, y0, c);
      const c10 = at(x1, y0, c);
      const c01 = at(x0, y1, c);
      const c11 = at(x1, y1, c);
      const top = c00 + (c10 - c00) * fx;
      const bot = c01 + (c11 - c01) * fx;
      out[c] = (top + (bot - top) * fy) / norm;
    }
  };
}
