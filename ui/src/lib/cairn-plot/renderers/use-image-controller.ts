/**
 * `renderers/use-image-controller.ts` — the image-pane adapter that projects an
 * image viewer's `{zoom, pan}` viewport (owned by `hooks/use-image-viewport.ts`
 * and lifted into the pane's props) onto the renderer-agnostic
 * {@link PlotController} facade the `<PlotToolbar>` drives. One per pane
 * instance (`GpuImagePane`, `GpuComparePane`).
 *
 * Images pan/zoom but have no rubber-band box-zoom and no point selection, so
 * this controller reports `boxZoom:false`, `select:false`, `lasso:false` and
 * pins its drag mode to `"pan"` (`setDragMode` is a no-op — dragging always
 * pans). It reuses the SAME viewport handlers the wheel/pointer path already
 * uses (no new viewport math): `zoomIn`/`zoomOut` reproduce
 * `use-image-viewport`'s zoom-to-cursor formula with the cursor pinned to the
 * pane center and clamp by the same `adaptiveMaxZoom` cap; `autoscale`/`reset`
 * both return to the fit-to-view "home" (`{zoom:1, pan:{0,0}}`, the same target
 * the pane's double-click reset uses).
 *
 * ## Screenshot (WebGPU readback caveat)
 * The image is a `<canvas>`, so `toPNG` uses the shared, self-contained
 * `canvasToPng` (falling back to `plotToPng(root)` when no canvas ref is
 * supplied). The panes render ON DEMAND (not per animation frame), so the
 * canvas already holds its last frame — but a WebGPU-backed canvas can present
 * a cleared buffer to a `drawImage`/`toBlob` readback if its surface was
 * reconfigured since the last present. To be safe, when the pane passes its
 * synchronous render callback as `requestRender`, `toPNG` repaints a fresh
 * frame and captures it in the SAME task: `canvasToPng` runs its `drawImage`
 * synchronously before its first `await`, so the freshly-rendered frame is what
 * gets rasterized — guaranteeing a non-blank export even on WebGPU.
 */
import { useCallback, useMemo } from "react";
import type { RefObject } from "react";
import type {
  ControllerCapabilities,
  DragMode,
  HoverMode,
  PlotController,
  ToPNGOptions,
} from "../controls/types";
import type { ToolbarConfig, ToolbarButtonSpec } from "../controls/ToolbarConfig";
import { adaptiveMaxZoom, type Viewport } from "../hooks/use-image-viewport";
import { canvasToPng, plotToPng, type PlotToPngOptions } from "../primitives/plot-to-png";
import type { PixelValueNotation } from "../primitives/PixelValueOverlay";

const HOME: Viewport = { zoom: 1, pan: { x: 0, y: 0 } };
/** Per-button click factor for the toolbar's +/- zoom (coarser than the
 *  1.1 wheel step so a single click makes a visible jump). */
const ZOOM_STEP = 1.3;
/** Mirror of `use-image-viewport`'s `DEFAULT_MIN_ZOOM`/`DEFAULT_MAX_ZOOM` (not
 *  exported there) — the clamp when a natural size / live box isn't available
 *  for the adaptive cap. */
const DEFAULT_MIN_ZOOM = 0.25;
const DEFAULT_MAX_ZOOM = 64;

/**
 * Default toolbar config for image panes: hide the box-zoom drag toggle
 * (`buttons.zoom`). `<PlotToolbar>` gates BOTH the box-zoom drag button and the
 * zoomIn/zoomOut buttons on `capabilities.zoom`; images want the latter but not
 * the former (they can't rubber-band box-zoom), so the box-zoom button is
 * hidden here by id while the +/- zoom buttons stay. The Pan drag button stays
 * (gated on `capabilities.pan`) so the toolbar still advertises drag-to-pan.
 */
export const IMAGE_TOOLBAR_CONFIG: ToolbarConfig = { buttons: { zoom: false } };

