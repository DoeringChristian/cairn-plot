import type {
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
  Colormap,
} from "../../plots/types";
import { CrossTypeCompositeMediaPane } from "../../plots/image/compare/compositor";
import type { CompareFloatSource } from "../../plots/image/compare/compositor";
import type { ViewportCapabilities, ViewportPaneProps, ViewState } from "./types";

// ---------------------------------------------------------------------------
// ImageViewport — the image object_type's Viewport module pieces.
//
// Wraps the EXISTING image rendering (CompositeMediaPane, which itself
// delegates to ImagePane for normal/diff and to MediaComparePane for
// split/blend) as a `ViewportModule["Pane"]`. No image rendering is
// rewritten here — this file only adapts prop shapes.
//
// Exports the two pieces that are pure/app-agnostic (the Pane component and
// the capability descriptor). The full `ViewportModule` object — which also
// needs `useData` (calls `api.artifactUrl`, an app-layer concern) and
// `defaultSettings`/`defaultView` — is assembled in
// `components/viewport-registry.tsx`. See types.ts's header comment for why.
// ---------------------------------------------------------------------------

/** ImageViewport's `TData`: one pane's resolved renderable content. Bundles
 *  the overlay alongside the URL because both are parsed from the SAME
 *  artifact at the SAME step (see ImageGalleryCard's `parseOverlay`, moved to
 *  `viewport-registry.tsx`'s `useImageData`) — keeping them as one unit
 *  avoids a second parallel per-pane array in the card. */
export interface ImageViewportItem {
  url: string | null;
  overlay?: ImageOverlayData | null;
  /**
   * DECODED float samples for a true-HDR artifact (`.exr` / float `.npy`) —
   * populated by `resolveImageViewportItemsAsync` (viewport/data-sources.ts)
   * when the artifact decodes to float; `url` is `null` in that case (a float
   * buffer has no browser-decodable URL). Absent for the ordinary 8-bit
   * `<img>` URL path (the synchronous `resolveImageViewportItems` never sets
   * it). The Pane hands this to `CompositeMediaPane`'s `imageFloat`, so an EXR
   * artifact gets HDR panes/compare (rgba16float, HDR-FLIP, tonemap menu).
   */
  float?: CompareFloatSource | null;
}

/** ImageViewport's `TView`: the "image2d" member of the shared `ViewState`
 *  union — zoom + pan, exactly as ImageGalleryCard's `settings.zoom`/`pan`
 *  today (view state stays persisted in settings, not a separate ephemeral
 *  value — see the design doc's D5 on the *pattern* being shared, not a
 *  concrete type). */
export type ImageViewState = Extract<ViewState, { kind: "image2d" }>;

/** ImageViewport's `TSettings` requirement — the subset of
 *  `VisualCompareSettings` (components/card-kit/visual-compare-settings.ts)
 *  this Pane actually reads. Declared narrowly here (rather than importing
 *  the app-layer settings type into cairn-plot) so this file stays
 *  app-agnostic; `VisualCompareSettings` structurally satisfies it. */
export interface ImageViewportSettings {
  brightness: number;
  contrast: number;
  gamma: number;
  exposure: number;
  offset: number;
  flipSign: boolean;
  interpolation?: Interpolation;
  colormap?: Colormap;
  showAxes?: boolean;
  overlay?: ImageOverlaySettings;
  pixelValueNotation?: "decimal" | "int";
  /** Host-controlled tone-map operator (unified 5-op set) — seeds the pane's
   *  tone-map view when the toolbar is hidden. Threaded to `CompositeMediaPane`'s
   *  `tonemap`. Unset ⇒ the pane's surface default. */
  tonemap?: string;
  /** Host-controlled PEAK ceiling `P` (HDR mode). Threaded to `peak`. */
  peak?: number;
  /** Host-controlled Gamma-operator exponent γ (used only when `tonemap:"gamma"`)
   *  — DISTINCT from `gamma` above (the CSS-filter knob). Threaded to
   *  `CompositeMediaPane`'s `tonemap_gamma`. */
  tonemapGamma?: number;
}

function toProcessing(s: ImageViewportSettings): ImageProcessing {
  return {
    brightness: s.brightness,
    contrast: s.contrast,
    gamma: s.gamma,
    exposure: s.exposure,
    offset: s.offset,
    flipSign: s.flipSign,
  };
}

