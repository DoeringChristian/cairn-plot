/**
 * Many-panes GPU resource pool (Task 6 of the WebGPU engine, Sub-project 1) —
 * `acquirePane(canvas)` / `releasePane(handle)`, consumed by
 * `renderers/GpuImagePane.tsx`.
 *
 * ## Why a pool at all
 * A page can host MANY image panes (a gallery grid, a notebook with dozens of
 * plots). One `GPUDevice` backs MANY `GPUCanvasContext`s just fine
 * (`engine/device.ts`'s module doc) — so every pane SHARES the ONE
 * `getSharedDevice()` instance; the per-pane cost is each pane's own source
 * texture (`Texture`) — potentially large for HDR float images.
 *
 * Even so, this pool caps the number of panes that hold LIVE GPU resources
 * ("swapchains" — a configured `Surface` + its source `Texture`) at
 * `MAX_LIVE_SWAPCHAINS`, tracked as an LRU, so a page with far more panes
 * than are ever on-screen at once (a big gallery) doesn't keep every pane's
 * source texture resident. A pane that scrolls off-screen is **parked**: its
 * `Surface`/`Texture` are freed. Direct `setSource()` buffers remain pane-owned;
 * reconstructible `setSourceLease()` buffers are released immediately after a
 * successful upload (and while waiting), retaining only exact layout metadata
 * plus the raw-source reacquire closure needed for restore. Admission is stable: when more panes are
 * intersection-visible than the count/byte budgets permit, excess panes enter
 * a FIFO waiting state and keep their last painted canvas. A pane that has not
 * yet presented its current content generation may rotate an already-presented
 * visible pane exactly until that first presentation succeeds; passive retries
 * after presentation never displace another visible pane. An offscreen/disposed
 * live pane frees a slot and admits the oldest eligible visible waiter. `GpuImagePane` drives
 * `park()`/`restore()`/`setVisible()` from its `IntersectionObserver`; after a
 * configurable offscreen delay reconstructible expanded CPU ownership is also
 * released (quick returns cancel it).
 *
 * `Surface` (`engine/types.ts`) exposes no explicit teardown (WebGPU's
 * `GPUCanvasContext` has no public "release the swapchain" call short of
 * `Device.destroy()` — see the RHI's doc notes) — so "parking" frees the
 * (often large) source `Texture` and simply stops rendering to the canvas;
 * re-`createSurface`-ing the SAME canvas on restore is a safe idempotent
 * re-configure (`webgpu/device.ts`'s `createSurface`).
 */
import {
  getGpuDiffCacheLimits,
  getGpuSourceTextureLimits,
  getGpuSourceTextureRetentionLimit,
  getLiveGpuPaneLimit,
  getOffscreenCpuReleaseMs,
} from "../../../resources/runtime-config.ts";
import { registerRuntimePolicyHook } from "../../../resources/runtime-policy-hooks.ts";
import { imageWebGpuRuntime } from "./device/runtime.ts";
import type { ImageWebGpuRuntime } from "./device/runtime.ts";
import {
  renderImage,
  releaseImageRenderState,
  computeMetrics,
  type ImageParams,
  type DiffMetrics,
} from "./image-engine";
// Phase 2b: the CACHED-op render path (FLIP / HDR-FLIP / SSIM) runs the diff
// engine's content-keyed compute + cache from INSIDE the pool (the pool owns the
// two source textures a cached op reduces). Safe to import here: `pool.ts` is
// browser-bundle only (never loaded by the `*.test.ts` strip-only node runner),
// so pulling the `engine/kernels` graph in transitively is fine.
import {
  ensureDiff,
  hasDiff,
  ensureSsimScalar,
  ensureDiffResultMean,
  hasSsimScalar,
  peekSsimScalar,
  ensureDiffResultReadback,
  type DiffCacheEntry,
} from "./diff-engine";
import { cacheFor, clearCacheFor } from "./diff-cache";
import { recordCachedPresent, recordSourceRebind, recordSourceUpload } from "./perf-stats.ts";
import { textureByteLength, textureBytes } from "./texture-bytes.ts";
import { mappingKey, type CompareMapping } from "../runtime/compare-align";
import { getWebGpuImageOperation, getWebGpuMultipassOperation } from "./image-operations.ts";
import { computeHdrFlipExposures } from "../runtime/hdr-flip-reference.ts";
import type { ImageOperationComputeContext } from "./operation-pass.ts";
import type {
  Device,
  Surface,
  Texture,
  TextureFormat,
  DeepSampleBuffers,
  DeepGpuCsrSpec,
  TexHistogramSpec,
  TexHistogramResult,
  DeepDepthHistogramResult,
} from "./device/device-contract";
import {
  forceEngineFailRequested,
  recordPaneRender,
  isPaneRenderLogActive,
  deepColorDetectorActive,
  recordDeepColorSample,
  type PaneRenderRecord,
} from "./test-hooks";

/**
 * Test-only: the FULL display-encode fingerprint of an `ImageParams`, for the
 * sharpened present-coherency oracle (the orange-frame proof). Reads only the
 * fields that decide the pixel's color path, so two DIFFERENT display combos
 * (a light image vs a scalar magma diff) are distinguishable from the ground
 * truth the pool actually presented with — no pixel readback. Cheap; only ever
 * called on the present hot path when a harness started the render log.
 */
function displayFingerprint(params: ImageParams): {
  operator?: string;
  hdrOut?: boolean;
  reduce?: string;
  channelCount?: number;
  scalarMode?: number;
  hasColormap?: boolean;
  colormapSig?: number;
  contentParam?: number;
} {
  const scalarMode = params.linearScalar ? 1 : 0;
  const lut = params.isScalar ? params.colormap : undefined;
  let colormapSig: number | undefined;
  if (lut && lut.length >= 1024) {
    // Sample a few LUT entries (mid + high ramp) so magma≠turbo≠viridis are
    // distinct; a stable, allocation-free scalar.
    colormapSig =
      lut[512] * 1 + lut[513] * 3 + lut[514] * 7 + // mid RGB
      lut[1020] * 11 + lut[1021] * 13 + lut[1022] * 17; // top RGB
  }
  return {
    operator: params.displayOperationId,
    hdrOut: params.hdrOut,
    reduce: params.reduce,
    channelCount: params.channelCount,
    scalarMode,
    hasColormap: !!lut,
    colormapSig,
    contentParam: params.contentParam,
  };
}

/**
 * Cap on simultaneously-LIVE GPU swapchains (configured `Surface` + source
 * `Texture`) across every pane this pool has acquired. Named per the Task 6
 * brief ("cap live swapchains... make it a named const"). 12 is a sensible
 * default: large enough that a normal viewport of on-screen panes all stay
 * live, small enough to bound total resident source-texture memory for a big
 * gallery.
 */
export const MAX_LIVE_SWAPCHAINS = 12;

/**
 * Cap on the number of CONTENT-KEYED source textures a single pane retains for
 * instant flip-back (see `PaneEntry.retained`). A stacked viewport reuses ONE
 * pane across its slots and re-drives it via `setSource`/`setSourceB` on every
 * flip; without retention each flip re-uploads the slot's source texture (the
 * `createTexture`+`write` cost, async behind the caller's decode), so flipping
 * BACK to an already-shown slot re-pays it and the cached diff RESULT can't be
 * presented until the re-upload lands — the reported residual flicker. When the
 * caller supplies a content key, the pool KEEPS the uploaded texture in a small
 * per-pane LRU so a flip back to that key rebinds it SYNCHRONOUSLY (no
 * re-upload). 6 covers the common stacks (a `[image, diff]` pair needs 3 keyed
 * textures — image, reference, foreground — and a 3-slot diff stack ~4–6)
 * while bounding resident source-texture memory; older keys evict (LRU) and
 * re-upload on their next visit. The retained set is per LIVE pane and is freed
 * wholesale on `park()`/`dispose()` — the pool's existing park/LRU discipline
 * (`MAX_LIVE_SWAPCHAINS`) stays the ultimate cap authority, so this never leaks
 * unbounded GPU memory (an off-screen pane holds ZERO retained textures).
 */
export const MAX_RETAINED_SOURCE_TEXTURES = 6;

/** A CPU-side source buffer + the GPU texture layout to upload it as. */
export interface SourceUpload {
  width: number;
  height: number;
  format: TextureFormat;
  data: ArrayBufferView;
}

/** One ref-counted ownership of an upload-ready CPU buffer. */
export interface SourceUploadLease {
  readonly upload: SourceUpload;
  release(): void;
}

interface SourceLayout {
  width: number;
  height: number;
  format: TextureFormat;
}

