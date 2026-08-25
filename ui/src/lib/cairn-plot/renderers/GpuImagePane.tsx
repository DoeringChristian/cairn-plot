/**
 * GpuImagePane — the WebGPU image BACKEND. One of two interchangeable image
 * backends (see `CpuImagePane.tsx` for the CPU/2D-canvas twin); both accept the
 * shared `ImageBackendProps` union (`renderers/image-backend.ts`) and are chosen
 * upstream by the render mode (`resolveRenderMode` — cpu | gpu | auto). It wraps
 * `engine/image-engine.ts`'s `renderImage()` + `engine/pool.ts`'s many-panes
 * resource pool. On any hard GPU-init/render failure it self-heals to
 * `CpuImagePane` (see `engineFailed`), so a pane never blanks.
 *
 * ## One component, three content modes
 * The pane renders `display_encode(content(uv))` — one persistent WebGPU
 * surface, two stages. The CONTENT stage produces the k-channel value per texel
 * from 1–2 source slots:
 *   - a plain IMAGE (single source; SDR `imageUrl` or float `hdr`),
 *   - a DIFF (`source` vs `compareSource.b` through a diff content op — a direct
 *     pointwise op inline, or a cached FLIP/HDR-FLIP/SSIM metric), or
 *   - a split/blend COMPOSITOR (a light composite of the two operands).
 * `compareSource` selects diff/compositor; its absence is the plain-image path.
 * The DISPLAY stage (curves / colormap LUTs / analytic, gated by the content
 * op's output arity) is shared across all three. Both prop shapes retain the CPU
 * source buffer the pixel-value overlay reads, like the CPU twin.
 *
 * ## Frame coherency — the RenderSnapshot
 * Sources upload asynchronously while props flip synchronously, so every visible
 * render is gated by a per-commit `RenderSnapshot` (`render-snapshot.ts`): a
 * frame paints only when its whole input set is from one commit; otherwise the
 * pane holds the previous frame. A fully-RESIDENT slot flip renders PRE-PAINT (a
 * `useLayoutEffect`) so the first painted frame already shows the new slot.
 *
 * ## Render triggers (on demand, NOT per animation frame)
 * The source-upload layout effects re-upload only when the decoded pixels change
 * (source identity / `imageUrl`+`colormap` / the `b` operand). Two render effects
 * (pre-paint for resident flips, post-paint for everything else) fire on a
 * viewport (zoom/pan → `uvRect`), exposure/operator/gamma, container-resize, or
 * source change. `engine/pool.ts`'s `acquirePane`/`releasePane` own the GPU
 * lifecycle (shared device, LRU park/restore, live-swapchain cap).
 *
 * ## Zoom/pan -> uvRect
 * `ImagePaneShell` owns the CSS-px zoom/pan state (Alt-gated wheel-zoom-to-cursor
 * + pointer-drag pan) and the double-click reset; `viewportToUvRect` converts it
 * into the source-space `[x,y,w,h]` window `renderImage` samples (GPU-side pan/
 * zoom, not a CSS transform), using the same object-contain fit math the pixel
 * overlay computes from the live rect.
 *
 * ## Off-screen park/restore
 * An `IntersectionObserver` on the pane calls the pool handle's `park()`/
 * `restore()` as the pane leaves/enters the viewport (proactively freeing GPU
 * memory) and reports every transition to `handle.setVisible()` so the pool's LRU
 * prefers evicting an off-screen pane. A cap-parked-but-visible pane keeps showing
 * its last frame and `PaneHandle.render()` transparently restores it on the next
 * render, so a zoom/pan/exposure change always paints a live frame.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Colormap } from "../types";
import { applyColormap, colormapFloatLUT } from "../colormaps";
import { resolveColormapMode } from "../engine/diff-cmap-mode";
import { loadImageData, getCachedImageData, setCachedImageData, getCachedLoadedImageData } from "../image";
import { HALF_ONE } from "../image/half";
import { floatValues, widenFloatPixels } from "../image/pixel-buffer.ts";
// DIFF capability: the pane samples a second source slot (`compareSource.b` via
// the pool's `setSourceB`) and renders a diff CONTENT op — a DIRECT pointwise op
// inline, or a CACHED metric (FLIP/HDR-FLIP/SSIM) via `renderDiffCached`. Engine
// imports are safe here: this file only ships in the gpu-image addon bundle,
// never `core.iife.js`.
import { contentOpId } from "../image/content-ops/index";
import {
  getDiffKernel,
  resolveDiffKernelId,
  kernelDefaultColormap,
  listDiffMenuModes,
} from "../engine/kernels";
import { computeCompareMapping, type CompareMapping } from "../engine/compare-align";
import { computeHdrFlipExposures } from "../engine/kernels/hdr-flip-reference";
import { formatSsim } from "../engine/ssim-metric";
import type { DiffMetrics } from "../engine/image-engine";
import type { DiffCacheEntry } from "../engine/diff-engine";
import { compareCaptions } from "../media-compare/compare-captions";
import { buildCompareModeMenu } from "../media-compare/compare-mode-menu";
import SplitDivider from "../media-compare/SplitDivider";
import { useSplitFlipKeys } from "../media-compare/use-split-flip-keys";
import RefBadge from "../primitives/RefBadge";
import { sourceTexelCenter, computeFit, screenPerTexel } from "./region-select";
import LabelChip from "../primitives/LabelChip";
import type { ToolbarButtonSpec } from "../controls/ToolbarConfig";
import ImageOverlay from "./ImageOverlay";
import PixelValueOverlay, {
  PIXEL_VALUE_MIN_SCREEN_PX,
} from "../primitives/PixelValueOverlay";
import type { Viewport as ImageViewport } from "../hooks/use-image-viewport";
import { useDevicePixelRatio } from "../hooks/use-device-pixel-ratio";
import { useResettableState } from "../hooks/use-resettable-state";
import {
  acquirePane,
  releasePane,
  getCanvasSurfaceForTest,
  MAX_RETAINED_SOURCE_TEXTURES as POOL_MAX_RETAINED_SOURCE_TEXTURES,
  type PaneHandle,
  type SourceUpload,
} from "../engine/pool";
import { getSharedDevice } from "../engine/device";
import { isPaintPhaseLogActive, recordPaintPhase } from "../engine/test-hooks";
import type { ImageParams } from "../engine/image-engine";
// C1 fix (whole-branch review) — the CPU image BACKEND, used as the fallback
// when the engine fails to activate/render (see `engineFailed` state below).
// Safe to import here: this file only ever ships inside the gpu-image ADDON
// bundle (`vite.plot-gpu-image.config.ts`), never `core.iife.js` — the
// core-bundle guard is about core staying free of the ENGINE, not about the
// addon avoiding a duplicate copy of the already-tiny CPU renderer.
import CpuImagePane from "./CpuImagePane";
import ImagePaneShell from "./ImagePaneShell";
import { u8HistogramSource, floatHistogramSource } from "./image-histogram-source";
import {
  depthHistogramFromWeights,
  seriesWeightsFor,
  tevResultFromRawHistogram,
  type HistogramSeriesSpec,
  type TevHistogramsResult,
} from "./image-histogram";
import { TEV_HISTOGRAM_BINS } from "../image/histogram-binning";
import { useSeedGroupOnFormation, useViewportSettings } from "./use-synced-image-settings";
import type { ImageSyncSettings } from "../viewport/image-settings-sync";
import {
  displayToolbarButton,
  scalarFaceColormap,
  reduceSegment,
  usePaneEncoding,
  compareDisplayToolbarButton,
  deriveCompareEncodingId,
} from "./display-encoding";
import { getEncoding, defaultReduceMode, type ReduceMode } from "../image/encodings";
import {
  resolveEffectiveTonemap,
  resolveRenderTonemap,
  resolveEncodeGamma,
  aliasPeakHint,
  EXTENDED_TONEMAP_PEAK_DEFAULT,
  EXTENDED_TONEMAP_PEAK_MIN,
  EXTENDED_TONEMAP_PEAK_MAX,
  EXTENDED_TONEMAP_PEAK_STEP,
  TONEMAP_GAMMA_DEFAULT,
  TONEMAP_GAMMA_MIN,
  TONEMAP_GAMMA_MAX,
  TONEMAP_GAMMA_STEP,
  SDR_TONEMAP_OPERATORS,
  type TonemapOperator,
} from "../image/tonemap";
import { useDeepFlatten } from "./use-deep-flatten";
import { usePixelSamplers } from "./gpu-image-samplers";
import { buildRenderSnapshot } from "./render-snapshot";
import {
  isHdrProps,
  useLegacyImageProps,
  shapeDims,
  finite,
  type HdrData,
  type HdrImageProps,
  type SdrImageProps,
  type ImageBackend,
  type ImageBackendProps,
  type CompareSource,
  type DecodedSource,
} from "./image-backend";

// A stable empty HDR for the SDR branch's unconditional `useDeepFlatten` call
// (rules-of-hooks): no `deep`, so it yields the source unchanged + no slider.
const NULL_HDR: HdrData = { pixels: floatValues(new Float32Array(0)), shape: [0, 0], dtype: "<f4" };

/** The IDENTITY-TRANSFER curves — the ones whose tone-map "operator" is a pure
 *  clamp, the display transfer living entirely in the output-encode stage. A
 *  single-channel "none" source on one of these renders through the gray DATA path
 *  (`scalarNoneData`) so the raw scalar rides the shared (extended) output-encode
 *  unclamped on an HDR surface, byte-identically to the curve on SDR. Real tone-
 *  mappers (reinhard/aces) compress highlights and stay on the curve path. */
const NONE_GRAY_CURVES: ReadonlySet<string> = new Set(["linear", "srgb", "gamma"]);
import { reportCapabilityLimit } from "../primitives/capability-notice";

/** Expand the raw HDR buffer into an RGBA source upload — NO exposure/tonemap/
 *  encode here (that's the GPU shader's job); mirrors `HdrImagePane`'s
 *  `tonemapToImageData` per-pixel channel extraction.
 *
 *  F16 pipeline: a `precision:"f16-bits"` source (`Uint16Array` of raw binary16
 *  bits) expands RGB→RGBA IN HALF SPACE — the u16 bit patterns are copied
 *  straight through (alpha = `HALF_ONE`, the bits for 1.0) into an
 *  `rgba16float` upload (8 bytes/px), never widened to f32. `textureLoad` of an
 *  `rgba16float` texture yields f32 in the shader, so the render math is
 *  identical to the f32 path. NaN/Inf half bits pass through as-is (no
 *  `finite()` guard) — the diff/tonemap kernels handle non-finite samples the
 *  same way they would after a float upload. The `"f32"` path is unchanged. */
function hdrToRGBAFloat32(hdr: HdrData): SourceUpload {
  const { h, w, c } = shapeDims(hdr.shape);
  if (hdr.pixels.kind === "f16-bits") {
    const src = hdr.pixels.bits;
    const out = new Uint16Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const base = i * c;
      const o = i * 4;
      if (c === 1) {
        const v = src[base]!;
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = HALF_ONE;
      } else {
        out[o] = src[base]!;
        out[o + 1] = src[base + 1]!;
        out[o + 2] = src[base + 2]!;
        out[o + 3] = c >= 4 ? src[base + 3]! : HALF_ONE;
      }
    }
    return { data: out, width: w, height: h, format: "rgba16float" };
  }
  const src = hdr.pixels.values;
  const out = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const base = i * c;
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (c === 1) {
      r = g = b = finite(src[base]!);
    } else if (c === 3) {
      r = finite(src[base]!);
      g = finite(src[base + 1]!);
      b = finite(src[base + 2]!);
    } else {
      r = finite(src[base]!);
      g = finite(src[base + 1]!);
      b = finite(src[base + 2]!);
      a = finite(src[base + 3]!);
    }
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }
  return { data: out, width: w, height: h, format: "rgba32float" };
}

/** Expand any decoded source (the reference operand `b` of a diff) into a
 *  `SourceUpload` in its natural texture format: a float source expands RGB→RGBA
 *  (via {@link hdrToRGBAFloat32}), a uint8 source is `<img>`-decoded to
 *  `rgba8unorm`. Async because the uint8 path decodes a URL. Mirrors
 *  `GpuComparePane`'s `loadSide`, but yields the pool's `SourceUpload` shape. */
async function decodedSourceToUpload(src: DecodedSource): Promise<SourceUpload | null> {
  if (src.dtype === "float") {
    return hdrToRGBAFloat32({
      pixels: src.pixels,
      shape: src.shape,
      dtype: src.numpyDtype ?? "<f4",
      deep: src.deep,
    });
  }
  if (!src.url) return null;
  const d = await loadImageData(src.url);
  if (!d) return null;
  return { data: d.data, width: d.width, height: d.height, format: "rgba8unorm" };
}

/**
 * Converts the CSS-px `{zoom,pan}` viewport (owned by `useImageViewport`)
 * into the source-space `uv` window `renderImage` samples — for a render
 * target that spans the FULL PANE/canvas (Q24 fix). `paneBox` here MUST be
 * the same box the canvas's own CSS size is measured against (the render
 * effect below uses `imgWrapperRef`'s rect for both) — see this function's
 * derivation below for why a mismatch there breaks the mapping.
 *
 * ## Model: the canvas IS the viewport; the image is a quad placed inside it
 * Q22 (a prior fix) shrank the GPU canvas's own CSS box to the object-contain
 * LETTERBOXED sub-rect of the image, to fix upscaling blur (the backing store
 * now tracks display resolution, not source resolution — a good fix, kept).
 * But that made the canvas element itself the size of the image's home rect,
 * which then CONFINED zoom/pan to the image's own aspect box: zooming in
 * only ever cropped tighter within that fixed small rect, so the checkerboard
 * margins around it were permanently dead space that could never fill in
 * (Q24), and the split/compare shader's screen-space `uv.x` (spanning the
 * SMALL canvas) no longer matched the separator/pointer math (still expressed
 * as a fraction of the full pane) — Q23. Fix: the canvas backing store always
 * covers the FULL pane (see the render-pass effect below); THIS function
 * places the image as a quad inside that full-canvas viewport instead —
 * at `zoom:1, pan:{0,0}` the quad sits at its object-contain "home" rect
 * (letterboxed, centered, checkerboard in the margins via Q18's existing
 * OOB -> transparent path); `zoom`/`pan` then transform the WHOLE viewport
 * (`translate(pan) scale(zoom)`, origin `(0,0)` of the pane — the SAME
 * convention `useImageViewport`'s wheel-zoom-to-cursor math already assumes,
 * since `cx = clientX - paneRect.left` there is measured against that same
 * origin), so the user can zoom toward / pan into the checkerboard margins
 * exactly like a standard image viewer (TEV) — never confined to the image's
 * own aspect box, and no explicit pan/zoom clamp is needed: whatever the
 * quad doesn't cover is genuinely-empty canvas, and Q18 already renders that
 * as transparent (checkerboard shows through).
 *
 * ## Derivation
 * Home fit: `scale = min(paneBox.w/naturalW, paneBox.h/naturalH)`,
 * `dispW/dispH` = the letterboxed on-screen size, `imgLeft/imgTop` = its
 * centered offset within `paneBox`. A canvas-space fragment at `shaderUV`
 * (spanning `[0,1]` across the FULL pane) must sample source-uv
 * `-imgLeft/dispW` at `shaderUV=0` and `(paneBox.w-imgLeft)/dispW` at
 * `shaderUV=1` when at rest — i.e. `uvRect.x = -imgLeft/dispW`,
 * `uvRect.w = paneBox.w/dispW` (>=1 whenever the image is letterboxed on that
 * axis: the SAME "sample past `[0,1]`" mechanism Q18 already uses for
 * zoom<1). Composing that with the `translate(pan) scale(zoom)`-on-the-
 * whole-viewport transform (origin `(0,0)`) gives `w = paneBox.w/(z*dispW)`,
 * `x = -imgLeft/dispW - pan.x/(z*dispW)`.
 */
export function viewportToUvRect(
  viewport: ImageViewport,
  paneBox: { width: number; height: number },
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0 || paneBox.width <= 0 || paneBox.height <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  // Object-contain fit (scale + centering) from the ONE shared primitive
  // (`region-select.computeFit`, full window) — the SAME letterbox math the hover
  // readout / marquee / overlay boxes use, so they can't drift (D1). Only the
  // zoom/pan COMPOSITION below is this function's own.
  const f = computeFit({
    box: { left: 0, top: 0, width: paneBox.width, height: paneBox.height },
    naturalWidth: naturalW,
    naturalHeight: naturalH,
  });
  const scale = f.scale;
  const dispW = f.visibleW * scale; // = naturalW * scale (full window)
  const dispH = f.visibleH * scale;
  const imgLeft = f.imgLeft;
  const imgTop = f.imgTop;
  const z = Math.max(viewport.zoom, 1e-6);
  const w = paneBox.width / (z * dispW);
  const h = paneBox.height / (z * dispH);
  const x = -imgLeft / dispW - viewport.pan.x / (z * dispW);
  const y = -imgTop / dispH - viewport.pan.y / (z * dispH);
  return { x, y, w, h };
}