/**
 * ImageViewport's Pane — renders one image/compare pane. Thin adapter over
 * `CompositeMediaPane`: unpacks `data`/`reference` (the `{url, overlay}`
 * pair), builds the `ImageProcessing` object from settings (moved verbatim
 * from ImageGalleryCard's `processing` useMemo), and forwards everything
 * else 1:1. `onFrame`/`nativeMode`/`fill` are accepted for interface
 * conformance but unused (image has no native modes and does not yet feed
 * the FrameSource bridge — see types.ts).
 *
 * WS-VC6: `crossTypeReferenceUrl` (a foreign 3D type's offscreen-rendered
 * snapshot, when the resolved reference is cross-type) fills the same
 * `baselineUrl` slot `reference?.url` would otherwise fill -- from
 * `CompositeMediaPane`'s point of view a 3D snapshot data-URL and an image
 * artifact URL are both just an `<img src>` string.
 * `CrossTypeCompositeMediaPane` (a thin wrapper, not a second path)
 * additionally routes `diff` through the resample/letterbox alignment step
 * when `crossTypeAlignForDiff` is set.
 */
export function ImageViewportPane({
  data,
  reference,
  imageFloat,
  baselineFloat,
  settings,
  view,
  onViewChange,
  mode,
  diffMode,
  diffKernel,
  onDiffKernelChange,
  onCompareModeChange,
  splitPosition,
  onSplitPositionChange,
  onNaturalSize,
  label,
  isBaseline,
  isDraggable,
  onDragStart,
  crossTypeReferenceUrl,
  crossTypeAlignForDiff,
  toolbar,
}: ViewportPaneProps<ImageViewportItem, ImageViewState, ImageViewportSettings>) {
  const processing = toProcessing(settings);
  // The float side may arrive EITHER as an explicit prop (a host that resolves
  // it card-side) OR carried on the resolved item itself (the async adapter,
  // `resolveImageViewportItemsAsync`). The explicit prop wins; the item's own
  // `float` is the fallback so the current card — which passes only `data`/
  // `reference` items — gets HDR panes/compare with no extra wiring.
  const fgFloat = imageFloat ?? data?.float ?? undefined;
  const refFloat = baselineFloat ?? reference?.float ?? undefined;
  return (
    <CrossTypeCompositeMediaPane
      toolbar={toolbar}
      mode={mode}
      imageUrl={data?.url ?? null}
      baselineUrl={reference?.url ?? crossTypeReferenceUrl ?? null}
      imageFloat={fgFloat}
      baselineFloat={refFloat}
      alignForDiff={crossTypeAlignForDiff}
      isReferencePane={isBaseline}
      tonemap={settings.tonemap}
      peak={settings.peak}
      tonemap_gamma={settings.tonemapGamma}
      diffSubmode={diffMode}
      diffKernel={diffKernel}
      onDiffKernelChange={onDiffKernelChange}
      onCompareModeChange={onCompareModeChange}
      colormap={settings.colormap ?? "none"}
      interpolation={settings.interpolation ?? "auto"}
      showAxes={settings.showAxes ?? false}
      processing={processing}
      zoom={view.zoom}
      pan={view.pan}
      onViewportChange={(v) => onViewChange({ kind: "image2d", zoom: v.zoom, pan: v.pan })}
      splitPosition={splitPosition}
      onSplitPositionChange={onSplitPositionChange}
      label={label}
      isDraggable={isDraggable}
      onDragStart={onDragStart}
      onNaturalSize={onNaturalSize}
      overlay={data?.overlay ?? undefined}
      overlaySettings={settings.overlay}
      pixelValueNotation={settings.pixelValueNotation}
    />
  );
}

/**
 * ImageViewport's capability descriptor — all core modes, image
 * post-processing + overlays, no native modes, no camera sync, "tracked"
 * reset-view (matches `imageViewModified` in ImageGalleryCard today).
 * `maxPanes`/`webglContextsPerPane` are unenforced-large/0 — image has no
 * per-pane WebGL context (diff uses one process-wide singleton, see
 * `image/webgl-diff.ts`) and no card-imposed pane cap today.
 */
export const imageViewportCapabilities: ViewportCapabilities<never> = {
  coreModes: ["normal", "split", "diff"],
  nativeModes: [],
  hasSteps: true,
  postProcessing: true,
  overlays: true,
  colorbar: "conditional",
  cameraSync: false,
  resetView: "tracked",
  crossTypeCompare: true,
  webglContextsPerPane: 0,
  maxPanes: Number.POSITIVE_INFINITY,
  label: { placement: "bottom-left", draggable: true },
};