export interface PaneHandle {
  readonly canvas: HTMLCanvasElement;
  /** True while this pane's GPU resources are freed (parked). */
  readonly isParked: boolean;
  /** True when visible but stably waiting for count/byte admission. */
  readonly isWaiting: boolean;
  /**
   * Replace the CPU source buffer. Direct buffers are retained by the pool so
   * `park()`/restore cycles don't need the caller to re-supply them; prefer
   * `setSourceLease` for reconstructible expanded buffers. If the pane is
   * currently live and admitted, uploads immediately; if parked, deferred to the next
   * `render()`/`restore()`.
   *
   * Q22 fix: this does NOT touch `canvas.width/height` or the surface's
   * configured size — those are now driven exclusively by `resize()`, sized
   * to the pane's ON-SCREEN display resolution, fully decoupled from the
   * source image's own resolution (a 16x16 source image and a 4K source
   * image render into the SAME backing-store size for a given on-screen
   * pane). Previously this sized the canvas backing store to
   * `src.width/height` directly — the source's native resolution — which
   * the browser then CSS-upscaled to the pane's actual on-screen size,
   * producing blurry edges and sub-pixel jitter on zoom/pan.
   *
   * `contentKey` (optional) opts this slot into CONTENT-KEYED RETENTION (see
   * {@link MAX_RETAINED_SOURCE_TEXTURES}): the uploaded texture is kept in a
   * small per-pane LRU under the key, so a later `setSource` with the SAME key
   * (a stacked-viewport flip BACK to an already-shown slot) rebinds the resident
   * texture instead of re-uploading (`createTexture`+`write`). Omit it for the
   * plain single-image path (unkeyed, exclusive, freed on replace) — byte- and
   * lifecycle-identical to before.
   */
  setSource(src: SourceUpload, contentKey?: string): void;
  /** Transfer one cache lease to this pane. The lease is released after upload
   * or while waiting; `reacquire` provides exact native data for restoration. */
  setSourceLease(
    lease: SourceUploadLease,
    contentKey: string,
    reacquire: () => SourceUploadLease,
  ): void;
  /**
   * Set (or clear) the SECOND source buffer `b` — the reference/baseline operand
   * of an arity-2 diff IMAGE operation (`image/operations`). Retained by the pool
   * exactly like {@link setSource}'s primary buffer, so park/restore cycles don't
   * need the caller to re-supply it: uploaded immediately when live, deferred to
   * the next `render()`/`restore()` when parked. Pass `null` to drop it (back to
   * the single-image path). INDEPENDENT of {@link setSource} — the primary `a`
   * slot is untouched. Once set, {@link render}'s `params` are bound with this
   * texture as `srcB`, so a `params.imageOperation` selecting a `direct` diff op
   * (signed/absolute/…) samples both slots; the single-image (identity) path is
   * unaffected when `b` is null (a 1x1 placeholder is bound and identity ignores it).
   *
   * `contentKey` (optional) opts the `b` slot into the SAME content-keyed
   * retention {@link setSource} documents — a stacked flip back to a diff slot
   * rebinds the reference texture synchronously instead of re-uploading it.
   */
  setSourceB(src: SourceUpload | null, contentKey?: string): void;
  setSourceBLease(
    lease: SourceUploadLease | null,
    contentKey?: string,
    reacquire?: () => SourceUploadLease,
  ): void;
  /** Release reconstructible upload-ready CPU ownership immediately. Raw pixels
   * used by labels remain owned by the renderer/resolution cache. */
  releaseCpuUploads(): void;
  /**
   * DEEP-EXR GPU composite source (the depth slider on GPU panes). Uploads the
   * Z-sorted samples to GPU storage buffers ONCE and composites the window
   * [`zNear`, `zFar`] into this pane's `rgba16float` source texture — the texture
   * `render()` then blits. Retained across park/restore (re-uploaded +
   * re-composited on restore) like {@link setSource}'s CPU buffer. Replaces any
   * prior CPU/deep source. If live, uploads + composites immediately; if parked,
   * deferred to the next `render()`/`restore()`.
   */
  setDeepSource(spec: DeepGpuCsrSpec, zNear: number, zFar: number): void;
  /**
   * Re-composite the retained deep samples over a new Z WINDOW (no re-upload) —
   * the real-time depth-slider path. No-op unless a {@link setDeepSource} is
   * live. The caller still calls `render()` afterward to blit the result.
   */
  setDeepWindow(zNear: number, zFar: number): void;
  /**
   * Size this pane's canvas backing store + WebGPU surface to
   * `width x height` DEVICE pixels (i.e. already `displayCssSize * dpr` —
   * callers, e.g. `GpuImagePane`, compute that from a `ResizeObserver` on the
   * pane's container plus a `devicePixelRatio` watcher). Q22 fix: THIS, not
   * `setSource()`, is what the canvas/surface resolution now tracks — the
   * source image's resolution is irrelevant to how many device pixels the
   * canvas backs; only what's actually on screen matters (bilinear/nearest
   * sampling in the shader handles up- or down-sampling the source into
   * however many pixels this allocates). No-op if `width`/`height` (rounded)
   * match the current backing size. If the pane is currently live, resizes
   * immediately (re-`configure`s the surface — a safe idempotent call, same
   * as `webgpu/device.ts`'s `createSurface` doc note); if parked, the new
   * size is retained and applied by the next `render()`/`restore()`.
   */
  resize(width: number, height: number): void;
  /**
   * Run the IMAGE render pass with `params` against the current source.
   * Auto-restores a parked pane when admission permits. A capacity-blocked
   * visible pane remains a stable waiter and preserves its last painted frame;
   * it never displaces another visible pane. No-op (does not throw) if no source
   * has been set yet or the handle was disposed.
   *
   * MEASURE-THEN-RENDER CONTRACT: a render before the first `resize()` (no backing
   * size yet) is a no-op SUCCESS — the pane is briefly blank until its container is
   * measured, by design. There is no source-dims fallback: the surface is only ever
   * configured to the on-screen backing size (`resize()`).
   *
   * NEVER THROWS (C1 fix — whole-branch review): a hard GPU failure while
   * (re)activating this pane's resources or while running the render pass
   * itself is caught here, the entry is parked, and `false` is returned
   * instead of letting the exception propagate into the caller's
   * `useEffect` (which would otherwise unmount the caller's whole subtree —
   * React 18 unmounts to the nearest root on an uncaught effect throw).
   * Returns `true` on success. Callers (`renderers/GpuImagePane.tsx`) treat
   * a `false` return as "fall back to the legacy CPU pane".
   */
  render(params: ImageParams): boolean;
  /**
   * CACHED-op render path (FLIP / HDR-FLIP / SSIM). Ensures the content-keyed diff
   * RESULT texture for (`contentKeys.a`, `contentKeys.b`, `operationId`,
   * `computeParams`, `mapping`) over this pane's TWO live source slots (`a` =
   * {@link setSource}, `b` = {@link setSourceB}), then blits it through
   * `displayParams` — the result texture is bound as the PRIMARY source and shown
   * via IDENTITY content (the result already IS the scalar error) + the
   * `isScalar` colormap the display-operation registry supplies. The diff-engine's
   * per-device content-keyed cache OWNS the returned entry's texture — the caller
   * must NOT destroy it — and a zoom / exposure / colormap change only re-blits
   * (cache hit), never recomputes. Returns the cache entry (so the caller can read
   * MSE/PSNR/MAE + the per-pixel readback) or `null` on a hard GPU failure (the
   * pane is parked and the caller must fall back to the legacy pane), mirroring
   * {@link render}'s NEVER-THROWS contract. Both source slots must be set (returns
   * `null` otherwise).
   */
  renderDiffCached(
    operationId: string,
    contentKeys: { a: string; b: string },
    computeParams: Record<string, number> | undefined,
    displayParams: ImageParams,
    mapping?: CompareMapping,
  ): DiffCacheEntry | null;
  /**
   * NON-mutating residency peek for a CACHED diff (FLIP / HDR-FLIP / SSIM): is
   * the result for (kernel, contentKeys, computeParams, mapping) already resident
   * in the per-device diff cache? Uses the two live source textures' dims to
   * derive the default `mapping` (as {@link renderDiffCached} would). Returns
   * `false` when a slot is unset / disposed. The pane's paint-atomic flip path
   * calls this to gate a PRE-PAINT cached-diff render on residency — a resident
   * result blits synchronously (no recompute), a missing one stays on the
   * post-paint hold path. Never uploads, computes, or perturbs LRU.
   */
  isDiffResultCached(
    operationId: string,
    contentKeys: { a: string; b: string },
    computeParams: Record<string, number> | undefined,
    mapping?: CompareMapping,
  ): boolean;
  /**
   * Render THIS FRAME's diff for `operationId` — the ONE kernel-agnostic entry
   * point. The POOL picks the execution strategy from the kernel's own
   * declaration: POINTWISE → the per-frame image operation evaluated inside the
   * normal render pass (the pool injects `srcB`); MULTIPASS → the content-keyed
   * cached compute ({@link renderDiffCached}), with the KERNEL deriving its
   * compute params from the generic source facts in `ctx`, displayed as
   * identity content + isScalar colormap. Callers never see kernel kinds, param
   * derivations, or cache keys. Returns:
   *   - `{ entry }` — rendered; `entry` is the cache entry (the metrics
   *     readback seam) or `null` for a streamed pointwise kernel;
   *   - `"hold"` — no valid op resolved yet (the identity-op floor: a diff
   *     present must come from the diff pipeline — presenting identity would
   *     flash the reference operand). Skip this present and retry;
   *   - `"failed"` — hard GPU failure (fall back to the legacy pane).
   */
  renderDiff(
    operationId: string,
    contentKeys: { a: string; b: string },
    ctx: ImageOperationComputeContext,
    display: ImageParams,
    mapping?: CompareMapping,
  ): { entry: DiffCacheEntry | null } | "hold" | "failed";
  /**
   * NON-mutating residency peek for {@link renderDiff}: can this frame paint
   * WITHOUT a compute stall? A pointwise kernel streams inside the render pass
   * (resident iff its op id resolves); a multipass kernel is resident iff its
   * cached result is (the kernel derives the cache-key params from `ctx`
   * exactly as {@link renderDiff} does). Never uploads, computes, or perturbs
   * the cache LRU.
   */
  isDiffContentResident(
    operationId: string,
    contentKeys: { a: string; b: string },
    ctx: ImageOperationComputeContext,
    mapping?: CompareMapping,
  ): boolean;
  /**
   * GPU tev-parity VALUE HISTOGRAM over this pane's live PRIMARY source
   * texture at FULL pixel coverage (info panel M2). The pool routes to the
   * device kernels (`Device.computeTevTextureHistogram`) and memoizes the
   * result against the live texture OBJECT — content-scoped for free, since
   * the pool's textures are content-retained: a stacked flip back to a
   * retained slot re-uses the resolved promise, a re-upload naturally misses.
   * Returns `null` (not a rejection) when the pane is unset/disposed, the
   * device lacks the kernel, or a hard GPU failure occurs (the caller falls
   * back to the CPU reader loop) — and for DEEP composite sources, whose
   * source texture is rewritten in place on every z-window change (the value
   * histogram stays on the CPU flattened buffer there; the DEPTH histogram
   * below is the deep GPU path).
   */
  computeHistogram(spec: TexHistogramSpec): Promise<TexHistogramResult> | null;
  /**
   * GPU alpha-weighted DEPTH HISTOGRAM over this pane's retained deep CSR
   * (`Device.computeDeepDepthHistogram` — fixed-point atomics over the
   * GPU-resident z/alpha sample buffers), memoized per CSR spec + bins.
   * Z-window independent (it bins the FULL sample set). Returns `null` when
   * no deep source is set / the device lacks the kernel / a hard GPU failure
   * occurs — callers fall back to the CPU twin over the exported CSR.
   */
  computeDepthHistogram(bins: number): Promise<DeepDepthHistogramResult | null> | null;
  /**
   * MSE / PSNR / MAE over the two live source slots (`a` = {@link setSource},
   * `b` = {@link setSourceB}), honoring the align/fit `mapping` — the diff pane's
   * metrics chip. A source-data metric: the pool owns the textures, so the compute
   * runs against them here (the same `computeMetrics` `GpuComparePane` calls on its
   * self-managed textures). Returns `null` (not a rejected promise) when either
   * slot is unset / the handle is disposed / a hard GPU failure occurs.
   */
  computeMetrics(contentKeys?: { a: string; b: string }, mapping?: CompareMapping): Promise<DiffMetrics> | null;
  /**
   * Mean-SSIM scalar over the two live source slots — the diff metrics chip's SSIM
   * face. Runs `ensureSsimScalar` (the content+mapping-keyed cache) over the
   * pool-owned textures. Returns `null` when a slot is unset / disposed / a hard
   * GPU failure occurs.
   */
  isSsimScalarCached(contentKeys: { a: string; b: string }, mapping?: CompareMapping): boolean;
  peekSsimScalar(contentKeys: { a: string; b: string }, mapping?: CompareMapping): number | undefined;
  computeSsim(
    contentKeys: { a: string; b: string },
    mapping?: CompareMapping,
    retainMap?: boolean,
  ): Promise<number> | null;
  /**
   * Read back a cached diff RESULT (a {@link DiffCacheEntry} returned by
   * {@link renderDiffCached}) as the per-pixel metric values (RGBA f32, row-major,
   * result resolution) the TEV overlay prints in a CACHED diff mode. Memoized in
   * the entry (never re-reads, never recomputes). Returns `null` on a disposed
   * handle.
   */
  computeDiffResultMean(entry: DiffCacheEntry): Promise<number> | null;
  readDiffResult(entry: DiffCacheEntry): Promise<Float32Array> | null;
  /** Free this pane's live GPU resources (source texture), keeping the
   *  retained CPU source buffer. Safe to call on an already-parked or
   *  disposed handle (no-op). */
  park(): void;
  /** Re-acquire GPU resources and re-upload the retained CPU source buffer,
   *  marking this pane most-recently-used (may evict another pane over cap).
   *  Safe to call on an already-live or disposed handle (no-op). */
  restore(): void;
  /**
   * Report this pane's current on-screen visibility (driven by
   * `GpuImagePane`'s `IntersectionObserver`). Purely informational for the
   * visibility. Going offscreen parks immediately and starts delayed CPU-upload
   * release; returning cancels that release and competes for FIFO admission.
   * Defaults to visible (`true`) until the caller reports otherwise.
   */
  setVisible(visible: boolean): void;
  /** Permanently release this pane: frees GPU resources AND drops the
   *  retained CPU buffer. The handle is unusable after this. */
  dispose(): void;
}

