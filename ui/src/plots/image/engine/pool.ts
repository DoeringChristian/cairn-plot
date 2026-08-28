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
 * `Surface`/`Texture` are freed while the CPU source buffer it was last given
 * via `setSource()` is RETAINED (owned by this pool entry, not by the
 * caller) so a scroll-back-into-view **restore** can re-upload without the
 * caller re-supplying the data. `render()` auto-restores a parked pane
 * (marking it most-recently-used) and — if that pushes the live count over
 * the cap — evicts (parks) the least-recently-used OTHER live pane,
 * PREFERRING an off-screen victim (`PaneHandle.setVisible`/`evictOverCap`) —
 * only reaching into the visible set when every live slot is visible (more
 * visible panes than the cap, the many-panes-gallery case this pool exists
 * for). Critically, `render()`'s auto-restore is unconditional: a pane the
 * LRU parked while it was STILL ON-SCREEN (visible-set eviction)
 * transparently restores on its very next render request (a viewport
 * zoom/pan, an exposure/operator change, the double-click reset, ...) — a
 * re-render never paints into a parked surface. `GpuImagePane` additionally
 * drives explicit `park()`/`restore()`/`setVisible()` from its own
 * `IntersectionObserver` so off-screen panes free GPU memory promptly
 * instead of only reactively at the next over-cap render, and the pool
 * always knows which live panes are actually on-screen.
 *
 * `Surface` (`engine/types.ts`) exposes no explicit teardown (WebGPU's
 * `GPUCanvasContext` has no public "release the swapchain" call short of
 * `Device.destroy()` — see the RHI's doc notes) — so "parking" frees the
 * (often large) source `Texture` and simply stops rendering to the canvas;
 * re-`createSurface`-ing the SAME canvas on restore is a safe idempotent
 * re-configure (`webgpu/device.ts`'s `createSurface`).
 */
import { imageWebGpuRuntime } from "./webgpu/runtime.ts";
import type { ImageWebGpuRuntime } from "./webgpu/runtime.ts";
import { renderImage, computeMetrics, type ImageParams, type DiffMetrics } from "./image-engine";
// Phase 2b: the CACHED-op render path (FLIP / HDR-FLIP / SSIM) runs the diff
// engine's content-keyed compute + cache from INSIDE the pool (the pool owns the
// two source textures a cached op reduces). Safe to import here: `pool.ts` is
// browser-bundle only (never loaded by the `*.test.ts` strip-only node runner),
// so pulling the `engine/kernels` graph in transitively is fine.
import {
  ensureDiff,
  hasDiff,
  ensureSsimScalar,
  ensureDiffResultReadback,
  type DiffCacheEntry,
} from "./diff-engine";
import type { CompareMapping } from "./compare-align";
import { contentOpId, getMultipassImageOperation } from "../model/content-ops/index";
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
} from "./webgpu/device-contract";
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
  const scalarMode = params.analytic ? 1 : params.linearScalar ? 2 : params.turbo ? 3 : 0;
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

export interface PaneHandle {
  readonly canvas: HTMLCanvasElement;
  /** True while this pane's GPU resources are freed (parked). */
  readonly isParked: boolean;
  /**
   * Replace the CPU source buffer. Retained by the pool so `park()`/restore
   * cycles don't need the caller to re-supply it. If the pane is currently
   * live, uploads immediately; if parked, the upload is deferred to the next
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
  /**
   * Set (or clear) the SECOND source buffer `b` — the reference/baseline operand
   * of an arity-2 diff CONTENT op (`image/content-ops`). Retained by the pool
   * exactly like {@link setSource}'s primary buffer, so park/restore cycles don't
   * need the caller to re-supply it: uploaded immediately when live, deferred to
   * the next `render()`/`restore()` when parked. Pass `null` to drop it (back to
   * the single-image path). INDEPENDENT of {@link setSource} — the primary `a`
   * slot is untouched. Once set, {@link render}'s `params` are bound with this
   * texture as `srcB`, so a `params.contentOpId` selecting a `direct` diff op
   * (signed/absolute/…) samples both slots; the single-image (identity) path is
   * unaffected when `b` is null (a 1x1 placeholder is bound and opId 0 ignores it).
   *
   * `contentKey` (optional) opts the `b` slot into the SAME content-keyed
   * retention {@link setSource} documents — a stacked flip back to a diff slot
   * rebinds the reference texture synchronously instead of re-uploading it.
   */
  setSourceB(src: SourceUpload | null, contentKey?: string): void;
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
   * Auto-restores a parked pane first (marking it most-recently-used) and
   * evicts the LRU live pane if that pushes the pool over
   * `MAX_LIVE_SWAPCHAINS`. No-op (does not throw) if no source has been set
   * yet or the handle was disposed.
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
   * declaration: POINTWISE → the per-frame content op evaluated inside the
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
  computeMetrics(mapping?: CompareMapping): Promise<DiffMetrics> | null;
  /**
   * Mean-SSIM scalar over the two live source slots — the diff metrics chip's SSIM
   * face. Runs `ensureSsimScalar` (the content+mapping-keyed cache) over the
   * pool-owned textures. Returns `null` when a slot is unset / disposed / a hard
   * GPU failure occurs.
   */
  computeSsim(contentKeys: { a: string; b: string }, mapping?: CompareMapping): Promise<number> | null;
  /**
   * Read back a cached diff RESULT (a {@link DiffCacheEntry} returned by
   * {@link renderDiffCached}) as the per-pixel metric values (RGBA f32, row-major,
   * result resolution) the TEV overlay prints in a CACHED diff mode. Memoized in
   * the entry (never re-reads, never recomputes). Returns `null` on a disposed
   * handle.
   */
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
   * LRU: `evictOverCap` prefers parking an OFF-SCREEN (`visible: false`)
   * entry over a visible one, so a still-on-screen pane that got LRU-parked
   * only because MORE panes are visible than `MAX_LIVE_SWAPCHAINS` (the
   * many-panes-gallery case this pool exists for) survives longer than an
   * off-screen one. Does NOT itself park/restore anything — no-op on a
   * disposed handle. Defaults to visible (`true`) until the caller reports
   * otherwise, since a freshly-acquired pane is typically on-screen.
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
  /** SECOND source slot `b` (the reference/baseline of an arity-2 diff CONTENT
   *  op) — the retained CPU buffer + its uploaded texture, mirroring `source`/
   *  `srcTexture`. Uploaded in `activateEntry`, freed in `parkEntry`, re-uploaded
   *  on restore. Null for the single-image path (the common case). See
   *  `PaneHandle.setSourceB`. */
  sourceB: SourceUpload | null;
  srcTextureB: Texture | null;
  /** Content key of the CURRENT primary/`b` source (see `PaneHandle.setSource`'s
   *  `contentKey`). `undefined` = the slot's texture is UNKEYED (exclusive, freed
   *  on replace/park); a string = the texture is owned by `retained` under this
   *  key (kept for instant flip-back). */
  sourceKey: string | undefined;
  sourceBKey: string | undefined;
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
  disposed: boolean;
  /** Last-reported on-screen visibility (`PaneHandle.setVisible`) — read by
   *  `evictOverCap` to prefer parking off-screen panes first. */
  visible: boolean;
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

function touchMostRecentlyUsed(entry: PaneEntry): void {
  const i = live.indexOf(entry);
  if (i !== -1) live.splice(i, 1);
  live.push(entry);
}

function untrack(entry: PaneEntry): void {
  const i = live.indexOf(entry);
  if (i !== -1) live.splice(i, 1);
}

/**
 * Upload `src` into a source texture, or REBIND an already-resident one when
 * `key` names a retained upload. When `key` is given, the returned texture is
 * owned by `entry.retained` (kept for flip-back); when absent, the caller owns
 * it exclusively (unkeyed, freed on replace). A keyed hit re-inserts the key as
 * most-recently-used; a keyed miss uploads, retains, and evicts the LRU.
 */
function uploadOrBindSource(entry: PaneEntry, src: SourceUpload, key: string | undefined): Texture {
  if (key !== undefined) {
    const existing = entry.retained.get(key);
    if (existing) {
      // Touch: move to most-recently-used (Map insertion order = LRU order).
      entry.retained.delete(key);
      entry.retained.set(key, existing);
      return existing;
    }
    const tex = entry.device.createTexture(src.width, src.height, src.format);
    tex.write(src.data);
    entry.retained.set(key, tex);
    evictRetained(entry);
    return tex;
  }
  const tex = entry.device.createTexture(src.width, src.height, src.format);
  tex.write(src.data);
  return tex;
}

/** Evict the LRU retained textures down to the cap, never destroying one that is
 *  the CURRENTLY-bound `srcTexture`/`srcTextureB` (skips to the next oldest). */
function evictRetained(entry: PaneEntry): void {
  while (entry.retained.size > MAX_RETAINED_SOURCE_TEXTURES) {
    let victimKey: string | undefined;
    for (const [k, tex] of entry.retained) {
      if (tex !== entry.srcTexture && tex !== entry.srcTextureB) {
        victimKey = k;
        break;
      }
    }
    if (victimKey === undefined) break; // every retained texture is currently bound
    const tex = entry.retained.get(victimKey)!;
    entry.retained.delete(victimKey);
    tex.destroy();
  }
}

/** Free the texture a slot last bound, IF it was unkeyed (exclusive). Keyed
 *  textures stay in `retained` for flip-back; the caller drops the slot's ref. */
function releaseUnkeyedSlotTexture(tex: Texture | null, key: string | undefined): void {
  if (tex && key === undefined) tex.destroy();
}

/** Destroy every retained texture and clear the map (park/dispose). */
function clearRetained(entry: PaneEntry): void {
  for (const tex of entry.retained.values()) tex.destroy();
  entry.retained.clear();
}

/** Free `entry`'s live GPU resources; leaves `entry.source` (CPU buffer) intact. */
function parkEntry(entry: PaneEntry): void {
  if (entry.parked) return;
  untrack(entry);
  // Free the currently-bound slot textures IF unkeyed; keyed ones are owned by
  // `retained` and freed by `clearRetained` below (no double-destroy).
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
  entry.surface = null;
  entry.parked = true;
}

/**
 * Evict (park) the least-recently-used live entry other than `except`,
 * repeating until at/under `MAX_LIVE_SWAPCHAINS`. Prefers the LRU entry among
 * OFF-SCREEN (`visible: false`) panes — parking a pane nobody can see is
 * always preferable to parking one that's on-screen. Only reaches into the
 * visible set when every other live slot is ALSO visible (the many-panes
 * gallery case: more visible panes than the cap, so an eviction among them is
 * unavoidable) — falls back to plain LRU across all live entries then.
 */
function evictOverCap(except: PaneEntry): void {
  while (live.length > MAX_LIVE_SWAPCHAINS) {
    const victim = live.find((e) => e !== except && !e.visible) ?? live.find((e) => e !== except);
    if (!victim) break;
    parkEntry(victim);
  }
}

/**
 * (Re-)acquire GPU resources for `entry` and upload its retained source (if
 * any); marks it most-recently-used and enforces the live cap.
 *
 * THROWS on a hard GPU-init failure — `Device.createSurface()` can throw
 * under real GPU-context exhaustion or driver failure. Callers
 * (`attemptRender`, below) MUST catch this — it is a genuine "this pane can
 * never activate right now" condition. `?forceEngineFail` (test-only,
 * `./test-hooks`) deterministically triggers this same throw path without
 * needing to actually exhaust a real GPU resource cap.
 */
function activateEntry(entry: PaneEntry): void {
  if (entry.disposed) return;
  if (forceEngineFailRequested()) {
    throw new Error("cairn-plot engine: forced pane activation failure (?forceEngineFail test hook)");
  }
  if (!entry.parked && entry.surface) {
    touchMostRecentlyUsed(entry);
    evictOverCap(entry);
    return;
  }
  // MEASURE-THEN-RENDER (the pane contract). A pane has NO backing size until its
  // container is measured (`PaneHandle.resize()`); until then there is nothing to
  // configure, so activation is DEFERRED — the surface stays null and the render
  // callers treat this entry as a no-op (a pane rendered pre-measure is briefly
  // blank, by contract — see `PaneHandle.render`). The on-screen backing size is the
  // ONLY size the surface is ever configured to: there is no source-dims floor.
  if (!entry.backingWidth || !entry.backingHeight) return;
  const device = entry.device;
  entry.surface = entry.engine.createSurface(entry.canvas, { hdr: entry.hdr });
  const w = entry.backingWidth;
  const h = entry.backingHeight;
  entry.canvas.width = w;
  entry.canvas.height = h;
  entry.surface.configure(w, h);
  if (entry.deep) {
    // DEEP GPU composite: an rgba16float target the composite pass fills, plus
    // the (once-uploaded) sample storage buffers. Re-created on every
    // restore from the retained CSR (like the CPU `source` path re-uploads).
    const tex = device.createTexture(entry.deep.width, entry.deep.height, "rgba16float");
    entry.srcTexture = tex;
    entry.deepBuffers = device.createDeepSampleBuffers!(entry.deep);
    device.compositeDeep!(entry.deepBuffers, tex, entry.deepZNear, entry.deepZFar);
  } else if (entry.source) {
    // Re-upload the current primary (park cleared `retained`), re-seeding the
    // content-keyed retention if the source carries a key.
    entry.srcTexture = uploadOrBindSource(entry, entry.source, entry.sourceKey);
  }
  // SECOND source slot `b` (arity-2 diff ops) — retained + re-uploaded on every
  // (re)activate exactly like the primary `a` buffer. Null for the single-image
  // path (no texture allocated).
  if (entry.sourceB) {
    entry.srcTextureB = uploadOrBindSource(entry, entry.sourceB, entry.sourceBKey);
  }
  entry.parked = false;
  touchMostRecentlyUsed(entry);
  evictOverCap(entry);
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
  if (entry.disposed || (!entry.source && !entry.deep)) return true;
  // MEASURE-THEN-RENDER: nothing to present until the container is measured (backing
  // size set via `resize()`). A no-op SUCCESS (not a failure) so the caller does NOT
  // fall back to the legacy pane; the first render after the first `resize()` paints.
  if (!entry.backingWidth || !entry.backingHeight) return true;
  try {
    activateEntry(entry);
    if (!entry.surface || !entry.srcTexture) return false;
    // Bind the pool-owned SECOND source slot `b` (arity-2 direct diff ops) when
    // present — the caller sets `params.contentOpId`; the pool supplies the
    // physical texture. Absent → the single-image path (renderImage binds a 1x1
    // placeholder, and opId 0 / identity ignores it), byte-identical to before.
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
        contentOpId: params.contentOpId,
        hasSrcB: entry.srcTextureB != null,
        isScalar: params.isScalar,
        compareIntended: params.compareIntended,
        ...displayFingerprint(params),
      };
      recordPaneRender(record);
      // Level-2 deep detector: sample this present's actual output color.
      if (deepColorDetectorActive()) sampleDeepColor(entry, entry.srcTexture, p, record);
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane activation/render failed, falling back to legacy pane", err);
    // Force a full teardown regardless of `parkEntry`'s early-return guard
    // (`entry.parked` may still read `true` if the throw happened mid
    // `activateEntry()`, before it flips to `false` — see that function).
    entry.parked = false;
    parkEntry(entry);
    return false;
  }
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
  computeParams: Record<string, number> | undefined,
  displayParams: ImageParams,
  mapping?: CompareMapping,
): DiffCacheEntry | null {
  if (entry.disposed || (!entry.source && !entry.deep) || !entry.sourceB) return null;
  try {
    activateEntry(entry);
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
    );
    // The cached RESULT is the scalar error — displayed via IDENTITY content
    // (`displayParams.contentOpId` unset/0, no `srcB`) + the isScalar colormap.
    // Bind it as the PRIMARY source; `srcTextureB` is intentionally NOT injected
    // (the display is single-source over the result).
    renderImage(entry.device, entry.surface, cacheEntry.texture, displayParams);
    // Present-coherency instrumentation (test-only; see attemptRender). A cached
    // diff blits the RESULT as the primary — the bound SOURCE keys still record
    // which operands the result was computed from (stale = an artefact).
    if (isPaneRenderLogActive()) {
      const record: PaneRenderRecord = {
        mode: "cached-diff",
        sourceKey: entry.sourceKey,
        sourceBKey: entry.sourceBKey,
        contentOpId: displayParams.contentOpId,
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
    return cacheEntry;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: cached-diff pane render failed, falling back to legacy pane", err);
    entry.parked = false;
    parkEntry(entry);
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
function attemptComputeMetrics(entry: PaneEntry, mapping?: CompareMapping): Promise<DiffMetrics> | null {
  if (entry.disposed || !entry.source || !entry.sourceB) return null;
  try {
    activateEntry(entry);
    if (!entry.srcTexture || !entry.srcTextureB) return null;
    return computeMetrics(entry.device, entry.srcTexture, entry.srcTextureB, mapping);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane metrics compute failed", err);
    entry.parked = false;
    parkEntry(entry);
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
  if (entry.disposed || !entry.source || entry.deep) return null;
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
    entry.parked = false;
    parkEntry(entry);
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
    entry.parked = false;
    parkEntry(entry);
    return null;
  }
}

/** Mean-SSIM scalar over `entry`'s two live source slots (see `PaneHandle.computeSsim`). */
function attemptComputeSsim(
  entry: PaneEntry,
  contentKeys: { a: string; b: string },
  mapping?: CompareMapping,
): Promise<number> | null {
  if (entry.disposed || !entry.source || !entry.sourceB) return null;
  try {
    activateEntry(entry);
    if (!entry.srcTexture || !entry.srcTextureB) return null;
    return ensureSsimScalar(entry.device, entry.srcTexture, entry.srcTextureB, contentKeys.a, contentKeys.b, mapping);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: pane SSIM compute failed", err);
    entry.parked = false;
    parkEntry(entry);
    return null;
  }
}

function makeHandle(entry: PaneEntry): PaneHandle {
  return {
    canvas: entry.canvas,
    get isParked() {
      return entry.parked;
    },
    setSource(src: SourceUpload, contentKey?: string): void {
      if (entry.disposed) return;
      entry.source = src;
      // A plain CPU source supersedes any prior DEEP composite source.
      entry.deep = null;
      if (entry.deepBuffers) {
        entry.deepBuffers.destroy();
        entry.deepBuffers = null;
      }
      // Q22 fix: no canvas/surface sizing here — that's `resize()`'s job now,
      // driven by the pane's ON-SCREEN display size, not this source
      // texture's own resolution.
      if (!entry.parked && entry.surface) {
        const prev = entry.srcTexture;
        const prevKey = entry.sourceKey;
        // Content-keyed retention: a keyed hit rebinds the resident texture (no
        // re-upload — the flip-back fast path); otherwise upload. The PREVIOUS
        // texture is freed only if it was unkeyed — a keyed one stays in
        // `retained` for its own flip-back (and may be `prev` itself on a
        // same-key re-set, in which case `uploadOrBindSource` returns it).
        const tex = uploadOrBindSource(entry, src, contentKey);
        if (prev && prev !== tex) releaseUnkeyedSlotTexture(prev, prevKey);
        entry.srcTexture = tex;
        entry.sourceKey = contentKey;
      } else {
        // Parked: the new source is picked up by the next activateEntry();
        // record its key so that upload re-seeds retention correctly.
        entry.sourceKey = contentKey;
      }
    },
    setSourceB(src: SourceUpload | null, contentKey?: string): void {
      if (entry.disposed) return;
      entry.sourceB = src;
      if (!entry.parked && entry.surface) {
        const prev = entry.srcTextureB;
        const prevKey = entry.sourceBKey;
        if (src) {
          const tex = uploadOrBindSource(entry, src, contentKey);
          if (prev && prev !== tex) releaseUnkeyedSlotTexture(prev, prevKey);
          entry.srcTextureB = tex;
          entry.sourceBKey = contentKey;
        } else {
          if (prev) releaseUnkeyedSlotTexture(prev, prevKey);
          entry.srcTextureB = null;
          entry.sourceBKey = undefined;
        }
      } else {
        // Parked: picked up by the next activateEntry().
        entry.sourceBKey = src ? contentKey : undefined;
      }
    },
    setDeepSource(spec: DeepGpuCsrSpec, zNear: number, zFar: number): void {
      if (entry.disposed) return;
      entry.deep = spec;
      entry.deepZNear = zNear;
      entry.deepZFar = zFar;
      entry.source = null; // mutually exclusive with a CPU source
      if (!entry.parked && entry.surface) {
        // Rebuild the composite target + storage buffers, then composite once.
        // A deep source is never a keyed (compare) source, but free the prior
        // texture retention-safely regardless (keyed → owned by `retained`).
        releaseUnkeyedSlotTexture(entry.srcTexture, entry.sourceKey);
        entry.sourceKey = undefined;
        if (entry.deepBuffers) entry.deepBuffers.destroy();
        const tex = entry.device.createTexture(spec.width, spec.height, "rgba16float");
        entry.srcTexture = tex;
        entry.deepBuffers = entry.device.createDeepSampleBuffers!(spec);
        entry.device.compositeDeep!(entry.deepBuffers, tex, zNear, zFar);
      }
      // Parked: picked up by the next activateEntry().
    },
    setDeepWindow(zNear: number, zFar: number): void {
      if (entry.disposed) return;
      entry.deepZNear = zNear;
      entry.deepZFar = zFar;
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
      if (entry.disposed || !entry.source || !entry.sourceB) return false;
      return hasDiff(
        entry.device,
        { w: entry.source.width, h: entry.source.height },
        { w: entry.sourceB.width, h: entry.sourceB.height },
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
      const operation = getMultipassImageOperation(operationId);
      if (operation) {
        // CACHED metric: computed once, content-keyed; the RESULT (a scalar
        // error) is displayed via IDENTITY content + the isScalar colormap.
        const cached = attemptRenderDiffCached(
          entry,
          operationId,
          contentKeys,
          operation.implementation.computeParams?.(ctx),
          { ...display, channelCount: 1, isScalar: true, norm: "linear" },
          mapping,
        );
        return cached ? { entry: cached } : "failed";
      }
      // DIRECT pointwise op, evaluated per frame: the pool injects `srcB`;
      // `cairnContent(a,b,opId)`. Op id 0 = IDENTITY (an unregistered or
      // transiently mis-resolved kernel) — the identity-op floor holds.
      const opId = contentOpId(operationId);
      if (opId === 0) return "hold";
      return attemptRender(entry, { ...display, contentOpId: opId }) ? { entry: null } : "failed";
    },
    isDiffContentResident(
      operationId: string,
      contentKeys: { a: string; b: string },
      ctx: ImageOperationComputeContext,
      mapping?: CompareMapping,
    ): boolean {
      const operation = getMultipassImageOperation(operationId);
      if (!operation) return contentOpId(operationId) !== 0;
      if (entry.disposed || !entry.source || !entry.sourceB) return false;
      return hasDiff(
        entry.device,
        { w: entry.source.width, h: entry.source.height },
        { w: entry.sourceB.width, h: entry.sourceB.height },
        operationId,
        operation.implementation.computeParams?.(ctx),
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
    computeMetrics(mapping?: CompareMapping): Promise<DiffMetrics> | null {
      return attemptComputeMetrics(entry, mapping);
    },
    computeSsim(contentKeys: { a: string; b: string }, mapping?: CompareMapping): Promise<number> | null {
      return attemptComputeSsim(entry, contentKeys, mapping);
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
      if (entry.disposed || (!entry.source && !entry.deep)) return;
      activateEntry(entry);
    },
    setVisible(visible: boolean): void {
      if (entry.disposed) return;
      entry.visible = visible;
    },
    dispose(): void {
      if (entry.disposed) return;
      parkEntry(entry); // frees srcTexture + srcTextureB + retained + deepBuffers
      entry.source = null;
      entry.sourceB = null;
      entry.sourceKey = undefined;
      entry.sourceBKey = undefined;
      entry.deep = null;
      entry.disposed = true;
    },
  };
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
  opts?: { hdr?: boolean },
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
    sourceB: null,
    srcTextureB: null,
    sourceKey: undefined,
    sourceBKey: undefined,
    retained: new Map(),
    deep: null,
    deepZNear: -Infinity,
    deepZFar: Infinity,
    deepBuffers: null,
    deepSampleTex: null,
    parked: true,
    disposed: false,
    visible: true,
    backingWidth: 0,
    backingHeight: 0,
  };
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

/** The live `Surface` a pane rendered into, or `null` if parked/unknown —
 *  test/introspection ONLY (the pool never exposes its `Surface` to callers; a
 *  parity harness needs it to `device.readback()` the rendered frame, the same
 *  path `GpuComparePane`'s `readbackSurface` uses on its self-managed surface).
 *  Not used by any production code. */
export function getCanvasSurfaceForTest(canvas: HTMLCanvasElement): Surface | null {
  return live.find((e) => e.canvas === canvas)?.surface ?? null;
}
