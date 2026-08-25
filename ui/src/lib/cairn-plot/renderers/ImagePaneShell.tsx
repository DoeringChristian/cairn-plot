/**
 * ImagePaneShell — the ONE shared frame every image viewer pane renders inside.
 *
 * cairn-plot ships two panes that are both "an image in a zoom/pan viewport
 * with a toolbar, a TEV pixel-value overlay and a label chip", differing only
 * in HOW they put pixels on screen:
 *   - `renderers/CpuImagePane.tsx`  — 2D-canvas / `<img>` + CSS-transform zoom.
 *   - `renderers/GpuImagePane.tsx`  — WebGPU engine, zoom via a sampled uvRect;
 *     also owns the split/diff compositor (content-op unification, Phase
 *     4 — the standalone `media-compare/GpuComparePane.tsx` it replaced is gone).
 * Everything AROUND the pixels — the pane root, the `useImageViewport`
 * wheel/drag/dblclick wiring, the `PlotToolbar` + `useImageController` adapter
 * (with the pixel-notation leading button), the `PixelValueOverlay` mount +
 * notation/active state, the `PixelAxes` + `ImageOverlay` mounts, the
 * checkerboard/letterbox container and the `LabelChip` — used to be copy-pasted
 * into all three. This component owns that plumbing ONCE; each pane keeps only
 * its genuine rendering logic and expresses its differences through the narrow
 * contract below.
 *
 * ## The contract (what a pane supplies, and why each knob exists)
 * Identity / DOM (test selectors + tailwind `group` hover depend on these, so
 * they stay per-pane):
 *   - `paneAttrs` / `viewportAttrs` — the `data-*` markers spread onto the root
 *     and the viewport box (`data-cpu-image-pane`, `data-gpu-image-pane` +
 *     `data-gpu-backend-ready`, `data-gpu-compare-pane` + `data-gpu-compare-ready`,
 *     and the matching `…-viewport` attrs). Boolean-valued attrs (the `…-ready`
 *     ones) render as `"true"`/`"false"` exactly as before.
 *   - the `group` class + the `PlotToolbar` render both key off `toolbar`
 *     (the OFFICIAL host seam — `false` hides the toolbar so a host can drive the
 *     view from its own menu; default `true`). ALL THREE panes take a
 *     `toolbar?: boolean` prop that funnels here, so the hidden-toolbar convention
 *     is identical everywhere: NO `PlotToolbar`, NO hover `group`, and the ONLY
 *     floating affordance kept is the `PixelNotationToggle` chip while the TEV
 *     overlay is active (below). See docs/API.md "Host-controlled panes".
 *
 * Refs — the pane OWNS `paneRef` (the padded viewport box, measured by the GPU
 * render passes for uvRect/backing-store sizing, and by `useImageViewport` /
 * `useImageController`) and `wrapperRef` (the padding-free content box PixelAxes
 * measures). The shell only ATTACHES them, so a pane's own effects keep reading
 * their live rects unchanged.
 *
 * Container geometry (the letterbox math that legitimately differs per backend):
 *   - `checkerboard: "pane" | "wrapper"` — where `cairn-checkerboard` lives
 *     (CPU/compare on the padded pane; GPU-image on the padding-free wrapper,
 *     per its Q26 fix).
 *   - `wrapperClassName` — CPU's transform wrapper (`relative w-full h-full`)
 *     vs the GPU panes' flex-centred wrapper.
 *   - `wrapperStyle` — CPU's `transform: translate(pan) scale(zoom)`; unset for
 *     the GPU panes (they zoom in the shader, the wrapper never transforms).
 *   - `viewportPadding` — the axis gutter (`showAxes`) vs the per-pane base pad.
 *
 * Surface + overlays:
 *   - `surface` — the pane's own `<img>`/`<canvas>` (+ compare's split divider),
 *     placed inside the wrapper. Carries the per-pane canvas `data-*` markers.
 *   - `showAxes` + `naturalDims` gate the shared `PixelAxes`; `overlayNode` is
 *     the optional `ImageOverlay` (boxes/masks), both inside the wrapper.
 *   - `overlay` (a discriminated union) is the TEV `PixelValueOverlay`: the
 *     `single` variant is the shared one-overlay mount (CPU + GPU-image, which
 *     differ only in `displayElRef`/`sourceWindow`/`hasSource`); the `render`
 *     variant lets the compare pane emit its own per-side split-clipped
 *     overlays while the shell still owns the `notation`/`overlayActive` state.
 *
 * Toolbar / controller:
 *   - `exportCanvasRef` is the controller's screenshot target; `requestRender`
 *     is the GPU panes' synchronous repaint (undefined on CPU) — both forwarded
 *     verbatim into `useImageController`.
 *
 * Chips: `label` + `showLabelChip` drive the shared bottom-left `LabelChip`;
 * `extraChips` is the compare pane's REF / metrics / custom-label slot.
 *
 * ## State the shell owns (so no pane duplicates it)
 * `notation` (seeded from `notationSeed`) and `overlayActive`. These feed the
 * toolbar's notation leading button, the CPU shims' floating `PixelNotationToggle`
 * (only when `toolbar={false}`), and the `PixelValueOverlay` — the pane's
 * `sample` callback receives the current notation as an argument, so it stays
 * stateless w.r.t. notation.
 */
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  screenPerTexel,
  screenRectToTexelRect,
  screenToTexel,
  texelRectToScreenRect,
  type SourceWindow,
  type TexelRect,
} from "./region-select";
import ImageInfoPanel, {
  INFO_PANEL_W,
  type HistogramSource,
} from "../primitives/ImageInfoPanel";
import { applyRectEdit, RESIZE_HANDLES, type RegionHandle } from "./region-edit";
import PixelAxes from "../primitives/PixelAxes";
import LabelChip from "../primitives/LabelChip";
import type { ToolbarButtonSpec, ToolbarSliderSpec, ToolbarSegmentSpec } from "../controls/ToolbarConfig";
import PixelValueOverlay, {
  PixelNotationToggle,
  type PixelSampler,
  type PixelValueNotation,
} from "../primitives/PixelValueOverlay";
import PlotToolbar from "../primitives/PlotToolbar";
import {
  useImageViewport,
  useReframeViewportOnResize,
  type Viewport as ImageViewport,
} from "../hooks/use-image-viewport";
import {
  useImageController,
  IMAGE_TOOLBAR_CONFIG,
  notationToolbarButton,
} from "./use-image-controller";
import FullscreenOverlayShell from "../primitives/FullscreenOverlayShell";