let paneIdCounter = 0;

interface PaneEntry {
  /** Monotonic per-pane id — used ONLY by the deep color detector's slot
   *  signature (test-only) to keep distinct panes' baselines separate (an
   *  unkeyed single-image pane has an empty `sourceKey`, so without this every
   *  plain image on a page would alias to one baseline). */
  paneId: number;
  canvas: HTMLCanvasElement;
  engine: ImageWebGpuRuntime;
  device: Device;
  hdr: boolean;
  surface: Surface | null;
  srcTexture: Texture | null;
  source: SourceUpload | null;
  sourceLayout: SourceLayout | null;
  sourceLease: SourceUploadLease | null;
  sourceReacquire: (() => SourceUploadLease) | null;
  /** SECOND source slot `b` (the reference/baseline of an arity-2 diff CONTENT
   *  op) — the retained CPU buffer + its uploaded texture, mirroring `source`/
   *  `srcTexture`. Uploaded in `activateEntry`, freed in `parkEntry`, re-uploaded
   *  on restore. Null for the single-image path (the common case). See
   *  `PaneHandle.setSourceB`. */
  sourceB: SourceUpload | null;
  sourceBLayout: SourceLayout | null;
  sourceBLease: SourceUploadLease | null;
  sourceBReacquire: (() => SourceUploadLease) | null;
  srcTextureB: Texture | null;
  /** Content key of the CURRENT primary/`b` source (see `PaneHandle.setSource`'s
   *  `contentKey`). `undefined` = the slot's texture is UNKEYED (exclusive, freed
   *  on replace/park); a string = the texture is owned by `retained` under this
   *  key (kept for instant flip-back). */
  sourceKey: string | undefined;
  sourceBKey: string | undefined;
  /** Cached metric result currently presented by this pane. Its cache lease
   * prevents a synchronized exposure/encoding update across a large grid from
   * evicting each pane's live FLIP result and recomputing it on the next tick. */
  activeDiffEntry: DiffCacheEntry | null;
  /** CONTENT-KEYED source-texture LRU (insertion-order = LRU order), capped at
   *  {@link MAX_RETAINED_SOURCE_TEXTURES}. Holds the keyed textures BOTH slots
   *  bind (a stacked pane's recently-shown slots), so a flip back to a resident
   *  key rebinds without a re-upload. Owns its textures: freed wholesale on
   *  `parkEntry`/`dispose` (an off-screen pane retains nothing). */
  retained: Map<string, Texture>;
  /** DEEP-EXR GPU composite source (retained CSR) — mutually exclusive with
   *  `source`; when set, `srcTexture` is filled by `compositeDeep`, not a CPU
   *  upload. See `PaneHandle.setDeepSource`. */
  deep: DeepGpuCsrSpec | null;
  /** Current depth WINDOW [near, far] for `deep`. */
  deepZNear: number;
  deepZFar: number;
  /** GPU storage buffers for `deep` (freed on park/dispose, rebuilt on restore). */
  deepBuffers: DeepSampleBuffers | null;
  /** DEEP OUTPUT-COLOR DETECTOR (test-only, `?paneRenderLog=2`) — a tiny 8×8
   *  offscreen render target the pool re-renders each present into (SAME primary
   *  texture + params) to read back the present's actual mean color. Lazily
   *  allocated on first armed present, freed on park/dispose. Null in production
   *  (the detector is never armed) and at level ≤ 1. */
  deepSampleTex: Texture | null;
  parked: boolean;
  waiting: boolean;
  disposed: boolean;
  failed: boolean;
  /** Monotonic desired-content epoch. A successful surface submission records
   * this epoch in `presentedGeneration`; source mutations advance it. */
  contentGeneration: number;
  /** Latest content epoch successfully submitted to this pane's surface. */
  presentedGeneration: number;
  /** Last-reported IntersectionObserver visibility. */
  visible: boolean;
  /** Page-visibility suspension, independent of intersection visibility. */
  documentHidden: boolean;
  offscreenReleaseTimer: ReturnType<typeof setTimeout> | null;
  onAdmitted: (() => void) | undefined;
  onActivationFailure: ((error: unknown) => void) | undefined;
  /**
   * The canvas backing-store / surface size (DEVICE pixels, i.e. already
   * display-css-size * dpr), as last requested via `PaneHandle.resize()`. 0 until
   * the first `resize()` call — while 0, `activateEntry` is a no-op (MEASURE-THEN-
   * RENDER: a pane rendered before its container is measured is briefly blank; there
   * is no source-dims fallback, so `Surface.configure()` is never called at 0 size).
   */
  backingWidth: number;
  backingHeight: number;
}

// Module-singleton LRU of currently-LIVE (non-parked) entries, oldest first.
const live: PaneEntry[] = [];
const panes = new Set<PaneEntry>();
const waiters: PaneEntry[] = [];
let documentHidden = typeof document !== "undefined" && document.visibilityState === "hidden";

const poolStats = {
  parks: 0,
  restores: 0,
  admissions: 0,
  admissionBlocks: 0,
  evictions: 0,
  presentations: 0,
  presentationRotations: 0,
};

function touchMostRecentlyUsed(entry: PaneEntry): void {
  const i = live.indexOf(entry);
  if (i !== -1) live.splice(i, 1);
  live.push(entry);
}

function untrack(entry: PaneEntry): void {
  const i = live.indexOf(entry);
  if (i !== -1) live.splice(i, 1);
}

interface SharedSourceTexture {
  texture: Texture;
  refs: number;
  bytes: number;
}

// Artifact-backed sources are immutable. Share one uploaded texture across all
// panes on the device instead of duplicating a global reference once per run.
const sharedSourceTextures = new WeakMap<Device, Map<string, SharedSourceTexture>>();
/** Strong only while a pane is registered; zero-pane devices are explicitly cleared. */
const devicePaneCounts = new Map<Device, number>();
const deviceLostUnsubscribers = new Map<Device, () => void>();

function sharedSources(device: Device): Map<string, SharedSourceTexture> {
  let cache = sharedSourceTextures.get(device);
  if (!cache) {
    cache = new Map();
    sharedSourceTextures.set(device, cache);
  }
  return cache;
}

function touchShared(cache: Map<string, SharedSourceTexture>, key: string, value: SharedSourceTexture): void {
  cache.delete(key);
  cache.set(key, value);
}

function registerDevice(device: Device): void {
  const count = devicePaneCounts.get(device) ?? 0;
  devicePaneCounts.set(device, count + 1);
  if (count === 0 && device.onLost) {
    deviceLostUnsubscribers.set(device, device.onLost((reason) => handleDeviceLoss(device, reason)));
  }
}

function unregisterDevice(device: Device): void {
  const count = devicePaneCounts.get(device) ?? 0;
  if (count > 1) {
    devicePaneCounts.set(device, count - 1);
    return;
  }
  devicePaneCounts.delete(device);
  deviceLostUnsubscribers.get(device)?.();
  deviceLostUnsubscribers.delete(device);
  const shared = sharedSourceTextures.get(device);
  if (shared) {
    for (const value of shared.values()) value.texture.destroy();
    shared.clear();
    sharedSourceTextures.delete(device);
  }
  clearCacheFor(device);
}

/** LRU-trim only zero-ref textures. Unique shared bytes are counted once and a
 * referenced working set is never destroyed, even while over budget. */
function trimSharedSources(device: Device): void {
  const cache = sharedSources(device);
  const limits = getGpuSourceTextureLimits();
  const totals = () => {
    let sharedBytes = 0;
    let zeroRefBytes = 0;
    for (const value of cache.values()) {
      sharedBytes += value.bytes;
      if (value.refs === 0) zeroRefBytes += value.bytes;
    }
    return { sharedBytes, zeroRefBytes };
  };
  let total = totals();
  while (total.sharedBytes > limits.sharedBytes || total.zeroRefBytes > limits.zeroRefBytes) {
    let victim: [string, SharedSourceTexture] | undefined;
    for (const candidate of cache) {
      if (candidate[1].refs === 0) {
        victim = candidate;
        break;
      }
    }
    if (!victim) return;
    cache.delete(victim[0]);
    victim[1].texture.destroy();
    total = totals();
  }
}

function releaseSharedSource(device: Device, key: string): void {
  const cache = sharedSources(device);
  const shared = cache.get(key);
  if (!shared || shared.refs === 0) return;
  shared.refs--;
  touchShared(cache, key, shared);
  trimSharedSources(device);
}

function retainedKey(key: string, src: SourceLayout): string {
  // Layout/transform identity is part of texture identity. This also makes a
  // stale caller key harmless if the decoded dimensions or native format move.
  return `${key}\u0000${src.width}x${src.height}:${src.format}`;
}

/**
 * Upload `src` into a source texture, or REBIND an already-resident one when
 * `key` names a retained upload. Keyed textures are shared device-wide and each
 * pane's local LRU holds one reference; unkeyed textures remain pane-owned.
 */
function uploadOrBindSource(entry: PaneEntry, src: SourceUpload, key: string | undefined): Texture {
  if (key !== undefined) {
    const cacheKey = retainedKey(key, src);
    const existing = entry.retained.get(cacheKey);
    if (existing) {
      recordSourceRebind();
      entry.retained.delete(cacheKey);
      entry.retained.set(cacheKey, existing);
      return existing;
    }
    const global = sharedSources(entry.device);
    let shared = global.get(cacheKey);
    if (shared) {
      recordSourceRebind();
      touchShared(global, cacheKey, shared);
      shared.refs++;
    } else {
      const texture = entry.device.createTexture(src.width, src.height, src.format);
      try {
        texture.write(src.data);
      } catch (error) {
        texture.destroy();
        throw error;
      }
      const bytes = textureByteLength(src.width, src.height, src.format);
      recordSourceUpload(bytes);
      shared = { texture, refs: 1, bytes };
      global.set(cacheKey, shared);
    }
    entry.retained.set(cacheKey, shared.texture);
    trimSharedSources(entry.device);
    return shared.texture;
  }
  const tex = entry.device.createTexture(src.width, src.height, src.format);
  try {
    tex.write(src.data);
  } catch (error) {
    tex.destroy();
    throw error;
  }
  recordSourceUpload(textureByteLength(src.width, src.height, src.format));
  return tex;
}

/** Evict the LRU retained textures down to the cap, never destroying one that is
 *  the CURRENTLY-bound `srcTexture`/`srcTextureB` (skips to the next oldest). */
function evictRetained(entry: PaneEntry): void {
  while (entry.retained.size > getGpuSourceTextureRetentionLimit()) {
    let victimKey: string | undefined;
    for (const [k, tex] of entry.retained) {
      if (tex !== entry.srcTexture && tex !== entry.srcTextureB) {
        victimKey = k;
        break;
      }
    }
    if (victimKey === undefined) break; // every retained texture is currently bound
    entry.retained.delete(victimKey);
    releaseSharedSource(entry.device, victimKey);
  }
}

/** Free the texture a slot last bound, IF it was unkeyed (exclusive). Keyed
 *  textures stay in `retained` for flip-back; the caller drops the slot's ref. */
function releaseUnkeyedSlotTexture(tex: Texture | null, key: string | undefined): void {
  if (tex && key === undefined) tex.destroy();
}

