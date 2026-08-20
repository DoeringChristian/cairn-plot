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
import { getSharedDevice } from "./device";
import { renderImage, type ImageParams } from "./image-engine";
// Phase 2b: the CACHED-op render path (FLIP / HDR-FLIP / SSIM) runs the diff
// engine's content-keyed compute + cache from INSIDE the pool (the pool owns the
// two source textures a cached op reduces). Safe to import here: `pool.ts` is
// browser-bundle only (never loaded by the `*.test.ts` strip-only node runner),
// so pulling the `engine/kernels` graph in transitively is fine.
import { ensureDiff, type DiffCacheEntry } from "./diff-engine";
import type { CompareMapping } from "./compare-align";
import type { Device, Surface, Texture, TextureFormat, DeepSampleBuffers, DeepGpuCsrSpec } from "./types";
import { forceEngineFailRequested } from "./test-hooks";

/**
 * Cap on simultaneously-LIVE GPU swapchains (configured `Surface` + source
 * `Texture`) across every pane this pool has acquired. Named per the Task 6
 * brief ("cap live swapchains... make it a named const"). 12 is a sensible
 * default: large enough that a normal viewport of on-screen panes all stay
 * live, small enough to bound total resident source-texture memory for a big
 * gallery.
 */
export const MAX_LIVE_SWAPCHAINS = 12;

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
   */
  setSource(src: SourceUpload): void;
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
   */
  setSourceB(src: SourceUpload | null): void;
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
   * RESULT texture for (`contentKeys.a`, `contentKeys.b`, `kernelId`,
   * `computeParams`, `mapping`) over this pane's TWO live source slots (`a` =
   * {@link setSource}, `b` = {@link setSourceB}), then blits it through
   * `displayParams` — the result texture is bound as the PRIMARY source and shown
   * via IDENTITY content (the result already IS the scalar error) + the
   * `isScalar` colormap the display-encoding registry supplies. The diff-engine's
   * per-device content-keyed cache OWNS the returned entry's texture — the caller
   * must NOT destroy it — and a zoom / exposure / colormap change only re-blits
   * (cache hit), never recomputes. Returns the cache entry (so the caller can read
   * MSE/PSNR/MAE + the per-pixel readback) or `null` on a hard GPU failure (the
   * pane is parked and the caller must fall back to the legacy pane), mirroring
   * {@link render}'s NEVER-THROWS contract. Both source slots must be set (returns
   * `null` otherwise).
   */
  renderDiffCached(
    kernelId: string,
    contentKeys: { a: string; b: string },
    computeParams: Record<string, number> | undefined,
    displayParams: ImageParams,
    mapping?: CompareMapping,
  ): DiffCacheEntry | null;
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