/**
 * The pixel-value notation toggle ("0–255" ↔ "0–1") as a toolbar LEADING
 * button, replacing the old free-floating `PixelNotationToggle` chip. A leading
 * (leftmost) button so that when the pixel-value overlay appears/disappears —
 * the only time this button shows — it never shifts the standard, corner-
 * anchored zoom/pan/reset buttons. Panes spread this into their toolbar config's
 * `leadingButtons` only while the overlay is active.
 */
export function notationToolbarButton(
  notation: PixelValueNotation,
  onChange: (n: PixelValueNotation) => void,
): ToolbarButtonSpec {
  return {
    id: "notation",
    label: notation === "int" ? "0–255" : "0–1",
    title:
      "Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)",
    onClick: () => onChange(notation === "int" ? "decimal" : "int"),
  };
}

/**
 * The registered colormaps as a toolbar-menu option list (diff-kernels
 * toolbar-selection track). Order + ids mirror `types.ts`'s `Colormap` union
 * (`colormaps/lut.ts`'s `COLORMAP_STOPS` keys, plus the `"none"` passthrough);
 * `"none"` shows the raw image / grayscale diff. Kept here (not in the toolbar
 * primitive) so the panes' shared image-controller module owns the one canonical
 * list both single-image backends and the compare pane's diff colormap draw from.
 */
export const COLORMAP_MENU_OPTIONS: { id: string; label: string }[] = [
  { id: "none", label: "None" },
  { id: "viridis", label: "Viridis" },
  { id: "plasma", label: "Plasma" },
  { id: "magma", label: "Magma" },
  { id: "red-green", label: "Red–Green" },
  { id: "red-blue", label: "Red–Blue" },
];

/**
 * A colormap dropdown as a toolbar LEADING button (menu variant). `value` is the
 * current colormap id; `onSelect` receives the picked id. Shown by a
 * colormap-capable pane (SDR single-image, or the compare pane's diff view) so
 * the colormap can be switched view-locally without leaving the pane. Like the
 * notation button, it's a leading (leftmost) control so its presence never
 * shifts the corner-anchored zoom/pan/reset buttons.
 */
export function colormapToolbarButton(
  value: string,
  onSelect: (id: string) => void,
): ToolbarButtonSpec {
  return {
    id: "colormap",
    title: "Colormap",
    menu: { options: COLORMAP_MENU_OPTIONS, value, onSelect },
  };
}

export interface UseImageControllerArgs {
  /** The pane's root element — the `plotToPng` fallback target and the box the
   *  center-zoom math measures against. */
  rootRef: RefObject<HTMLElement | null>;
  /** The pane's WebGPU `<canvas>` — the preferred `canvasToPng` export target. */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  /** Current viewport zoom (lifted into the pane's props). */
  zoom: number;
  /** Current viewport pan (lifted into the pane's props). */
  pan: { x: number; y: number };
  /** Full-replace viewport setter — the same callback the wheel/pointer path
   *  drives. When absent, zoom/reset are inert (read-only pane). */
  onViewportChange?: (v: Viewport) => void;
  /** Image natural pixel size — enables the adaptive max-zoom cap (zoom until
   *  one source texel fills the viewport), matching the wheel path. */
  naturalWidth?: number;
  naturalHeight?: number;
  minZoom?: number;
  maxZoom?: number;
  /** The pane's synchronous render callback — see the module doc's screenshot
   *  note. When provided, `toPNG` repaints before capturing. */
  requestRender?: () => void;
  /** Extra side effect the HOME / reset action runs ALONGSIDE resetting the
   *  viewport — used to zero the EXPOSURE/OFFSET display-adjust sliders so the
   *  toolbar home button (and, via the shell, the double-click reset) return the
   *  pane to a fully neutral state, not just zoom/pan. */
  onReset?: () => void;
}