/**
 * Screen pixels covered by ONE source texel, for the CURRENTLY-DISPLAYED
 * `rawUv` window — the exact same object-contain-fit formula
 * `PixelValueOverlay.tsx`'s `draw()` uses for its own `scale` (`min(box.width
 * / visibleW, box.height / visibleH)`, `visibleW/H = rawUv.w/h *
 * naturalW/H`), so `GpuImagePane`'s nearest/linear filter switch (Q20) stays
 * in EXACT lockstep with `PixelValueOverlay`'s `PIXEL_VALUE_MIN_SCREEN_PX`
 * active-state threshold — both flip at the same zoom level. `box` must be
 * the DISPLAYED element's rect (the canvas, same as `PixelValueOverlay`'s
 * `imageElRef`), not the outer padded pane container.
 */
export function screenPxPerTexel(
  rawUv: { w: number; h: number },
  box: { width: number; height: number },
  naturalW: number,
  naturalH: number,
): number {
  const visibleW = rawUv.w * naturalW;
  const visibleH = rawUv.h * naturalH;
  if (visibleW <= 0 || visibleH <= 0 || box.width <= 0 || box.height <= 0) return 0;
  // The SAME object-contain scale the hover readout uses — the shared primitive over
  // the CURRENTLY-DISPLAYED `rawUv` crop (D1); x/y don't affect scale.
  return screenPerTexel({
    box: { left: 0, top: 0, width: box.width, height: box.height },
    naturalWidth: naturalW,
    naturalHeight: naturalH,
    sourceWindow: { x: 0, y: 0, w: rawUv.w, h: rawUv.h },
  });
}

