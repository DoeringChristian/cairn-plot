/**
 * ImagePaneShell — the ONE shared frame every image viewer pane renders inside.
 *
 * cairn-plot ships three panes that are all "an image in a zoom/pan viewport
 * with a toolbar, a TEV pixel-value overlay and a label chip", differing only
 * in HOW they put pixels on screen:
 *   - `renderers/CpuImagePane.tsx`  — 2D-canvas / `<img>` + CSS-transform zoom.
 *   - `renderers/GpuImagePane.tsx`  — WebGPU engine, zoom via a sampled uvRect.
 *   - `media-compare/GpuComparePane.tsx` — WebGPU split/blend/diff compositor.
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
 *     (the CPU shims pass `toolbar={false}` for their legacy chrome; the GPU
 *     panes always pass `true`).
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
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import PixelAxes from "../primitives/PixelAxes";
import LabelChip from "../primitives/LabelChip";
import PixelValueOverlay, {
  PixelNotationToggle,
  type PixelSampler,
  type PixelValueNotation,
} from "../primitives/PixelValueOverlay";
import PlotToolbar from "../primitives/PlotToolbar";
import { useImageViewport, type Viewport as ImageViewport } from "../hooks/use-image-viewport";
import {
  useImageController,
  IMAGE_TOOLBAR_CONFIG,
  notationToolbarButton,
} from "./use-image-controller";

const HOME_VIEWPORT: ImageViewport = { zoom: 1, pan: { x: 0, y: 0 } };

/** `data-*` markers spread onto the root / viewport box. Boolean values render
 *  as `"true"`/`"false"` (the `…-ready` attrs); `""` marks a bare attribute. */
export type PaneDataAttrs = Record<string, string | boolean>;

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
      /** Per-pixel value/luminance accessor over the RAW source buffer. */
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
  /** Render the `PlotToolbar` (and add the `group` hover class). The CPU shims
   *  pass `false` for their legacy chrome; the GPU panes always pass `true`. */
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
  label,
  showLabelChip,
  isDraggable = false,
  onDragStart,
  extraChips,
}: ImagePaneShellProps) {
  // Notation is owned locally (seeded from the prop) so the pane is
  // self-contained; the toggle shows only while the overlay is active.
  const [notation, setNotation] = useState<PixelValueNotation>(notationSeed);
  const [overlayActive, setOverlayActive] = useState(false);

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

  // Double-click reset (Q17) — same gesture across every image pane + the 2D
  // charts.
  const resetViewport = useCallback(() => {
    onViewportChange?.(HOME_VIEWPORT);
  }, [onViewportChange]);

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
  });

  // While the overlay is active, expose the notation toggle ("0–255"/"0–1") as
  // a LEADING toolbar button (leftmost so it never shifts the standard buttons).
  const toolbarConfig = useMemo(
    () => ({
      ...IMAGE_TOOLBAR_CONFIG,
      leadingButtons: overlayActive ? [notationToolbarButton(notation, setNotation)] : [],
    }),
    [overlayActive, notation],
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

  return (
    <div className={`relative flex flex-col h-full${toolbar ? " group" : ""}`} {...paneAttrs}>
      {header}
      {toolbar && <PlotToolbar controller={controller} config={toolbarConfig} />}
      <div
        ref={paneRef}
        className={paneClass}
        style={{ padding: viewportPadding, ...viewportProps.style }}
        onPointerDown={viewportProps.onPointerDown}
        onPointerMove={viewportProps.onPointerMove}
        onPointerUp={viewportProps.onPointerUp}
        onPointerCancel={viewportProps.onPointerCancel}
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
      </div>
      {showLabelChip && (
        <LabelChip label={label} isDraggable={isDraggable} onDragStart={onDragStart} />
      )}
      {extraChips}
    </div>
  );
}