/** Controlled fullscreen state — see `ImagePaneShellProps.enlargeControl`. */
export interface EnlargeControl {
  enlarged: boolean;
  setEnlarged: (v: boolean) => void;
}
import { EnlargeInterceptContext } from "./enlarge-intercept";
import { usePublishNaturalSize } from "./natural-size-report";

const HOME_VIEWPORT: ImageViewport = { zoom: 1, pan: { x: 0, y: 0 } };

/** `data-*` markers spread onto the root / viewport box. Boolean values render
 *  as `"true"`/`"false"` (the `…-ready` attrs); `""` marks a bare attribute. */
export type PaneDataAttrs = Record<string, string | boolean>;

/**
 * EXPOSURE / OFFSET display-adjust wiring (image panes only). The PANE owns the
 * `exposureEV`/`offset` state (so it can feed them straight into its own render
 * pass — display-only, never a diff recompute) and passes the current values +
 * setters here; the shell renders them as the toolbar's SECOND slider row (which
 * folds into the overflow menu on a narrow pane). Omitted by panes/sub-paths
 * that can't apply the adjustment (e.g. the CPU SDR `<img>` path) — the slider
 * row is then simply absent. */
export interface ImageDisplayAdjust {
  /** Exposure in EV stops (color * 2^EV). Slider range -8..+8, default 0, but
   *  any finite value is legal (manual toolbar entry can exceed the range). */
  readonly exposureEV: number;
  /** Additive offset applied AFTER exposure. Slider range -1..+1, default 0, but
   *  any finite value is legal (manual toolbar entry can exceed the range). */
  readonly offset: number;
  readonly onExposureChange: (ev: number) => void;
  readonly onOffsetChange: (offset: number) => void;
}

/** Context the shell hands a custom-overlay renderer — it owns notation/active
 *  state, so the pane reads them from here rather than duplicating them. */
export interface ImagePaneOverlayContext {
  readonly notation: PixelValueNotation;
  readonly setOverlayActive: (active: boolean) => void;
}

/**
 * The TEV pixel-value overlay contract. `single` is the shared one-overlay
 * mount (CPU + GPU-image); `render` is the escape hatch for the compare pane's
 * per-side split-clipped overlays.
 */
export type ImagePaneOverlaySpec =
  | {
      /** The displayed `<img>`/`<canvas>` whose live rect the overlay reads. */
      readonly displayElRef: RefObject<HTMLElement | null>;
      /** Per-pixel value accessor over the RAW source buffer. */
      readonly sample: PixelSampler;
      /** Bumped when the underlying source buffer changes (forces a redraw). */
      readonly version: number;
      /** Overlay gate beyond `naturalDims` (CPU: `!!imageUrl`; GPU: `true`). */
      readonly hasSource: boolean;
      /** The GPU panes' displayed crop; CPU omits it (its element grows via
       *  the CSS transform, so `getBoundingClientRect` already encodes zoom). */
      readonly sourceWindow?: { x: number; y: number; w: number; h: number };
    }
  | {
      /** Emit a bespoke overlay tree (compare's per-side overlays). */
      readonly render: (ctx: ImagePaneOverlayContext) => ReactNode;
    };

export interface ImagePaneShellProps {
  // --- identity / DOM ------------------------------------------------------
  /** `data-*` markers for the root element. */
  paneAttrs: PaneDataAttrs;
  /** `data-*` markers for the viewport (pointer/wheel) element. */
  viewportAttrs: PaneDataAttrs;
  /** Render the `PlotToolbar` (and add the `group` hover class). The OFFICIAL
   *  host seam: `false` hides the toolbar (host-driven view) — the shell then
   *  renders only the floating `PixelNotationToggle` while the TEV overlay is
   *  active. All three panes forward their own `toolbar?: boolean` here. Default
   *  at the pane boundary is `true`; the shell prop is required (panes resolve it). */
  toolbar: boolean;

  // --- refs (pane-owned; the shell only attaches them) ---------------------
  /** The padded viewport box — pointer target + GPU render-pass measurement. */
  paneRef: RefObject<HTMLDivElement>;
  /** The padding-free content box — PixelAxes / letterbox measurement. */
  wrapperRef: RefObject<HTMLDivElement>;

  // --- viewport ------------------------------------------------------------
  zoom: number;
  pan: { x: number; y: number };
  onViewportChange?: (v: ImageViewport) => void;
  /** Source pixel size — enables the adaptive max-zoom cap + gates overlays. */
  naturalDims: { w: number; h: number } | null;

  // --- container geometry --------------------------------------------------
  checkerboard: "pane" | "wrapper";
  wrapperClassName: string;
  wrapperStyle?: CSSProperties;
  viewportPadding: string | number;

  // --- surface + in-wrapper overlays ---------------------------------------
  /** Rendered before the pane box (the CPU SDR branch's `GammaFilterSvg`). */
  header?: ReactNode;
  /** The pane's `<img>`/`<canvas>` (+ compare's split divider). */
  surface: ReactNode;
  showAxes: boolean;
  /** Optional `ImageOverlay` (boxes/masks), inside the transformed wrapper. */
  overlayNode?: ReactNode;

  // --- TEV pixel-value overlay ---------------------------------------------
  overlay: ImagePaneOverlaySpec;
  notationSeed: PixelValueNotation;