export function useImageController({
  rootRef,
  canvasRef,
  zoom,
  pan,
  onViewportChange,
  naturalWidth,
  naturalHeight,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  requestRender,
  onReset,
}: UseImageControllerArgs): PlotController {
  // Zoom toward the pane center, reusing `use-image-viewport`'s exact
  // zoom-to-cursor formula with the cursor pinned to the box center — NO new
  // viewport math. Clamp by the same `adaptiveMaxZoom` cap the wheel path uses.
  const applyZoom = useCallback(
    (factor: number) => {
      if (!onViewportChange) return;
      const rect = rootRef.current?.getBoundingClientRect();
      const boxW = rect?.width ?? 0;
      const boxH = rect?.height ?? 0;
      const effMax =
        naturalWidth && naturalHeight && boxW > 0 && boxH > 0
          ? adaptiveMaxZoom(naturalWidth, naturalHeight, boxW, boxH)
          : maxZoom;
      const nextZoom = Math.max(minZoom, Math.min(effMax, zoom * factor));
      if (nextZoom === zoom) return;
      const cx = boxW / 2;
      const cy = boxH / 2;
      const newPanX = cx - ((cx - pan.x) / zoom) * nextZoom;
      const newPanY = cy - ((cy - pan.y) / zoom) * nextZoom;
      onViewportChange({ zoom: nextZoom, pan: { x: newPanX, y: newPanY } });
    },
    [onViewportChange, rootRef, naturalWidth, naturalHeight, maxZoom, minZoom, zoom, pan.x, pan.y],
  );

  const zoomIn = useCallback(() => applyZoom(ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(1 / ZOOM_STEP), [applyZoom]);
  const home = useCallback(() => {
    onViewportChange?.(HOME);
    onReset?.(); // zero EXPOSURE/OFFSET alongside the viewport reset
  }, [onViewportChange, onReset]);

  const toPNG = useCallback(
    (opts?: ToPNGOptions): Promise<Blob> => {
      const png: PlotToPngOptions = { scale: opts?.scale, filename: opts?.filename };
      // WebGPU readback caveat (see module doc): repaint synchronously first,
      // then capture in the same task — `canvasToPng` runs its `drawImage`
      // before its first `await`, so the fresh frame is what gets rasterized.
      requestRender?.();
      const canvas = canvasRef?.current;
      if (canvas) return canvasToPng(canvas, png);
      const root = rootRef.current;
      if (root) return plotToPng(root, png);
      return Promise.reject(new Error("useImageController.toPNG: no canvas or root element to export"));
    },
    [canvasRef, rootRef, requestRender],
  );

  // Images pan/zoom but there is no box-zoom / point-selection surface.
  const capabilities: ControllerCapabilities = useMemo(
    () => ({
      zoom: true,
      pan: true,
      autoscale: true,
      reset: true,
      screenshot: true,
      boxZoom: false,
      select: false,
      lasso: false,
      hover: false,
      spikelines: false,
      hoverModes: false,
      legend: false,
      axisScaleToggle: false,
      perAxisDrag: false,
      brush: false,
      reorder: false,
    }),
    [],
  );

  const isModified = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

  // Drag always pans (no other image drag mode); the setters below are inert
  // beyond that so the toolbar's Pan button reads as the fixed active mode.
  const setDragMode = useCallback((_m: DragMode) => {}, []);
  const setHoverMode = useCallback((_m: HoverMode) => {}, []);
  const toggleSpikelines = useCallback(() => {}, []);

  return useMemo<PlotController>(
    () => ({
      capabilities,
      dragMode: "pan",
      hoverMode: "closest",
      spikelines: false,
      isModified,
      setDragMode,
      setHoverMode,
      toggleSpikelines,
      zoomIn,
      zoomOut,
      autoscale: home,
      reset: home,
      toPNG,
    }),
    [capabilities, isModified, setDragMode, setHoverMode, toggleSpikelines, zoomIn, zoomOut, home, toPNG],
  );
}