function releaseActiveDiff(entry: PaneEntry): void {
  if (!entry.activeDiffEntry) return;
  cacheFor(entry.device).release(entry.activeDiffEntry);
  entry.activeDiffEntry = null;
}

function presentActiveDiff(entry: PaneEntry, next: DiffCacheEntry): void {
  if (entry.activeDiffEntry === next) return;
  // Retain first so enforcing the budget while releasing the previous result
  // cannot evict the result this pane is about to present.
  cacheFor(entry.device).retain(next);
  releaseActiveDiff(entry);
  entry.activeDiffEntry = next;
}

/** Release every retained shared texture and clear the pane-local LRU. */
function clearRetained(entry: PaneEntry): void {
  for (const key of entry.retained.keys()) releaseSharedSource(entry.device, key);
  entry.retained.clear();
}

function needsPresentation(entry: PaneEntry): boolean {
  return entry.contentGeneration > entry.presentedGeneration;
}

function noteContentChange(entry: PaneEntry): void {
  entry.contentGeneration++;
}

function removeWaiter(entry: PaneEntry): void {
  const index = waiters.indexOf(entry);
  if (index !== -1) waiters.splice(index, 1);
  entry.waiting = false;
}

function enqueueWaiter(entry: PaneEntry): void {
  if (entry.waiting || entry.failed || entry.disposed) return;
  entry.waiting = true;
  waiters.push(entry);
  // Admission needs only exact layout metadata. Reconstructible expanded arrays
  // must remain evictable while this pane waits.
  releaseCpuUploadOwnership(entry);
  poolStats.admissionBlocks++;
}

function releaseCpuUploadOwnership(entry: PaneEntry): void {
  entry.sourceLease?.release();
  entry.sourceLease = null;
  if (entry.sourceReacquire) entry.source = null;
  entry.sourceBLease?.release();
  entry.sourceBLease = null;
  if (entry.sourceBReacquire) entry.sourceB = null;
}

function reacquireCpuUploads(entry: PaneEntry): void {
  if (!entry.source && entry.sourceReacquire) {
    entry.sourceLease = entry.sourceReacquire();
    entry.source = entry.sourceLease.upload;
  }
  if (!entry.sourceB && entry.sourceBReacquire) {
    entry.sourceBLease = entry.sourceBReacquire();
    entry.sourceB = entry.sourceBLease.upload;
  }
}

function layoutOf(src: SourceUpload): SourceLayout {
  return { width: src.width, height: src.height, format: src.format };
}

function deepStorageByteLength(deep: DeepGpuCsrSpec): number {
  return deep.offsets.byteLength + deep.colors.byteLength + deep.zs.byteLength;
}

function hasPrimarySource(entry: PaneEntry): boolean {
  return !!entry.sourceLayout || !!entry.deep;
}

function hasSecondarySource(entry: PaneEntry): boolean {
  return !!entry.sourceBLayout;
}

function cancelOffscreenRelease(entry: PaneEntry): void {
  if (entry.offscreenReleaseTimer !== null) clearTimeout(entry.offscreenReleaseTimer);
  entry.offscreenReleaseTimer = null;
}

function scheduleOffscreenRelease(entry: PaneEntry): void {
  cancelOffscreenRelease(entry);
  const timeout = getOffscreenCpuReleaseMs();
  if (timeout === 0) {
    releaseCpuUploadOwnership(entry);
    return;
  }
  entry.offscreenReleaseTimer = setTimeout(() => {
    entry.offscreenReleaseTimer = null;
    if ((!entry.visible || entry.documentHidden) && !entry.disposed) releaseCpuUploadOwnership(entry);
  }, timeout);
}

function activeSourceBytes(device?: Device): number {
  const seen = new Set<Texture>();
  let bytes = 0;
  for (const entry of live) {
    if (device && entry.device !== device) continue;
    for (const texture of [entry.srcTexture, entry.srcTextureB]) {
      if (texture && !seen.has(texture)) {
        seen.add(texture);
        bytes += textureBytes(texture);
      }
    }
    for (const texture of entry.retained.values()) {
      if (!seen.has(texture)) {
        seen.add(texture);
        bytes += textureBytes(texture);
      }
    }
    if (entry.deep) bytes += deepStorageByteLength(entry.deep);
  }
  return bytes;
}

function prospectiveSourceBytes(entry: PaneEntry): number {
  const keys = new Set<string>();
  let bytes = 0;
  const add = (layout: SourceLayout | null, key: string | undefined) => {
    if (!layout) return;
    if (key === undefined) {
      bytes += textureByteLength(layout.width, layout.height, layout.format);
      return;
    }
    const k = retainedKey(key, layout);
    if (keys.has(k)) return;
    keys.add(k);
    const shared = sharedSources(entry.device).get(k);
    if (!shared || shared.refs === 0) bytes += textureByteLength(layout.width, layout.height, layout.format);
  };
  if (entry.deep) {
    bytes += textureByteLength(entry.deep.width, entry.deep.height, "rgba16float");
    bytes += deepStorageByteLength(entry.deep);
  } else add(entry.sourceLayout, entry.sourceKey);
  add(entry.sourceBLayout, entry.sourceBKey);
  return bytes;
}

function projectedLiveMutationBytes(
  entry: PaneEntry,
  sourceLayout: SourceLayout | null,
  sourceKey: string | undefined,
  sourceBLayout: SourceLayout | null,
  sourceBKey: string | undefined,
  deep: DeepGpuCsrSpec | null,
): number {
  const seenTextures = new Set<Texture>();
  const virtualKeys = new Set<string>();
  let bytes = 0;
  const addTexture = (texture: Texture) => {
    if (seenTextures.has(texture)) return;
    seenTextures.add(texture);
    bytes += textureBytes(texture);
  };
  for (const candidate of live) {
    if (candidate.device !== entry.device || candidate === entry) continue;
    for (const texture of [candidate.srcTexture, candidate.srcTextureB]) if (texture) addTexture(texture);
    for (const texture of candidate.retained.values()) addTexture(texture);
    if (candidate.deep) bytes += deepStorageByteLength(candidate.deep);
  }
  // Retention remains part of this pane's active working set after a mutation.
  for (const texture of entry.retained.values()) addTexture(texture);
  const addLayout = (layout: SourceLayout | null, key: string | undefined) => {
    if (!layout) return;
    if (key === undefined) {
      bytes += textureByteLength(layout.width, layout.height, layout.format);
      return;
    }
    const cacheKey = retainedKey(key, layout);
    if (virtualKeys.has(cacheKey)) return;
    virtualKeys.add(cacheKey);
    const texture = entry.retained.get(cacheKey) ?? sharedSources(entry.device).get(cacheKey)?.texture;
    if (texture) addTexture(texture);
    else bytes += textureByteLength(layout.width, layout.height, layout.format);
  };
  if (deep) {
    bytes += textureByteLength(deep.width, deep.height, "rgba16float") + deepStorageByteLength(deep);
  } else addLayout(sourceLayout, sourceKey);
  addLayout(sourceBLayout, sourceBKey);
  return bytes;
}

function isAdmissionVictim(candidate: PaneEntry, requester: PaneEntry, allowPresentationRotation: boolean): boolean {
  if (candidate === requester) return false;
  if (!candidate.visible) return true;
  // A pane may rotate a visible peer only while it still owes the user one
  // presentation of its current content generation. Never displace another
  // presentation-needing pane: it is already making bounded forward progress.
  return allowPresentationRotation && !needsPresentation(candidate);
}

function evictForAdmission(victim: PaneEntry, rotated: boolean): void {
  poolStats.evictions++;
  if (rotated) poolStats.presentationRotations++;
  parkEntry(victim, false);
  // A visible displaced pane keeps its last canvas frame. It remains a stable
  // waiter and can fill a genuinely free slot later, but cannot evict its way
  // back in because its current generation was already presented.
  if (victim.visible && hasPrimarySource(victim)) enqueueWaiter(victim);
}

function canApplyLiveMutation(
  entry: PaneEntry,
  sourceLayout: SourceLayout | null,
  sourceKey: string | undefined,
  sourceBLayout: SourceLayout | null,
  sourceBKey: string | undefined,
  deep: DeepGpuCsrSpec | null,
): boolean {
  const limit = getGpuSourceTextureLimits().activeBytes;
  const mayRotate = needsPresentation(entry);
  while (projectedLiveMutationBytes(entry, sourceLayout, sourceKey, sourceBLayout, sourceBKey, deep) > limit) {
    const victim = live.find((candidate) =>
      candidate.device === entry.device && isAdmissionVictim(candidate, entry, mayRotate));
    if (!victim) return false;
    evictForAdmission(victim, victim.visible);
  }
  return true;
}

function canAdmit(entry: PaneEntry, allowPresentationRotation = needsPresentation(entry)): boolean {
  // An offscreen pane never takes a slot. A hidden document restores nothing.
  if (!entry.visible || documentHidden) return false;
  // Prefer same-device victims: doing so can satisfy both the global count cap
  // and this device's byte cap with one bounded rotation.
  while (live.length >= getLiveGpuPaneLimit()) {
    const candidates = live.filter((candidate) => isAdmissionVictim(candidate, entry, allowPresentationRotation));
    const victim = candidates.find((candidate) => candidate.device === entry.device) ?? candidates[0];
    if (!victim) return false;
    evictForAdmission(victim, victim.visible);
  }
  const limit = getGpuSourceTextureLimits().activeBytes;
  while (activeSourceBytes(entry.device) + prospectiveSourceBytes(entry) > limit &&
         live.some((candidate) => candidate.device === entry.device)) {
    const victim = live.find((candidate) =>
      candidate.device === entry.device && isAdmissionVictim(candidate, entry, allowPresentationRotation));
    if (!victim) return false;
    evictForAdmission(victim, victim.visible);
  }
  // One oversize working set is pinned when nothing else is live on its device.
  // Diagnostics report the soft over-budget state without downsampling.
  return true;
}

let admittingWaiters = false;
let admissionScheduled = false;
function scheduleWaiterAdmission(): void {
  if (admissionScheduled) return;
  admissionScheduled = true;
  queueMicrotask(() => {
    admissionScheduled = false;
    admitWaiters();
  });
}

function markPresented(entry: PaneEntry): void {
  if (!needsPresentation(entry)) return;
  entry.presentedGeneration = entry.contentGeneration;
  poolStats.presentations++;
  // A waiter blocked behind an in-flight presentation can now rotate this pane.
  // Defer until the completed render call has finished all instrumentation.
  scheduleWaiterAdmission();
}

function admitWaiters(): void {
  if (admittingWaiters || documentHidden) return;
  admittingWaiters = true;
  try {
    // Presentation debt outranks stable restoration. This avoids strict HOL
    // blocking when an older, already-presented waiter cannot fit. FIFO order is
    // retained within each class by filtering the queue without sorting it.
    const ordered = [
      ...waiters.filter((entry) => needsPresentation(entry)),
      ...waiters.filter((entry) => !needsPresentation(entry)),
    ];
    for (const entry of ordered) {
      if (entry.disposed) {
        removeWaiter(entry);
        continue;
      }
      if (!entry.visible) continue;
      const presentationDebt = needsPresentation(entry);
      if (!canAdmit(entry, presentationDebt)) continue;
      removeWaiter(entry);
      if (activateEntry(entry) && !entry.parked) queueMicrotask(() => entry.onAdmitted?.());
    }
  } finally {
    admittingWaiters = false;
  }
}