  // --- toolbar / controller ------------------------------------------------
  /** The controller's preferred screenshot target. */
  exportCanvasRef?: RefObject<HTMLCanvasElement | null>;
  /** The pane's synchronous repaint, so `toPNG` gets a fresh WebGPU frame. */
  requestRender?: () => void;
  /** Pane-supplied LEADING toolbar buttons/menus (the diff-mode + colormap
   *  dropdowns). Rendered before the notation button, so they sit leftmost and
   *  never shift the corner-anchored standard buttons. Only shown when the
   *  toolbar itself renders (`toolbar={true}`). */
  leadingMenus?: ToolbarButtonSpec[];
  /** EXPOSURE / OFFSET display-adjust sliders (image panes; see
   *  {@link ImageDisplayAdjust}). When omitted, the second slider row is absent.
   *  Only shown when the toolbar itself renders (`toolbar={true}`). */
  displayAdjust?: ImageDisplayAdjust;
  /** DEEP EXR depth-WINDOW sliders (Z-NEAR + Z-FAR, `useDeepFlatten`) —
   *  prepended to the slider row when present. Their `reset()`/`isModified` ride
   *  the `onReset`/`extraModified` contract below, like the display-adjust ones. */
  depthSliders?: ToolbarSliderSpec[];
  /** DEEP region-select ("select depth from region"). When present, a leading
   *  marquee toolbar button activates a one-shot crosshair drag; on release the
   *  drawn rect is mapped to image texels and `commit`ted. A committed `rect`
   *  (image texels) then PERSISTS as an editable overlay anchored in image space
   *  (moves/resizes with the viewport), whose edits re-`commit` and whose × chip
   *  calls `remove`. Only wired for the `single` overlay variant (deep panes). */
  regionSelect?: {
    /** The persisted rect in image texels (null = none drawn yet). */
    rect: { x0: number; y0: number; x1: number; y1: number } | null;
    /** Live (coalesced) window update while drawing/moving/resizing — sets the Z
     *  window from the rect's sample range (empty region ⇒ empty window). Does
     *  NOT persist the rect. */
    queryLive: (x0: number, y0: number, x1: number, y1: number) => void;
    /** Finalize a rect (release): persist it + set the window. Empty is valid. */
    commit: (x0: number, y0: number, x1: number, y1: number) => void;
    /** ×: drop the rect + reset only the Z window to full. */
    remove: () => void;
  };
  /** Extra pane-supplied slider rows APPENDED after the EXPOSURE/OFFSET pair
   *  (e.g. the HDR PEAK slider, shown only while an extended roll-off operator
   *  is selected). The pane owns their value/reset — their `reset`/`isModified`
   *  ride the `onReset`/`extraModified` contract below, like the others. */
  extraSliders?: ToolbarSliderSpec[];
  /** Second-row SEGMENTED controls (the DATA-encoding norm + multi-channel reduce
   *  pickers) rendered at the LEADING edge of the second row BEFORE the sliders —
   *  a compact discrete-choice control that lives alongside EV/OFF/PK/γ rather
   *  than next to the DISPLAY menu (per the controls-row-separation directive).
   *  Folds into the overflow menu as rows like the sliders. Only shown when the
   *  toolbar itself renders (`toolbar={true}`). */
  rowSegments?: ToolbarSegmentSpec[];
  /** Extra host-pane reset run by HOME / double-click alongside the viewport +
   *  slider reset — a compare pane restores its colormap / view-mode / kernel
   *  to the descriptor defaults here. */
  onReset?: () => void;
  /** Host-pane "off default" flag (compare: colormap/mode/kernel differ from
   *  the descriptor) — folded into the HOME button's enabled state. */
  extraModified?: boolean;

  /**
   * CONTROLLED single-pane fullscreen state. The plot leaf (`LeafView`) owns
   * the flag ABOVE the async-resolve swap boundary, so a cold re-resolve
   * (channel pick → "Loading…" placeholder → this subtree unmounts) cannot
   * reset it — the pane re-enters fullscreen when it remounts. Absent (a
   * storeless host mount) → shell-local state, unchanged behavior.
   */
  enlargeControl?: EnlargeControl;

  // --- in-pane INFO PANEL --------------------------------------------------
  /** When supplied, an INFO-PANEL toggle button is added to the toolbar and the
   *  sectioned info panel (stats + tev-parity histogram + read-outs) is pinned
   *  to the pane's top-right (below the toolbar). The pane closes `readChannel`
   *  over its own decoded buffer (no server); see
   *  `primitives/ImageInfoPanel.tsx`. Only wired for the `single` overlay
   *  variant (the cursor read-out reuses its displayElRef/sourceWindow
   *  screen→texel mapping). Absent = no panel. */
  histogram?: HistogramSource;
  /** DEEP-Z only: the LIVE depth window `[zNear, zFar]` (the toolbar sliders /
   *  region select) — drawn as limit marks on the info panel's depth
   *  histogram. Absent = no marks. */
  depthWindow?: { zNear: number; zFar: number };
  /** The viewport's `infoPanel` SETTING (from the settings stack): `true`/
   *  `false` = an explicit user choice (synced, transient per layer);
   *  `undefined` = AUTO — the panel shows iff its footprint stays within 25%
   *  of the pane's width, re-evaluated live on resize. */
  infoPanelSetting?: boolean;
  /** Write the setting on a toggle (the pane routes this into its settings
   *  stack). Absent (a storeless host mount) → a local override is kept. */
  onInfoPanelChange?: (open: boolean) => void;

  // --- chips ---------------------------------------------------------------
  label: string;
  showLabelChip: boolean;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  /** Compare's REF / metrics / custom-label chips (rendered on the root). */
  extraChips?: ReactNode;
}