interface PaneEntry {
  canvas: HTMLCanvasElement;
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
  /** DEEP-EXR GPU composite source (retained CSR) — mutually exclusive with
   *  `source`; when set, `srcTexture` is filled by `compositeDeep`, not a CPU
   *  upload. See `PaneHandle.setDeepSource`. */
  deep: DeepGpuCsrSpec | null;
  /** Current depth WINDOW [near, far] for `deep`. */
  deepZNear: number;
  deepZFar: number;
  /** GPU storage buffers for `deep` (freed on park/dispose, rebuilt on restore). */
  deepBuffers: DeepSampleBuffers | null;
  parked: boolean;
  disposed: boolean;
  /** Last-reported on-screen visibility (`PaneHandle.setVisible`) — read by
   *  `evictOverCap` to prefer parking off-screen panes first. */
  visible: boolean;
  /**
   * Q22 fix: the canvas backing-store / surface size (DEVICE pixels, i.e.
   * already display-css-size * dpr), as last requested via
   * `PaneHandle.resize()`. 0 until the first `resize()` call — `activateEntry`
   * falls back to the retained source's dimensions in that narrow window (a
   * pane rendering before its container has ever been measured) so
   * `Surface.configure()` never sees a zero size.
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

/** Free `entry`'s live GPU resources; leaves `entry.source` (CPU buffer) intact. */
function parkEntry(entry: PaneEntry): void {
  if (entry.parked) return;
  untrack(entry);
  if (entry.srcTexture) {
    entry.srcTexture.destroy();
    entry.srcTexture = null;
  }
  if (entry.srcTextureB) {
    entry.srcTextureB.destroy();
    entry.srcTextureB = null;
  }
  if (entry.deepBuffers) {
    entry.deepBuffers.destroy();
    entry.deepBuffers = null;
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
  const device = entry.device;
  entry.surface = device.createSurface(entry.canvas, { hdr: entry.hdr });
  // Q22 fix: the backing store / surface are sized to the ON-SCREEN display
  // resolution (`backingWidth/backingHeight`, set via `resize()`), NEVER the
  // source image's own resolution — falls back to the source's dims only in
  // the narrow window before the caller's first `resize()` call (e.g. a
  // render requested before the pane's container has been measured), so
  // `configure()` never sees a zero size.
  const w = entry.backingWidth || entry.source?.width || entry.deep?.width || 1;
  const h = entry.backingHeight || entry.source?.height || entry.deep?.height || 1;
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
    const tex = device.createTexture(entry.source.width, entry.source.height, entry.source.format);
    tex.write(entry.source.data);
    entry.srcTexture = tex;
  }
  // SECOND source slot `b` (arity-2 diff ops) — retained + re-uploaded on every
  // (re)activate exactly like the primary `a` buffer. Null for the single-image
  // path (no texture allocated).
  if (entry.sourceB) {
    if (entry.srcTextureB) entry.srcTextureB.destroy();
    const texB = device.createTexture(entry.sourceB.width, entry.sourceB.height, entry.sourceB.format);
    texB.write(entry.sourceB.data);
    entry.srcTextureB = texB;
  }
  entry.parked = false;
  touchMostRecentlyUsed(entry);
  evictOverCap(entry);
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
  try {
    activateEntry(entry);
    if (!entry.surface || !entry.srcTexture) return false;
    // Bind the pool-owned SECOND source slot `b` (arity-2 direct diff ops) when
    // present — the caller sets `params.contentOpId`; the pool supplies the
    // physical texture. Absent → the single-image path (renderImage binds a 1x1
    // placeholder, and opId 0 / identity ignores it), byte-identical to before.
    const p = entry.srcTextureB ? { ...params, srcB: entry.srcTextureB } : params;
    renderImage(entry.device, entry.surface, entry.srcTexture, p);
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
  kernelId: string,
  contentKeys: { a: string; b: string },
  computeParams: Record<string, number> | undefined,
  displayParams: ImageParams,
  mapping?: CompareMapping,
): DiffCacheEntry | null {
  if (entry.disposed || (!entry.source && !entry.deep) || !entry.sourceB) return null;
  try {
    activateEntry(entry);
    if (!entry.surface || !entry.srcTexture || !entry.srcTextureB) return null;
    // Content-keyed cache: a pure function of the SOURCE content (not the
    // viewport / exposure / colormap), so the expensive multi-pass compute runs
    // once and zoom/pan/encoding changes re-blit only. The cache OWNS the result
    // texture — never destroyed here.
    const cacheEntry = ensureDiff(
      entry.device,
      entry.srcTexture,
      entry.srcTextureB,
      kernelId,
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
    return cacheEntry;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("cairn-plot engine: cached-diff pane render failed, falling back to legacy pane", err);
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
    setSource(src: SourceUpload): void {
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
        if (entry.srcTexture) entry.srcTexture.destroy();
        const tex = entry.device.createTexture(src.width, src.height, src.format);
        tex.write(src.data);
        entry.srcTexture = tex;
      }
      // Parked: the new source is picked up by the next activateEntry().
    },
    setSourceB(src: SourceUpload | null): void {
      if (entry.disposed) return;
      entry.sourceB = src;
      if (!entry.parked && entry.surface) {
        if (entry.srcTextureB) {
          entry.srcTextureB.destroy();
          entry.srcTextureB = null;
        }
        if (src) {
          const tex = entry.device.createTexture(src.width, src.height, src.format);
          tex.write(src.data);
          entry.srcTextureB = tex;
        }
      }
      // Parked: the new second source is picked up by the next activateEntry().
    },
    setDeepSource(spec: DeepGpuCsrSpec, zNear: number, zFar: number): void {
      if (entry.disposed) return;
      entry.deep = spec;
      entry.deepZNear = zNear;
      entry.deepZFar = zFar;
      entry.source = null; // mutually exclusive with a CPU source
      if (!entry.parked && entry.surface) {
        // Rebuild the composite target + storage buffers, then composite once.
        if (entry.srcTexture) entry.srcTexture.destroy();
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
      kernelId: string,
      contentKeys: { a: string; b: string },
      computeParams: Record<string, number> | undefined,
      displayParams: ImageParams,
      mapping?: CompareMapping,
    ): DiffCacheEntry | null {
      return attemptRenderDiffCached(entry, kernelId, contentKeys, computeParams, displayParams, mapping);
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
      parkEntry(entry); // frees srcTexture + srcTextureB + deepBuffers
      entry.source = null;
      entry.sourceB = null;
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
  const device = await getSharedDevice();
  const entry: PaneEntry = {
    canvas,
    device,
    hdr: opts?.hdr ?? false,
    surface: null,
    srcTexture: null,
    source: null,
    sourceB: null,
    srcTextureB: null,
    deep: null,
    deepZNear: -Infinity,
    deepZFar: Infinity,
    deepBuffers: null,
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