/** Free live GPU resources while retaining reconstructible CPU ownership. */
function parkEntry(entry: PaneEntry, reconsiderWaiters = true): void {
  if (entry.parked) return;
  untrack(entry);
  poolStats.parks++;
  releaseActiveDiff(entry);
  releaseUnkeyedSlotTexture(entry.srcTexture, entry.sourceKey);
  entry.srcTexture = null;
  releaseUnkeyedSlotTexture(entry.srcTextureB, entry.sourceBKey);
  entry.srcTextureB = null;
  clearRetained(entry);
  if (entry.deepBuffers) {
    entry.deepBuffers.destroy();
    entry.deepBuffers = null;
  }
  if (entry.deepSampleTex) {
    entry.deepSampleTex.destroy();
    entry.deepSampleTex = null;
  }
  if (entry.surface) releaseImageRenderState(entry.surface);
  entry.surface = null;
  entry.parked = true;
  if (reconsiderWaiters) admitWaiters();
}

/** Unsafe activation body. Call only through {@link activateEntry}. */
function activateEntryUnsafe(entry: PaneEntry): void {
  if (entry.disposed || entry.failed || documentHidden || !entry.visible) return;
  if (forceEngineFailRequested()) {
    throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");
  }
  if (!entry.parked && entry.surface) {
    touchMostRecentlyUsed(entry);
    return;
  }
  if (!entry.backingWidth || !entry.backingHeight) return;
  // Admission uses retained layout metadata only. Waiting panes do not pin the
  // reconstructible expanded cache merely to ask whether they fit.
  if (!canAdmit(entry)) {
    enqueueWaiter(entry);
    return;
  }
  removeWaiter(entry);
  reacquireCpuUploads(entry);
  const device = entry.device;
  entry.surface = entry.engine.createSurface(entry.canvas, { hdr: entry.hdr });
  entry.canvas.width = entry.backingWidth;
  entry.canvas.height = entry.backingHeight;
  entry.surface.configure(entry.backingWidth, entry.backingHeight);
  if (entry.deep) {
    const tex = device.createTexture(entry.deep.width, entry.deep.height, "rgba16float");
    entry.srcTexture = tex;
    entry.deepBuffers = device.createDeepSampleBuffers!(entry.deep);
    device.compositeDeep!(entry.deepBuffers, tex, entry.deepZNear, entry.deepZFar);
  } else if (entry.source) {
    entry.srcTexture = uploadOrBindSource(entry, entry.source, entry.sourceKey);
  }
  if (entry.sourceB) entry.srcTextureB = uploadOrBindSource(entry, entry.sourceB, entry.sourceBKey);
  evictRetained(entry);
  entry.parked = false;
  poolStats.restores++;
  poolStats.admissions++;
  touchMostRecentlyUsed(entry);
  // GPU ownership is now sufficient. Drop reconstructible expanded arrays;
  // raw decoded pixels/reacquire closures remain the restoration authority.
  releaseCpuUploadOwnership(entry);
}

function failEntryActivation(entry: PaneEntry, error: unknown): void {
  if (entry.disposed || entry.failed) return;
  entry.parked = false; // force teardown after a partial unsafe activation
  parkEntry(entry, false);
  removeWaiter(entry);
  releaseCpuUploadOwnership(entry);
  entry.failed = true;
  queueMicrotask(() => entry.onActivationFailure?.(error));
  admitWaiters();
}

/** The sole exception-safe activation authority for render, restore and page visibility. */
function activateEntry(entry: PaneEntry): boolean {
  try {
    activateEntryUnsafe(entry);
    return !entry.failed;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane activation failed, falling back to legacy pane", error);
    failEntryActivation(entry, error);
    return false;
  }
}

function handleDeviceLoss(device: Device, reason: unknown): void {
  for (const entry of panes) {
    if (entry.device === device && !entry.disposed) failEntryActivation(entry, reason);
  }
  // Failed panes remain until their React owners dispose, but the dead device
  // must not remain strongly registered and its opportunistic caches are useless.
  devicePaneCounts.delete(device);
  deviceLostUnsubscribers.get(device)?.();
  deviceLostUnsubscribers.delete(device);
  const shared = sharedSourceTextures.get(device);
  if (shared) {
    for (const value of shared.values()) value.texture.destroy();
    shared.clear();
    sharedSourceTextures.delete(device);
  }
  clearCacheFor(device);
}

const DEEP_SAMPLE_DIM = 8;

/**
 * DEEP OUTPUT-COLOR DETECTOR (test-only, `?paneRenderLog=2`). Re-renders the
 * present that just happened into a tiny 8×8 offscreen texture (SAME primary
 * texture + params — NOT the swapchain, which rotates and can't be read post-
 * present) and reads back its mean color, feeding it to
 * {@link recordDeepColorSample}. Fire-and-forget + fully guarded: a failure here
 * NEVER disturbs the real present (which already happened). Called only when the
 * detector is armed, so production pays nothing.
 */
function sampleDeepColor(
  entry: PaneEntry,
  primary: Texture,
  params: ImageParams,
  record: PaneRenderRecord,
): void {
  try {
    const fmt: TextureFormat = entry.hdr ? "rgba16float" : "rgba8unorm";
    if (!entry.deepSampleTex) {
      entry.deepSampleTex = entry.device.createTexture(DEEP_SAMPLE_DIM, DEEP_SAMPLE_DIM, fmt);
    }
    const target = entry.deepSampleTex;
    // Same primary + params as the real present (incl. any injected srcB).
    renderImage(entry.device, target, primary, params);
    entry.device
      .readback(target)
      .then((px) => {
        recordDeepColorSample(record, averageSampleRgb(px, entry.hdr), entry.paneId);
      })
      .catch(() => {
        /* readback can reject on device teardown — best-effort, drop it */
      });
  } catch {
    /* never let the detector disturb rendering */
  }
}

/** Average an 8×8 readback (RGBA) to one normalized-[0,1] RGB, weighting by
 *  alpha so fully-transparent out-of-bounds border texels don't drag the color.
 *  8-bit reads are /255; HDR (float) reads are tone-normalized by the frame's own
 *  max channel so a bright HDR color still yields a comparable hue. */
function averageSampleRgb(px: Uint8Array | Float32Array, hdr: boolean): { r: number; g: number; b: number } {
  let sr = 0, sg = 0, sb = 0, sa = 0;
  const scale = hdr ? 1 : 1 / 255;
  for (let i = 0; i + 3 < px.length; i += 4) {
    const a = (px[i + 3] as number) * (hdr ? 1 : 1 / 255);
    const w = a <= 0 ? 0 : a;
    sr += (px[i] as number) * scale * w;
    sg += (px[i + 1] as number) * scale * w;
    sb += (px[i + 2] as number) * scale * w;
    sa += w;
  }
  if (sa <= 0) return { r: 0, g: 0, b: 0 };
  let r = sr / sa, g = sg / sa, b = sb / sa;
  if (hdr) {
    const m = Math.max(r, g, b, 1);
    r /= m; g /= m; b /= m; // tone-normalize so hue stays comparable to SDR
  }
  return { r: Math.min(1, r), g: Math.min(1, g), b: Math.min(1, b) };
}

/**
 * Runs the IMAGE render pass for `entry`.
 *
 * C1 fix (whole-branch review): `activateEntry()`'s hard-failure vector and
 * `renderImage()`'s are both inside ONE try/catch; a failure from EITHER
 * parks the entry and returns `false` instead of throwing into the caller
 * (`PaneHandle.render()` → `renderers/GpuImagePane.tsx`'s render effect),
 * which would otherwise unmount the caller's whole subtree.
 */
function attemptRender(entry: PaneEntry, params: ImageParams): boolean {
  if (entry.disposed || entry.failed || !hasPrimarySource(entry)) return !entry.failed;
  // A direct/compositor/plain present supersedes a cached metric face. Release
  // that lease; the cache may retain it opportunistically for a later flip-back.
  releaseActiveDiff(entry);
  // MEASURE-THEN-RENDER: nothing to present until the container is measured (backing
  // size set via `resize()`). A no-op SUCCESS (not a failure) so the caller does NOT
  // fall back to the legacy pane; the first render after the first `resize()` paints.
  if (!entry.backingWidth || !entry.backingHeight) return true;
  try {
    if (!activateEntry(entry)) return false;
    if (entry.waiting || documentHidden || !entry.visible) return true;
    if (!entry.surface || !entry.srcTexture) return false;
    // Bind the pool-owned SECOND source slot `b` (arity-2 direct diff ops) when
    // present — the caller sets `params.imageOperation`; the pool supplies the
    // physical texture. Absent → the single-image path (renderImage binds a 1x1
    // placeholder, and the specialized identity operation ignores it).
    const p = entry.srcTextureB ? { ...params, srcB: entry.srcTextureB } : params;
    renderImage(entry.device, entry.surface, entry.srcTexture, p);
    // Present-coherency instrumentation (test-only; guarded so NO per-present cost
    // — record + display fingerprint — is paid unless a harness started the log):
    // the GROUND-TRUTH bound keys + full display-encode combo at this present.
    if (isPaneRenderLogActive()) {
      const record: PaneRenderRecord = {
        mode: "image",
        sourceKey: entry.sourceKey,
        sourceBKey: entry.sourceBKey,
        imageOperation: params.imageOperation,
        hasSrcB: entry.srcTextureB != null,
        isScalar: params.isScalar,
        compareIntended: params.compareIntended,
        ...displayFingerprint(params),
      };
      recordPaneRender(record);
      // Level-2 deep detector: sample this present's actual output color.
      if (deepColorDetectorActive()) sampleDeepColor(entry, entry.srcTexture, p, record);
    }
    markPresented(entry);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane", err);
    failEntryActivation(entry, err);
    return false;
  }
}

const hdrExposureParamsBySource = new Map<string, Record<string, number>>();

function automaticHdrFlipParams(entry: PaneEntry, contentKey: string): Record<string, number> {
  const cached = hdrExposureParamsBySource.get(contentKey);
  if (cached) {
    hdrExposureParamsBySource.delete(contentKey);
    hdrExposureParamsBySource.set(contentKey, cached);
    return cached;
  }
  let temporary: SourceUploadLease | null = null;
  const source = entry.source ?? (entry.sourceReacquire ? (temporary = entry.sourceReacquire()).upload : null);
  if (!source) return { ppd: 67, startExposure: 0, stopExposure: 4, numExposures: 2 };
  let exposure: ReturnType<typeof computeHdrFlipExposures>;
  try {
    const values = source.data as unknown as ArrayLike<number>;
    exposure = computeHdrFlipExposures(values, source.width, source.height, 4);
  } finally {
    temporary?.release();
  }
  const params = { ppd: 67, ...exposure };
  hdrExposureParamsBySource.set(contentKey, params);
  while (hdrExposureParamsBySource.size > 512) {
    const oldest = hdrExposureParamsBySource.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    hdrExposureParamsBySource.delete(oldest);
  }
  return params;
}

/**
 * Runs the CACHED-op render path for `entry` (see `PaneHandle.renderDiffCached`).
 * `activateEntry()` (which uploads BOTH source slots) + `ensureDiff()` (the
 * multi-pass compute, on a cache MISS) + `renderImage()` (the display blit) are
 * all inside ONE try/catch: a hard GPU failure from any of them parks the entry
 * and returns `null` instead of throwing into the caller's render effect (which
 * would unmount its subtree — the same C1-fix reasoning as `attemptRender`).
 */