export default function ImagePaneShell({
  paneAttrs,
  viewportAttrs,
  toolbar,
  paneRef,
  wrapperRef,
  zoom,
  pan,
  onViewportChange,
  naturalDims,
  checkerboard,
  wrapperClassName,
  wrapperStyle,
  viewportPadding,
  header,
  surface,
  showAxes,
  overlayNode,
  overlay,
  notationSeed,
  exportCanvasRef,
  requestRender,
  leadingMenus,
  displayAdjust,
  depthSliders,
  extraSliders,
  rowSegments,
  regionSelect,
  onReset,
  extraModified,
  enlargeControl,
  histogram,
  depthWindow,
  infoPanelSetting,
  onInfoPanelChange,
  label,
  showLabelChip,
  isDraggable = false,
  onDragStart,
  extraChips,
}: ImagePaneShellProps) {
  // Report the source (natural) pixel dims UP to any enclosing framing wrapper
  // (the default `ContentAspectFrame` / the selection stage), so the pane's BOX
  // can track the CONTENT aspect. No-op when there is no listener (the default),
  // so a pane rendered bare behaves exactly as before.
  usePublishNaturalSize(naturalDims);

  // Notation is owned locally (seeded from the prop) so the pane is
  // self-contained; the toggle shows only while the overlay is active.
  const [notation, setNotation] = useState<PixelValueNotation>(notationSeed);
  const [overlayActive, setOverlayActive] = useState(false);
  // DEEP region-select ("select depth from region") — a one-shot marquee draw
  // mode. Any region is valid (an empty one selects an empty Z window). Only the
  // `single` overlay variant exposes the displayElRef/sourceWindow mapping needs.
  const [regionActive, setRegionActive] = useState(false);
  const singleOverlay = "render" in overlay ? null : overlay;
  const regionAvailable = !!regionSelect && !!singleOverlay;

  // In-pane HISTOGRAM: an optional multi-channel histogram panel toggled from
  // the toolbar. Available only for the `single` overlay variant (its
  // displayElRef/sourceWindow give the cursor read-out's screen→texel mapping).
  const histogramAvailable = !!histogram && !!singleOverlay;
  // INFO-PANEL visibility (spec §2): explicit SETTING (store) > local override
  // (storeless host fallback) > AUTO (footprint ≤ 25% of the live pane width).
  const [paneW, setPaneW] = useState(0);
  useEffect(() => {
    const el = paneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setPaneW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paneRef]);
  const [localInfoOverride, setLocalInfoOverride] = useState<boolean | null>(null);
  const autoInfoOpen = paneW > 0 && INFO_PANEL_W <= paneW * 0.25;
  const infoOpen = histogramAvailable && (infoPanelSetting ?? localInfoOverride ?? autoInfoOpen);
  const setInfoOpen = useCallback(
    (open: boolean) => {
      if (onInfoPanelChange) onInfoPanelChange(open);
      else setLocalInfoOverride(open);
    },
    [onInfoPanelChange],
  );
  const [histCursor, setHistCursor] = useState<{ px: number; py: number } | null>(null);

  // Track the texel under the cursor for the histogram's per-pixel read-out,
  // reusing the SHARED `screenToTexel` mapping (region-select) — the same math
  // the TEV overlay + marquee use, not a second sampler. Active only while the
  // panel is open, so it costs nothing otherwise.
  const trackHistCursor = useCallback(
    (e: React.PointerEvent) => {
      if (!infoOpen || !histogramAvailable || !singleOverlay || !naturalDims) return;
      const el = singleOverlay.displayElRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const t = screenToTexel(e.clientX, e.clientY, {
        box,
        naturalWidth: naturalDims.w,
        naturalHeight: naturalDims.h,
        sourceWindow: singleOverlay.sourceWindow,
      });
      const px = Math.floor(t.x);
      const py = Math.floor(t.y);
      if (px < 0 || py < 0 || px >= naturalDims.w || py >= naturalDims.h) {
        setHistCursor((prev) => (prev === null ? prev : null));
        return;
      }
      setHistCursor((prev) => (prev && prev.px === px && prev.py === py ? prev : { px, py }));
    },
    [infoOpen, histogramAvailable, singleOverlay, naturalDims],
  );

  // ENLARGE (fullscreen overlay). The shell keeps the pane's ENTIRE subtree in
  // ONE stable container element (`contentHostRef`) and only MOVES that element
  // between its inline slot and a `document.body`-portaled fixed overlay — a
  // plain `appendChild` reparent that never unmounts/remounts the pane's React
  // tree. That is critical for the WebGPU/2D panes: a React re-render that
  // changed the content's tree position would tear down + recreate the
  // `<canvas>`, dropping its GL/GPU context + backing store (a blank/black pane
  // and a context-loss warning). Moving the DOM node instead preserves the
  // canvas object (and thus its context) verbatim. On the box change,
  // `useReframeViewportOnResize` keeps the CENTER world texel (and its on-screen
  // size) fixed — an untouched HOME view re-fits to fill the new box, a
  // zoomed/panned view keeps its center rather than jumping — so enter/exit is
  // lossless (sliders are untouched).
  // The single-pane fullscreen flag. CONTROLLED when the host supplies
  // `enlargeControl` (the plot leaf owns the state ABOVE the async-resolve
  // swap, so a channel pick's cold re-resolve — which unmounts this whole
  // subtree behind a "Loading…" placeholder — cannot reset it); LOCAL for
  // storeless host mounts (unchanged behavior).
  const [localEnlarged, setLocalEnlarged] = useState(false);
  const enlarged = enlargeControl ? enlargeControl.enlarged : localEnlarged;
  const setEnlarged = enlargeControl ? enlargeControl.setEnlarged : setLocalEnlarged;
  // The stable wrapper that HOLDS the pane subtree; created once and reparented.
  // `display: contents` so it never adds a box of its own — the pane root's
  // `h-full` resolves against whichever host it currently lives in.
  const contentHostRef = useRef<HTMLDivElement | null>(null);
  if (contentHostRef.current === null && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.style.display = "contents";
    contentHostRef.current = el;
  }
  // The two mount points the content host moves between.
  const inlineMountRef = useRef<HTMLDivElement | null>(null);
  const overlayMountRef = useRef<HTMLDivElement | null>(null);

  // Reparent the content host into the overlay (when enlarged) or the inline
  // slot (otherwise), on every toggle AND on mount. `appendChild` MOVES the
  // node; a transient detach across the toggle never destroys the canvas
  // element (context lives on the element, surviving a detach/re-attach).
  useLayoutEffect(() => {
    const host = contentHostRef.current;
    if (!host) return;
    const target = enlarged ? overlayMountRef.current : inlineMountRef.current;
    if (target && host.parentNode !== target) target.appendChild(host);
  }, [enlarged]);

  // ENLARGE-INTERCEPT: while this pane is part of a page-wide ≥2 selection, its
  // enlarge button opens the page-level SELECTION STAGE (a grid of ALL selected
  // panes) instead of this single-pane overlay. The wrapping
  // `PaneSelectionFrame` provides the intercept; the pane itself stays
  // selection-agnostic. `onEnlarge()` returning `true` means "handled — the
  // multi stage opened", so we skip the local single-pane enlarge.
  const enlargeIntercept = useContext(EnlargeInterceptContext);

  // The enlarge toggle as a LEADING toolbar button (only rendered when the
  // toolbar itself renders — under `toolbar={false}` the host drives layout, so
  // enlarge is simply absent, matching every other toolbar button's seam). The
  // overlay's own ✕ / Escape / backdrop-click still close it if opened.
  const enlargeButton = useMemo<ToolbarButtonSpec>(
    () => ({
      id: "enlarge",
      icon: enlarged ? "compress" : "expand",
      title: enlarged ? "Exit fullscreen (Esc)" : "Enlarge (fullscreen)",
      active: enlarged,
      onClick: () => {
        // Opening (not closing): let a ≥2-selection intercept take over with the
        // multi-pane stage; only fall through to the local overlay if unhandled.
        if (!enlarged && enlargeIntercept?.onEnlarge()) return;
        setEnlarged(!enlarged);
      },
    }),
    [enlarged, enlargeIntercept],
  );

  const { containerProps: viewportProps } = useImageViewport({
    containerRef: paneRef,
    zoom,
    pan,
    onViewportChange,
    // Q29: adaptive max-zoom — zoom until one source texel fills the viewport
    // (same cap the +/- buttons use).
    naturalWidth: naturalDims?.w,
    naturalHeight: naturalDims?.h,
  });

  // Bug 5: keep the world texel at the viewport CENTER (and its on-screen size)
  // fixed when the pane's container box changes — entering/exiting the enlarge
  // overlay OR a window/container resize — instead of the top-left-anchored pan
  // letting the view jump. HOME (untouched) still re-fits to the new box.
  useReframeViewportOnResize({
    containerRef: paneRef,
    zoom,
    pan,
    onViewportChange,
    naturalWidth: naturalDims?.w,
    naturalHeight: naturalDims?.h,
  });

  // HOME / reset also zeroes the EXPOSURE/OFFSET display-adjust sliders (they're
  // controlled inputs, so resetting the pane's state snaps their positions back
  // to 0). Shared by the toolbar home button (via the controller's `onReset`)
  // and the double-click reset below, so both gestures return the pane to a
  // fully neutral state, not just zoom/pan.
  const resetDisplayAdjust = useCallback(() => {
    displayAdjust?.onExposureChange(0);
    displayAdjust?.onOffsetChange(0);
    // A host pane's extra reset (compare: colormap / view-mode / kernel back to
    // their descriptor defaults) rides the same HOME/dblclick chain.
    onReset?.();
  }, [displayAdjust, onReset]);

  // Double-click reset (Q17) — same gesture across every image pane + the 2D
  // charts.
  const resetViewport = useCallback(() => {
    onViewportChange?.(HOME_VIEWPORT);
    resetDisplayAdjust();
  }, [onViewportChange, resetDisplayAdjust]);

  // PlotToolbar controller (zoom/pan/reset/screenshot). Runs unconditionally
  // (rules-of-hooks); only the toolbar's RENDER is gated on `toolbar`.
  const controller = useImageController({
    rootRef: paneRef,
    canvasRef: exportCanvasRef,
    zoom,
    pan,
    onViewportChange,
    naturalWidth: naturalDims?.w,
    naturalHeight: naturalDims?.h,
    requestRender,
    onReset: resetDisplayAdjust,
    // A dialed EXPOSURE/OFFSET slider counts as "modified": HOME resets the
    // sliders too (onReset above), so the button must read enabled whenever
    // either slider is off 0 — even at home zoom/pan.
    extraModified:
      (displayAdjust?.exposureEV ?? 0) !== 0 ||
      (displayAdjust?.offset ?? 0) !== 0 ||
      !!extraModified,
  });

  // EXPOSURE / OFFSET display-adjust sliders (image panes only; §requirement B).
  // TEV convention: color * 2^EV, then + offset, applied in display/linear space
  // BEFORE tonemap/gamma/colormap. Display-only — the pane feeds these into its
  // render pass, never a diff recompute.
  const sliders = useMemo<ToolbarSliderSpec[] | undefined>(() => {
    // DEEP depth slider leads; the EXPOSURE/OFFSET display-adjust pair follows;
    // any pane-supplied extra rows (e.g. the HDR PEAK slider) come last.
    const rows: ToolbarSliderSpec[] = [];
    if (depthSliders) rows.push(...depthSliders);
    if (!displayAdjust) {
      if (extraSliders) rows.push(...extraSliders);
      return rows.length ? rows : undefined;
    }
    const signed = (v: number, digits: number) =>
      `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
    rows.push(
      {
        id: "exposure",
        icon: "sun",
        label: "EV",
        title:
          "Exposure (EV stops) — color × 2^EV. Double-click to type a value (may exceed the slider range).",
        min: -8,
        max: 8,
        step: 0.1,
        value: displayAdjust.exposureEV,
        onChange: displayAdjust.onExposureChange,
        format: (v) => signed(v, 1),
      },
      {
        id: "offset",
        icon: "plusminus",
        label: "OFF",
        title:
          "Offset — added after exposure (before tonemap). Double-click to type a value (may exceed the slider range).",
        min: -1,
        max: 1,
        step: 0.01,
        value: displayAdjust.offset,
        onChange: displayAdjust.onOffsetChange,
        format: (v) => signed(v, 2),
      },
    );
    if (extraSliders) rows.push(...extraSliders);
    return rows;
  }, [displayAdjust, depthSliders, extraSliders]);

  // While the overlay is active, expose the notation toggle ("0–255"/"0–1") as
  // a LEADING toolbar button (leftmost so it never shifts the standard buttons).
  const regionButton = useMemo<ToolbarButtonSpec | null>(
    () =>
      regionAvailable
        ? {
            id: "region-depth",
            icon: "select",
            title: "Select depth from region — drag a rectangle to set the Z window to the samples it covers (Esc to cancel)",
            active: regionActive,
            onClick: () => setRegionActive((v) => !v),
          }
        : null,
    [regionAvailable, regionActive],
  );

  // INFO-PANEL toggle — a LEADING toolbar button (like enlarge) shown whenever
  // a histogram source is available. Portaled menus stay above; the panel it
  // opens sits below the toolbar seam (see ImageInfoPanel). A click is an
  // EXPLICIT choice: it writes the viewport setting (outranking the auto rule
  // permanently, per spec §2).
  const histogramButton = useMemo<ToolbarButtonSpec | null>(
    () =>
      histogramAvailable
        ? {
            id: "histogram",
            icon: "chart",
            title: infoOpen ? "Hide info panel" : "Show info panel",
            active: infoOpen,
            onClick: () => setInfoOpen(!infoOpen),
          }
        : null,
    [histogramAvailable, infoOpen, setInfoOpen],
  );

  const toolbarConfig = useMemo(
    () => ({
      ...IMAGE_TOOLBAR_CONFIG,
      leadingButtons: [
        enlargeButton,
        ...(histogramButton ? [histogramButton] : []),
        ...(leadingMenus ?? []),
        ...(regionButton ? [regionButton] : []),
        ...(overlayActive ? [notationToolbarButton(notation, setNotation)] : []),
      ],
      sliders,
      segments: rowSegments,
    }),
    [overlayActive, notation, leadingMenus, regionButton, histogramButton, sliders, rowSegments, enlargeButton],
  );

  const checkerClass = " cairn-checkerboard";
  const paneClass =
    "relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded" +
    (checkerboard === "pane" ? checkerClass : "");
  const wrapClass = wrapperClassName + (checkerboard === "wrapper" ? checkerClass : "");

  const pixelOverlay =
    "render" in overlay ? (
      overlay.render({ notation, setOverlayActive })
    ) : overlay.hasSource && naturalDims ? (
      <PixelValueOverlay
        imageElRef={overlay.displayElRef}
        naturalWidth={naturalDims.w}
        naturalHeight={naturalDims.h}
        zoom={zoom}
        pan={pan}
        sourceWindow={overlay.sourceWindow}
        sample={overlay.sample}
        notation={notation}
        version={overlay.version}
        onActiveChange={setOverlayActive}
      />
    ) : null;

  // The pane subtree. Kept in ONE stable element (`contentHostRef`) that is
  // reparented between the inline slot and the enlarge overlay WITHOUT
  // remounting — see the ENLARGE note above — so the canvas/engine survives.
  const shellRoot = (
    // `isolate` (isolation: isolate) makes this pane root its OWN stacking
    // context, so every z-index INSIDE it (the `z-10` pixel-value overlay
    // canvas, the `z-20` notation toggle, `z-30`/`z-50` toolbar menus) is
    // resolved LOCALLY and can never compete with the embedding host's chrome.
    // Without it, the overlay canvas's `z-10` lives in the host's root stacking
    // context: once the pane scrolls up under a host `position: sticky` header
    // whose z-index is <= 10 (or auto), the overlay text paints OVER that header
    // (the reported "numbers on top of the sticky header" bug). Clipping alone
    // (`overflow-hidden` on the inner viewport) does NOT fix this — the clipped
    // box itself slides under the header, so the fix must be stacking, not
    // clipping. The library stays well-behaved regardless of the host's CSS.
    <div className={`relative isolate flex flex-col h-full${toolbar ? " group" : ""}`} {...paneAttrs}>
      {header}
      {toolbar && <PlotToolbar controller={controller} config={toolbarConfig} />}
      <div
        ref={paneRef}
        className={paneClass}
        style={{ padding: viewportPadding, ...viewportProps.style }}
        onPointerDown={viewportProps.onPointerDown}
        onPointerMove={(e) => {
          viewportProps.onPointerMove?.(e);
          trackHistCursor(e);
        }}
        onPointerUp={viewportProps.onPointerUp}
        onPointerCancel={viewportProps.onPointerCancel}
        onPointerLeave={() => setHistCursor((prev) => (prev === null ? prev : null))}
        onDoubleClick={resetViewport}
        {...viewportAttrs}
      >
        <div ref={wrapperRef} className={wrapClass} style={wrapperStyle}>
          {surface}
          {showAxes && naturalDims && (
            <PixelAxes
              naturalWidth={naturalDims.w}
              naturalHeight={naturalDims.h}
              zoom={zoom}
              containerRef={wrapperRef}
            />
          )}
          {overlayNode}
        </div>
        {pixelOverlay}
        {!toolbar && overlayActive && (
          <PixelNotationToggle notation={notation} onChange={setNotation} />
        )}
        {/* Fresh-draw marquee (button active) — replaces any existing rect.
            Live-queries the window as it's dragged; commit persists on release. */}
        {regionActive && regionSelect && singleOverlay && naturalDims && (
          <RegionSelectLayer
            imageElRef={singleOverlay.displayElRef}
            naturalDims={naturalDims}
            sourceWindow={singleOverlay.sourceWindow}
            onQueryLive={regionSelect.queryLive}
            onSelect={(x0, y0, x1, y1) => {
              setRegionActive(false);
              regionSelect.commit(x0, y0, x1, y1);
            }}
            onExit={() => setRegionActive(false)}
          />
        )}
        {/* Persisted, editable rect — anchored in image space (moves with zoom/pan). */}
        {!regionActive && regionSelect?.rect && singleOverlay && naturalDims && (
          <RegionRectOverlay
            rect={regionSelect.rect}
            imageElRef={singleOverlay.displayElRef}
            naturalDims={naturalDims}
            sourceWindow={singleOverlay.sourceWindow}
            zoom={zoom}
            pan={pan}
            onQueryLive={regionSelect.queryLive}
            onCommit={regionSelect.commit}
            onRemove={regionSelect.remove}
          />
        )}
        {/* In-pane INFO panel — pinned top-right below the toolbar seam;
            pointer-events scoped to the panel (see ImageInfoPanel). Closing is
            an EXPLICIT choice → writes the viewport setting. */}
        {infoOpen && histogram && singleOverlay && naturalDims && (
          <ImageInfoPanel
            source={histogram}
            cursor={histCursor}
            depthWindow={depthWindow}
            onClose={() => setInfoOpen(false)}
          />
        )}
      </div>
      {showLabelChip && (
        <LabelChip label={label} isDraggable={isDraggable} onDragStart={onDragStart} />
      )}
      {extraChips}
    </div>
  );

  return (
    <>
      {/* Inline slot — the pane's normal position in the host layout. The
          content host (holding the whole pane subtree) lives here at rest, and
          is moved into the overlay below while enlarged. Rendered EMPTY by React
          (the child is imperatively appended) so React never fights the
          reparent. */}
      <div ref={inlineMountRef} className="relative flex flex-col h-full min-h-0 min-w-0" />

      {/* Fullscreen ENLARGE overlay — the SHARED body-portaled chrome (backdrop,
          ✕, Escape, backdrop-click, scroll-lock, themed portal). The pane's own
          subtree (its live `<canvas>`) is appendChild'd into the mount below —
          NOT re-rendered — so the GPU/2D context survives. Theme is read from
          `inlineMountRef`, which stays in the ORIGINAL tree (inside the theme
          scope) rather than the reparented pane. */}
      <FullscreenOverlayShell
        open={enlarged}
        onClose={() => setEnlarged(false)}
        originRef={inlineMountRef}
        ariaLabel={label ? `Enlarged: ${label}` : "Enlarged view"}
      >
        {/* Empty in React's view — the content host is appendChild'd here while
            enlarged. `flex:1` + `min-*:0` let the pane fill + clamp. */}
        <div
          ref={overlayMountRef}
          style={{
            position: "relative",
            flex: "1 1 0%",
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        />
      </FullscreenOverlayShell>

      {/* The pane subtree, portaled ONCE into the stable content host (which is
          reparented between the inline slot and the overlay). The canvas/engine
          is never torn down by enlarge. */}
      {contentHostRef.current && createPortal(shellRoot, contentHostRef.current)}
    </>
  );
}

/**
 * The DEEP region-select marquee: a one-shot crosshair drag over the pane that
 * maps the drawn screen rect to an image-texel rect (reusing the overlay's
 * screen→texel math, `./region-select.ts`) and hands it to `onSelect`. Escape
 * (or a zero-size click) cancels via `onExit`. Rendered ABOVE the surface, so it
 * pre-empts the viewport's pan/zoom pointer handlers while active.
 */
function RegionSelectLayer({
  imageElRef,
  naturalDims,
  sourceWindow,
  onQueryLive,
  onSelect,
  onExit,
}: {
  imageElRef: RefObject<HTMLElement | null>;
  naturalDims: { w: number; h: number };
  sourceWindow?: SourceWindow;
  onQueryLive: (x0: number, y0: number, x1: number, y1: number) => void;
  onSelect: (x0: number, y0: number, x1: number, y1: number) => void;
  onExit: () => void;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Map the current band to an image-texel rect (or null if off-image).
  const bandToTexel = useCallback(
    (ax: number, ay: number, bx: number, by: number) => {
      const imgEl = imageElRef.current;
      if (!imgEl) return null;
      return screenRectToTexelRect(ax, ay, bx, by, {
        box: imgEl.getBoundingClientRect(),
        naturalWidth: naturalDims.w,
        naturalHeight: naturalDims.h,
        sourceWindow,
      });
    },
    [imageElRef, naturalDims, sourceWindow],
  );

  // Escape cancels the mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setBand({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
  }, []);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      setBand({ x0: s.x, y0: s.y, x1: e.clientX, y1: e.clientY });
      // Live-query the window as the marquee grows (coalesced upstream).
      const rect = bandToTexel(s.x, s.y, e.clientX, e.clientY);
      if (rect) onQueryLive(rect.x0, rect.y0, rect.x1, rect.y1);
    },
    [bandToTexel, onQueryLive],
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = startRef.current;
      startRef.current = null;
      setBand(null);
      const imgEl = imageElRef.current;
      if (!s || !imgEl) {
        onExit();
        return;
      }
      // A near-zero drag (a click) → cancel rather than select one texel.
      if (Math.abs(e.clientX - s.x) < 3 && Math.abs(e.clientY - s.y) < 3) {
        onExit();
        return;
      }
      const box = imgEl.getBoundingClientRect();
      const rect = screenRectToTexelRect(s.x, s.y, e.clientX, e.clientY, {
        box,
        naturalWidth: naturalDims.w,
        naturalHeight: naturalDims.h,
        sourceWindow,
      });
      if (!rect) {
        onExit();
        return;
      }
      onSelect(rect.x0, rect.y0, rect.x1, rect.y1);
    },
    [imageElRef, naturalDims, sourceWindow, onSelect, onExit],
  );

  const layerRect = layerRef.current?.getBoundingClientRect();
  const bandStyle =
    band && layerRect
      ? {
          left: Math.min(band.x0, band.x1) - layerRect.left,
          top: Math.min(band.y0, band.y1) - layerRect.top,
          width: Math.abs(band.x1 - band.x0),
          height: Math.abs(band.y1 - band.y0),
        }
      : null;

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-20"
      style={{ cursor: "crosshair", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {bandStyle && (
        <div
          className="absolute border-2 border-dashed border-sky-400 bg-sky-400/15 pointer-events-none"
          style={bandStyle}
        />
      )}
    </div>
  );
}

/** Handle → CSS cursor + fractional position along the rect (0..1 per axis). */
const HANDLE_META: Record<Exclude<RegionHandle, "move">, { cursor: string; fx: number; fy: number }> = {
  nw: { cursor: "nwse-resize", fx: 0, fy: 0 },
  n: { cursor: "ns-resize", fx: 0.5, fy: 0 },
  ne: { cursor: "nesw-resize", fx: 1, fy: 0 },
  e: { cursor: "ew-resize", fx: 1, fy: 0.5 },
  se: { cursor: "nwse-resize", fx: 1, fy: 1 },
  s: { cursor: "ns-resize", fx: 0.5, fy: 1 },
  sw: { cursor: "nesw-resize", fx: 0, fy: 1 },
  w: { cursor: "ew-resize", fx: 0, fy: 0.5 },
};

/**
 * The PERSISTED deep region rectangle: anchored in IMAGE-TEXEL space and mapped
 * to screen every commit/viewport change (`texelRectToScreenRect`, the same
 * object-contain/uvRect mapping the TEV overlay + marquee use — so it stays glued
 * to the image pixels across zoom/pan/resize). Drag the interior to MOVE, the
 * corner/edge handles to RESIZE (texel deltas = screen delta ÷ on-screen scale,
 * clamped to the image + a min size — `region-edit.ts`), pointer-captured so the
 * pane's pan gesture never fires mid-edit. On release the new rect re-queries the
 * Z window (`onCommit`). The top-right × removes the rect + resets only the Z
 * window (`onRemove`). The screen box is recomputed in a layout effect (post-DOM-
 * commit) so it reads the transform the just-applied zoom/pan produced.
 */
function RegionRectOverlay({
  rect,
  imageElRef,
  naturalDims,
  sourceWindow,
  zoom,
  pan,
  onQueryLive,
  onCommit,
  onRemove,
}: {
  rect: TexelRect;
  imageElRef: RefObject<HTMLElement | null>;
  naturalDims: { w: number; h: number };
  sourceWindow?: SourceWindow;
  zoom: number;
  pan: { x: number; y: number };
  onQueryLive: (x0: number, y0: number, x1: number, y1: number) => void;
  onCommit: (x0: number, y0: number, x1: number, y1: number) => void;
  onRemove: () => void;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  // Live rect during an edit (texels); null when idle → show the committed rect.
  const [editing, setEditing] = useState<TexelRect | null>(null);
  const dragRef = useRef<{ handle: RegionHandle; sx: number; sy: number; start: TexelRect } | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const activeRect = editing ?? rect;

  // Recompute the on-screen box AFTER the DOM commits (so getBoundingClientRect
  // reflects the zoom/pan transform just applied). Re-runs on any viewport change.
  useLayoutEffect(() => {
    const compute = () => {
      const img = imageElRef.current;
      const layer = layerRef.current;
      if (!img || !layer) return;
      const imgBox = img.getBoundingClientRect();
      const layerBox = layer.getBoundingClientRect();
      const s = texelRectToScreenRect(activeRect, {
        box: imgBox,
        naturalWidth: naturalDims.w,
        naturalHeight: naturalDims.h,
        sourceWindow,
      });
      setBox({ left: s.left - layerBox.left, top: s.top - layerBox.top, width: s.width, height: s.height });
    };
    compute();
    const img = imageElRef.current;
    if (!img || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(compute);
    ro.observe(img);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRect, naturalDims.w, naturalDims.h, sourceWindow, zoom, pan.x, pan.y]);

  const beginDrag = useCallback(
    (handle: RegionHandle) => (e: React.PointerEvent) => {
      e.stopPropagation(); // never start a pan
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = { handle, sx: e.clientX, sy: e.clientY, start: activeRect };
      setEditing(activeRect);
    },
    [activeRect],
  );
  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      const img = imageElRef.current;
      if (!d || !img) return;
      const scale = screenPerTexel({
        box: img.getBoundingClientRect(),
        naturalWidth: naturalDims.w,
        naturalHeight: naturalDims.h,
        sourceWindow,
      });
      const dx = (e.clientX - d.sx) / (scale || 1);
      const dy = (e.clientY - d.sy) / (scale || 1);
      const next = applyRectEdit(d.start, d.handle, dx, dy, { w: naturalDims.w, h: naturalDims.h }, 1);
      setEditing(next);
      // Live-query the window as the rect moves/resizes (coalesced upstream).
      onQueryLive(next.x0, next.y0, next.x1, next.y1);
    },
    [imageElRef, naturalDims.w, naturalDims.h, sourceWindow, onQueryLive],
  );
  const endDrag = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    const r = editing;
    setEditing(null);
    if (d && r) onCommit(r.x0, r.y0, r.x1, r.y1);
  }, [editing, onCommit]);

  if (!box) {
    // First paint: mount the ref so the layout effect can measure.
    return <div ref={layerRef} className="absolute inset-0 z-20 pointer-events-none" />;
  }

  return (
    <div ref={layerRef} className="absolute inset-0 z-20 pointer-events-none" style={{ touchAction: "none" }}>
      {/* The rect body — drag to MOVE. */}
      <div
        className="absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-auto"
        style={{ ...box, cursor: "move", touchAction: "none" }}
        onPointerDown={beginDrag("move")}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
      />
      {/* Resize handles. Larger invisible hit box around a small visible dot. */}
      {RESIZE_HANDLES.map((h) => {
        const m = HANDLE_META[h];
        return (
          <div
            key={h}
            className="absolute pointer-events-auto flex items-center justify-center"
            style={{
              left: box.left + m.fx * box.width - 12,
              top: box.top + m.fy * box.height - 12,
              width: 24,
              height: 24,
              cursor: m.cursor,
              touchAction: "none",
            }}
            onPointerDown={beginDrag(h)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          >
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-400 border border-white/80" />
          </div>
        );
      })}
      {/* Remove × — top-right, theme-consistent chip, ≥40px hit area. */}
      <button
        type="button"
        aria-label="Remove depth region"
        title="Remove region (reset the depth window)"
        className="absolute pointer-events-auto flex items-center justify-center rounded-full text-white"
        style={{ left: box.left + box.width - 8, top: box.top - 32, width: 40, height: 40 }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800/90 border border-white/70 text-[11px] leading-none">
          ×
        </span>
      </button>
    </div>
  );
}