export default function GpuImagePane(backendProps: ImageBackendProps) {
  // The ONE unified `source` fans out (keyed on `source.dtype`) into the two
  // internal dtype-keyed representations the body below consumes — so the body
  // (and its `isHdrProps(props)` dispatch) is unchanged. `backendProps` is
  // forwarded verbatim to the CPU fallback (which reconstructs it the same way).
  const props = useLegacyImageProps(backendProps);
  const hdrMode = isHdrProps(props);
  // COMPARE capability (content-op unification): when `compareSource` is present
  // the pane renders a COMPARE of `source` (reference/`a`) against
  // `compareSource.b` (foreground). The single-image path is byte-identical when
  // absent. The `opId` selects the mode:
  //   - `compositorMode` (Phase 3): `split` — a LIGHT composite (divider),
  //     displayed as a plain image with the divider + per-side chrome.
  //   - `diffMode` (Phase 2c): a diff kernel — the scalar-error display.
  // `hasCompare` gates the SHARED operand plumbing (upload `b`, mapping, metrics).
  const compareSource: CompareSource | undefined = backendProps.compareSource;
  const hasCompare = !!compareSource;
  // The compare mode is EXPLICIT (`compareSource.mode`, default "diff"), so `opId`
  // stays the diff kernel even in a compositor mode (switching INTO diff restores it).
  // A legacy "blend" (removed view mode) aliases to "split".
  const compareMode: "diff" | "split" | null = hasCompare
    ? ((compareSource!.mode as string) === "blend" ? "split" : (compareSource!.mode ?? "diff"))
    : null;
  const compositorMode = compareMode === "split";
  const diffMode = compareMode === "diff";
  // The concrete compositor mode ("split"), or null. Drives the divider, the flip
  // keys, the per-side captions/readout, and the compositor render.
  const compareOpMode: "split" | null = compositorMode ? "split" : null;
  const splitPosition = compareSource?.splitPosition ?? 0.5;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const imgWrapperRef = useRef<HTMLDivElement | null>(null);
  const paneHandleRef = useRef<PaneHandle | null>(null);

  // DEEP EXR depth WINDOW. A deep source drives the REAL-TIME GPU composite
  // (samples uploaded once to GPU storage buffers, re-composited per window on
  // the GPU — see `pool.setDeepSource`/`setDeepWindow`). `deepFlatten` still owns
  // the sliders / region-select / HOME reset; in GPU mode (`onDeepWindow`
  // supplied) it hands every window straight to the composite + repaint (no wasm
  // flatten, no CPU upload). Called unconditionally (rules-of-hooks) with a null
  // HDR in the SDR branch.
  const renderPassRef = useRef<(() => void) | null>(null);
  const deepActive = hdrMode && !!(props as HdrImageProps).hdr?.deep;
  const onDeepWindow = useCallback((zNear: number, zFar: number) => {
    paneHandleRef.current?.setDeepWindow(zNear, zFar);
    renderPassRef.current?.();
  }, []);
  const deepFlatten = useDeepFlatten(
    hdrMode ? (props as HdrImageProps).hdr : NULL_HDR,
    deepActive ? onDeepWindow : undefined,
  );
  // True once the acquire effect below has resolved a real HDR (rgba16float/
  // display-p3/extended-tonemap) surface for this pane — see `useHdr`'s
  // computation just below. Read by the render effect to decide `hdrOut`
  // (skip the SDR encode) so the two stay in lockstep with the surface the
  // pool actually configured; a ref (not state) because it must be settled
  // BEFORE the render effect's first pass and never itself needs to trigger
  // a re-render (paneReady already does that once acquisition resolves).
  const useHdrRef = useRef(false);
  // The SAME `useHdr` decision, mirrored into STATE so the toolbar TONEMAP menu
  // re-renders once acquisition resolves it: the menu offers "Extended (HDR)"
  // and its effective default IS "extended" only when the true-HDR surface
  // engaged. The ref (above) stays the render effect's source of truth (settled
  // before the first pass); this state drives the UI. Stable per pane instance —
  // set exactly once when acquisition resolves the HDR-out gate.
  const [hdrEngaged, setHdrEngaged] = useState(false);

  // C1 fix (whole-branch review): true once the engine has definitively
  // failed to activate or render this pane (a non-context-lost hard failure
  // — `engine/pool.ts`'s `handle.render()` returned `false`, or an
  // unexpected throw was caught below). Once set, this component permanently
  // renders the LEGACY CPU pane (`ImagePane`/`HdrImagePane`) instead of the
  // GPU canvas — see the bailout branch near the bottom of this component's
  // render body. A pane never blanks: either the GPU canvas paints, or the
  // legacy pane does.
  const [engineFailed, setEngineFailed] = useState(false);
  const [paneReady, setPaneReady] = useState(false);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [uploadVersion, setUploadVersion] = useState(0);
  const [containerTick, setContainerTick] = useState(0);
  // The DISPLAYED uv window, for `PixelValueOverlay`'s
  // `sourceWindow` — see that prop's doc for why the GPU pane must supply
  // this explicitly (its canvas CSS box doesn't grow with zoom the way the
  // legacy CSS-transform panes' <img>/<canvas> does).
  const [overlayWindow, setOverlayWindow] = useState({ x: 0, y: 0, w: 1, h: 1 });

  // TEV overlay source buffers (retained CPU pixels, mirrors ImagePane's
  // valueDataRef / HdrImagePane's `hdr.data`).
  const hdrDataRef = useRef<HdrData | null>(null);
  const sdrImageDataRef = useRef<ImageData | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);
  // DIFF reference (`b`) retained pixels — the diff TEV readout's `b` operand for a
  // DIRECT op's cpu twin. Float → the raw DecodedSource; uint8 → the decoded RGBA.
  const refFloatRef = useRef<DecodedSource | null>(null);
  const refU8Ref = useRef<{ data: ArrayLike<number>; width: number; height: number } | null>(null);
  // FLIP-BACK RETENTION (content-op unification follow-up — residual stacked-flip
  // flicker). A stacked viewport reuses ONE pane across its slots; flipping BACK
  // to an already-shown COMPARE slot must present the (content-keyed, still-cached)
  // diff RESULT SYNCHRONOUSLY — never through an async decode+upload gap that
  // paints a transient/intermediate frame. This caches the DECODED `SourceUpload`
  // (the primary reference `a` + foreground `b`) keyed by the slot's content keys,
  // so a flip back binds without re-decoding; the POOL separately retains the GPU
  // texture (`PaneHandle.setSource(..., contentKey)`), so neither re-decode nor
  // re-upload happens. Bounded (LRU) to the pool's retention cap so CPU-buffer
  // memory can't grow unbounded across many flips. See the setSource/setSourceB
  // effects below for the synchronous fast-path.
  const uploadCacheRef = useRef<Map<string, { upload: SourceUpload; ref: DecodedSource }>>(new Map());
  // -----------------------------------------------------------------------
  // PRESENT-COHERENCY GUARD (residual fast-flip flicker). The pane's content
  // config — which primary/`b` source, and whether it's a diff/composite/plain
  // image — flips SYNCHRONOUSLY from props, but the pool's actual source TEXTURES
  // are applied through SEPARATE effects, some ASYNC (an SDR primary always goes
  // through async `loadImageData`; a first-visit `b` decodes). Under rapid
  // image↔diff flipping a `renderPass` can therefore fire while the pool still has
  // the PREVIOUS slot's textures bound — presenting a stale/mismatched frame (the
  // measured artefact: an identity blit sampling the retained diff reference on a
  // diff→image flip). These refs record the content IDENTITY the pool has actually
  // applied for each slot; `renderPass` presents only when the applied identities
  // match the identities the CURRENT render expects (`expectedPrimaryId`/
  // `expectedBId` below), else it HOLDS the previous frame (WebGPU keeps the last
  // present) until the pending async application lands + bumps a version → re-fire.
  // General by construction: it protects every single-pane source swap, not just
  // stacks (an image→image URL swap is gated the same way). Deadlock-free: the
  // applied values are set from the SAME expressions `renderPass` uses, so they
  // converge once the (always-scheduled) upload effect completes.
  const appliedPrimaryIdRef = useRef<string | undefined>(undefined);
  const appliedBIdRef = useRef<string | null | undefined>(undefined);
  // -----------------------------------------------------------------------
  // PAINT-ATOMIC FLIPS (residual one-frame stale flash). The coherency guard
  // above proves every PRESENT is coherent, but a slot FLIP (image↔diff) commits
  // the tab strip instantly while the pane's engine render for the new slot runs
  // in a POST-PAINT (passive) effect — so the FIRST painted frame after the flip
  // still shows the HELD previous slot (the reported "image for one frame inside
  // the diff tab"). When the target is FULLY RESIDENT (retained source textures +,
  // for a cached op, the diff RESULT cache HIT) the render can instead run
  // PRE-PAINT (a `useLayoutEffect`), so the first painted frame already shows the
  // new slot. NON-resident targets keep today's hold-previous-frame behavior (that
  // hold is correct for genuinely-async loads). `lastContentIdentityRef` records
  // the `snapshot.contentKey` most recently acted on (flip detector — a viewport/
  // exposure change is NOT a flip); `lastRenderedRef` dedupes the pre-paint render
  // against the post-paint effect so a resident flip submits exactly once.
  const lastContentIdentityRef = useRef<string | undefined>(undefined);
  const lastRenderedRef = useRef<{ id: object; uv: number; ct: number } | null>(null);
  // Monotonic content EPOCH — bumped whenever `snapshot.contentKey` changes (a
  // flip), for the paint-phase oracle (a harness groups submits by epoch to find
  // each flip's FIRST render's phase — layout=paint-atomic vs post=stale first
  // frame). Test-only signal; the increment is a pure derivation of the key.
  const contentEpochRef = useRef(0);
  const contentEpochIdentityRef = useRef<string | undefined>(undefined);
  const lastCommitEpochRef = useRef(-1);
  const rememberUpload = useCallback((key: string, upload: SourceUpload, ref: DecodedSource) => {
    const m = uploadCacheRef.current;
    if (m.has(key)) m.delete(key);
    m.set(key, { upload, ref });
    while (m.size > POOL_MAX_RETAINED_SOURCE_TEXTURES) {
      const oldest = m.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      m.delete(oldest);
    }
  }, []);
  // Content-identity diff-cache keys (`a` = primary/`source`, `b` = reference):
  // a float side keys on its ORIGINAL content key (URL), not the decoded bytes.
  // Declared here (before the source-upload effects) so those effects can key the
  // pool retention + the local flip-back upload cache on them.
  const contentKeyA = compareSource?.contentKeyA ?? "diff:a";
  const contentKeyB = compareSource?.contentKeyB ?? "diff:b";

  const zoom = props.zoom ?? 1;
  const pan = props.pan ?? { x: 0, y: 0 };
  const onViewportChange = props.onViewportChange;
  // Host seam: `toolbar={false}` hides the PlotToolbar (the shell then renders
  // the free-floating pixel-notation toggle only), so a host can drive the view
  // from its own menu via the controlled props below. Default true.
  const toolbar = props.toolbar ?? true;
  // Colormap: the `colormap` prop SEEDS a view-local override so the toolbar
  // COLORMAP menu can switch it in-pane (diff-kernels toolbar track). Re-seeds
  // when the prop changes (e.g. the app card's colormap control) so the pane
  // stays a controlled surface until the user overrides it locally.
  // The colormap seeds from the prop on BOTH shapes: the SDR pane false-colors it
  // CPU-side, and (Phase 2) the FLOAT pane runs it through the GPU LUT family on
  // its scalar channel (the channel selector's scalar isolations — layer "Z",
  // "diffuse.G" — become colormappable). An absent prop (the common HDR case)
  // reads `"none"`; the toolbar COLORMAP menu / sync bus then drive it view-local.
  const propColormap: Colormap = (props as SdrImageProps).colormap ?? "none";
  const propTonemap = hdrMode
    ? (props as HdrImageProps).tonemap
    : (props as SdrImageProps).tonemap;

  // The viewport's settings STORE: threaded down from its owner (node frame /
  // stage cell / compositor) when present; a BARE mount (card / cross-type
  // host) owns its own group-of-one store, so settings live ONLY in stores —
  // never in pane state. An empty store lets the descriptor seeds shine
  // through (the one lookup: store value > prop seed).
  const ownStoreId = useId();
  const ownStore = useViewportSettings([`vp-st-pane-${ownStoreId}`]);
  const threadedSet = backendProps.setSyncedSettings;
  const synced = threadedSet ? backendProps.syncedSettings : ownStore.settings;
  const setSynced = threadedSet ?? ownStore.set;

  // -----------------------------------------------------------------------
  // DIFF kernel + DEFAULT colormap (state-unification). The diff/compare face no
  // longer owns a SEPARATE colormap store — its colormap IS the viewport's ONE
  // display encoding (`enc`, below). The kernel's registry default
  // (magma/turbo/red-green) — or the authored `compareSource.colormap` when the
  // descriptor specifies one — is the SEED/HOME target the encoding hook uses
  // while a diff is visible. Computed HERE, above `enc`, so the hook can seed from
  // it. (`resolveDiffColormap` stays the pure default-vs-override statement; the
  // OVERRIDE now lives in `enc.encodingId`, so a diff-colormap pick, a slot flip
  // to the scalar image, and HOME all read/write ONE store — one viewport, one
  // setting.) Declared unconditionally (rules-of-hooks); inert when `!diffMode`.
  // -----------------------------------------------------------------------
  const diffSeedColormap = ((): Colormap | null => {
    const c = compareSource?.colormap;
    if (c == null || c === "none") return null;
    return (c as string) === "viridis" ? ("turbo" as Colormap) : c;
  })();
  // The diff KERNEL (which error metric) is a per-VIEWPORT content-op choice OWNED
  // by the hoisted `useCompareControl` (descriptor path) — surfaced here as
  // `compareSource.opId` and mutated via `compareSource.onDiffKernelChange`. When
  // that owner is present the pane DERIVES the kernel straight from `opId` (ONE
  // authoritative store — no parallel pane-local seed/reseed to hand-sync; M2). The
  // owner also carries the bus subscription (`plot-node.tsx`) AND the HOME reset
  // (`onCompareReset`), so a remote kernel patch and HOME both flow through it, not
  // a second copy here. A cross-type consumer with NO owner (the live-3D snapshot
  // compare, `OffscreenComparePanes`, which threads no `onDiffKernelChange`) keeps a
  // local fallback store so its own MODE menu still functions.
  const hasKernelOwner = !!compareSource?.onDiffKernelChange;
  const [localKernel, setLocalKernel, localKernelMeta] = useResettableState<string>(
    compareSource?.opId ?? "absolute",
  );
  useLayoutEffect(() => {
    // Fallback store follows the descriptor ONLY when there is no owner (the owner
    // path derives directly, so this reseed would be redundant AND could fight the
    // derivation). Anti-churn (paint-atomic note): reseed only from a PRESENT compare
    // descriptor — an image slot in a stacked image↔diff flip keeps the last kernel
    // DORMANT rather than resetting to "absolute" then re-applying post-paint.
    if (hasKernelOwner || !compareSource) return;
    setLocalKernel(compareSource.opId ?? "absolute");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKernelOwner, compareSource?.opId, !!compareSource]);
  // No-owner path resolves at RENDER: store value > local fallback (the owner
  // path derives from `opId`, which the node's control already resolves).
  const diffKernel = hasKernelOwner
    ? (compareSource!.opId ?? "absolute")
    : (synced?.diffKernel ?? localKernel);
  const setDiffKernel = useCallback(
    (id: string) => {
      // ONE write path: route to the owner when present (it re-derives `opId` back
      // into this pane). No owner ⇒ ONE settings-store write (the render lookup
      // reads `synced.diffKernel` first; a local-only write would stay shadowed
      // by a store value — the HOME-can't-reset-the-kernel bug). Every pane has
      // a store (own fallback on bare mounts), so no local cell is written.
      if (compareSource?.onDiffKernelChange) compareSource.onDiffKernelChange(id);
      else setSynced({ diffKernel: id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compareSource?.onDiffKernelChange, setSynced],
  );
  // Cheap pure derivations: the concrete kernel id (float sources auto-dispatch
  // flip→hdr-flip) and the diff's DEFAULT colormap (authored override else the
  // per-kernel default) — the seed `enc` adopts while a diff is visible.
  const sourcesAreFloat =
    backendProps.source.dtype === "float" || compareSource?.b.dtype === "float";
  const resolvedKernelId = diffMode ? resolveDiffKernelId(diffKernel, !!sourcesAreFloat) : diffKernel;
  const diffDefaultColormap = (diffSeedColormap ?? kernelDefaultColormap(resolvedKernelId)) as Colormap;
  // ONE-CONCRETE-VALUE model (user ruling): the viewport's encoding seeds ONCE from
  // the INITIALLY-VISIBLE face's defaults — diff → authored/kernel default colormap,
  // image → authored props — and then PERSISTS. Flips and kernel switches never
  // reseed; only a pick or HOME (which copies the currently-visible face's defaults)
  // assigns a new value. Frozen in a ref so later prop churn can't re-derive it.
  const initialEncSeedRef = useRef<Colormap | null>(null);
  if (initialEncSeedRef.current == null) {
    initialEncSeedRef.current = hasCompare && diffMode ? diffDefaultColormap : propColormap;
  }

  // UNIFIED DISPLAY ENCODING (Phase 3): ONE `encoding` id replaces the separate
  // colormap + tonemap overrides — selecting a LUT deactivates the curve and
  // vice-versa STRUCTURALLY (`display-encoding.ts`). The float pane gates the
  // menu by its real channel arity (luts@k=1, `normal`@k=3); the 8-bit pane has
  // no channel-count signal (`mode:"sdr"`) so offers the full applicable set.
  // Both drive the unified 5-curve set (Linear · sRGB · Gamma · Reinhard · ACES
  // + `normal`); the default curve resolves from `tonemap=` (colormap wins the
  // seed for scalars, per the descriptor back-compat contract).
  const sourceArity = hdrMode ? shapeDims(deepFlatten.hdr.shape).c : 1;
  const resolveDefaultCurve = useCallback(
    (t: string | null | undefined) => resolveEffectiveTonemap(t, false),
    [],
  );
  // CONTROLLED SURFACE vs INTERACTIVE VIEWPORT — the ONE axis that governs whether a
  // descriptor prop change RESEEDS the pane's display settings. `toolbar === false`
  // is the host-driven controlled-surface seam (a card/host hides the toolbar and
  // drives colormap/tonemap/peak/… as props from its OWN menu): there the settings
  // FOLLOW the props (the non-interactive contract, reseed on change). Otherwise this
  // is an interactive VIEWPORT — a standalone pane, a grid cell, or the ONE reused
  // renderer of a STACKED viewport — and it OWNS its settings: seeded once from the
  // initially-visible image, they PERSIST across slot flips / re-lowers and change
  // only on a user pick or HOME (which re-seeds to the CURRENTLY-VISIBLE image). A
  // stacked viewport is exactly this rule with one shared pane, so its slots share
  // ALL settings by construction — nothing special-cases the stack. `__cairnDisable-
  // StackShared` (test-only) forces the controlled-surface reseed on a viewport so one
  // harness run measures pre-fix (flip wipes the shared setting) vs post-fix (shared,
  // survives) with one driver.
  const disableStackShared =
    typeof window !== "undefined" &&
    !!(window as unknown as { __cairnDisableStackShared?: boolean }).__cairnDisableStackShared;
  // A pane in a SYNC GROUP is a controlled surface too: the node-level receiver
  // drives its display keys via `synced` (its toolbar stays VISIBLE — the user
  // still edits + publishes; the node just also DRIVES it top-down). This is the
  // decoupling the single-receiver refactor makes: "controlled" no longer implies
  // "toolbar hidden".
  // HOST-driven surface (`toolbar={false}` card seam / test flag): display values
  // follow the descriptor props live. Distinct from having a settings store.
  const hostDriven = toolbar === false || disableStackShared;
  const controlledSurface = hostDriven || !!synced;
  const enc = usePaneEncoding({
    mode: hdrMode ? "arity" : "sdr",
    arity: sourceArity,
    curveSet: SDR_TONEMAP_OPERATORS,
    // ONE encoding for image AND diff faces (the viewport's single display-
    // encoding value). The store's `encoding` id rules when present (see
    // usePaneEncoding); these props are only the SEED term of the lookup.
    propColormap: controlledSurface ? propColormap : (initialEncSeedRef.current ?? propColormap),
    propTonemap,
    resolveDefaultCurve,
    controlledSurface,
    // The settings store rules when present; picks publish and flow back down.
    settings: synced,
  });
  // HOME / double-click: set the viewport's encoding to the CURRENTLY-VISIBLE
  // face's defaults (diff → authored/kernel default; image → authored colormap
  // else the default curve). ONE STORE WRITE — the store-backed lookup is what
  // renders, so HOME must publish (the local `enc` write only serves the
  // storeless fallback). Identical for the home button, double-click and the
  // probe seam; flipping never changes the value.
  const assignVisibleFaceDefaultEncoding = () => {
    // For a diff, HOME resets the kernel too (via onCompareReset / the local
    // fallback), so the colormap target derives from the DESCRIPTOR kernel, not
    // the momentarily-still-current one.
    const target = diffMode
      ? ((diffSeedColormap ?? kernelDefaultColormap(localKernelMeta.default)) as Colormap)
      : propColormap !== "none"
        ? propColormap
        : resolveDefaultCurve(propTonemap);
    enc.setEncoding(target); // storeless fallback
    publishSettings({ encoding: target });
  };
  // Derived back-compat values the render pipeline / sync already consume: the
  // colormap ("none" or a LUT id) and the curve id in effect. Split per path so
  // each path's "no colormap" condition (`sdrPlain`) is exact.
  const sdrColormap: Colormap = hdrMode ? "none" : (enc.colormap as Colormap);
  const hdrColormap: Colormap = hdrMode ? (enc.colormap as Colormap) : "none";
  const effectiveTonemap: TonemapOperator = enc.curveId as TonemapOperator;
  // PEAK (HDR ceiling) gates off the ACTIVE encoding's param MANIFEST — like
  // γ / EV / OFF. Every curve declares `peak` (each respects P as its ceiling on
  // an HDR surface); the `normal` remap and colormap LUTs don't. The pane never
  // inspects encoding kinds.
  const activeRespectsPeak = enc.hasParam("peak");
  // TEST-ONLY tripwire tag: did the DESCRIPTOR author a colormap LUT for this pane?
  // A plain identity present with NO colormap bound while this is true is the
  // encoding-generation lag (`isEncodingGenerationMismatch`). Static, from the
  // descriptor prop — independent of the (possibly lagging) live `enc` state, so it
  // catches a stale-generation present rather than agreeing with it.
  const authoredColormapIsLut = propColormap !== "none" && getEncoding(propColormap)?.kind === "lut";

  // GRAY NONE (the plain-grayscale "none" DATA encoding — HDR-native follow-up).
  // A SINGLE-CHANNEL source with no colormap LUT is DATA, not light: its raw scalar
  // (after exposure/offset + any norm/bounds) is linear light that should ride the
  // SHARED output-encode exactly like a curve / the analytic red-green — SDR clamps
  // (byte-identical to the old srgb/linear/gamma curve for in-range values), an
  // engaged HDR surface keeps >1. So a scalar with one of the IDENTITY-TRANSFER
  // curves (linear/srgb/gamma — the ones whose "operator" is a pure clamp, the
  // transfer living entirely in output-encode) renders through the gray DATA path
  // (isScalar + `grayNone`) instead of the peak-clamping curve path, and honors the
  // NORM/BOUNDS pickers. Real tone-mappers (reinhard/aces) stay on the curve path —
  // they compress highlights (a LIGHT concept), so a scalar keeps them selectable.
  const scalarNoneData =
    hdrMode && sourceArity === 1 && hdrColormap === "none" && NONE_GRAY_CURVES.has(effectiveTonemap);

  // PEAK white (×SDR white) — the UNIFIED HDR MODE control. On an engaged HDR
  // surface it is ALWAYS shown and every operator respects it as its ceiling `P`
  // (SDR is just `P = 1`); view-local, display-only, fed into the render pass via
  // `resolveRenderTonemap`. Default 4 (managed determinism); seeded to ∞ only for
  // the deprecated raw `extended` alias (recovering its browser-clipped look).
  // HOME restores the seed. Never a source re-upload.
  const propPeak = hdrMode
    ? (props as HdrImageProps).peak
    : (props as SdrImageProps).peak;
  const seedPeak = (): number =>
    propPeak != null && propPeak > 0
      ? propPeak
      : (aliasPeakHint(propTonemap) ?? EXTENDED_TONEMAP_PEAK_DEFAULT);
  // PEAK resolves at RENDER through the one lookup (the settings contract):
  // store value > descriptor seed. No pane state, no adoption effect.
  const peakSeed = seedPeak();
  const peak = synced?.peak != null && synced.peak > 0 ? synced.peak : peakSeed;
  // HOME target + modified dot track the CURRENTLY-VISIBLE slot's descriptor:
  // HOME adopts the visible image's default; the dot lights when the effective
  // value differs from it.
  const peakModified = peak !== peakSeed;

  // Gamma(γ) for the Gamma display operator (HDR panes AND the SDR display-
  // transfer path). View-local; the slider is shown ONLY while the Gamma
  // operator is in effect (the same conditional-slider precedent as PEAK).
  // Seeded from the descriptor `gamma=` prop (HDR or SDR) when present, else the
  // default 2.2; re-seeds on prop change; HOME restores it.
  const propGamma: number | undefined = hdrMode
    ? (props as HdrImageProps).gamma
    : (props as SdrImageProps).gamma;
  const gammaSeed = propGamma && propGamma > 0 ? propGamma : TONEMAP_GAMMA_DEFAULT;
  // γ resolves at RENDER: store value > descriptor seed.
  const tonemapGamma =
    synced?.tonemapGamma != null && synced.tonemapGamma > 0 ? synced.tonemapGamma : gammaSeed;
  const gammaModified = tonemapGamma !== gammaSeed;

  // (SDR display-transfer state removed — §B: the plain-SDR pane now shares the
  // SAME unified operator state as the HDR pane, `effectiveTonemap` above, and
  // the same PEAK/γ sliders. The old 3-operator sRGB·Gamma·Linear subset is gone;
  // reinhard/aces are meaningful post-sRGB-decode, and PEAK extends the whole set
  // onto an HDR surface.)

  // EXPOSURE / OFFSET display-adjust sliders (§requirement B). View-local,
  // display-only state — fed straight into the render pass below (the GPU shader
  // applies `color * 2^EV + offset` before tonemap/colormap/encode). For the HDR
  // path this display EV ADDS to the prop `exposure`; for SDR the prop exposure
  // is 0 so it's the only exposure. Never triggers a source re-upload.
  // EV/OFFSET resolve at RENDER: store value > 0 (no descriptor prop).
  const displayEV = synced?.exposureEV ?? 0;
  const displayOffset = synced?.offset ?? 0;

  // DATA-ENCODING BOUNDS (Phase 4). (The norm Lin·Log·Pow PICKER was removed —
  // the engine norm machinery `cairnDataIndex`/`computeDataIndex`/`u_bind9` stays,
  // but the UI is gone and the effective norm is always linear; see the
  // norm-UI-removal follow-up.) `colorRange` (the grid-shared
  // descriptor prop — `shared.colorRange` → LeafView mergedProps) SEEDS the
  // min/max BOUNDS skin: the ALTERNATIVE to EV/OFF (bounds-first, data-speak).
  // The two are skins over ONE affine and are NEVER composed — when bounds are
  // active EV/OFF are hidden and inert (single-application; see the shader's
  // cairnDataIndex + the colorRange audit note in the design doc). Absent
  // `colorRange` → EV/OFF as before, bounds inactive.
  const propColorRange = (props as { colorRange?: [number, number] }).colorRange;
  // MULTI-CHANNEL REDUCE (the multi-channel-colormap follow-up) — how a k>1
  // colormap source collapses to the scalar the LUT indexes. The control (below)
  // shows only while a lut is active AND sourceArity>1; HOME writes the default.
  // TURBO false-color (the tev-exact follow-up) defaults `reduce` to MEAN (tev
  // averages RGB) regardless of k, unlike the k-based `defaultReduceMode`
  // (luminance for k≥3). REDUCE resolves at RENDER: store value > the derived
  // default (no descriptor prop).
  const activeIsTurbo = !!getEncoding(enc.encodingId)?.turbo;
  const reduceDefault: ReduceMode = activeIsTurbo ? "mean" : defaultReduceMode(sourceArity);
  const effectiveReduce = (synced?.reduce as ReduceMode | undefined) ?? reduceDefault;
  // BOUNDS resolve at RENDER: store pair > descriptor colorRange. Memoized so
  // the derived array is identity-stable per input change.
  const colorBounds = useMemo<[number, number] | null>(
    () =>
      synced?.colorMin != null && synced?.colorMax != null
        ? [synced.colorMin, synced.colorMax]
        : (propColorRange ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [synced?.colorMin, synced?.colorMax, propColorRange?.[0], propColorRange?.[1]],
  );
  const boundsSeedVal: [number, number] | null = propColorRange ?? null;
  const boundsModified =
    (colorBounds?.[0] ?? null) !== (boundsSeedVal?.[0] ?? null) ||
    (colorBounds?.[1] ?? null) !== (boundsSeedVal?.[1] ?? null);
  // The bounds skin is engaged iff a DATA encoding is active (a lut that declares
  // min/max, OR the gray-none data path) AND a finite colorRange seeds it (min<max).
  // Light curves (reinhard/aces on a scalar, RGB curves) never use bounds.
  const boundsEngaged =
    ((enc.isLut && enc.hasParam("min")) || scalarNoneData) &&
    !!colorBounds &&
    Number.isFinite(colorBounds[0]) &&
    Number.isFinite(colorBounds[1]);
  // Slider travel for the MIN/MAX bounds — derived from the DESCRIPTOR seed (not
  // the live value) so the track doesn't shift under a drag. Each endpoint gets
  // ±one span of headroom around the seeded [lo,hi].
  const boundsRange = useMemo(() => {
    const seed = propColorRange ?? [0, 1];
    const lo = seed[0];
    const hi = seed[1];
    const span = hi > lo ? hi - lo : 1;
    return { lo, hi, span };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propColorRange?.[0], propColorRange?.[1]]);

  // DIFF display colormap — the viewport's ONE encoding value, resolved for the
  // scalar face by the encoding layer (applicability at render, ruling 5): a
  // LUT applies; a curve doesn't, so the kernel default stands.
  const effectiveDiffColormap = scalarFaceColormap(enc, diffDefaultColormap) as Colormap;

  // Diff metrics chip (MSE/PSNR/MAE) + mean-SSIM + the RESULT-readback (cached-op
  // TEV numbers). Source-data metrics: recomputed only on a source/kernel change.
  const [diffMetrics, setDiffMetrics] = useState<DiffMetrics | null>(null);
  const [diffSsim, setDiffSsim] = useState<number | null>(null);
  const [diffOverlayVersion, setDiffOverlayVersion] = useState(0);
  const [refDims, setRefDims] = useState<{ w: number; h: number } | null>(null);
  const [refUploadVersion, setRefUploadVersion] = useState(0);
  const diffEntryRef = useRef<DiffCacheEntry | null>(null);
  const diffSamplesRef = useRef<Float32Array | null>(null);
  const diffResultDimsRef = useRef<{ w: number; h: number } | null>(null);

  // -----------------------------------------------------------------------
  // Multi-viewport SELECTION: display-settings sync (SINGLE-RECEIVER model). The
  // pane PUBLISHES its local control changes (the `change*` handlers below are the
  // ONE publish site per control) and, as the anchor, SEEDS the group with its
  // full current settings on formation (`settingsSnapshot`). It does NOT subscribe:
  // incoming settings arrive TOP-DOWN via `synced` (the node-level receiver drives
  // the controlled reseed above) — there is exactly ONE bus receiver per viewport,
  // at the node. See `use-synced-image-settings.ts`.
  //
  // NO-OWNER cross-type kernel (the live-3D snapshot compare `OffscreenComparePanes`
  // threads no `onDiffKernelChange`, so its kernel has no node-level owner): mirror
  // `synced.diffKernel` into the local fallback store here. When an owner IS present
  // (the descriptor / stage path) the kernel mirrors through `useCompareControl` at
  // the node, so the pane must NOT also drive it (that owner re-derives `opId`).
  const settingsSnapshot = useCallback(
    (): ImageSyncSettings =>
      diffMode
        ? {
            // DIFF face: the scalar-error encoding + the effective diff colormap
            // (per-kernel default when unoverridden), the real `compareMode:"diff"`,
            // and the diff KERNEL — all the viewport's CURRENT values, so formation
            // mirrors the first diff's settings to the group (ruling 3). A light peer
            // stores the scalar colormap and simply doesn't false-color (ruling 5:
            // arity gating at render).
            encoding: deriveCompareEncodingId("scalar", effectiveTonemap, effectiveDiffColormap),
            tonemapGamma,
            peak,
            exposureEV: displayEV,
            offset: displayOffset,
            reduce: effectiveReduce,
            compareMode: "diff",
            diffKernel,
          }
        : {
            // The ONE `encoding` id — the registry derives colormap/curve from it.
            encoding: enc.encodingId,
            tonemapGamma,
            peak,
            exposureEV: displayEV,
            offset: displayOffset,
            reduce: effectiveReduce,
            ...(colorBounds ? { colorMin: colorBounds[0], colorMax: colorBounds[1] } : {}),
            // COMPOSITOR (split): the LIGHT display look above (a compare peer
            // follows it) PLUS the compare-only keys so a selected peer's control
            // follows the mode + divider (`useCompareControl` reads them). Omitted
            // in the plain single-image case.
            ...(compositorMode
              ? { compareMode: compareOpMode as string, splitPosition }
              : {}),
          },
    [diffMode, effectiveDiffColormap, diffKernel, enc.encodingId, enc.colormap, effectiveTonemap, tonemapGamma, peak, displayEV, displayOffset, effectiveReduce, colorBounds, compositorMode, compareOpMode, splitPosition],
  );
  // The ONE write path into the viewport's settings store (see the binding of
  // `setSynced` above): the GROUP store while selected (transient — gone on
  // unselect), else the viewport's local store (sticks).
  const publishSettings = setSynced;
  // Anchor formation seed: a forming group converges to this viewport's values.
  useSeedGroupOnFormation(
    props.settingsSyncGroupId,
    !!props.syncIsAnchor,
    setSynced,
    settingsSnapshot,
  );
  const changeEncoding = useCallback(
    (id: string) => {
      enc.setEncoding(id);
      publishSettings({ encoding: id });
    },
    [enc, publishSettings],
  );
  // Every display gesture is ONE store write; the value flows back down through
  // the render lookup — no pane state to keep consistent.
  const changeExposure = useCallback(
    (ev: number) => publishSettings({ exposureEV: ev }),
    [publishSettings],
  );
  const changeOffset = useCallback(
    (off: number) => publishSettings({ offset: off }),
    [publishSettings],
  );
  const changePeak = useCallback((v: number) => publishSettings({ peak: v }), [publishSettings]);
  const changeGamma = useCallback(
    (v: number) => publishSettings({ tonemapGamma: v }),
    [publishSettings],
  );
  const changeReduce = useCallback(
    (mode: ReduceMode) => publishSettings({ reduce: mode }),
    [publishSettings],
  );
  const changeBounds = useCallback(
    (next: [number, number]) => publishSettings({ colorMin: next[0], colorMax: next[1] }),
    [publishSettings],
  );
  const changeInfoPanel = useCallback(
    (open: boolean) => publishSettings({ infoPanel: open }),
    [publishSettings],
  );
  // DIFF gesture sites: a kernel / colormap pick is one store write (+ the
  // kernel routes through its owner); peers follow via the store.
  const changeDiffKernel = useCallback(
    (id: string) => {
      setDiffKernel(id);
      // USER RULING: switching to another error SELECTS THAT ERROR'S DEFAULT
      // colormap (a kernel switch re-copies its default into the viewport's one
      // concrete value, exactly like HOME would for that kernel). Published by
      // VALUE so mirrored peers converge on the same colormap.
      const kernelDefault = kernelDefaultColormap(id) as Colormap;
      enc.setEncoding(kernelDefault);
      // ONE patch by value: the kernel + the encoding carrying its new default,
      // mirrored to peers (ruling 3/4).
      publishSettings({
        compareMode: "diff",
        diffKernel: id,
        encoding: deriveCompareEncodingId("scalar", effectiveTonemap, kernelDefault),
      });
    },
    [setDiffKernel, publishSettings, enc, effectiveTonemap],
  );
  const changeDiffColormap = useCallback(
    (id: Colormap) => {
      // The picked id writes the viewport's ONE encoding store (`enc`). An explicit
      // "None" = the raw per-channel error → clear the LUT by selecting the current
      // curve id (so `enc.colormap` becomes "none"); otherwise select the LUT. The pick
      // sticks across kernel switches AND — in a stack — across image↔diff flips (one
      // viewport, one setting). HOME re-seeds `enc` to the kernel default.
      enc.setEncoding(id === "none" ? enc.curveId : id);
      publishSettings({ encoding: deriveCompareEncodingId("scalar", effectiveTonemap, id) });
    },
    [enc, publishSettings, effectiveTonemap],
  );
  // MODE menu picking SLIDE delegates to the owner (which remounts to
  // `GpuComparePane` — the documented slide remount) AND broadcasts on the
  // shared settings bus so a selected PEER pane follows the switch out of diff
  // (its router — `NodeDispatch` — reads `compareMode` and reroutes; a diff
  // `GpuImagePane` can't apply it itself). Mirrors `GpuComparePane.changeCompareMode`.
  const changeCompareMode = useCallback(
    (mode: "split" | "diff") => {
      compareSource?.onCompareModeChange?.(mode);
      publishSettings({ compareMode: mode });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compareSource?.onCompareModeChange, publishSettings],
  );
  // COMPOSITOR param publish sites (Phase 3): the divider / flip keys both LIFT
  // the value to the owner (so the reused-instance control state survives) AND
  // broadcast on the shared bus (a selected peer's control follows —
  // `useCompareControl` subscribes to `splitPosition`). Mirrors
  // `GpuComparePane.changeSplit`. NO recompile — only the compositor param uniform.
  const changeSplit = useCallback(
    (p: number) => {
      compareSource?.onSplitPositionChange?.(p);
      publishSettings({ splitPosition: p });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compareSource?.onSplitPositionChange, publishSettings],
  );
  // SPLIT flip keys ([ / ] always; ←/→/h/l when not in a stacked grid) — ported
  // from `GpuComparePane`. Active only in split mode; `inStackedGrid`/`inOverlay`
  // are threaded via `compareSource` from the CORE side (the addon bundle's
  // context identity differs, so the hook's own context read would miss).
  useSplitFlipKeys(paneRef, compareOpMode === "split" ? "split" : "normal", changeSplit, {
    inStackedGrid: compareSource?.inStackedGrid,
    inOverlay: compareSource?.inOverlay,
  });
  // Q22 fix: the canvas backing store / WebGPU surface are sized to
  // `displayCssSize * dpr` (see the render-pass effect below) — this must
  // re-fire that sizing whenever `devicePixelRatio` itself changes (moving
  // the window to a different-DPI display, an OS/browser zoom change), not
  // just on container resize.
  const dpr = useDevicePixelRatio();

  // -----------------------------------------------------------------------
  // Acquire/release the pool handle for this canvas.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    // HDR-out gate: requires (1) the WebGPU device reporting `capabilities.hdr`,
    // (2) the OS/display actually reporting extended dynamic range (an HDR surface
    // on a plain SDR panel just re-clips at the OS compositor, so there's no
    // point paying for it), and (3) this pane rendering the FLOAT `HdrData`
    // path (`hdrMode`, i.e. the `imagehdr` prop shape) — plain 8-bit
    // `imageUrl` images have no values >1.0 to preserve, so they stay SDR
    // unconditionally. `hdrMode` is read from the closure (stable for a
    // given pane instance — the two prop shapes never swap mid-life, per
    // this file's module doc) rather than a dep, matching this effect's
    // existing run-once-on-mount contract.
    getSharedDevice()
      .then((device) => {
        if (cancelled) return;
        // Two INDEPENDENT signals decide true-HDR output, and we DIAGNOSE which
        // one is missing so the notice can show the right message + hint:
        //   (a) BROWSER support for the extended-tone-mapping canvas path —
        //       probed for real (`capabilities.hdr` is a hardcoded backend flag,
        //       always `true`, so it is NOT this signal; see
        //       `webgpu/device.ts`'s `probeExtendedToneMapping`). Firefox lacks
        //       this entirely — a FUNDAMENTAL browser limitation.
        //   (b) DISPLAY/OS actually in HDR mode (`dynamic-range: high`). An HDR
        //       surface on a plain SDR panel just re-clips at the compositor.
        const browserHasExtendedToneMapping = device.probeExtendedToneMapping?.() ?? false;
        const hasHighDynamicRangeDisplay =
          typeof matchMedia !== "undefined" && matchMedia("(dynamic-range: high)").matches;
        // UNIFIED (§B): the extended surface engages for ANY LIGHT source — the
        // `&& hdrMode` cap is GONE. Once an 8-bit source is sRGB-DECODED to
        // scene-linear (the plain-SDR path), the SAME operator × PEAK pipeline can
        // push EV+n past SDR white on a real HDR display ("unified no matter what
        // the input data was"), so a plain-SDR pane engages the surface exactly
        // like a float-HDR pane. Two hardware signals gate it, PLUS the source
        // being LIGHT: a DESCRIPTOR-COLORMAPPED SDR pane (`propColormap` set at
        // mount) is a FALSE-COLOR visualization, not light — its sRGB LUT output
        // must stay a pixel-exact passthrough on an sRGB surface, so engaging the
        // display-p3 extended surface (which would shift its colors toward P3) is
        // suppressed. A plain 8-bit source (light) engages; the render still forces
        // P=1 / hdrOut:false whenever the surface did NOT engage (resolveRenderTonemap).
        const sourceIsLight = hdrMode || propColormap === "none";
        const useHdr =
          browserHasExtendedToneMapping && hasHighDynamicRangeDisplay && sourceIsLight;
        useHdrRef.current = useHdr;
        setHdrEngaged(useHdr);
        // This pane WANTED HDR (true-float `imagehdr` content) but is getting an
        // SDR surface. Report a one-time notice, diagnosing the missing layer.
        // Prefer the BROWSER sub-case when both signals fail — it's the harder
        // (unworkaroundable) limit. Reported from here (not the addon) because
        // only a real HDR pane knows it wanted HDR and got SDR; and because
        // this whole `.then` only runs when WebGPU IS available (a WebGPU-less
        // browser REJECTS `getSharedDevice()` → the `.catch` below → the legacy
        // CPU pane, which never reports no-hdr), the no-webgpu and no-hdr-*
        // notices are mutually exclusive by construction.
        if (hdrMode && !useHdr) {
          reportCapabilityLimit(
            browserHasExtendedToneMapping ? "no-hdr-display" : "no-hdr-browser",
          );
        }
        acquirePane(canvas, { hdr: useHdr })
          .then((handle) => {
            if (cancelled) {
              releasePane(handle);
              return;
            }
            paneHandleRef.current = handle;
            setPaneReady(true);
          })
          .catch((err) => {
            // C1 fix (whole-branch review): defense-in-depth — `acquirePane`
            // is not expected to reject in practice (the hard GPU-init
            // failures this fix targets surface later, from `handle.render()`
            // — see the render effect below), but a promise rejection here
            // would otherwise be an unhandled rejection that leaves the pane
            // permanently blank. Fall back to the legacy pane instead.
            if (cancelled) return;
            // eslint-disable-next-line no-console
            console.warn("cairn-plot: GpuImagePane failed to acquire a pool handle, falling back to legacy pane", err);
            setEngineFailed(true);
          });
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("cairn-plot: GpuImagePane could not resolve a GPU device, falling back to legacy pane", err);
        setEngineFailed(true);
      });
    return () => {
      cancelled = true;
      if (paneHandleRef.current) {
        releasePane(paneHandleRef.current);
        paneHandleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Viewport interaction (Alt-gated wheel zoom-to-cursor + pointer pan) and
  // the double-click reset are owned by the shared `ImagePaneShell` — this
  // backend only CONSUMES the resulting `{zoom, pan}` (as a uvRect) below.

  // Redraw the TEV overlay / re-run the render pass when the container's own
  // box changes (object-contain fit depends on the live rect).
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // Off-screen park/restore.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const handle = paneHandleRef.current;
        if (!handle) return;
        handle.setVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          if (handle.isParked) {
            handle.restore();
            setContainerTick((t) => t + 1); // force a re-render pass
          }
        } else {
          handle.park();
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // HDR mode: decode/retain source, upload on identity change.
  // -----------------------------------------------------------------------
  // LAYOUT effect (paint-atomic flips): the synchronous HDR upload + `appliedPrimaryIdRef`
  // stamp must land BEFORE paint so a resident float compare/image flip renders
  // pre-paint. Only runs on source/identity change (never per pan/zoom frame — its
  // deps exclude the viewport), so promoting it out of the passive phase is free.
  useLayoutEffect(() => {
    if (!hdrMode || !paneReady || deepActive) return; // deep → GPU-composite effect below
    // The DEEP-aware effective source (live Z-clip re-flatten swaps its `data`).
    const hdr = deepFlatten.hdr;
    hdrDataRef.current = hdr;
    const upload = hdrToRGBAFloat32(hdr);
    // COMPARE primary: key the pool retention on `contentKeyA` so a stacked flip
    // back rebinds the resident float texture (no GPU re-upload). This effect is
    // already SYNCHRONOUS (no async decode), so there is no flip-back gap to close
    // beyond the upload itself. Unkeyed for the single-image path.
    paneHandleRef.current?.setSource(upload, hasCompare ? contentKeyA : undefined);
    // Coherency guard: mirrors `expectedPrimaryId` (compare → `A:<keyA>`, else "hdr").
    appliedPrimaryIdRef.current = hasCompare ? `A:${contentKeyA}` : "hdr";
    setNaturalDims((prev) =>
      prev && prev.w === upload.width && prev.h === upload.height ? prev : { w: upload.width, h: upload.height },
    );
    setPixelDataVersion((v) => v + 1);
    setUploadVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hdrMode, paneReady, deepActive, hdrMode ? deepFlatten.hdr : null, hasCompare, hasCompare ? contentKeyA : null]);

  // DEEP GPU-composite upload: fetch the Z-sorted samples ONCE, upload them to
  // GPU storage buffers, and composite the full window [zMin, zMax] into the
  // pane's source texture. Depth-window ticks thereafter re-composite on the GPU
  // via `onDeepWindow` (no wasm, no re-upload) — the real-time path. Runs only
  // while the source is deep AND the pane is a live WebGPU HDR pane.
  useEffect(() => {
    if (!hdrMode || !paneReady || !deepActive) return;
    const hdr = (props as HdrImageProps).hdr;
    const deep = hdr.deep!;
    hdrDataRef.current = hdr; // TEV overlay reads the full-composite values
    let cancelled = false;
    deep
      .getGpuCsr()
      .then((csr) => {
        if (cancelled) return;
        paneHandleRef.current?.setDeepSource(csr, deep.zMin, deep.zMax);
        appliedPrimaryIdRef.current = "deep"; // coherency guard: mirrors expectedPrimaryId
        setNaturalDims((prev) =>
          prev && prev.w === csr.width && prev.h === csr.height ? prev : { w: csr.width, h: csr.height },
        );
        setPixelDataVersion((v) => v + 1);
        setUploadVersion((v) => v + 1);
      })
      .catch((err) => {
        if (!cancelled) console.warn("[cairn] deep GPU CSR upload failed:", err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hdrMode, paneReady, deepActive, hdrMode ? (props as HdrImageProps).hdr.deep : null]);

  // -----------------------------------------------------------------------
  // SDR mode: decode `imageUrl` (+ optional CPU colormap false-color, exact
  // parity with ImagePane), retain for the overlay, upload on change.
  // -----------------------------------------------------------------------
  // LAYOUT effect (paint-atomic flips): the resident SYNCHRONOUS fast-path (cache
  // hit → `applySdr`) must stamp `appliedPrimaryIdRef` + `naturalDims` BEFORE paint
  // so a resident image/compare-primary flip renders pre-paint. The async decode
  // path is unchanged (kicks off here, resolves post-paint → the held-frame path).
  // Deps exclude the viewport, so this never runs per pan/zoom frame.
  useLayoutEffect(() => {
    if (hdrMode || !paneReady) return;
    const p = props as SdrImageProps;
    const imageUrl = p.imageUrl;
    // COMPARE mode uploads the RAW source (diff samples raw `a`/`b`; a compositor
    // composites raw light) — never a CPU false-color, which is the single-image
    // display convenience only.
    const colormap = hasCompare ? "none" : sdrColormap;
    if (!imageUrl) {
      sdrImageDataRef.current = null;
      appliedPrimaryIdRef.current = `img:`;
      setNaturalDims(null);
      setPixelDataVersion((v) => v + 1);
      // Q24 fix: no explicit inline CSS size to drop anymore — the canvas is
      // always `w-full h-full` of `imgWrapperRef` (see the JSX below); only
      // its device-pixel backing store is set imperatively, and the
      // render-pass effect's early-return on `!naturalDims` simply leaves
      // that backing store at whatever it last was, which is harmless (no
      // source to render into it).
      return;
    }
    // COMPARE mode keys the pool retention on the reference's content identity
    // (`contentKeyA`) so a stacked flip BACK to this slot rebinds the resident
    // primary texture instead of re-uploading. Unkeyed for the single-image path.
    const primaryKey = hasCompare ? contentKeyA : undefined;
    const applySdr = (raw: ImageData, display: ImageData, p2: SdrImageProps) => {
      sdrImageDataRef.current = raw; // TEV overlay reads the RAW source, like ImagePane.
      const upload: SourceUpload = {
        data: display.data,
        width: display.width,
        height: display.height,
        format: "rgba8unorm",
      };
      paneHandleRef.current?.setSource(upload, primaryKey);
      // Coherency guard: record which primary content the pool now holds — mirrors
      // `expectedPrimaryId` in renderPass (compare → `A:<keyA>`, else `img:<url>`).
      appliedPrimaryIdRef.current = hasCompare ? `A:${contentKeyA}` : `img:${imageUrl}`;
      setNaturalDims((prev) =>
        prev && prev.w === display.width && prev.h === display.height ? prev : { w: display.width, h: display.height },
      );
      p2.onNaturalSize?.(display.width, display.height);
      setPixelDataVersion((v) => v + 1);
      setUploadVersion((v) => v + 1);
    };
    // FLIP-BACK / PAINT-ATOMIC FAST PATH (colormap "none" — a raw source with no
    // CPU false-color, i.e. every compare primary AND every plain non-colormapped
    // image): if the decode is already resident, bind SYNCHRONOUSLY so the target
    // presents on THIS commit with no async gap. In a `useLayoutEffect` (below)
    // this stamps `appliedPrimaryIdRef` + `naturalDims` before paint, so a resident
    // slot flip renders pre-paint (no one-frame stale flash). The plain-image case
    // matters for the diff→image direction: without it the image slot's primary
    // uploads async and the diff frame is held for one paint. A colormapped image
    // (`colormap !== "none"`) keeps its async bake below (unchanged).
    if (colormap === "none") {
      const raw = getCachedLoadedImageData(imageUrl);
      if (raw) {
        applySdr(raw, raw, p);
        return;
      }
    }
    let cancelled = false;
    loadImageData(imageUrl).then((raw) => {
      if (cancelled || !raw) return;
      let display = raw;
      if (colormap !== "none") {
        // Exposure/offset are folded into the LUT INDEX here (before the LUT),
        // so the toolbar sliders change colormap SENSITIVITY — matching the GPU
        // diff blit. They enter the cache key so a bake is reused per EV/offset.
        const cacheKey = `gpu::${imageUrl}::${colormap}::ev${displayEV}::off${displayOffset}`;
        const cached = getCachedImageData(cacheKey);
        if (cached) {
          display = cached;
        } else {
          const cmapMode = resolveColormapMode(colormap);
          display = applyColormap(
            raw,
            colormap as Exclude<Colormap, "none">,
            cmapMode,
            displayEV,
            displayOffset,
          );
          setCachedImageData(cacheKey, display);
        }
      }
      applySdr(raw, display, p);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hdrMode,
    paneReady,
    hdrMode ? null : (props as SdrImageProps).imageUrl,
    hdrMode ? null : sdrColormap,
    // Exposure/offset re-bake the colormap (pre-LUT) — only meaningful when a
    // colormap is active; harmless (re-uploads the raw) otherwise.
    hdrMode ? 0 : displayEV,
    hdrMode ? 0 : displayOffset,
    // Compare primary keys the pool retention on `contentKeyA` (flip-back).
    hasCompare,
    hasCompare ? contentKeyA : null,
  ]);

  // -----------------------------------------------------------------------
  // DIFF: upload the reference operand `b` into the pool's SECOND source slot
  // (`setSourceB`). The diff is `source − b` (slot a = `source`, slot b = `b`),
  // matching the diff-engine's `texA − texB` — the caller assigns operands to pick
  // the sign (reference→`source`, foreground→`b` for GpuComparePane parity).
  // Cleared to the single-image path when `!diffMode`. Async (a uint8 ref decodes
  // a URL). Byte-parity is proven at the engine level by content-ops.browser.ts.
  // -----------------------------------------------------------------------
  // LAYOUT effect (paint-atomic flips): the resident SYNCHRONOUS fast-path (upload
  // cache hit → `apply`) must stamp `appliedBIdRef` + `refDims` BEFORE paint so a
  // resident diff/compositor flip renders pre-paint (the diff RESULT then blits
  // this commit). The async decode path is unchanged (resolves post-paint → held
  // frame). Deps exclude the viewport, so this never runs per pan/zoom frame.
  useLayoutEffect(() => {
    if (!paneReady) return;
    const b = hasCompare ? compareSource?.b : undefined;
    if (!b) {
      paneHandleRef.current?.setSourceB(null);
      appliedBIdRef.current = null; // coherency guard: no `b` operand bound
      setRefDims(null);
      refFloatRef.current = null;
      refU8Ref.current = null;
      return;
    }
    const key = contentKeyB;
    // Apply a decoded upload to the pool + local readout refs + versions. Shared
    // by the SYNCHRONOUS flip-back path (cache hit) and the async decode path so a
    // flip back to a resident diff slot presents the cached RESULT on the same
    // commit — no async gap, no intermediate frame.
    const apply = (upload: SourceUpload) => {
      paneHandleRef.current?.setSourceB(upload, key);
      // Coherency guard: record the `b` operand the pool now holds — mirrors
      // `expectedBId` in renderPass (`B:<keyB>`).
      appliedBIdRef.current = `B:${key}`;
      // Retain the reference pixels for the DIRECT-op cpu-twin readout.
      if (b.dtype === "float") {
        refFloatRef.current = b;
        refU8Ref.current = null;
      } else {
        refU8Ref.current = { data: upload.data as unknown as ArrayLike<number>, width: upload.width, height: upload.height };
        refFloatRef.current = null;
      }
      setRefDims((prev) =>
        prev && prev.w === upload.width && prev.h === upload.height ? prev : { w: upload.width, h: upload.height },
      );
      setRefUploadVersion((v) => v + 1);
    };
    const cached = uploadCacheRef.current.get(key);
    if (cached) {
      // FLIP-BACK FAST PATH: decoded upload already resident (and the pool retains
      // the GPU texture under `key`) — bind synchronously, no `.then`.
      uploadCacheRef.current.delete(key); // touch → most-recently-used
      uploadCacheRef.current.set(key, cached);
      apply(cached.upload);
      return;
    }
    let cancelled = false;
    decodedSourceToUpload(b).then((upload) => {
      if (cancelled || !upload) return;
      rememberUpload(key, upload, b);
      apply(upload);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneReady, hasCompare, compareSource?.b, contentKeyB]);

  // Align/fit overlap mapping for the two operands (a = `source`/reference, b =
  // foreground) — folds into the diff cache key + the metrics reduction region
  // (both diff AND compositor metrics). Null until both footprints are known.
  const diffMapping = useMemo<CompareMapping | null>(() => {
    if (!hasCompare || !naturalDims || !refDims) return null;
    // Primary = the foreground = the SECOND operand (`b`), matching
    // `GpuComparePane`'s `computeCompareMapping(ref, fg, …, "b")` — `fit:"fill"`
    // rescales to the foreground. Irrelevant under the default `crop`.
    return computeCompareMapping(
      naturalDims,
      refDims,
      compareSource?.align ?? "top-left",
      compareSource?.fit ?? "crop",
      "b",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompare, naturalDims, refDims, compareSource?.align, compareSource?.fit]);

  // HDR-FLIP exposure range — computed once per REFERENCE content from its
  // luminance (deterministic → folds into the diff-cache key, never a recompute on
  // zoom/pan). The reference is the diff-engine's `texA` operand = the pane's
  // `source` here. Only needed for the `hdr-flip` kernel.
  const hdrExposures = useMemo(() => {
    if (!diffMode || !sourcesAreFloat) return null;
    const ref = backendProps.source.dtype === "float" ? backendProps.source : null;
    if (!ref) return null;
    const { h, w, c } = shapeDims(ref.shape);
    const refData = widenFloatPixels(ref.pixels);
    return computeHdrFlipExposures(refData, w, h, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffMode, sourcesAreFloat, backendProps.source]);

  // -----------------------------------------------------------------------
  // Render pass — on demand: mount (via uploadVersion bump above) +
  // viewport/exposure/operator/gamma/container-resize change. NOT per frame.
  // -----------------------------------------------------------------------
  // Base exposure/offset — the CONTROLLED EV/offset surface (host-menu contract):
  // read straight from props (always current, so trivially controllable), and the
  // toolbar's EV/OFF sliders (`displayEV`/`displayOffset`) are ADDITIVE runtime
  // adjustments on top (HOME zeroes only the sliders, so the base persists). Both
  // prop shapes now carry `exposure`/`offset`; the plain-SDR pipeline applies them
  // in-shader exactly like the HDR path (the colormapped SDR passthrough does not).
  const baseExposure = hdrMode
    ? ((props as HdrImageProps).exposure ?? 0)
    : ((props as SdrImageProps).exposure ?? 0);
  const baseOffset = hdrMode
    ? ((props as HdrImageProps).offset ?? 0)
    : ((props as SdrImageProps).offset ?? 0);
  // DISPLAY-space post-processing (the 8-bit `processing` block's brightness/
  // contrast/flipSign) — honored IN-SHADER (u_bind14 via ImageParams) so a single
  // knob renders IDENTICALLY to the CPU SDR pane's CSS filter (audit H1: this pane,
  // the DEFAULT renderer, previously ignored the whole block). exposure/offset are
  // NOT here — they are lifted top-level and applied in scene-linear space above.
  // A float/HDR source never carries a `processing` block (Python drops
  // brightness/contrast/flip_sign on the float path), so this is identity there;
  // spread into the plain-image params below (identity default = bit-for-bit the
  // pre-processing render for every image with no processing set).
  const processing = hdrMode ? undefined : (props as SdrImageProps).processing;
  const displayAdjust: Pick<ImageParams, "brightness" | "contrast" | "flipSign"> = {
    brightness: processing?.brightness ?? 0,
    contrast: processing?.contrast ?? 0,
    flipSign: processing?.flipSign ?? false,
  };
  // The plain (non-colormap) SDR path runs the tev display-transfer pipeline
  // (sRGB-DECODE → exposure → operator → encode); a colormapped SDR image is
  // already false-colored / display-ready, so it stays a raw passthrough.
  const sdrPlain = !hdrMode && sdrColormap === "none";

  // ----------------------------------------------------------------------
  // THE RENDER SNAPSHOT — assembled ONCE from the current commit's props and the
  // pool's applied-source stamps. `renderPass` (the present gate), the pre-paint
  // paint-atomic effect, the flip detector, and the paint-phase log all read it;
  // none re-derives its own "which sources / which op / resident?" view. See
  // `render-snapshot.ts` for the invariant it owns.
  // ----------------------------------------------------------------------
  const snapshot = buildRenderSnapshot({
    diffMode,
    compositorMode,
    hasCompare,
    hdrMode,
    deepActive,
    imageUrl: (props as SdrImageProps).imageUrl ?? "",
    contentKeyA,
    contentKeyB,
    hasBOperand: !!compareSource?.b,
    resolvedKernelId,
    compareOpMode,
    splitPosition,
    paneReady,
    // Read the pool's applied stamps at render time (the same timing the previous
    // inline `targetResident` used); the present gate in `renderPass` re-reads
    // them at CALL time for imperative repaints.
    appliedPrimaryId: appliedPrimaryIdRef.current,
    appliedBId: appliedBIdRef.current,
    naturalDims,
    refDims,
    // A cached diff's result is resident iff the per-device cache HITs — a
    // non-mutating pool peek (a cold cache stays on the post-paint path rather
    // than recomputing multi-pass on the paint critical path).
    isDiffContentResident: () =>
      !!paneHandleRef.current?.isDiffContentResident(
        resolvedKernelId,
        { a: contentKeyA, b: contentKeyB },
        { hdrExposures },
        diffMapping ?? undefined,
      ),
  });
  // The render pass, extracted into a stable callback so the screenshot path
  // (`useImageController`'s `toPNG`) can force a fresh, SYNCHRONOUS repaint
  // before reading the WebGPU canvas back (see that hook's module doc). The
  // effect below simply invokes it on the same dep set as before.
  const renderPass = useCallback((): boolean => {
    const handle = paneHandleRef.current;
    if (!handle || !paneReady || !naturalDims) return false;
    const paneEl = paneRef.current;
    // Both the uv math and the canvas backing store key off `imgWrapperRef`, the
    // padding-free content box the axes/overlay also measure — one coordinate
    // space, so the sampled window and the canvas rect never disagree.
    const wrapEl = imgWrapperRef.current;
    // MEASURE-THEN-RENDER (pane contract): present only once the container has a real
    // layout box — its size drives `handle.resize()` → the surface backing size. No
    // source-dims fallback: a pane with no measured box (pre-layout, or a hidden
    // stack slot) HOLDS (blank), and the ResizeObserver re-runs this pass
    // (`containerTick`) the moment layout arrives. This is why the pool needs no
    // backing-size floor.
    const measureEl = wrapEl ?? paneEl;
    const wrapBox = measureEl ? measureEl.getBoundingClientRect() : null;
    if (!wrapBox || wrapBox.width <= 0 || wrapBox.height <= 0) return false;
    const rawUv = viewportToUvRect({ zoom, pan }, wrapBox, naturalDims.w, naturalDims.h);
    setOverlayWindow((prev) =>
      prev.x === rawUv.x && prev.y === rawUv.y && prev.w === rawUv.w && prev.h === rawUv.h ? prev : rawUv,
    );

    // The canvas backing store / WebGPU surface span the FULL content box ×
    // devicePixelRatio; the image is placed as a quad inside that viewport by
    // `viewportToUvRect` (letterboxed at rest, pannable/zoomable into the
    // margins). The CSS layout box is `w-full h-full` of the wrapper, so only
    // the device-pixel backing store is computed here; letterbox + checkerboard
    // in any empty region is the shader's OOB→transparent path.
    // The measured box is guaranteed positive by the measure-then-render gate above.
    handle.resize(Math.round(wrapBox.width * dpr), Math.round(wrapBox.height * dpr));

    // Nearest filtering once a source texel is >= PIXEL_VALUE_MIN_SCREEN_PX on
    // screen (the same threshold at which the pixel overlay starts drawing
    // per-texel numbers), linear below it — see `screenPxPerTexel`.
    const filter: "nearest" | "linear" =
      screenPxPerTexel(rawUv, wrapBox, naturalDims.w, naturalDims.h) >= PIXEL_VALUE_MIN_SCREEN_PX
        ? "nearest"
        : "linear";
    const uv = rawUv;

    // ---- PRESENT GATE (the snapshot's one rule) ------------------------
    // Present ONLY when the pool has bound exactly the sources this frame's
    // snapshot expects; otherwise HOLD the previous frame (WebGPU keeps the last
    // present) until the pending async upload lands, bumps `uploadVersion`/
    // `refUploadVersion`, and re-fires this pass. Op + display encoding are pure
    // synchronous derivations of the props (coherent by construction), so gating
    // the two async-lagging SOURCE identities is necessary and sufficient — a
    // present can never mix a new op with a previous slot's textures (the measured
    // artefact: an identity blit sampling the retained diff reference on a
    // diff→image flip). General: it equally gates a plain single-pane image→image
    // URL swap. Deadlock-free — `applied*` is stamped from the same expressions
    // that build `snapshot.primaryId`/`bId`, so they converge. Read the applied
    // refs at CALL time (fresh) so an imperative repaint — screenshot / probe
    // readback / deep-window — gates against the pool's live binding, not the
    // render-time value.
    if (appliedPrimaryIdRef.current !== snapshot.primaryId || appliedBIdRef.current !== snapshot.bId) {
      return false;
    }

    // ---- COMPOSITOR path (split, Phase 3) -------------------------------
    // Renders a LIGHT composite of the two operands (slot a = reference =
    // `source`, slot b = foreground = `compareSource.b`) through the SAME unified
    // image pipeline: `render({contentOpId: split, contentParam})`, the pool
    // injects `srcB`, and `cairnContent` composites by the fragment uv against the
    // compositor param. The composite is ordinary scene light → the DISPLAY stage
    // (operator × peak × surface, output-encode) runs EXACTLY as a plain image
    // (isScalar false). Byte-identical to `GpuComparePane`'s compose for a hard
    // split. Driven live (divider drag) — only the compositor param uniform
    // changes, no recompile.
    if (compositorMode) {
      // Wait for the foreground slot to upload (else the composite would sample
      // the 1×1 placeholder for slot b). Re-fires on `refUploadVersion`.
      if (!refDims) return false;
      const rt = resolveRenderTonemap(
        effectiveTonemap,
        useHdrRef.current ? peak : 1,
        useHdrRef.current,
        tonemapGamma,
      );
      const compositeParams: ImageParams = {
        exposureEV: baseExposure + displayEV,
        offset: baseOffset + displayOffset,
        operator: rt.operator as ImageParams["operator"],
        gamma: rt.gamma,
        isScalar: false,
        hdrOut: rt.hdrOut,
        peak: rt.peak,
        // sRGB-DECODE an 8-bit operand to scene-linear (like the single-image
        // light path); a float operand is already scene-linear. Same-dtype
        // operands (the common case) share this flag; a mixed-dtype pair follows
        // the PRIMARY (documented limitation vs GpuComparePane's per-side decode).
        srgbDecode: !hdrMode,
        uv,
        filter,
        contentOpId: contentOpId(compareOpMode!),
        contentParam: splitPosition,
      };
      try {
        const ok = handle.render(compositeParams);
        if (!ok) setEngineFailed(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("cairn-plot: GpuImagePane compositor render failed, falling back to legacy pane", err);
        setEngineFailed(true);
      }
      return true;
    }

    // ---- DIFF path (content-op unification, Phase 2c) --------------------
    // Renders `source − compareSource.b` through the pool: a DIRECT pointwise op
    // inline (`render({contentOpId})`, the pool injects `srcB`); a CACHED metric
    // (FLIP/HDR-FLIP/SSIM) via `renderDiffCached`. The DISPLAY reuses the pane's
    // display-encoding machinery: analytic red-green (signed), turbo-log2
    // (magnitude), a plain LUT (magma/…) or raw per-channel error ("none"). Proven
    // byte-identical to the composed cpu twin by content-ops.browser.ts.
    if (diffMode) {
      // Wait for the reference slot to upload (else a direct op would sample the
      // 1×1 placeholder). The render effect re-fires on `refUploadVersion`.
      if (!refDims) return false;
      const kernelId = getDiffKernel(resolvedKernelId) ? resolvedKernelId : "absolute";
      const cmap = effectiveDiffColormap; // an encoding/colormap id, or "none"
      const encEntry = cmap !== "none" ? getEncoding(cmap) : undefined;
      const isAnalytic = !!encEntry?.analytic;
      const isTurbo = !!encEntry?.turbo;
      const lut =
        cmap !== "none" && !isAnalytic ? colormapFloatLUT(cmap as Exclude<Colormap, "none">) : undefined;
      // Scalar-error display params: reduce MEAN (tev averages RGB), EV/OFF as
      // colormap sensitivity, the resolved encoding face. `gamma` is LEFT UNSET so
      // the analytic branch encodes via sRGB OETF (a gamma of 1 would flip it to an
      // identity encode — the content-ops.browser twin uses `outputEncode(_, undefined)`).
      const diffDisplay: ImageParams = {
        exposureEV: displayEV,
        offset: displayOffset,
        operator: "linear",
        isScalar: cmap !== "none",
        reduce: "mean",
        channelCount: 3,
        // The LUT/turbo tables hold display-sRGB → SDR (hdrOut false); the analytic
        // color is scene-linear and rides the shared output-encode, so |v|>1 error
        // survives on an engaged HDR surface.
        hdrOut: isAnalytic ? useHdrRef.current : false,
        srgbDecode: false,
        uv,
        filter,
        ...(isAnalytic ? { analytic: true } : {}),
        ...(isTurbo ? { turbo: true } : {}),
        ...(lut ? { colormap: lut } : {}),
      };
      try {
        // ONE kernel-agnostic call: the POOL picks the execution strategy from
        // the kernel's own declaration (pointwise → per-frame content op;
        // multipass → content-keyed cached compute) and the KERNEL derives its
        // compute params from the generic source facts. The pane never sees
        // kernel kinds, param derivations, or cache keys.
        const result = handle.renderDiff(
          kernelId,
          { a: contentKeyA, b: contentKeyB },
          { hdrExposures },
          diffDisplay,
          diffMapping ?? undefined,
        );
        // Identity-op floor: a diff present must come from the diff pipeline —
        // HOLD this present until a valid op resolves (see PaneHandle.renderDiff).
        if (result === "hold") return false;
        if (result === "failed") {
          diffEntryRef.current = null;
          setEngineFailed(true);
        } else {
          diffEntryRef.current = result.entry;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("cairn-plot: GpuImagePane diff render failed, falling back to legacy pane", err);
        setEngineFailed(true);
      }
      return true;
    }
    // TONE-MAP operator = the operator ACTUALLY in effect (`effectiveTonemap`,
    // the toolbar menu's value): the view-local override if the user picked one,
    // else the effective default (Linear on an engaged HDR surface, sRGB on SDR).
    //
    // UNIFIED translation: the display operator + PEAK ceiling `P` + whether the
    // real HDR surface engaged (`useHdrRef`, guarding a stale pick from requesting
    // HDR-out on a non-HDR surface) resolve to the engine operator + `hdrOut` +
    // finite `peak` + encode `gamma`. `P` is the live slider on an engaged
    // surface; forced to 1 (SDR rendition) otherwise. See resolveRenderTonemap.
    const rt = resolveRenderTonemap(
      effectiveTonemap,
      useHdrRef.current ? peak : 1,
      useHdrRef.current,
      tonemapGamma,
    );
    // UNIFIED render params (§A/§B). The HDR (float) pane AND the plain-SDR
    // (8-bit, no colormap) pane run the SAME resolveRenderTonemap output — one
    // operator × PEAK × surface model. The ONLY per-shape differences are:
    //   - exposure base: HDR adds the descriptor `exposure`; SDR's is 0.
    //   - srgbDecode: the 8-bit source is sRGB-DECODED to scene-linear first
    //     (`!hdrMode`); a float source is already scene-linear.
    // So an 8-bit 255-white pixel at EV+1 on an engaged HDR surface genuinely
    // encodes past SDR white, exactly as a float 1.0 pixel would. A COLORMAPPED
    // SDR image is the one exception — its false-color LUT output is already
    // display-ready, so it stays a raw passthrough (operator "linear", gamma 1 =
    // identity, no decode, hdrOut:false) to avoid double-encoding the LUT output.
    // FLOAT colormap (Phase 2 / task #86): a colormap on the float/unified
    // surface runs the GPU LUT FAMILY on the scalar channel — scalar (channel 0)
    // → exposure/offset SENSITIVITY → LUT (cmap-mode linear). `isScalar`
    // short-circuits the tone-map operator + output-encode in the shader (the LUT
    // holds display sRGB), so operator/gamma/hdrOut are moot; the LUT table comes
    // from the shared `colormapFloatLUT`, the SAME the diff blit binds.
    const hdrColormapActive = hdrMode && hdrColormap !== "none";
    // ANALYTIC colormap (tev-style signed red-green): computed color, no LUT bind.
    // Unlike the LUT branch (which bakes display sRGB → hdrOut:false), the analytic
    // color is SCENE-LINEAR and rides the SHARED output-encode, so it takes the
    // pane's real hdrOut (`rt.hdrOut`) — |v|>1 error survives on the engaged HDR
    // surface, |v|<=1 renders identically on SDR. Exposure/offset SCALE the
    // amplitude (no bounds/norm skin on the analytic entry). See DisplayEncoding.
    const analyticColormapActive = hdrColormapActive && !!getEncoding(hdrColormap)?.analytic;
    // Phase 4 DATA-encoding skins (float LUT path only): when the min/max BOUNDS
    // skin is engaged (`boundsEngaged`, seeded from `colorRange`), it is the SOLE
    // affine — EV/OFF are held NEUTRAL so the two skins never double-apply
    // (single-application; see the colorRange audit). The `power` norm's exponent
    // reuses the γ uniform (gamma), free on the lut path; other norms leave it 1.
    const cmapExposure = boundsEngaged ? 0 : baseExposure + displayEV;
    const cmapOffset = boundsEngaged ? 0 : baseOffset + displayOffset;
    const params: ImageParams = analyticColormapActive
      ? {
          exposureEV: baseExposure + displayEV,
          offset: baseOffset + displayOffset,
          operator: "linear",
          isScalar: true,
          analytic: true,
          // No colormap bound, no norm/bounds; gamma unset → sRGB OETF encode.
          hdrOut: rt.hdrOut,
          peak: rt.peak,
          srgbDecode: false,
          reduce: effectiveReduce,
          channelCount: sourceArity,
          uv,
          filter,
        }
      : hdrColormapActive
      ? {
          exposureEV: cmapExposure,
          offset: cmapOffset,
          operator: "linear",
          gamma: 1,
          isScalar: true,
          colormap: colormapFloatLUT(hdrColormap as Exclude<Colormap, "none">),
          hdrOut: false,
          peak: rt.peak,
          srgbDecode: false,
          // TURBO bakes its own FIXED log2 index (scalar-mode 3). The user-facing
          // norm picker was removed (effective norm is linear = cairnDataIndex
          // identity), so the LUT index is the plain sensitivity-adjusted scalar.
          ...(activeIsTurbo ? { turbo: true } : {}),
          // Multi-channel follow-up: a k>1 source is REDUCED to a scalar
          // (luminance/mean) before the LUT; k=1 leaves channel 0 untouched.
          reduce: effectiveReduce,
          channelCount: sourceArity,
          ...(boundsEngaged && colorBounds
            ? { normMin: colorBounds[0], normMax: colorBounds[1] }
            : {}),
          uv,
          filter,
        }
      : scalarNoneData
      ? {
          // GRAY NONE — the plain-grayscale scalar as a DATA encoding. Same shape
          // as the float-LUT branch (scalar → cairnDataIndex) but the color is the
          // SCENE-LINEAR gray vec3(idx) through the SHARED output-encode (NOT a
          // baked-sRGB LUT), so `hdrOut` is the pane's REAL surface (rt.hdrOut) and
          // idx>1 survives on HDR. `gamma` (the power-NORM exponent slot) is 1 now
          // that the norm picker is removed (effective norm linear); `grayEncodeGamma`
          // is the curve's OWN encode transfer (sRGB / identity / 1/γ). EV/OFF are the
          // sensitivity skin (neutralized when bounds engage, single-apply).
          exposureEV: cmapExposure,
          offset: cmapOffset,
          operator: "linear",
          gamma: 1,
          isScalar: true,
          grayNone: true,
          grayEncodeGamma: resolveEncodeGamma(effectiveTonemap, tonemapGamma) ?? 0,
          hdrOut: rt.hdrOut,
          peak: rt.peak,
          srgbDecode: false,
          reduce: effectiveReduce,
          channelCount: sourceArity,
          ...(boundsEngaged && colorBounds
            ? { normMin: colorBounds[0], normMax: colorBounds[1] }
            : {}),
          uv,
          filter,
        }
      : hdrMode || sdrPlain
        ? {
            exposureEV: baseExposure + displayEV,
            offset: baseOffset + displayOffset,
            operator: rt.operator as ImageParams["operator"],
            gamma: rt.gamma,
            isScalar: false,
            hdrOut: rt.hdrOut,
            peak: rt.peak,
            srgbDecode: !hdrMode,
            uv,
            filter,
            // DISPLAY-space brightness/contrast/flipSign (identity when unset).
            ...displayAdjust,
          }
        : {
            exposureEV: 0,
            offset: 0,
            operator: "linear",
            gamma: 1,
            isScalar: false,
            hdrOut: false,
            srgbDecode: false,
            uv,
            filter,
            // DISPLAY-space brightness/contrast/flipSign (identity when unset) —
            // an 8-bit COLORMAPPED image reaches this raw-passthrough branch; the
            // CPU SDR pane applies its CSS filter over the colormapped element too.
            ...displayAdjust,
          };
    // COMPARE-INTENDED FLOOR (snapshot invariant). The diff/compositor branches
    // above return for every well-formed compare, so reaching this plain image
    // blit while `hasCompare` means a degenerate render slipped through (e.g. an
    // unrecognized `compareSource.mode`). Blitting the primary — which in compare
    // mode IS the reference — would flash the reference, so HOLD instead. Tagged
    // `compareIntended` so the render-log oracle (`isPipelineMismatch`) asserts
    // zero such presents reach the surface. The real-path leak (a diff `state`
    // emitted as a plain image on a cold flip) is closed upstream by `LeafView`'s
    // reference-leak guard + diff-pair prefetch; this is the last-line floor.
    if (hasCompare) return false;
    // `handle.render()` is synchronous here, so a throw would unmount the subtree;
    // `attemptRender` already converts hard failures to a `false` return, and the
    // try/catch is belt-and-suspenders. Either way `engineFailed` falls this pane
    // back to the CPU pane — it never blanks.
    try {
      const ok = handle.render({ ...params, compareIntended: hasCompare, authoredColormap: authoredColormapIsLut });
      if (!ok) setEngineFailed(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("cairn-plot: GpuImagePane render failed, falling back to legacy pane", err);
      setEngineFailed(true);
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneReady, naturalDims, zoom, pan.x, pan.y, baseExposure, baseOffset, displayEV, displayOffset, effectiveTonemap, peak, tonemapGamma, sdrPlain, hdrMode, sdrColormap, hdrColormap, effectiveReduce, sourceArity, colorBounds, boundsEngaged, dpr,
    // DIFF deps: re-render when the reference uploads, the kernel/colormap/mapping
    // change, or the hdr-flip exposures resolve.
    diffMode, refDims, refUploadVersion, resolvedKernelId, effectiveDiffColormap, diffMapping, hdrExposures, contentKeyA, contentKeyB,
    // COMPOSITOR deps: re-render on a divider drag / mode change
    // (only the compositor param uniform changes — no recompile).
    compositorMode, compareOpMode, splitPosition,
    // PRESENT-COHERENCY GUARD deps: `expectedPrimaryId`/`expectedBId` read these,
    // so renderPass must be recreated (and re-evaluate the guard) when the pane's
    // intended source IDENTITY changes — notably a plain image→image URL swap
    // (`imageUrl`), a compare toggle (`hasCompare`), a deep toggle (`deepActive`),
    // or the presence of the `b` operand — else the guard would compare against a
    // stale expected id and hold the previous frame forever.
    hasCompare, deepActive, hdrMode ? null : (props as SdrImageProps).imageUrl, compareSource?.b,
    // TEST-ONLY tripwire tag (fresh across a descriptor colormap change).
    authoredColormapIsLut]);

  // Keep a live ref to the latest renderPass so the (stable) deep-zClip callback
  // (`onDeepZClip`, declared before renderPass exists) can trigger a repaint.
  renderPassRef.current = renderPass;

  // Dedupe identity: a fresh object per `renderPass` recreation (i.e. whenever any
  // pixel-affecting dep changes). Paired with `uploadVersion`/`containerTick` (the
  // forced-re-render triggers — re-upload, park/restore, resize) it uniquely keys a
  // render. `renderPass` returns whether it actually SUBMITTED (a held/guarded frame
  // returns false), so a hold does NOT mark the key done and a later retry still
  // fires. Both the pre-paint layout effect and the post-paint effect consult this
  // one ref, so a resident flip renders exactly once (pre-paint), and the post-paint
  // effect skips the duplicate.
  const renderId = useMemo(() => ({}), [renderPass]);
  if (contentEpochIdentityRef.current !== snapshot.contentKey) {
    contentEpochIdentityRef.current = snapshot.contentKey;
    contentEpochRef.current += 1;
  }
  const contentEpoch = contentEpochRef.current;
  const alreadyRendered = (): boolean => {
    const r = lastRenderedRef.current;
    return !!r && r.id === renderId && r.uv === uploadVersion && r.ct === containerTick;
  };
  const markRendered = (): void => {
    lastRenderedRef.current = { id: renderId, uv: uploadVersion, ct: containerTick };
  };

  // PRE-PAINT (paint-atomic) render for a RESIDENT slot flip. Runs in the layout
  // phase — BEFORE the browser paints — so the first painted frame after the flip
  // already shows the new slot instead of the held previous one. Gated on a genuine
  // content flip (`snapshot.contentKey` changed) AND full residency
  // (`snapshot.resident`), so pan/zoom/exposure (not a flip) and non-resident
  // targets (genuinely async loads, correctly held) stay on the post-paint path
  // below. The upload effects
  // above are `useLayoutEffect`, so on a resident flip they bind the sources +
  // `setRefDims`/`setNaturalDims` synchronously in this same commit; React flushes
  // the resulting state update (a 2nd render pass) BEFORE paint, and this effect
  // then re-fires with residency satisfied and submits the new slot pre-paint.
  useLayoutEffect(() => {
    // Emit a pre-paint COMMIT marker once per flip (before any early-return), so a
    // harness can classify the new slot's submit time against the flip's commit
    // boundary (a paint between commit and submit = a stale first frame).
    if (isPaintPhaseLogActive() && lastCommitEpochRef.current !== contentEpoch) {
      lastCommitEpochRef.current = contentEpoch;
      recordPaintPhase({
        phase: "commit",
        kind: snapshot.mode,
        submitted: false,
        resident: snapshot.resident,
        epoch: contentEpoch,
        t: performance.now(),
      });
    }
    if (snapshot.contentKey === lastContentIdentityRef.current) return; // not a flip
    if (!snapshot.resident) return; // non-resident → keep the post-paint hold path
    if (alreadyRendered()) return;
    lastContentIdentityRef.current = snapshot.contentKey;
    const submitted = renderPass();
    if (submitted) markRendered();
    if (isPaintPhaseLogActive())
      recordPaintPhase({
        phase: "layout",
        kind: snapshot.mode,
        submitted,
        resident: snapshot.resident,
        epoch: contentEpoch,
        t: performance.now(),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderId, uploadVersion, containerTick, snapshot.resident, snapshot.contentKey]);

  // POST-PAINT render — the general path (pan/zoom/exposure/param changes,
  // park/restore/resize, and NON-resident flips whose async load resolves later and
  // is correctly held until ready). Skips the render the pre-paint effect already
  // submitted for this exact key (dedupe), and keeps the flip detector current for
  // non-flip renders.
  useEffect(() => {
    lastContentIdentityRef.current = snapshot.contentKey;
    if (alreadyRendered()) return;
    const submitted = renderPass();
    if (submitted) markRendered();
    if (submitted && isPaintPhaseLogActive())
      recordPaintPhase({
        phase: "post",
        kind: snapshot.mode,
        submitted,
        resident: snapshot.resident,
        epoch: contentEpoch,
        t: performance.now(),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderId, uploadVersion, containerTick]);

  // -----------------------------------------------------------------------
  // DIFF metrics (MSE/PSNR/MAE) + mean-SSIM — source-data metrics computed over
  // the two pool-owned slots (never on viewport/exposure/colormap). Ported from
  // `GpuComparePane`, but run THROUGH the pool (`handle.computeMetrics` /
  // `computeSsim`) since the pool owns the textures.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!hasCompare || !paneReady || !refDims) {
      setDiffMetrics(null);
      return;
    }
    let cancelled = false;
    const p = paneHandleRef.current?.computeMetrics(diffMapping ?? undefined);
    p?.then((m) => {
      if (!cancelled) setDiffMetrics(m);
    }).catch(() => {
      if (!cancelled) setDiffMetrics(null);
    });
    return () => {
      cancelled = true;
    };
  }, [hasCompare, paneReady, refDims, uploadVersion, refUploadVersion, diffKernel, diffMapping]);

  useEffect(() => {
    if (!hasCompare || !paneReady || !refDims) {
      setDiffSsim(null);
      return;
    }
    let cancelled = false;
    setDiffSsim(null);
    const p = paneHandleRef.current?.computeSsim({ a: contentKeyA, b: contentKeyB }, diffMapping ?? undefined);
    p?.then((m) => {
      if (!cancelled) setDiffSsim(m);
    }).catch(() => {
      if (!cancelled) setDiffSsim(null);
    });
    return () => {
      cancelled = true;
    };
  }, [hasCompare, paneReady, refDims, uploadVersion, refUploadVersion, contentKeyA, contentKeyB, diffMapping]);

  // -----------------------------------------------------------------------
  // DIFF RESULT readback (TEV per-pixel metric values) — CACHED kernels only. A
  // direct op's per-pixel readout comes from its `cpu` twin (below); a cached
  // metric has no per-texel twin, so read back the RESULT texture once per entry.
  // Cleared on a kernel switch; bumps `diffOverlayVersion` so the overlay tracks
  // the selected metric.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!diffMode) {
      diffSamplesRef.current = null;
      diffResultDimsRef.current = null;
      return;
    }
    const kernel = getDiffKernel(resolvedKernelId);
    if (kernel?.kind !== "multipass") {
      // Direct op: no result readback — the cpu twin drives the readout.
      diffSamplesRef.current = null;
      diffResultDimsRef.current = null;
      setDiffOverlayVersion((v) => v + 1);
      return;
    }
    const entry = diffEntryRef.current;
    if (!paneReady || !entry) return;
    let cancelled = false;
    diffSamplesRef.current = null;
    diffResultDimsRef.current = null;
    setDiffOverlayVersion((v) => v + 1);
    paneHandleRef.current
      ?.readDiffResult(entry)
      ?.then((arr) => {
        if (cancelled) return;
        diffSamplesRef.current = arr;
        diffResultDimsRef.current = { w: entry.width, h: entry.height };
        setDiffOverlayVersion((v) => v + 1);
      })
      .catch(() => {
        /* readback failure — leave numbers blank (display-only) */
      });
    return () => {
      cancelled = true;
    };
  }, [diffMode, paneReady, resolvedKernelId, uploadVersion, refUploadVersion, diffMapping]);

  // Test seam (browser harness only): expose the live diff seams on the pane
  // element so a headless harness can drive kernel/colormap switching + HOME and
  // read the wired metric strings — mirrors `GpuComparePane`'s `__cairnCompareProbe`.
  // No production code reads this; set whenever the pane is a COMPARE pane (diff
  // OR compositor). It unifies the seams the migrated harnesses read — the diff
  // fields (kernel/colormap/metrics) AND the compositor fields (split/blend +
  // per-side overlay geometry + surface readback the split-numbers harness needs).
  useEffect(() => {
    const el = paneRef.current as (HTMLDivElement & { __cairnImageDiffProbe?: unknown }) | null;
    if (!el || !hasCompare) return;
    el.__cairnImageDiffProbe = {
      canvas: canvasRef.current,
      requestRender: renderPass,
      // The LIVE compare mode — a unified harness reads `compareMode` off whichever
      // probe (compare | diff) is live to follow mode across a split↔diff switch.
      get compareMode() {
        return (diffMode ? "diff" : compareOpMode) as "split" | "diff";
      },
      get diffKernel() {
        return diffKernel;
      },
      get resolvedKernelId() {
        return resolvedKernelId;
      },
      get colormap() {
        return effectiveDiffColormap;
      },
      // The ONE derived encoding id this pane publishes on the shared bus — a
      // migrated compare-settings-sync harness asserts a peer follows it.
      get encodingId() {
        return deriveCompareEncodingId("scalar", effectiveTonemap, effectiveDiffColormap);
      },
      get effectiveTonemap() {
        return effectiveTonemap;
      },
      get metrics() {
        return diffMetrics;
      },
      get ssimText() {
        return formatSsim(diffSsim);
      },
      // COMPOSITOR (split) seams — mirror `GpuComparePane`'s `__cairnCompareProbe`.
      get splitPosition() {
        return splitPosition;
      },
      changeSplit,
      // The FRAMING grid (primary/reference footprint) + the per-side source grids
      // ("a" = reference = the framing dims, "b" = foreground = its own dims).
      get dims() {
        return naturalDims;
      },
      get srcDims() {
        return naturalDims ? { a: naturalDims, b: refDims ?? naturalDims } : null;
      },
      get overlayWindow() {
        return overlayWindow;
      },
      // Per-side TEV texel→screen mapping (canvas-LOCAL CSS px) through the SAME
      // `sourceTexelCenter`/`computeSourceFit` the per-side overlays draw with —
      // the split-numbers alignment proof (the #88 fix).
      overlayTexelCenter: (side: "a" | "b", px: number, py: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !naturalDims) return null;
        const box = canvas.getBoundingClientRect();
        const srcd = side === "a" ? naturalDims : (refDims ?? naturalDims);
        const c = sourceTexelCenter(
          px,
          py,
          { box, naturalWidth: naturalDims.w, naturalHeight: naturalDims.h, sourceWindow: overlayWindow },
          srcd,
        );
        return { x: c.x - box.left, y: c.y - box.top };
      },
      // Headless-reliable surface readback (a live in-DOM swapchain reads blank via
      // createImageBitmap): a fresh synchronous frame then `device.readback` of the
      // pool-owned surface. Mirrors `GpuComparePane.readbackSurface`.
      readbackSurface: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        renderPass();
        const surface = getCanvasSurfaceForTest(canvas);
        if (!surface) return null;
        const device = await getSharedDevice();
        const data = await device.readback(surface);
        return { data, width: canvas.width, height: canvas.height };
      },
      changeCompareMode,
      changeDiffKernel,
      changeDiffColormap,
      // The compare display curve (light compositor tonemap) — the unified encoding
      // set; mirrors `GpuComparePane.changeTonemap` for the settings-sync harness.
      changeTonemap: (id: string) => changeEncoding(id),
      // Alias mirroring `GpuComparePane`'s probe field name (the diff colormap
      // menu) so a unified harness drives either pane with one call.
      changeColormap: changeDiffColormap,
      // HOME reset (the pane's own `onReset` chain): restore the HOISTED compare
      // control (mode/kernel/split/blend, via the owner) AND re-seed the viewport's ONE
      // encoding — which, for a diff, IS the diff colormap → back to the kernel default.
      home: () => {
        const disableCompareHomeReset =
          typeof window !== "undefined" &&
          !!(window as unknown as { __cairnDisableCompareHomeReset?: boolean }).__cairnDisableCompareHomeReset;
        if (compareSource?.onCompareReset) {
          if (!disableCompareHomeReset) compareSource.onCompareReset();
        } else {
          setDiffKernel(localKernelMeta.default); // direct-pane fallback (no hoisted owner)
        }
        // HOME copies the CURRENTLY-VISIBLE face's defaults into the viewport's
        // one concrete encoding value (identical to double-click).
        assignVisibleFaceDefaultEncoding();
      },
    };
    return () => {
      if (el) delete el.__cairnImageDiffProbe;
    };
  }, [hasCompare, diffMode, compareOpMode, renderPass, diffKernel, resolvedKernelId, effectiveDiffColormap, effectiveTonemap, diffMetrics, diffSsim, splitPosition, changeSplit, naturalDims, refDims, overlayWindow, changeCompareMode, changeDiffKernel, changeDiffColormap, changeEncoding, setDiffKernel, localKernelMeta, enc, compareSource]);

  // TEST-ONLY seam for the IMAGE display encoding (the diff probe covers compare).
  // Lets a harness drive + read the plain-image colormap/curve pick WITHOUT a
  // fragile DOM menu click — the reg: a user's colormap pick must SURVIVE a
  // stacked/enlarge slot flip. No production code reads it (mirrors the diff probe).
  useEffect(() => {
    const el = paneRef.current as
      | (HTMLDivElement & { __cairnImagePaneProbe?: unknown })
      | null;
    if (!el) return;
    el.__cairnImagePaneProbe = {
      get encodingId() {
        return enc.encodingId;
      },
      get colormap() {
        return enc.colormap;
      },
      get controlledSurface() {
        return controlledSurface;
      },
      // PEAK is a viewport setting BEYOND the encoding — sampled to prove a stack
      // shares ALL settings across flips (reg b), not only encoding/diff-colormap.
      get peak() {
        return peak;
      },
      changePeak, // a user pick → the viewport's peak (a stack shares it across slots)
      changeEncoding, // a user pick → the viewport's encoding (a stack shares it across slots)
      home: () => assignVisibleFaceDefaultEncoding(), // HOME copies the visible face's defaults
    };
    return () => {
      if (el) delete (el as { __cairnImagePaneProbe?: unknown }).__cairnImagePaneProbe;
    };
  }, [enc.encodingId, enc.colormap, controlledSurface, peak, changePeak, changeEncoding, enc]);

  // The PlotToolbar + `useImageController` wiring (with `requestRender:
  // renderPass` so the screenshot forces a fresh WebGPU frame) and the
  // notation leading button now live in the shared `ImagePaneShell`.

  // TEV per-pixel value overlays: primary (`samplePixel`), diff readout
  // (`sampleDiffPixel`), and split/blend foreground (`sampleForeground`). The
  // read-only samplers over the retained CPU buffers live in `usePixelSamplers`.
  const { samplePixel, sampleDiffPixel, sampleForeground } = usePixelSamplers({
    hdrMode,
    naturalDims,
    sdrColormap,
    resolvedKernelId,
    hdrDataRef,
    sdrImageDataRef,
    refFloatRef,
    refU8Ref,
    diffSamplesRef,
    diffResultDimsRef,
  });

  // In-pane HISTOGRAM source — bins the RAW retained buffer (float scene values
  // in HDR mode, RGBA source bytes in SDR mode), NOT the display pixels. For a
  // DEEP EXR, `getDeepCsr` exports the samples for the per-pixel depth read-out.
  //
  // M2: the GPU computes at FULL pixel coverage through the pool
  // (`PaneHandle.computeHistogram` — value histogram over the pane's own source
  // texture; `computeDepthHistogram` — the alpha-weighted depth histogram over
  // the deep CSR). A `null` anywhere (no handle yet, >4 channels, kernel-less
  // device, GPU failure) resolves `null` and the panel stays on its CPU loop.
  // DEEP panes keep the CPU VALUE histogram (their pool texture is the z-window
  // composite, rewritten in place per window — see the pool's doc) and use the
  // GPU only for the depth histogram.
  const histogramSource = useMemo(() => {
    const gpuTev =
      (channelCount: number, u8Scale: boolean) =>
      async (series: HistogramSeriesSpec[]): Promise<TevHistogramsResult | null> => {
        const handle = paneHandleRef.current;
        const seriesWeights = seriesWeightsFor(series);
        if (!handle || !seriesWeights || channelCount > 4) return null;
        const pending = handle.computeHistogram({
          channelCount,
          seriesCount: series.length,
          seriesWeights,
          bins: TEV_HISTOGRAM_BINS,
          u8Scale,
        });
        if (!pending) return null;
        const raw = await pending.catch(() => null);
        return raw ? tevResultFromRawHistogram(raw, series, TEV_HISTOGRAM_BINS) : null;
      };
    if (hdrMode) {
      const hdr = hdrDataRef.current;
      if (!hdr) return undefined;
      const deep = (props as HdrImageProps).hdr?.deep;
      const base = floatHistogramSource(hdr, pixelDataVersion, deep ? () => deep.getGpuCsr() : undefined);
      if (deep) {
        return {
          ...base,
          computeDepthHistogram: async () => {
            const pending = paneHandleRef.current?.computeDepthHistogram(TEV_HISTOGRAM_BINS);
            if (!pending) return null;
            const raw = await pending.catch(() => null);
            return raw ? depthHistogramFromWeights(raw.zMin, raw.zMax, raw.weights, TEV_HISTOGRAM_BINS) : null;
          },
        };
      }
      return { ...base, computeTev: gpuTev(shapeDims(hdr.shape).c, false) };
    }
    const base = u8HistogramSource(sdrImageDataRef.current, pixelDataVersion);
    return { ...base, computeTev: gpuTev(4, true) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hdrMode, pixelDataVersion]);

  // -----------------------------------------------------------------------
  // COMPARE chrome (diff + Phase-3 compositor): the MODE menu + the mode's DISPLAY
  // menu, the caption(s), and the MSE/PSNR/MAE/SSIM metrics chip — all ride the
  // SAME shell seams the compare pane uses (`leadingMenus`, `extraChips`). Inert
  // (empty/undefined) when `!hasCompare`.
  // -----------------------------------------------------------------------
  const compareLeadingMenus = useMemo<ToolbarButtonSpec[]>(() => {
    if (!hasCompare) return [];
    // The ONE compare MODE menu (Slide · <kernels>), current value = the live
    // mode. onKernel switches INTO diff (an op-switch on the reused instance
    // — no remount, since [image, split, diff] all key `plot:image`).
    const modeMenu = buildCompareModeMenu({
      mode: compositorMode ? compareOpMode! : "diff",
      kernel: diffKernel,
      kernelOptions: listDiffMenuModes().map((k) => ({ id: k.id, label: k.label })),
      onSplit: () => changeCompareMode("split"),
      onKernel: (id) => {
        if (compositorMode) changeCompareMode("diff");
        changeDiffKernel(id);
      },
    });
    if (compositorMode) {
      // SPLIT composite LIGHT — the SAME unified image DISPLAY menu (curves;
      // luts gated off at k=3) as a plain image, so the composite is displayed
      // exactly as an image would be.
      return [modeMenu, displayToolbarButton({ value: enc.encodingId, ids: enc.ids, onSelect: changeEncoding })];
    }
    // DIFF: the scalar-error DISPLAY menu (None + colormap LUTs); no light curves.
    const displayMenu = compareDisplayToolbarButton({
      mode: "scalar",
      curveIds: [],
      curveValue: effectiveTonemap,
      lutValue: effectiveDiffColormap,
      onSelectCurve: () => {},
      onSelectLut: (id) => changeDiffColormap(id as Colormap),
    });
    return [modeMenu, displayMenu];
  }, [hasCompare, compositorMode, compareOpMode, diffKernel, effectiveDiffColormap, effectiveTonemap, enc.encodingId, enc.ids, changeEncoding, changeCompareMode, changeDiffKernel, changeDiffColormap]);

  // Captions (same DOM / selectors as `GpuComparePane`): diff → ONE bottom-left
  // "<metric> · <fg> compared to <ref>"; split/blend → REFERENCE bottom-left +
  // FOREGROUND bottom-right (the divider slides over them). The metrics chip
  // (all compare modes) sits bottom-right, stacked ABOVE the foreground caption
  // when present (`data-gpu-compare-metrics`, `data-cairn-compare-caption`).
  const compareCaps = hasCompare
    ? compareCaptions({
        mode: diffMode ? "diff" : compareOpMode!,
        diffKernel,
        referenceLabel: compareSource?.referenceLabel,
        foregroundLabel: compareSource?.foregroundLabel,
      })
    : { left: undefined, right: undefined };
  const metricsBottomClass = compareCaps.right ? "bottom-7" : "bottom-1";
  const compareChips = hasCompare ? (
    <>
      {/* REF badge: split only (the left-of-divider side IS the reference). */}
      {compareOpMode === "split" && <RefBadge />}
      {compareCaps.left ? (
        <LabelChip label={compareCaps.left} corner="bottom-left" attrs={{ "data-cairn-compare-caption": "reference" }} />
      ) : null}
      {compareCaps.right ? (
        <LabelChip label={compareCaps.right} corner="bottom-right" attrs={{ "data-cairn-compare-caption": "foreground" }} />
      ) : null}
      {diffMetrics && (
        <span
          className={`absolute right-1 z-30 rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${metricsBottomClass}`}
          data-gpu-compare-metrics
        >
          MSE {diffMetrics.mse.toExponential(2)} · PSNR{" "}
          {Number.isFinite(diffMetrics.psnr) ? diffMetrics.psnr.toFixed(1) : "∞"} dB · MAE {diffMetrics.mae.toExponential(2)} ·
          SSIM {formatSsim(diffSsim)}
        </span>
      )}
    </>
  ) : undefined;

  // -----------------------------------------------------------------------
  // Render.
  // -----------------------------------------------------------------------
  const showAxes = props.showAxes ?? false;
  const label = hdrMode ? ((props as HdrImageProps).label ?? "") : (props as SdrImageProps).label;
  const interpolation = props.interpolation ?? "auto";
  const imgRendering = interpolation === "auto" ? undefined : interpolation;
  // Detection overlays composite over the display surface regardless of dtype —
  // read from the unified props on BOTH the float (HDR) and uint8 (SDR) paths
  // (M7 fix: the old `hdrMode ? undefined` null-out silently dropped boxes/masks
  // on the float surface, exactly where per-region overlays matter most). Both
  // union members declare `overlay`/`overlaySettings`, so no dtype cast is needed.
  const overlay = props.overlay;
  const overlaySettings = props.overlaySettings;
  const isDraggable = hdrMode ? false : ((props as SdrImageProps).isDraggable ?? false);
  const onDragStart = hdrMode ? undefined : (props as SdrImageProps).onDragStart;

  // C1 fix (whole-branch review) — engine bailout: the GPU backend self-heals
  // to the CPU backend (`CpuImagePane`) on any activation/render hard
  // failure. Both backends accept the SAME `ImageBackendProps` union (see
  // `renderers/image-backend.ts`), so the props forward verbatim and the
  // image still renders — never a blank card. Placed after every hook above
  // runs unconditionally (rules-of-hooks) but before this component paints
  // its own GPU canvas.
  if (engineFailed) {
    // Forward the UNIFIED props verbatim — CpuImagePane accepts the same
    // `ImageBackendProps` and reconstructs its own internal representation.
    return <CpuImagePane {...backendProps} />;
  }

  // The image quad is placed inside the FULL-viewport canvas by
  // `viewportToUvRect` (letterboxed at rest, filling/pannable at any zoom); the
  // canvas is always `w-full h-full` of the shell's wrapper (no inline size /
  // object-fit — only its device-pixel backing store is set imperatively, in
  // the render-pass effect above). The checkerboard lives on that padding-free
  // wrapper (`checkerboard="wrapper"`, Q26) so it shows ONLY where the quad
  // doesn't cover the canvas (letterbox margins / under-zoomed pan), never as a
  // fixed border in the axis gutter.
  const overlayNode =
    overlay &&
    overlaySettings?.enabled &&
    naturalDims &&
    ((overlay.boxes?.length ?? 0) > 0 || (overlay.masks?.length ?? 0) > 0) ? (
      <ImageOverlay
        data={overlay}
        settings={overlaySettings}
        naturalWidth={naturalDims.w}
        naturalHeight={naturalDims.h}
      />
    ) : undefined;

  return (
    <ImagePaneShell
      paneAttrs={{ "data-gpu-image-pane": "", "data-gpu-backend-ready": paneReady }}
      viewportAttrs={{ "data-gpu-image-viewport": "" }}
      toolbar={toolbar}
      paneRef={paneRef}
      wrapperRef={imgWrapperRef}
      zoom={zoom}
      pan={pan}
      onViewportChange={onViewportChange}
      naturalDims={naturalDims}
      checkerboard="wrapper"
      wrapperClassName="relative w-full h-full flex items-center justify-center"
      // COMPOSITOR: zero padding + no axis gutter, so the divider (a child of the
      // wrapper, `left:split%`) and the shader's screen-space `uv.x < split` agree
      // by construction (matching `GpuComparePane`).
      viewportPadding={!compositorMode && showAxes && naturalDims ? "16px 4px 4px 28px" : 0}
      surface={
        <>
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ imageRendering: imgRendering }}
            data-gpu-image-canvas
            data-gpu-compare-canvas={compositorMode ? "" : undefined}
          />
          {/* Full-height gapless split divider — drives the `contentParam` uniform
              via `changeSplit`. Double-click resets to 0.5. Ported from
              `GpuComparePane` (SplitDivider is the single source of truth). */}
          {compareOpMode === "split" && (
            <SplitDivider splitPosition={splitPosition} onChange={changeSplit} onReset={() => changeSplit(0.5)} />
          )}
        </>
      }
      showAxes={showAxes && !compositorMode}
      overlayNode={overlayNode}
      overlay={
        compositorMode
          ? {
              // COMPOSITOR per-side TEV overlays (the #88 fix). split → each side
              // clipped at the divider: LEFT (uv.x < split) = REFERENCE (slot a =
              // `source`, framing grid = identity), RIGHT = FOREGROUND (slot b =
              // `compareSource.b`, its OWN grid via `sourceDims={refDims}` — so its
              // numbers land on ITS pixels even when the two resolutions differ,
              // instead of drifting through the framing grid). blend → the single
              // foreground overlay. The shell owns notation / active state.
              render: ({ notation, setOverlayActive }) =>
                compareOpMode === "split" ? (
                  <>
                    {naturalDims && (
                      <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: `inset(0 ${(1 - splitPosition) * 100}% 0 0)` }}
                      >
                        <PixelValueOverlay
                          imageElRef={canvasRef}
                          naturalWidth={naturalDims.w}
                          naturalHeight={naturalDims.h}
                          zoom={zoom}
                          pan={pan}
                          sourceWindow={overlayWindow}
                          // REFERENCE side = the primary/framing footprint → identity.
                          sourceDims={naturalDims}
                          sample={samplePixel}
                          notation={notation}
                          version={pixelDataVersion}
                        />
                      </div>
                    )}
                    {naturalDims && refDims && (
                      <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: `inset(0 0 0 ${splitPosition * 100}%)` }}
                      >
                        <PixelValueOverlay
                          imageElRef={canvasRef}
                          naturalWidth={naturalDims.w}
                          naturalHeight={naturalDims.h}
                          zoom={zoom}
                          pan={pan}
                          sourceWindow={overlayWindow}
                          // FOREGROUND side = its OWN grid (mismatched-res #88 fix).
                          sourceDims={refDims}
                          sample={sampleForeground}
                          notation={notation}
                          version={refUploadVersion + pixelDataVersion}
                          onActiveChange={setOverlayActive}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  naturalDims &&
                  refDims && (
                    <PixelValueOverlay
                      imageElRef={canvasRef}
                      naturalWidth={naturalDims.w}
                      naturalHeight={naturalDims.h}
                      zoom={zoom}
                      pan={pan}
                      sourceWindow={overlayWindow}
                      sourceDims={refDims}
                      sample={sampleForeground}
                      notation={notation}
                      version={refUploadVersion + pixelDataVersion}
                      onActiveChange={setOverlayActive}
                    />
                  )
                ),
            }
          : {
              displayElRef: canvasRef,
              // DIFF mode prints the metric values (cpu twin / result readback); the
              // version bumps on kernel switches so the numbers track the selected metric.
              sample: diffMode ? sampleDiffPixel : samplePixel,
              version: diffMode ? diffOverlayVersion : pixelDataVersion,
              hasSource: true,
              sourceWindow: overlayWindow,
            }
      }
      notationSeed={props.pixelValueNotation ?? "decimal"}
      exportCanvasRef={canvasRef}
      requestRender={renderPass}
      // Histogram button: suppressed for a compare (a scalar error has no channel
      // histogram). Plain images — including an image slot in a mixed stack — keep it.
      enlargeControl={backendProps.enlargeControl}
      histogram={hasCompare ? undefined : histogramSource}
      depthWindow={deepFlatten.hasDeep ? deepFlatten.window : undefined}
      infoPanelSetting={synced?.infoPanel}
      onInfoPanelChange={changeInfoPanel}
      // UNIFIED DISPLAY menu (Phase 3): ONE arity-gated dropdown (CURVES /
      // COLORMAPS / REMAPS sections) replaces the separate colormap + tonemap
      // menus. Selecting a LUT deactivates the curve and vice-versa structurally
      // (`enc` owns the single `encoding` id); the float pane gates luts to k=1
      // and `normal` to k=3, the 8-bit pane offers the full applicable set.
      leadingMenus={
        hasCompare
          ? // COMPARE (diff OR split/blend): the MODE menu + the mode's DISPLAY menu.
            [...(props.channelMenu ? [props.channelMenu] : []), ...compareLeadingMenus]
          : [
              // CHANNELS (EXR part/layer) menu, owner-supplied — leading, like the rest.
              ...(props.channelMenu ? [props.channelMenu] : []),
              displayToolbarButton({ value: enc.encodingId, ids: enc.ids, onSelect: changeEncoding }),
            ]
      }
      // SECOND-ROW segmented controls (controls-row-separation directive): the
      // multi-channel REDUCE (Lum·Mean) picker lives in the second toolbar row
      // alongside EV/OFF/PK/γ. Shown while a lut is active AND the source has >1
      // channel (the reduction is moot for a scalar). (The norm Lin·Log·Pow picker
      // was REMOVED — norm-UI-removal follow-up.)
      rowSegments={[
        // The diff error is a k=1 scalar (reduce mean) — no reduce picker in diff mode.
        ...(!diffMode && enc.hasParam("reduce") && sourceArity > 1 ? [reduceSegment(effectiveReduce, changeReduce)] : []),
      ]}
      // EXPOSURE / OFFSET display-adjust sliders — the GPU shader applies them
      // in-pass (both HDR and SDR paths). Gated by the ACTIVE encoding's param
      // manifest: shown for curves + luts (which declare exposure/offset), hidden
      // for the paramless `normal` remap.
      displayAdjust={
        // DIFF: EV/OFF are always shown (they scale the colormap SENSITIVITY of the
        // raw metric before the LUT — display-only, never a diff recompute).
        diffMode
          ? {
              exposureEV: displayEV,
              offset: displayOffset,
              onExposureChange: changeExposure,
              onOffsetChange: changeOffset,
            }
          : // EV/OFF are the DEFAULT sensitivity skin — hidden when the min/max
            // BOUNDS skin is engaged (they are alternatives over ONE affine, never
            // both; the bounds sliders below replace them). Also hidden for the
            // paramless `normal` remap (no exposure param).
            enc.hasParam("exposure") && !boundsEngaged
            ? {
                exposureEV: displayEV,
                offset: displayOffset,
                onExposureChange: changeExposure,
                onOffsetChange: changeOffset,
              }
            : undefined
      }
      // PEAK is the HDR MODE — shown while the real HDR surface engaged AND the
      // active encoding is a CURVE (every curve respects `P` as its ceiling; the
      // paramless `normal` remap and colormap LUTs have no peak). γ rides the
      // active encoding's manifest (only the Gamma curve declares it).
      extraSliders={diffMode ? [] : [
        // PEAK is the CURVE family's HDR ceiling — hidden for the gray-none DATA
        // path (a scalar as data has no tone-map ceiling; its raw value rides the
        // output-encode unclamped), the `normal` remap, and colormap LUTs.
        ...((hdrMode || sdrPlain) && hdrEngaged && activeRespectsPeak && !scalarNoneData
          ? [
              {
                id: "peak",
                label: "PK",
                title:
                  "Peak white (×SDR white) — the HDR ceiling P every operator clips at (Linear/sRGB/Gamma hard-clip at P; Reinhard/ACES roll off toward P). P=1 reproduces the SDR rendition exactly; double-click to type a value, including 'inf' for the raw browser-clipped extended look.",
                min: EXTENDED_TONEMAP_PEAK_MIN,
                max: EXTENDED_TONEMAP_PEAK_MAX,
                step: EXTENDED_TONEMAP_PEAK_STEP,
                value: peak,
                onChange: changePeak,
                format: (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}×` : "∞"),
              },
            ]
          : []),
        ...((hdrMode || sdrPlain) && enc.hasParam("gamma")
          ? [
              {
                id: "gamma",
                label: "γ",
                title:
                  "Display gamma γ for the Gamma transfer — display = clamp(value)^(1/γ), tev-style. Default 2.2 (close to sRGB, not identical). Double-click to type a value.",
                min: TONEMAP_GAMMA_MIN,
                max: TONEMAP_GAMMA_MAX,
                step: TONEMAP_GAMMA_STEP,
                value: tonemapGamma,
                onChange: changeGamma,
                format: (v: number) => v.toFixed(1),
              },
            ]
          : []),
        // (The power-NORM exponent `exp` slider was REMOVED with the norm picker —
        // norm-UI-removal follow-up. The Gamma-curve γ slider above is unaffected.)
        // MIN/MAX BOUNDS sliders (Phase 4) — the bounds-first, data-speak skin,
        // shown INSTEAD of EV/OFF when the descriptor `colorRange` seeds a lut.
        ...(boundsEngaged && colorBounds
          ? [
              {
                id: "colorMin",
                label: "min",
                title: "Colormap domain minimum — the data value that maps to the bottom of the ramp.",
                min: boundsRange.lo - boundsRange.span,
                max: boundsRange.hi,
                step: boundsRange.span / 100,
                value: colorBounds[0],
                onChange: (v: number) => changeBounds([v, colorBounds[1]]),
                format: (v: number) => v.toPrecision(3),
              },
              {
                id: "colorMax",
                label: "max",
                title: "Colormap domain maximum — the data value that maps to the top of the ramp.",
                min: boundsRange.lo,
                max: boundsRange.hi + boundsRange.span,
                step: boundsRange.span / 100,
                value: colorBounds[1],
                onChange: (v: number) => changeBounds([colorBounds[0], v]),
                format: (v: number) => v.toPrecision(3),
              },
            ]
          : []),
      ]}
      // DEEP depth-window sliders + region-select (HDR deep sources only). Their
      // reset/modified fold into the colormap/tonemap/peak ones so HOME clears all.
      depthSliders={deepFlatten.sliders}
      regionSelect={
        deepActive
          ? {
              rect: deepFlatten.region,
              queryLive: deepFlatten.queryRegionWindow,
              commit: deepFlatten.commitRegion,
              remove: deepFlatten.removeRegion,
            }
          : undefined
      }
      onReset={() => {
        assignVisibleFaceDefaultEncoding();
        {
          // HOME is a GROUP action: publish the clicked viewport's IMAGE/DIFF
          // DEFAULTS by value so every synced member resets to them, and so a
          // re-lowered/remounted pane adopts the RESET state (not the group's
          // stale pre-HOME snapshot — the second-double-click colormap bug).
          const homeColormap = (
            diffMode
              ? ((diffSeedColormap ?? kernelDefaultColormap(localKernelMeta.default)) as Colormap)
              : propColormap
          ) as Colormap;
          const homeEncoding = diffMode
            ? deriveCompareEncodingId("scalar", effectiveTonemap, homeColormap)
            : homeColormap !== "none"
              ? homeColormap
              : resolveDefaultCurve(propTonemap);
          publishSettings({
            encoding: homeEncoding,
            peak: peakSeed,
            tonemapGamma: gammaSeed,
            exposureEV: 0,
            offset: 0,
            reduce: activeIsTurbo ? "mean" : defaultReduceMode(sourceArity),
            ...(boundsSeedVal
              ? { colorMin: boundsSeedVal[0], colorMax: boundsSeedVal[1] }
              : // Explicit `undefined` CLEARS the pair in the store (flat merge),
                // so HOME turns the bounds skin off, not "keeps the old pair".
                { colorMin: undefined, colorMax: undefined }),
            // HOME clears the explicit info-panel choice → back to AUTO.
            infoPanel: undefined,
          });
        }
        deepFlatten.reset();
        props.onChannelReset?.(); // channel override folds into HOME
        // COMPARE HOME: the VIEW MODE / kernel / split / blend live in the owner's
        // hoisted `useCompareControl` (out of this pane's reach), so route their
        // reset back through the owner — the old `GpuComparePane` reset the MODE too
        // (`setCompareMode(compareModeMeta.default)`); hoisting the mode dropped it
        // from the pane HOME. A diff↔slide transition re-lowers via `NodeDispatch`.
        if (hasCompare) {
          const disableCompareHomeReset =
            typeof window !== "undefined" &&
            !!(window as unknown as { __cairnDisableCompareHomeReset?: boolean }).__cairnDisableCompareHomeReset;
          if (compareSource?.onCompareReset) {
            // Descriptor path: the owner resets mode + kernel + split + blend.
            if (!disableCompareHomeReset) compareSource.onCompareReset();
          } else {
            // Direct-pane fallback (cross-type card / diff harness — no hoisted
            // owner): the mode is fixed by the caller, so reset only the local kernel.
            setDiffKernel(localKernelMeta.default);
          }
        }
        // The diff colormap is DERIVED from `enc`, and the HOME publish above wrote
        // the kernel-default encoding into the store — no explicit diff reset.
      }}
      extraModified={
        // `enc.encodingModified` covers BOTH the image encoding AND (in diff mode) the
        // diff colormap — they are one store now.
        enc.encodingModified ||
        peakModified ||
        gammaModified ||
        effectiveReduce !== reduceDefault ||
        boundsModified ||
        deepFlatten.isModified ||
        !!props.channelModified ||
        (hasCompare && !!compareSource?.compareModified)
      }
      // DIFF: the caption chip (in `extraChips`) carries the labeling, so the
      // shell's own bottom-left LabelChip is suppressed.
      label={hasCompare ? "" : label}
      showLabelChip={!hasCompare && !!label}
      extraChips={compareChips}
      isDraggable={isDraggable}
      onDragStart={onDragStart}
    />
  );
}

// Compile-time contract check: GpuImagePane implements the shared backend
// interface (`renderers/image-backend.ts`) — interchangeable with CpuImagePane.
const _backendCheck: ImageBackend = GpuImagePane;
void _backendCheck;