function attemptRenderDiffCached(
  entry: PaneEntry,
  operationId: string,
  contentKeys: { a: string; b: string },
  computeParams: Record<string, number> | (() => Record<string, number> | undefined) | undefined,
  displayParams: ImageParams,
  mapping?: CompareMapping,
  cacheParams?: Record<string, number>,
): DiffCacheEntry | null {
  if (
    entry.disposed || entry.failed ||
    !hasPrimarySource(entry) ||
    !hasSecondarySource(entry)
  ) return null;
  try {
    if (!activateEntry(entry)) return null;
    if (entry.waiting) return null;
    // MEASURE-THEN-RENDER: unmeasured ⇒ `activateEntry` deferred (no surface). The
    // caller (GpuImagePane.renderPass) already holds pre-measure, so this is a
    // defensive no-op path for any direct caller — a null result the pane retries.
    if (!entry.surface || !entry.srcTexture || !entry.srcTextureB) return null;
    // Content-keyed cache: a pure function of the SOURCE content (not the
    // viewport / exposure / colormap), so the expensive multi-pass compute runs
    // once and zoom/pan/encoding changes re-blit only. The cache OWNS the result
    // texture — never destroyed here.
    const cacheEntry = ensureDiff(
      entry.device,
      entry.srcTexture,
      entry.srcTextureB,
      operationId,
      computeParams,
      contentKeys.a,
      contentKeys.b,
      mapping,
      cacheParams,
    );
    presentActiveDiff(entry, cacheEntry);
    // The cached RESULT is the scalar error — displayed via IDENTITY content
    // (`displayParams.imageOperation` unset/0, no `srcB`) + the isScalar colormap.
    // Bind it as the PRIMARY source; `srcTextureB` is intentionally NOT injected
    // (the display is single-source over the result).
    renderImage(entry.device, entry.surface, cacheEntry.texture, displayParams);
    recordCachedPresent(operationId);
    // Present-coherency instrumentation (test-only; see attemptRender). A cached
    // diff blits the RESULT as the primary — the bound SOURCE keys still record
    // which operands the result was computed from (stale = an artefact).
    if (isPaneRenderLogActive()) {
      const record: PaneRenderRecord = {
        mode: "cached-diff",
        sourceKey: entry.sourceKey,
        sourceBKey: entry.sourceBKey,
        imageOperation: displayParams.imageOperation,
        hasSrcB: entry.srcTextureB != null,
        isScalar: displayParams.isScalar,
        ...displayFingerprint(displayParams),
      };
      recordPaneRender(record);
      // Level-2 deep detector: the cached result is the primary; sample the
      // actual displayed color (the FLIP magma map) so a garbage/uninitialized
      // result texture would flash here by its real color.
      if (deepColorDetectorActive()) sampleDeepColor(entry, cacheEntry.texture, displayParams, record);
    }
    markPresented(entry);
    return cacheEntry;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: cached-diff pane render failed, falling back to legacy pane", err);
    failEntryActivation(entry, err);
    return null;
  }
}

/**
 * Compute MSE/PSNR/MAE over `entry`'s two live source slots (see
 * `PaneHandle.computeMetrics`). `activateEntry` (uploads both slots) is inside the
 * try so a hard GPU failure returns `null` (parking the entry) rather than
 * throwing / rejecting into the caller's effect — the same never-throws contract
 * as `attemptRender`.
 */
const sourceMetricsCache = new WeakMap<Device, Map<string, Promise<DiffMetrics>>>();

function attemptComputeMetrics(
  entry: PaneEntry,
  contentKeys?: { a: string; b: string },
  mapping?: CompareMapping,
): Promise<DiffMetrics> | null {
  if (entry.disposed || entry.failed || !entry.sourceLayout || !entry.sourceBLayout) return null;
  try {
    activateEntry(entry);
    if (entry.waiting || !entry.srcTexture || !entry.srcTextureB) return null;
    if (!contentKeys) return computeMetrics(entry.device, entry.srcTexture, entry.srcTextureB, mapping);
    let cache = sourceMetricsCache.get(entry.device);
    if (!cache) {
      cache = new Map();
      sourceMetricsCache.set(entry.device, cache);
    }
    const key = `${contentKeys.a}\u0000${contentKeys.b}\u0000${mapping ? mappingKey(mapping) : "full"}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = computeMetrics(entry.device, entry.srcTexture, entry.srcTextureB, mapping);
      cache.set(key, pending);
      pending.catch(() => cache!.delete(key));
    }
    return pending;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane metrics compute failed", err);
    failEntryActivation(entry, err);
    return null;
  }
}

// HISTOGRAM CACHES (info panel M2) — keyed by the LIVE GPU resource object the
// compute ran over. The pool's source textures are content-retained (`retained`
// LRU) and the deep CSR spec is the retained content itself, so object identity
// IS content identity here: a flip back to a retained slot re-uses the resolved
// promise; a re-upload (new texture) or new CSR naturally misses; GC of the
// resource drops its cache row.
const texHistogramCache = new WeakMap<Texture, Map<string, Promise<TexHistogramResult>>>();
const deepHistogramCache = new WeakMap<DeepGpuCsrSpec, Map<number, Promise<DeepDepthHistogramResult | null>>>();

/**
 * GPU value histogram over `entry`'s primary source texture (see
 * `PaneHandle.computeHistogram`). Activation is inside the try so a hard GPU
 * failure parks the entry and returns `null` — the same never-throws contract
 * as `attemptRender`. Deep composite sources return `null` (their source
 * texture is rewritten in place per z-window; the CPU flattened-buffer path
 * stays authoritative for the value histogram there).
 */
function attemptComputeHistogram(
  entry: PaneEntry,
  spec: TexHistogramSpec,
): Promise<TexHistogramResult> | null {
  if (entry.disposed || entry.failed || !entry.sourceLayout || entry.deep) return null;
  try {
    activateEntry(entry);
    const tex = entry.srcTexture;
    const compute = entry.device.computeTevTextureHistogram?.bind(entry.device);
    if (!tex || !compute) return null;
    const key = `${spec.channelCount}|${spec.seriesCount}|${spec.bins}|${spec.u8Scale ? 1 : 0}|${Array.from(spec.seriesWeights).join(",")}`;
    let byKey = texHistogramCache.get(tex);
    if (!byKey) {
      byKey = new Map();
      texHistogramCache.set(tex, byKey);
    }
    let pending = byKey.get(key);
    if (!pending) {
      pending = compute(tex, tex.width, tex.height, spec);
      byKey.set(key, pending);
      // A rejected compute (device loss mid-map) must not stick as a cache hit.
      pending.catch(() => byKey!.delete(key));
    }
    return pending;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane histogram compute failed", err);
    failEntryActivation(entry, err);
    return null;
  }
}

/** GPU depth histogram over `entry`'s retained deep CSR (see
 *  `PaneHandle.computeDepthHistogram`). Never throws — mirrors the above. */
function attemptComputeDepthHistogram(
  entry: PaneEntry,
  bins: number,
): Promise<DeepDepthHistogramResult | null> | null {
  if (entry.disposed || !entry.deep) return null;
  try {
    activateEntry(entry);
    const compute = entry.device.computeDeepDepthHistogram?.bind(entry.device);
    if (!entry.deepBuffers || !compute) return null;
    const csr = entry.deep;
    let byBins = deepHistogramCache.get(csr);
    if (!byBins) {
      byBins = new Map();
      deepHistogramCache.set(csr, byBins);
    }
    let pending = byBins.get(bins);
    if (!pending) {
      pending = compute(entry.deepBuffers, bins);
      byBins.set(bins, pending);
      pending.catch(() => byBins!.delete(bins));
    }
    return pending;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane depth-histogram compute failed", err);
    failEntryActivation(entry, err);
    return null;
  }
}

/** Mean-SSIM scalar over `entry`'s two live source slots (see `PaneHandle.computeSsim`). */
function attemptComputeSsim(
  entry: PaneEntry,
  contentKeys: { a: string; b: string },
  mapping?: CompareMapping,
  retainMap = true,
): Promise<number> | null {
  if (entry.disposed || entry.failed || !entry.sourceLayout || !entry.sourceBLayout) return null;
  try {
    activateEntry(entry);
    if (entry.waiting || !entry.srcTexture || !entry.srcTextureB) return null;
    return ensureSsimScalar(
      entry.device,
      entry.srcTexture,
      entry.srcTextureB,
      contentKeys.a,
      contentKeys.b,
      mapping,
      retainMap,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane SSIM compute failed", err);
    failEntryActivation(entry, err);
    return null;
  }
}

function replacePrimarySource(
  entry: PaneEntry,
  src: SourceUpload,
  contentKey: string | undefined,
  lease: SourceUploadLease | null,
  reacquire: (() => SourceUploadLease) | null,
): void {
  if (entry.disposed || entry.failed) {
    lease?.release();
    return;
  }
  const nextLayout = layoutOf(src);
  const changed = entry.sourceLayout?.width !== src.width || entry.sourceLayout?.height !== src.height ||
    entry.sourceLayout?.format !== src.format || entry.sourceKey !== contentKey || entry.deep !== null ||
    (contentKey === undefined && entry.source !== src);
  if (changed) {
    releaseActiveDiff(entry);
    noteContentChange(entry);
  }

  // A live replacement is admitted against the complete A+B working set before
  // any texture upload. If it cannot fit, park the old GPU ownership (the canvas
  // keeps its last paint), retain only reconstructible metadata, and join FIFO.
  if (!entry.parked && entry.surface &&
      !canApplyLiveMutation(entry, nextLayout, contentKey, entry.sourceBLayout, entry.sourceBKey, null)) {
    // Tear down using the OLD keys/ownership before committing desired metadata.
    parkEntry(entry, false);
    entry.sourceLease?.release();
    entry.source = reacquire ? null : src;
    entry.sourceLayout = nextLayout;
    entry.sourceLease = null;
    entry.sourceReacquire = reacquire;
    entry.sourceKey = contentKey;
    entry.deep = null;
    lease?.release();
    enqueueWaiter(entry);
    admitWaiters();
    return;
  }

  try {
    if (!entry.parked && entry.surface) {
      const previous = entry.srcTexture;
      const previousKey = entry.sourceKey;
      const next = uploadOrBindSource(entry, src, contentKey);
      if (previous && previous !== next) releaseUnkeyedSlotTexture(previous, previousKey);
      if (entry.deepBuffers) {
        entry.deepBuffers.destroy();
        entry.deepBuffers = null;
      }
      entry.srcTexture = next;
      evictRetained(entry);
    }
    entry.sourceLease?.release();
    entry.source = reacquire ? null : src;
    entry.sourceLayout = nextLayout;
    entry.sourceLease = null;
    entry.sourceReacquire = reacquire;
    entry.sourceKey = contentKey;
    entry.deep = null;
    lease?.release();
  } catch (error) {
    lease?.release();
    failEntryActivation(entry, error);
  }
}

function replaceSecondarySource(
  entry: PaneEntry,
  src: SourceUpload | null,
  contentKey: string | undefined,
  lease: SourceUploadLease | null,
  reacquire: (() => SourceUploadLease) | null,
): void {
  if (entry.disposed || entry.failed) {
    lease?.release();
    return;
  }
  const nextLayout = src ? layoutOf(src) : null;
  const nextKey = src ? contentKey : undefined;
  const changed = entry.sourceBLayout?.width !== nextLayout?.width ||
    entry.sourceBLayout?.height !== nextLayout?.height ||
    entry.sourceBLayout?.format !== nextLayout?.format || entry.sourceBKey !== nextKey ||
    (nextKey === undefined && entry.sourceB !== src);
  if (changed) {
    releaseActiveDiff(entry);
    noteContentChange(entry);
  }
  if (!entry.parked && entry.surface &&
      !canApplyLiveMutation(entry, entry.sourceLayout, entry.sourceKey, nextLayout, nextKey, entry.deep)) {
    parkEntry(entry, false);
    entry.sourceBLease?.release();
    entry.sourceB = reacquire ? null : src;
    entry.sourceBLayout = nextLayout;
    entry.sourceBLease = null;
    entry.sourceBReacquire = reacquire;
    entry.sourceBKey = nextKey;
    lease?.release();
    enqueueWaiter(entry);
    admitWaiters();
    return;
  }
  try {
    if (!entry.parked && entry.surface) {
      const previous = entry.srcTextureB;
      const previousKey = entry.sourceBKey;
      const next = src ? uploadOrBindSource(entry, src, nextKey) : null;
      if (previous && previous !== next) releaseUnkeyedSlotTexture(previous, previousKey);
      entry.srcTextureB = next;
      evictRetained(entry);
    }
    entry.sourceBLease?.release();
    entry.sourceB = reacquire ? null : src;
    entry.sourceBLayout = nextLayout;
    entry.sourceBLease = null;
    entry.sourceBReacquire = reacquire;
    entry.sourceBKey = nextKey;
    lease?.release();
  } catch (error) {
    lease?.release();
    failEntryActivation(entry, error);
  }
}

function makeHandle(entry: PaneEntry): PaneHandle {
  const handle: PaneHandle = {
    canvas: entry.canvas,
    get isParked() {
      return entry.parked;
    },
    get isWaiting() {
      return entry.waiting;
    },
    setSource(src: SourceUpload, contentKey?: string): void {
      replacePrimarySource(entry, src, contentKey, null, null);
    },
    setSourceLease(lease: SourceUploadLease, contentKey: string, reacquire: () => SourceUploadLease): void {
      replacePrimarySource(entry, lease.upload, contentKey, lease, reacquire);
    },
    setSourceB(src: SourceUpload | null, contentKey?: string): void {
      replaceSecondarySource(entry, src, contentKey, null, null);
    },
    setSourceBLease(
      lease: SourceUploadLease | null,
      contentKey?: string,
      reacquire?: () => SourceUploadLease,
    ): void {
      replaceSecondarySource(entry, lease?.upload ?? null, contentKey, lease, lease ? reacquire ?? null : null);
    },
    releaseCpuUploads(): void {
      releaseCpuUploadOwnership(entry);
    },
    setDeepSource(spec: DeepGpuCsrSpec, zNear: number, zFar: number): void {
      if (entry.disposed || entry.failed) return;
      const changed = entry.deep !== spec || entry.sourceLayout !== null ||
        entry.deepZNear !== zNear || entry.deepZFar !== zFar;
      if (changed) {
        releaseActiveDiff(entry);
        noteContentChange(entry);
      }
      if (!entry.parked && entry.surface &&
          !canApplyLiveMutation(entry, null, undefined, entry.sourceBLayout, entry.sourceBKey, spec)) {
        parkEntry(entry, false);
        entry.sourceLease?.release();
        entry.source = null;
        entry.sourceLayout = null;
        entry.sourceLease = null;
        entry.sourceReacquire = null;
        entry.sourceKey = undefined;
        entry.deep = spec;
        entry.deepZNear = zNear;
        entry.deepZFar = zFar;
        enqueueWaiter(entry);
        admitWaiters();
        return;
      }
      try {
        if (!entry.parked && entry.surface) {
          const tex = entry.device.createTexture(spec.width, spec.height, "rgba16float");
          let buffers: DeepSampleBuffers | null = null;
          try {
            buffers = entry.device.createDeepSampleBuffers!(spec);
            entry.device.compositeDeep!(buffers, tex, zNear, zFar);
          } catch (error) {
            buffers?.destroy();
            tex.destroy();
            throw error;
          }
          releaseUnkeyedSlotTexture(entry.srcTexture, entry.sourceKey);
          if (entry.deepBuffers) entry.deepBuffers.destroy();
          entry.srcTexture = tex;
          entry.deepBuffers = buffers;
        }
        entry.sourceLease?.release();
        entry.source = null;
        entry.sourceLayout = null;
        entry.sourceLease = null;
        entry.sourceReacquire = null;
        entry.sourceKey = undefined;
        entry.deep = spec;
        entry.deepZNear = zNear;
        entry.deepZFar = zFar;
      } catch (error) {
        failEntryActivation(entry, error);
      }
    },
    setDeepWindow(zNear: number, zFar: number): void {
      if (entry.disposed) return;
      if (entry.deepZNear === zNear && entry.deepZFar === zFar) return;
      entry.deepZNear = zNear;
      entry.deepZFar = zFar;
      noteContentChange(entry);
      if (!entry.parked && entry.deepBuffers && entry.srcTexture) {
        entry.device.compositeDeep!(entry.deepBuffers, entry.srcTexture, zNear, zFar);
      }
    },
    resize(width: number, height: number): void {
      if (entry.disposed) return;
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (entry.backingWidth === w && entry.backingHeight === h) return;
      entry.backingWidth = w;
      entry.backingHeight = h;
      if (!entry.parked && entry.surface) {
        entry.canvas.width = w;
        entry.canvas.height = h;
        entry.surface.configure(w, h);
      }
      // Parked: picked up by the next activateEntry() (restore/render).
    },
    render(params: ImageParams): boolean {
      return attemptRender(entry, params);
    },
    renderDiffCached(
      operationId: string,
      contentKeys: { a: string; b: string },
      computeParams: Record<string, number> | undefined,
      displayParams: ImageParams,
      mapping?: CompareMapping,
    ): DiffCacheEntry | null {
      return attemptRenderDiffCached(entry, operationId, contentKeys, computeParams, displayParams, mapping);
    },
    isDiffResultCached(
      operationId: string,
      contentKeys: { a: string; b: string },
      computeParams: Record<string, number> | undefined,
      mapping?: CompareMapping,
    ): boolean {
      // Peek only — reads the retained operand DIMS (kept across park, unlike the
      // GPU textures) so no activation/upload happens, then probes the per-device
      // diff cache non-mutatingly. False when either operand is unset/disposed.
      if (entry.disposed || !entry.sourceLayout || !entry.sourceBLayout) return false;
      return hasDiff(
        entry.device,
        { w: entry.sourceLayout.width, h: entry.sourceLayout.height },
        { w: entry.sourceBLayout.width, h: entry.sourceBLayout.height },
        operationId,
        computeParams,
        contentKeys.a,
        contentKeys.b,
        mapping,
      );
    },
    renderDiff(
      operationId: string,
      contentKeys: { a: string; b: string },
      ctx: ImageOperationComputeContext,
      display: ImageParams,
      mapping?: CompareMapping,
    ): { entry: DiffCacheEntry | null } | "hold" | "failed" {
      const operation = getWebGpuMultipassOperation(operationId);
      if (operation) {
        const automaticHdr = operationId === "flip-hdr" && !ctx.hdrExposures;
        const computeParams = automaticHdr
          ? () => automaticHdrFlipParams(entry, contentKeys.a)
          : operation.program.computeParams?.(ctx);
        // Automatic HDR exposures are a deterministic function of source A.
        // Key the final map by the sources + an auto-mode marker, and compute
        // the derived range only after ensureDiff has established a miss.
        const cacheParams = automaticHdr ? { ppd: 67, automaticExposure: 1 } : undefined;
        // CACHED metric: computed once, content-keyed; the RESULT (a scalar
        // error) is displayed via IDENTITY content + the isScalar colormap.
        const cached = attemptRenderDiffCached(
          entry,
          operationId,
          contentKeys,
          computeParams,
          // Multipass metrics already write their scalar result as gray RGB.
          // Preserve the selected display operation: curves process that RGB
          // normally, while colormaps opt into scalar reduction themselves.
          { ...display, channelCount: 1, norm: "linear" },
          mapping,
          cacheParams,
        );
        return cached
          ? { entry: cached }
          : entry.waiting || documentHidden || !entry.visible
            ? "hold"
            : "failed";
      }
      // Direct operation: pipeline selection is keyed by the semantic id. An
      // unknown or non-inline operation is held rather than shown as identity.
      const inline = getWebGpuImageOperation(operationId);
      if (!inline || inline.kind !== "inline" || inline.definition.id === "identity") return "hold";
      return attemptRender(entry, { ...display, imageOperation: operationId }) ? { entry: null } : "failed";
    },
    isDiffContentResident(
      operationId: string,
      contentKeys: { a: string; b: string },
      ctx: ImageOperationComputeContext,
      mapping?: CompareMapping,
    ): boolean {
      const operation = getWebGpuMultipassOperation(operationId);
      if (!operation) return getWebGpuImageOperation(operationId)?.kind === "inline";
      if (entry.disposed || !entry.sourceLayout || !entry.sourceBLayout) return false;
      const automaticHdr = operationId === "flip-hdr" && !ctx.hdrExposures;
      return hasDiff(
        entry.device,
        { w: entry.sourceLayout.width, h: entry.sourceLayout.height },
        { w: entry.sourceBLayout.width, h: entry.sourceBLayout.height },
        operationId,
        automaticHdr ? { ppd: 67, automaticExposure: 1 } : operation.program.computeParams?.(ctx),
        contentKeys.a,
        contentKeys.b,
        mapping,
      );
    },
    computeHistogram(spec: TexHistogramSpec): Promise<TexHistogramResult> | null {
      return attemptComputeHistogram(entry, spec);
    },
    computeDepthHistogram(bins: number): Promise<DeepDepthHistogramResult | null> | null {
      return attemptComputeDepthHistogram(entry, bins);
    },
    computeMetrics(contentKeys?: { a: string; b: string }, mapping?: CompareMapping): Promise<DiffMetrics> | null {
      return attemptComputeMetrics(entry, contentKeys, mapping);
    },
    isSsimScalarCached(contentKeys: { a: string; b: string }, mapping?: CompareMapping): boolean {
      return hasSsimScalar(entry.device, contentKeys.a, contentKeys.b, mapping);
    },
    peekSsimScalar(contentKeys: { a: string; b: string }, mapping?: CompareMapping): number | undefined {
      return peekSsimScalar(entry.device, contentKeys.a, contentKeys.b, mapping);
    },
    computeSsim(
      contentKeys: { a: string; b: string },
      mapping?: CompareMapping,
      retainMap = true,
    ): Promise<number> | null {
      return attemptComputeSsim(entry, contentKeys, mapping, retainMap);
    },
    computeDiffResultMean(cacheEntry: DiffCacheEntry): Promise<number> | null {
      if (entry.disposed) return null;
      return ensureDiffResultMean(entry.device, cacheEntry);
    },
    readDiffResult(cacheEntry: DiffCacheEntry): Promise<Float32Array> | null {
      if (entry.disposed) return null;
      return ensureDiffResultReadback(entry.device, cacheEntry);
    },
    park(): void {
      if (entry.disposed) return;
      parkEntry(entry);
    },
    restore(): void {
      if (
        entry.disposed || entry.failed || !entry.parked ||
        !hasPrimarySource(entry) ||
        documentHidden ||
        !entry.visible
      ) return;
      enqueueWaiter(entry);
      admitWaiters();
    },
    setVisible(visible: boolean): void {
      if (entry.disposed || entry.visible === visible) return;
      entry.visible = visible;
      if (visible) {
        if (!entry.documentHidden) cancelOffscreenRelease(entry);
        if (entry.waiting) admitWaiters();
      } else {
        removeWaiter(entry);
        parkEntry(entry);
        scheduleOffscreenRelease(entry);
      }
    },
    dispose(): void {
      if (entry.disposed) return;
      cancelOffscreenRelease(entry);
      removeWaiter(entry);
      parkEntry(entry, false); // frees srcTexture + srcTextureB + retained + deepBuffers
      releaseCpuUploadOwnership(entry);
      entry.source = null;
      entry.sourceLayout = null;
      entry.sourceB = null;
      entry.sourceBLayout = null;
      entry.sourceReacquire = null;
      entry.sourceBReacquire = null;
      entry.sourceKey = undefined;
      entry.sourceBKey = undefined;
      entry.deep = null;
      entry.disposed = true;
      panes.delete(entry);
      unregisterDevice(entry.device);
      admitWaiters();
    },
  };
  return handle;
}

/**
 * Acquire a pane bound to `canvas`. Resolves the page-wide shared `Device`
 * (`getSharedDevice()`), but does NOT allocate any live GPU resources yet —
 * the pane starts PARKED; the first `setSource()` + `render()` (or explicit
 * `restore()`) activates it. Cheap to call for many canvases up front (e.g. a
 * gallery mounting 100 panes) since nothing GPU-side happens until a pane
 * actually needs to draw. REJECTS if `getSharedDevice()` rejects (no WebGPU
 * available) — the caller (`GpuImagePane`) must fall back to the legacy CPU
 * pane in that case.
 */
export async function acquirePane(
  canvas: HTMLCanvasElement,
  opts?: { hdr?: boolean; onAdmitted?: () => void; onActivationFailure?: (error: unknown) => void },
): Promise<PaneHandle> {
  const engine = await imageWebGpuRuntime.acquire();
  const device = engine.device;
  const entry: PaneEntry = {
    paneId: ++paneIdCounter,
    canvas,
    engine,
    device,
    hdr: opts?.hdr ?? false,
    surface: null,
    srcTexture: null,
    source: null,
    sourceLayout: null,
    sourceLease: null,
    sourceReacquire: null,
    sourceB: null,
    sourceBLayout: null,
    sourceBLease: null,
    sourceBReacquire: null,
    srcTextureB: null,
    sourceKey: undefined,
    sourceBKey: undefined,
    retained: new Map(),
    activeDiffEntry: null,
    deep: null,
    deepZNear: -Infinity,
    deepZFar: Infinity,
    deepBuffers: null,
    deepSampleTex: null,
    parked: true,
    waiting: false,
    disposed: false,
    failed: false,
    contentGeneration: 0,
    presentedGeneration: 0,
    visible: true,
    documentHidden,
    offscreenReleaseTimer: null,
    onAdmitted: opts?.onAdmitted,
    onActivationFailure: opts?.onActivationFailure,
    backingWidth: 0,
    backingHeight: 0,
  };
  panes.add(entry);
  registerDevice(device);
  return makeHandle(entry);
}

/** Permanently release `handle` — equivalent to `handle.dispose()`. */
export function releasePane(handle: PaneHandle): void {
  handle.dispose();
}

/** Number of currently-LIVE (non-parked) panes across the whole pool —
 *  test/introspection hook (mirrors `engine/device.ts`'s test helpers). */
export function getLiveSwapchainCount(): number {
  return live.length;
}

/** True if `canvas`'s pane is currently LIVE (not parked) — test/introspection
 *  hook, used by the many-panes-gallery harness to find a pane the LRU cap
 *  parked without needing access to its `PaneHandle`. */
export function isCanvasLive(canvas: HTMLCanvasElement): boolean {
  return live.some((e) => e.canvas === canvas);
}

/** Per-canvas presentation admission diagnostic used by lifecycle/stress
 * harnesses. A valid first/current-generation frame is `presented === true`. */
export function getCanvasPresentationStateForTest(canvas: HTMLCanvasElement): {
  presented: boolean;
  everPresented: boolean;
  contentGeneration: number;
  presentedGeneration: number;
} | null {
  const entry = [...panes].find((candidate) => candidate.canvas === canvas);
  if (!entry) return null;
  return {
    presented: entry.contentGeneration > 0 && !needsPresentation(entry),
    everPresented: entry.presentedGeneration > 0,
    contentGeneration: entry.contentGeneration,
    presentedGeneration: entry.presentedGeneration,
  };
}

/** The live `Surface` a pane rendered into, or `null` if parked/unknown —
 *  test/introspection ONLY (the pool never exposes its `Surface` to callers; a
 *  parity harness needs it to `device.readback()` the rendered frame, the same
 *  path `GpuComparePane`'s `readbackSurface` uses on its self-managed surface).
 *  Not used by any production code. */
export function getCanvasSurfaceForTest(canvas: HTMLCanvasElement): Surface | null {
  return live.find((e) => e.canvas === canvas)?.surface ?? null;
}

export interface GpuPoolMemorySnapshot {
  panes: {
    total: number;
    live: number;
    waiting: number;
    presentationNeeded: number;
    neverPresented: number;
    offscreen: number;
    documentHidden: number;
  };
  sourceTextures: {
    activeEntries: number;
    /** Logical source texture + deep CSR storage bytes (excludes driver/surface overhead). */
    activeBytes: number;
    deepStorageBytes: number;
    sharedEntries: number;
    sharedBytes: number;
    zeroRefEntries: number;
    zeroRefBytes: number;
    activeOverBudget: boolean;
    sharedOverBudget: boolean;
    zeroRefOverBudget: boolean;
  };
  diff: {
    entries: number;
    bytes: number;
    pinnedEntries: number;
    pinnedRefs: number;
    readbackEntries: number;
    readbackBytes: number;
    overBudget: boolean;
  };
  counters: typeof poolStats;
}

export function getGpuPoolMemorySnapshot(): GpuPoolMemorySnapshot {
  const devices = new Set<Device>(devicePaneCounts.keys());
  let sharedEntries = 0, sharedBytes = 0, zeroRefEntries = 0, zeroRefBytes = 0;
  let diffEntries = 0, diffBytes = 0, pinnedEntries = 0, pinnedRefs = 0;
  let readbackEntries = 0, readbackBytes = 0;
  let diffOverBudget = false;
  for (const device of devices) {
    for (const value of sharedSources(device).values()) {
      sharedEntries++;
      sharedBytes += value.bytes;
      if (value.refs === 0) {
        zeroRefEntries++;
        zeroRefBytes += value.bytes;
      }
    }
    const diff = cacheFor(device).snapshot();
    diffEntries += diff.entries;
    diffBytes += diff.bytes;
    pinnedEntries += diff.pinnedEntries;
    pinnedRefs += diff.pinnedRefs;
    readbackEntries += diff.readbackEntries;
    readbackBytes += diff.readbackBytes;
    diffOverBudget ||= diff.overBudget;
  }
  // Include live pane-owned (unkeyed/deep) textures without double-counting
  // device-shared textures already represented above.
  const allActiveBytes = activeSourceBytes();
  let deepStorageBytes = 0;
  const activeTextures = new Set<Texture>();
  for (const entry of live) {
    if (entry.deep) deepStorageBytes += deepStorageByteLength(entry.deep);
    if (entry.srcTexture) activeTextures.add(entry.srcTexture);
    if (entry.srcTextureB) activeTextures.add(entry.srcTextureB);
    for (const texture of entry.retained.values()) activeTextures.add(texture);
  }
  const limits = getGpuSourceTextureLimits();
  return {
    panes: {
      total: panes.size,
      live: live.length,
      waiting: [...panes].filter((entry) => entry.waiting).length,
      presentationNeeded: [...panes].filter((entry) => needsPresentation(entry)).length,
      neverPresented: [...panes].filter((entry) => entry.contentGeneration > 0 && entry.presentedGeneration === 0).length,
      offscreen: [...panes].filter((entry) => !entry.visible).length,
      documentHidden: [...panes].filter((entry) => entry.documentHidden).length,
    },
    sourceTextures: {
      activeEntries: activeTextures.size,
      activeBytes: allActiveBytes,
      deepStorageBytes,
      sharedEntries,
      sharedBytes,
      zeroRefEntries,
      zeroRefBytes,
      activeOverBudget: allActiveBytes > limits.activeBytes,
      sharedOverBudget: sharedBytes > limits.sharedBytes,
      zeroRefOverBudget: zeroRefBytes > limits.zeroRefBytes,
    },
    diff: {
      entries: diffEntries,
      bytes: diffBytes,
      pinnedEntries,
      pinnedRefs,
      readbackEntries,
      readbackBytes,
      overBudget: diffOverBudget,
    },
    counters: { ...poolStats },
  };
}

/** Immediately apply changed host budgets to existing reconstructible caches. */
export function applyGpuResourcePolicy(): void {
  const limits = getGpuSourceTextureLimits();
  // Lowering the per-pane count can create zero-ref shared entries, so trim
  // memberships before enforcing the device-wide shared byte budgets.
  for (const entry of panes) evictRetained(entry);
  for (const device of devicePaneCounts.keys()) {
    trimSharedSources(device);
    cacheFor(device).configure(
      getGpuDiffCacheLimits().maxEntries,
      getGpuDiffCacheLimits().maxBytes,
    );
    while (activeSourceBytes(device) > limits.activeBytes) {
      const candidates = live.filter((entry) => entry.device === device);
      if (candidates.length <= 1) break; // one exact oversize working set is soft-pinned
      const victim = candidates[0]!;
      parkEntry(victim, false);
      if (victim.visible) enqueueWaiter(victim);
    }
  }
  while (live.length > getLiveGpuPaneLimit()) {
    const victim = live[0]!;
    parkEntry(victim, false);
    if (victim.visible) enqueueWaiter(victim);
  }
  admitWaiters();
}

/** Number of strongly registered devices; test-only lifecycle diagnostic. */
export function getRegisteredGpuDeviceCountForTest(): number {
  return devicePaneCounts.size;
}

registerRuntimePolicyHook(applyGpuResourcePolicy);

/** Reset cumulative counters only; gauges and ownership remain untouched. */
export function resetGpuPoolMemoryStats(): void {
  poolStats.parks = 0;
  poolStats.restores = 0;
  poolStats.admissions = 0;
  poolStats.admissionBlocks = 0;
  poolStats.evictions = 0;
  poolStats.presentations = 0;
  poolStats.presentationRotations = 0;
}

function updateDocumentVisibility(hidden: boolean): void {
  documentHidden = hidden;
  if (documentHidden) {
    for (const entry of panes) {
      entry.documentHidden = true;
      if (!entry.parked) {
        parkEntry(entry, false);
        if (entry.visible) enqueueWaiter(entry);
      }
      scheduleOffscreenRelease(entry);
    }
    return;
  }
  for (const entry of panes) {
    entry.documentHidden = false;
    if (entry.visible) cancelOffscreenRelease(entry);
    else scheduleOffscreenRelease(entry);
    if (entry.disposed || entry.failed || !entry.visible || !hasPrimarySource(entry)) continue;
    enqueueWaiter(entry);
  }
  admitWaiters();
}

/** Test seam for deterministic page-visibility lifecycle coverage. */
export function setDocumentHiddenForTest(hidden: boolean): void {
  updateDocumentVisibility(hidden);
}

// Exactly one module-level page-visibility coordinator. Existing waiters keep
// their FIFO position across suspension; previously-live panes join behind them.
// Restoration is performed only by admitWaiters, never by direct activation.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    updateDocumentVisibility(document.visibilityState === "hidden");
  });
}
