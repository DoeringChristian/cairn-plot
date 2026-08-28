import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import GpuImagePane from "../webgpu/view";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "../components/gpu-image-gate";
import { InFullscreenOverlayContext } from "../../../primitives/components/FullscreenOverlayShell";
import { InStackedGridContext } from "../../../layout/stack/stack-context";
import { usePublishNaturalSize } from "../../../layout/natural-size";
import type {
  Colormap,
  DiffMode,
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
} from "../../types";
import { useImageGestures, type ImageViewState } from "../../../host/hooks/use-image-gestures";
import { useGammaFilter, GammaFilterSvg } from "./post-processing";
import ImageOverlay from "../components/ImageOverlay";
import CpuImagePane, { tonemapToImageData } from "../cpu/view";
import { DEFAULT_DISPLAY_OPERATION_ID } from "../runtime/tonemap";
import { DIFF_MODE_LABELS } from "../cpu/diff.ts";
import PixelValueOverlay, {
  CHANNEL_COLORS,
  PixelNotationToggle,
  formatChannelValue,
  type PixelSample,
  type PixelValueNotation,
} from "../../../primitives/components/PixelValueOverlay";
import { loadImageData } from "../resources/load-image-data.ts";
import RefBadge from "../../../primitives/components/RefBadge";
import LabelChip from "../../../primitives/components/LabelChip";
import { useSplitFlipKeys } from "./use-split-flip-keys";
import { compareCaptions } from "./compare-captions";
import PaneUnavailable from "../../../primitives/components/PaneUnavailable";
import SplitDivider from "./SplitDivider";
import type { MediaCompareModeKind } from "./mode";
import type { ImageCompareAlign, ImageCompareFit } from "../runtime/compare-align";
import { alignFrameSourcesForDiff } from "./cross-type-align";
import { resolveRenderMode, urlSource } from "../runtime/contracts";
import {
  useSeedGroupOnFormation,
  useCellSettings,
} from "../../../state/settings/use-cell-settings";

import type {
  CompareSource,
  ImageBackend,
} from "../runtime/contracts";
import type {
  FloatImageSource,
  ImageSource,
  ResolvedFloatImage,
} from "../definition/content.ts";

/**
 * Resolve the UNIFIED engine image pane (`GpuImagePane`, statically in core
 * since the addon fold) — only once the device gate confirms it. `null` keeps
 * the CPU `MediaComparePane`/`ImagePane` diff path — the required fallback
 * (probe pending, host opted out, or WebGPU unavailable). Same gate
 * `plot-renderers.tsx`'s `resolveImageRenderer` uses, so cross-type compare
 * consumers (`ImageViewStatePane` / `OffscreenComparePanes`) render the SAME
 * unified pane a descriptor image-compare leaf does.
 */
function resolveGpuImagePane(): ImageBackend | null {
  if (typeof window === "undefined") return null;
  const mode = resolveRenderMode();
  if (mode === "cpu") return null;
  return gpuImageGateState() === "ready" ? (GpuImagePane as ImageBackend) : null;
}

/**
 * The device probe is async and can settle AFTER `CompositeMediaPane`'s
 * first paint; this hook kicks the lazy probe and re-renders the caller when
 * the gate flips, so the engine pane picks up the instant it's available.
 */
function useGpuCompareReadyTick(): void {
  useSyncExternalStore(subscribeGpuImageGate, gpuImageGateState, gpuImageGateState);
  useEffect(() => {
    ensureGpuImageProbe();
  }, []);
}

/** Map a decoded-float compare side ({@link ResolvedFloatImage}) to the unified
 *  {@link FloatImageSource} the image backend consumes (`[H,W,C]` shape). */
function compareFloatToDecoded(src: ResolvedFloatImage): FloatImageSource {
  return {
    dtype: "float",
    pixels: src.pixels,
    shape: [src.height, src.width, src.channels],
  };
}

const DEFAULT_PROCESSING: ImageProcessing = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  exposure: 0,
  offset: 0,
  flipSign: false,
};

// ---------------------------------------------------------------------------
// MediaComparePane — the split compositor.
//
// Absorbed from renderers/CompareImagePane.tsx verbatim (mechanics
// unchanged: clip-path drag handle for split). This is now the ONE split
// implementation; CompareImagePane.tsx is deleted (spec-visual-compare.md
// quality bar #2).
// ---------------------------------------------------------------------------

export interface MediaComparePaneProps {
  imageUrl: string | null;
  baselineUrl: string | null;
  mode: Extract<MediaCompareModeKind, "split">;
  splitPosition: number;
  onSplitPositionChange?: (p: number) => void;

  zoom: number;
  pan: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;

  processing?: ImageProcessing;
  interpolation?: Interpolation;

  label?: string;
  /** Per-side captions (`cp.Image(label=...)`): reference bottom-left, foreground
   *  bottom-right in slide. Supersede the legacy single `label`. */
  referenceLabel?: string;
  foregroundLabel?: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;

  /** Overlay annotations — applied to the FOREGROUND (prediction) image only. */
  overlay?: ImageOverlayData;
  overlaySettings?: ImageOverlaySettings;

  /** Initial notation for the pixel-value overlay (user-toggleable in-pane). */
  pixelValueNotation?: PixelValueNotation;
}

/**
 * Compare pane that stacks two images (prediction over baseline/reference) and
 * reveals them via a draggable split (clipPath). Self-contained: zoom/pan
 * interaction runs through `useImageGestures`; the gamma filter comes from the
 * shared `useGammaFilter` helper.
 */
export function MediaComparePane({
  imageUrl,
  baselineUrl,
  mode,
  splitPosition,
  onSplitPositionChange,
  zoom,
  pan,
  onViewChange,
  processing = DEFAULT_PROCESSING,
  interpolation = "auto",
  label = "",
  referenceLabel,
  foregroundLabel,
  isDraggable = false,
  onDragStart,
  overlay,
  overlaySettings,
  pixelValueNotation = "decimal",
}: MediaComparePaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [refDims, setRefDims] = useState<{ w: number; h: number } | null>(null);

  // Publish the compare pane's natural content size (the foreground image's own
  // size) so a grid / the compare-enlarge stage sizes this cell to the content
  // aspect — "works for all types", not just plain images.
  usePublishNaturalSize(naturalDims);
  const [notation, setNotation] = useState<PixelValueNotation>(pixelValueNotation);
  const [overlayActive, setOverlayActive] = useState(false);

  // TEV-style per-pixel value overlay. The split compositor draws raw
  // <img>s (not ImagePane), so it carries its own overlay so pixel values still
  // appear when you zoom in far enough here too. In SPLIT mode BOTH sources are
  // sampled: the reference (left of the divider) and the foreground/comparison
  // (right of the divider), each clipped to its own side and re-read live as the
  // divider moves.
  const fgImgRef = useRef<HTMLImageElement | null>(null);
  const refImgRef = useRef<HTMLImageElement | null>(null);
  const fgDataRef = useRef<ImageData | null>(null);
  const refDataRef = useRef<ImageData | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);
  useEffect(() => {
    if (!imageUrl) {
      fgDataRef.current = null;
      setPixelDataVersion((v) => v + 1);
      return;
    }
    let cancelled = false;
    loadImageData(imageUrl).then((d) => {
      if (cancelled) return;
      fgDataRef.current = d;
      setPixelDataVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);
  useEffect(() => {
    if (!baselineUrl) {
      refDataRef.current = null;
      setPixelDataVersion((v) => v + 1);
      return;
    }
    let cancelled = false;
    loadImageData(baselineUrl).then((d) => {
      if (cancelled) return;
      refDataRef.current = d;
      setPixelDataVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [baselineUrl]);

  // One sampler factory over an ImageData ref — identical formatting/tinting for
  // the foreground and the reference source.
  const makeSampler =
    (dataRef: React.RefObject<ImageData | null>) =>
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const d = dataRef.current;
      if (!d || px < 0 || py < 0 || px >= d.width || py >= d.height) return null;
      const i = (py * d.width + px) * 4;
      const r = d.data[i]!;
      const g = d.data[i + 1]!;
      const b = d.data[i + 2]!;
      if (r === g && g === b) {
        return { lines: [formatChannelValue(r, "uint8", notation)] };
      }
      return {
        lines: [
          formatChannelValue(r, "uint8", notation),
          formatChannelValue(g, "uint8", notation),
          formatChannelValue(b, "uint8", notation),
        ],
        colors: [CHANNEL_COLORS[0], CHANNEL_COLORS[1], CHANNEL_COLORS[2]],
      };
    };
  const sampleFg = useMemo(() => makeSampler(fgDataRef), []);
  const sampleRef = useMemo(() => makeSampler(refDataRef), []);

  const showOverlay =
    !!overlay &&
    !!overlaySettings?.enabled &&
    !!naturalDims &&
    !!imageUrl &&
    ((overlay.boxes?.length ?? 0) > 0 || (overlay.masks?.length ?? 0) > 0);

  const { gammaFilterId, filterStr, gamma, offset } = useGammaFilter(processing);
  const transformStr = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  const imgRendering = interpolation === "auto" ? undefined : interpolation;

  const { containerProps: viewportProps, modifierActive } = useImageGestures({
    containerRef: paneRef,
    zoom,
    pan,
    onViewChange,
  });

  // Split ("slide") mode: Left/Right arrow snaps the divider hard to one edge,
  // flipping between the two images (scoped to the hovered/focused pane).
  useSplitFlipKeys(paneRef, mode, onSplitPositionChange);

  return (
    // `isolate`: own stacking context so the pixel-value overlay's `z-10`
    // canvas can never paint over the embedding host's sticky header (same
    // rationale as `ImagePaneShell`'s root — the library must be a well-behaved
    // embeddable component regardless of the host's z-index/CSS).
    <div className="relative isolate flex flex-col h-full">
      <GammaFilterSvg id={gammaFilterId} gamma={gamma} offset={offset} />

      <div
        ref={paneRef}
        // No padding: the reference (left) side must fill exactly [0..split]
        // edge-to-edge (no checkerboard seam), the full-height divider must
        // reach the top/bottom edges, and the divider-drag math maps the
        // pointer across the FULL pane width so splitPosition stays exact.
        className="relative flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded cairn-checkerboard"
        style={{ padding: 0, ...viewportProps.style }}
        onPointerDown={viewportProps.onPointerDown}
        onPointerMove={viewportProps.onPointerMove}
        onPointerUp={viewportProps.onPointerUp}
        onPointerCancel={viewportProps.onPointerCancel}
      >
        <div className="relative w-full h-full">
          <div className="relative w-full h-full" style={{ transform: transformStr, transformOrigin: "0 0" }}>
            <img
              ref={fgImgRef}
              src={imageUrl ?? undefined}
              alt="pred"
              className="w-full h-full object-contain block"
              draggable={false}
              style={{
                filter: filterStr,
                imageRendering: imgRendering,
              }}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            {showOverlay && (
              <ImageOverlay
                data={overlay!}
                settings={overlaySettings!}
                naturalWidth={naturalDims!.w}
                naturalHeight={naturalDims!.h}
              />
            )}
          </div>
          <div
            className="absolute inset-0 overflow-hidden"
            style={mode === "split" ? { clipPath: `inset(0 ${(1 - splitPosition) * 100}% 0 0)` } : undefined}
          >
            <div className="w-full h-full" style={{ transform: transformStr, transformOrigin: "0 0" }}>
              <img
                ref={refImgRef}
                src={baselineUrl ?? undefined}
                alt="ref"
                className="w-full h-full object-contain block"
                draggable={false}
                style={{
                  filter: filterStr,
                  imageRendering: imgRendering,
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setRefDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
            </div>
          </div>
          {mode === "split" && (
            <SplitDivider
              splitPosition={splitPosition}
              onChange={onSplitPositionChange}
              onReset={() => onSplitPositionChange?.(0.5)}
            />
          )}
        </div>
        {/* Per-pixel value overlay. In SPLIT mode each side samples its OWN
            source, clipped at the divider so the numbers under the divider
            always match the image actually shown there; the clip is driven by
            `splitPosition`, so it re-reveals per side live as the divider moves.
            Normal shows a single foreground overlay. */}
        {mode === "split" ? (
          <>
            {baselineUrl && refDims && (
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${(1 - splitPosition) * 100}% 0 0)` }}
              >
                <PixelValueOverlay
                  imageElRef={refImgRef}
                  naturalWidth={refDims.w}
                  naturalHeight={refDims.h}
                  zoom={zoom}
                  pan={pan}
                  sample={sampleRef}
                  notation={notation}
                  version={pixelDataVersion}
                />
              </div>
            )}
            {imageUrl && naturalDims && (
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 0 0 ${splitPosition * 100}%)` }}
              >
                <PixelValueOverlay
                  imageElRef={fgImgRef}
                  naturalWidth={naturalDims.w}
                  naturalHeight={naturalDims.h}
                  zoom={zoom}
                  pan={pan}
                  sample={sampleFg}
                  notation={notation}
                  version={pixelDataVersion}
                  onActiveChange={setOverlayActive}
                />
              </div>
            )}
          </>
        ) : (
          imageUrl &&
          naturalDims && (
            <PixelValueOverlay
              imageElRef={fgImgRef}
              naturalWidth={naturalDims.w}
              naturalHeight={naturalDims.h}
              zoom={zoom}
              pan={pan}
              sample={sampleFg}
              notation={notation}
              version={pixelDataVersion}
              onActiveChange={setOverlayActive}
            />
          )
        )}
        {overlayActive && (
          <PixelNotationToggle notation={notation} onChange={setNotation} />
        )}
      </div>
      {/* REF badge: shown in `split`/slide, where the reference side is
          distinctly visible left of the divider. Shared `RefBadge` — identical
          element/corner in every compare mode. */}
      {mode === "split" && <RefBadge />}
      {/* Per-side captions: REFERENCE bottom-left (static), FOREGROUND bottom-
          right (draggable, keeping the old single-label semantics). Drag is
          suppressed while a viewport modifier key is held so the key-drag pans
          instead of grabbing the chip; the grip stays visible (explicit `grip`).
          The legacy single `label` falls back to the foreground caption. */}
      {(() => {
        const caps = compareCaptions({ mode, referenceLabel, foregroundLabel });
        const rightLabel = caps.right ?? (label || undefined);
        return (
          <>
            {caps.left && (
              <LabelChip label={caps.left} corner="bottom-left" attrs={{ "data-cairn-compare-caption": "reference" }} />
            )}
            {rightLabel && (
              <LabelChip
                label={rightLabel}
                corner="bottom-right"
                isDraggable={isDraggable && !modifierActive}
                grip
                onDragStart={onDragStart}
                attrs={{ "data-cairn-compare-caption": "foreground" }}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompositeMediaPane — the single compositor entry point.
//
// Given a foreground (prediction) source and a reference (baseline) source,
// renders whichever of the three core modes is active: normal (single pane,
// reference tracked but not shown) | split (MediaComparePane above) |
// diff (delegates to ImagePane's existing pixel-diff pipeline —
// cairn-plot/image/diff.ts + webgl-diff.ts, NOT duplicated here). This is what
// ImageGalleryCard's per-pane rendering now calls instead of its own
// renderOverlayPane/plain switch (spec-visual-compare.md quality bar #2 — one
// compositor, written once).
//
// `baselineUrl == null` always forces "normal" regardless of `mode` — a mode
// selection with no resolved reference has nothing to compare against. The
// caller decides *whether* a reference resolves for this pane (including
// card-specific nuances like "hide split against a content-addressed
// duplicate of itself") and passes `baselineUrl: null` to opt a pane out.
// ---------------------------------------------------------------------------

/**
 * A DECODED float side for the engine compare pane — the non-URL alternative to
 * a browser-decodable `imageUrl`/`baselineUrl`. Produced client-side by the
 * compare descriptor resolver (`plot-node.tsx`'s `resolveFrame`) when an image
 * `DataSpec` carries a `url` that decodes to float samples (`.exr`/float `.npy`
 * — formats the browser can't `<img>`-decode). Uploaded as an `rgba32float`
 * source texture by `GpuComparePane` (mirroring the HDR image path's
 * `hdrToRGBAFloat32`), so the diff runs in the TRUE float values rather than the
 * 8-bit-quantized legacy path. GPU-ONLY: the legacy CPU compare panes
 * (`MediaComparePane`/`CpuImagePane`) take only URL sources, so a float side
 * with no engine pane available surfaces `CompareFloatUnsupportedError`, never a
 * blank pane.
 *
 * `data` is the raw decoded buffer (`width*height*channels`, row-major); the
 * pane expands it to RGBA. `contentKey` is the STABLE diff-cache key — the
 * original source URL (NOT the float bytes), so a remount/rerender with the
 * same URL is a cache hit.
 */
/**
 * The standard "this side can't render on the CPU compare" error state. Shown
 * when a `ResolvedFloatImage` side is present but the engine compare pane is
 * unavailable (render mode `cpu`, the gpu-image addon never loaded, or WebGPU
 * is unavailable) — a float side is GPU-only (`rgba32float` upload), and the
 * legacy CPU panes take only URL sources. Never a blank pane (Task point 3).
 */
export function CompareFloatUnsupportedError() {
  // A capability FACT (this browser/GPU has no WebGPU compare for float
  // sources), not an error — neutral-muted styling via the shared placeholder.
  return (
    <PaneUnavailable
      title="GPU compare unavailable"
      body="Float image sources need the GPU compare (WebGPU), which isn't available in this browser."
    />
  );
}

/** A small, unobtrusive corner notice overlaid on a WORKING fallback view (as
 *  opposed to `PaneUnavailable`, which REPLACES the view). Same neutral tone. */
function CompareCpuNotice({ text }: { text: string }) {
  return (
    <div
      data-cairn-compare-cpu-notice=""
      className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-bg-elevated/90 px-2 py-1 text-[11px] text-fg-muted shadow-sm"
    >
      {text}
    </div>
  );
}

/** A diff KERNEL the CPU can't compute: anything that isn't one of the pointwise
 *  {@link DIFF_MODE_LABELS} `computeDiff` handles. The engine kernels (SSIM, FLIP,
 *  …) are GPU-only. */
export function isEngineOnlyDiff(kernel: string): boolean {
  return !(kernel in DIFF_MODE_LABELS);
}

/** Tone-map a float compare side to a display PNG data-URL on the CPU (the CPU
 *  compare panes take only URL sources). A visual approximation good enough for a
 *  slide OVERLAY — those aren't pixel math (that's what a float DIFF needs
 *  the GPU for). Returns `null` if the browser can't rasterize. */
function floatSourceToDataUrl(src: ResolvedFloatImage, tonemap: string, gamma?: number): string | null {
  try {
    const imageData = tonemapToImageData(
      { pixels: src.pixels, shape: [src.height, src.width, src.channels], dtype: "<f4" },
      tonemap,
      0, // exposure
      gamma,
      0, // offset
    );
    const canvas = document.createElement("canvas");
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * CPU fallback for a FLOAT compare when the WebGPU engine is unavailable (render
 * mode `cpu`, addon not loaded, or no WebGPU). Instead of a bare "unavailable"
 * placeholder with NO image, tone-map the float side(s) to display URLs on the
 * CPU and show a real slide of them + a small notice. `diff` (pixel math)
 * is GPU-only for float, so it degrades to a SLIDE with a "diff needs WebGPU"
 * notice. If the browser can't even rasterize, fall back to the placeholder.
 */
function CpuFloatComparePane({
  imageFloat,
  baselineFloat,
  imageUrl,
  baselineUrl,
  mode,
  tonemap,
  tonemap_gamma,
  splitPosition,
  onSplitPositionChange,
  zoom,
  pan,
  onViewChange,
  processing,
  interpolation,
  label,
  referenceLabel,
  foregroundLabel,
  isDraggable,
  onDragStart,
  overlay,
  overlaySettings,
  pixelValueNotation,
}: Pick<
  CompositeMediaPaneProps,
  | "imageFloat"
  | "baselineFloat"
  | "imageUrl"
  | "baselineUrl"
  | "mode"
  | "tonemap"
  | "tonemap_gamma"
  | "splitPosition"
  | "onSplitPositionChange"
  | "zoom"
  | "pan"
  | "onViewChange"
  | "processing"
  | "interpolation"
  | "label"
  | "referenceLabel"
  | "foregroundLabel"
  | "isDraggable"
  | "onDragStart"
  | "overlay"
  | "overlaySettings"
  | "pixelValueNotation"
>) {
  const tm = tonemap ?? DEFAULT_DISPLAY_OPERATION_ID;
  const fgUrl = useMemo(
    () => (imageFloat ? floatSourceToDataUrl(imageFloat, tm, tonemap_gamma) : imageUrl),
    [imageFloat, tm, tonemap_gamma, imageUrl],
  );
  const refUrl = useMemo(
    () => (baselineFloat ? floatSourceToDataUrl(baselineFloat, tm, tonemap_gamma) : baselineUrl),
    [baselineFloat, tm, tonemap_gamma, baselineUrl],
  );
  // Couldn't rasterize a float side → the honest neutral placeholder.
  if ((imageFloat && fgUrl == null) || (baselineFloat && refUrl == null)) {
    return <CompareFloatUnsupportedError />;
  }
  // No reference (a lone float side) → just the tone-mapped foreground image.
  if (refUrl == null) {
    return (
      <div className="relative h-full w-full">
        <CpuImagePane
          toolbar={false}
          source={urlSource(fgUrl)}
          interpolation={interpolation}
          processing={processing}
          zoom={zoom}
          pan={pan}
          onViewChange={onViewChange}
          label={foregroundLabel ?? label}
          pixelValueNotation={pixelValueNotation}
        />
        <CompareCpuNotice text="Compare on CPU (WebGPU unavailable)" />
      </div>
    );
  }
  const wantDiff = mode === "diff";
  // diff is GPU-only for float → slide; everything else → slide.
  const cpuMode: Extract<MediaCompareModeKind, "split"> = "split";
  return (
    <div className="relative h-full w-full">
      <MediaComparePane
        imageUrl={fgUrl}
        baselineUrl={refUrl}
        mode={cpuMode}
        splitPosition={splitPosition ?? 0.5}
        onSplitPositionChange={onSplitPositionChange}
        zoom={zoom}
        pan={pan}
        onViewChange={onViewChange}
        processing={processing}
        interpolation={interpolation}
        label={label}
        referenceLabel={referenceLabel}
        foregroundLabel={foregroundLabel}
        isDraggable={isDraggable}
        onDragStart={onDragStart}
        overlay={overlay}
        overlaySettings={overlaySettings}
        pixelValueNotation={pixelValueNotation}
      />
      <CompareCpuNotice text={wantDiff ? "Diff needs WebGPU — showing slide" : "Compare on CPU (WebGPU unavailable)"} />
    </div>
  );
}

export interface CompositeMediaPaneProps {
  mode: MediaCompareModeKind;
  imageUrl: string | null;
  baselineUrl: string | null;
  /** DECODED float sides (`.exr`/float `.npy` URLs) — the GPU-only alternative
   *  to the URL sources above; see {@link ResolvedFloatImage}. */
  imageFloat?: ResolvedFloatImage;
  baselineFloat?: ResolvedFloatImage;
  /** True when this pane's own image IS the resolved reference series
   *  (the "series-same-step" baseline pane rendered alongside its peers). */
  isReferencePane?: boolean;

  /** Used only when the effective mode is "diff". */
  operation: DiffMode;
  /** Initial diff KERNEL id (engine compare pane) — seeds `GpuComparePane`'s
   *  view-local kernel selection; falls back to `operation` when unset. */
  comparisonOperationId?: string;
  /** Mismatched-size diff operand handling (engine compare pane, diff modes):
   *  `align` = overlap anchor (default "top-left"); `fit` = "crop" (default) |
   *  "fill". Ignored in split. */
  align?: ImageCompareAlign;
  fit?: ImageCompareFit;
  /** Fired when the engine pane's diff kernel changes (menu). */
  onComparisonOperationChange?: (operationId: string) => void;
  /** Fired when the engine pane's compare mode changes (split/diff menu).
   *  Lets `CompareView` keep its lifted view-mode state in sync. */
  onCompareModeChange?: (mode: "split" | "diff") => void;
  colormap: Colormap;
  interpolation: Interpolation;
  showAxes?: boolean;
  processing?: ImageProcessing;

  /** Host-controlled tone-map OPERATOR (unified 5-op set: linear · srgb · gamma
   *  · reinhard · aces) seeded onto the composited / single panes — the
   *  host-menu surface when the toolbar is hidden (`toolbar={false}`). Forwarded
   *  to `GpuComparePane` / `CpuImagePane` (both already accept it); the CPU
   *  2D-canvas backend is the P=1 SDR-only hardware exception. Unset ⇒ each
   *  pane's own surface default (sRGB on SDR, Linear+managed PEAK on HDR). */
  tonemap?: string;
  /** Host-controlled PEAK ceiling `P` (the HDR mode, ×SDR white) — every operator
   *  clips at `P`. Unset ⇒ the pane default (1 on SDR / 4 on an engaged HDR
   *  surface). Forwarded to the engine panes; the CPU backend forces `P=1`. */
  peak?: number;
  /** Host-controlled Gamma-operator exponent γ (used only when `tonemap:"gamma"`).
   *  DISTINCT from `processing.gamma`, the separate CSS-filter brightness knob, so
   *  the two never double-apply. Unset ⇒ the operator default (2.2). */
  tonemap_gamma?: number;

  zoom: number;
  pan: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;

  /** Used only when the effective mode is "split". */
  splitPosition?: number;
  onSplitPositionChange?: (p: number) => void;

  /** Multi-pane SELECTION settings-sync — forwarded to the engine compare pane
   *  (`GpuComparePane`) so a selected compare pane joins the ONE shared settings
   *  bus (mode / kernel / colormap / tonemap / … sync), the same bus the image
   *  panes use. Threaded from `CellSettingsContext` via `CompareView`. Only the
   *  engine-composited (split/diff) pane participates. */
  settingsSyncGroupId?: string;
  syncIsAnchor?: boolean;

  label: string;
  /** Per-side captions (`cp.Image(label=...)`): reference bottom-left, foreground
   *  bottom-right in slide; folded into the diff caption in diff mode. */
  referenceLabel?: string;
  foregroundLabel?: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onNaturalSize?: (w: number, h: number) => void;

  overlay?: ImageOverlayData;
  overlaySettings?: ImageOverlaySettings;

  /** Initial notation for the pixel-value overlay (user-toggleable in-pane). */
  pixelValueNotation?: PixelValueNotation;

  /** Host seam — hide the composited-pane toolbar (`GpuComparePane`'s shell
   *  toolbar / the diff CPU fallback's) when `false`, so a host can drive the
   *  compare view from its own menu. Default `true`. Threaded from `cp.Compare(
   *  toolbar=False)` via `CompareView` / the `ImageViewState` module. */
  toolbar?: boolean;
}

export function CompositeMediaPane({
  mode,
  imageUrl,
  baselineUrl,
  imageFloat,
  baselineFloat,
  isReferencePane,
  operation,
  comparisonOperationId,
  align,
  fit,
  onComparisonOperationChange,
  onCompareModeChange,
  colormap,
  interpolation,
  showAxes,
  processing,
  tonemap,
  peak,
  tonemap_gamma,
  zoom,
  pan,
  onViewChange,
  splitPosition,
  onSplitPositionChange,
  settingsSyncGroupId,
  syncIsAnchor,
  label,
  referenceLabel,
  foregroundLabel,
  isDraggable,
  onDragStart,
  onNaturalSize,
  overlay,
  overlaySettings,
  pixelValueNotation,
  toolbar = true,
}: CompositeMediaPaneProps) {
  // A "reference side" is either a URL baseline or a decoded float baseline; a
  // float side has no `baselineUrl` string, so gate on BOTH (the old
  // `baselineUrl == null` alone would misclassify a float-only reference as
  // "no reference" and collapse to a single "normal" pane).
  const hasBaseline = baselineUrl != null || baselineFloat != null;
  const hasFloatSide = imageFloat != null || baselineFloat != null;
  const effectiveMode: MediaCompareModeKind = !hasBaseline ? "normal" : mode;
  useGpuCompareReadyTick();
  const GpuImagePane = resolveGpuImagePane();

  // Slide-flip keyboard scope, read HERE (core, inside the real providers) and
  // threaded into the GPU compare pane below. `GpuComparePane` ships in a separate
  // bundle whose copies of these context objects differ in identity from the core
  // providers', so IT cannot read them itself — a `useContext` there returns the
  // default `false`, which let `→` BOTH flip the slider AND change the stacked-grid
  // tab (the reported collision). The CPU panes are core, so they still read the
  // same context via `useSplitFlipKeys`'s fallback; only the GPU pane needs these.
  const inStackedGrid = useContext(InStackedGridContext);
  const inOverlay = useContext(InFullscreenOverlayContext);

  // The settings STORE for the LIVE-compare (card / 3D-snapshot) viewport: this
  // pane is NOT under a plot-node `PaneSelectionFrame`, so IT owns the one store
  // per viewport (local store + group while synced; group > local > default —
  // see use-cell-settings.ts) and drives the composited pane top-down.
  const vst = useCellSettings(
    settingsSyncGroupId ? [{ id: settingsSyncGroupId }] : undefined,
  );
  const syncedSettings = vst.settings;
  // This frameless compositor is its viewport owner, so formation belongs here
  // rather than in the image renderer. The deferred seed reads the live box
  // after child initialization has filled any missing defaults.
  useSeedGroupOnFormation(
    settingsSyncGroupId,
    !!syncIsAnchor,
    vst.set,
    () => ({ ...(vst.get() ?? {}) }),
  );

  // The engine pane composites only split/diff (normal is a single image).
  const engineComposited =
    effectiveMode === "split" || effectiveMode === "diff";

  // Float sides are GPU-only for the COMPOSITED modes (`rgba32float` upload — the
  // legacy CPU split/diff panes take only URL sources). The engine pane
  // below ingests them when available; when it ISN'T, the CPU fallback further
  // down tone-maps them for a slide + a small notice — never a blank pane.
  // `useGpuCompareReadyTick` above forces a re-render once the gpu-image addon
  // finishes initializing, so on a WebGPU browser this resolves to the real GPU
  // pane below once ready.

  // Engine-backed split/diff (opt-in — see `resolveGpuImagePane`) on the
  // UNIFIED image pane (`GpuImagePane` + `compareSource`) — the SAME pane a
  // descriptor image-compare leaf lowers to (`plot-node.tsx`'s `LeafView`).
  // Slot convention (matches the unified pane + the deleted `GpuComparePane`'s
  // `texA − texB`): `source` = slot `a` = REFERENCE (`baselineUrl`/
  // `baselineFloat`), `compareSource.b` = slot `b` = FOREGROUND (`imageUrl`/
  // `imageFloat`), so `diff = a − b` and split shows the reference left of the
  // divider. One WGSL content-op pass composites/diffs the two operands; the
  // metrics chip / per-side captions / divider gesture ride the pane's chrome.
  // Float sides (`imageFloat`/`baselineFloat`) are threaded through here — the
  // engine pane ingests them as `rgba16float` textures.
  if (GpuImagePane && hasBaseline && engineComposited) {
    const referenceSource: ImageSource = baselineFloat
      ? compareFloatToDecoded(baselineFloat)
      : urlSource(baselineUrl);
    const foregroundSource: ImageSource = imageFloat
      ? compareFloatToDecoded(imageFloat)
      : urlSource(imageUrl);
    // Stable diff-cache identity keys (a source URL / float contentKey, NOT the
    // decoded bytes) — `a` = reference, `b` = foreground, matching the pool's
    // `ensureDiff(texA, texB)` ordering (see `renderers/image-backend.ts`).
    const contentKeyA = baselineFloat?.contentKey ?? baselineUrl ?? "diff:a";
    const contentKeyB = imageFloat?.contentKey ?? imageUrl ?? "diff:b";
    const compareSource: CompareSource = {
      b: foregroundSource,
      opId: comparisonOperationId ?? operation,
      mode: effectiveMode as "split" | "diff",
      colormap,
      splitPosition: splitPosition ?? 0.5,
      align,
      fit,
      contentKeyA,
      contentKeyB,
      referenceLabel,
      foregroundLabel,
      inStackedGrid,
      inOverlay,
      onComparisonOperationChange,
      onCompareModeChange,
      onSplitPositionChange,
    };
    return (
      <GpuImagePane
        source={referenceSource}
        compareSource={compareSource}
        toolbar={toolbar}
        syncedSettings={syncedSettings ?? undefined}
        setSyncedSettings={vst.set}
        tonemap={tonemap}
        peak={peak}
        gamma={tonemap_gamma}
        processing={processing}
        showAxes={showAxes ?? false}
        zoom={zoom}
        pan={pan}
        onViewChange={onViewChange}
        onNaturalSize={onNaturalSize}
        interpolation={interpolation}
        label={label}
        isDraggable={isDraggable}
        onDragStart={onDragStart}
        overlay={overlay}
        overlaySettings={overlaySettings}
        pixelValueNotation={pixelValueNotation}
      />
    );
  }

  // CPU FALLBACK (no GPU engine for this composite). Float compositing is
  // GPU-only, so tone-map the float side(s) on the CPU and show a real slide
  // + a small notice — a float `diff`, being pixel math, degrades to a
  // slide. Never a bare "unavailable" placeholder with no image.
  if (hasFloatSide) {
    return (
      <CpuFloatComparePane
        imageFloat={imageFloat}
        baselineFloat={baselineFloat}
        imageUrl={imageUrl}
        baselineUrl={baselineUrl}
        mode={effectiveMode}
        tonemap={tonemap}
        tonemap_gamma={tonemap_gamma}
        splitPosition={splitPosition}
        onSplitPositionChange={onSplitPositionChange}
        zoom={zoom}
        pan={pan}
        onViewChange={onViewChange}
        processing={processing}
        interpolation={interpolation}
        label={label}
        referenceLabel={referenceLabel}
        foregroundLabel={foregroundLabel}
        isDraggable={isDraggable}
        onDragStart={onDragStart}
        overlay={overlay}
        overlaySettings={overlaySettings}
        pixelValueNotation={pixelValueNotation}
      />
    );
  }

  if (effectiveMode === "split") {
    return (
      <MediaComparePane
        imageUrl={imageUrl}
        baselineUrl={baselineUrl}
        mode={effectiveMode}
        splitPosition={splitPosition ?? 0.5}
        onSplitPositionChange={onSplitPositionChange}
        zoom={zoom}
        pan={pan}
        onViewChange={onViewChange}
        processing={processing}
        interpolation={interpolation}
        label={label}
        referenceLabel={referenceLabel}
        foregroundLabel={foregroundLabel}
        isDraggable={isDraggable}
        onDragStart={onDragStart}
        overlay={overlay}
        overlaySettings={overlaySettings}
        pixelValueNotation={pixelValueNotation}
      />
    );
  }

  // An engine-only diff KERNEL (SSIM / FLIP / …) was requested but the engine
  // isn't available. `computeDiff` (the CPU path below) only does the pointwise
  // DiffModes, so fall back to a SLIDE of the two images + a small notice rather
  // than a broken/blank diff.
  if (effectiveMode === "diff" && isEngineOnlyDiff(operation)) {
    return (
      <div className="relative h-full w-full">
        <MediaComparePane
          imageUrl={imageUrl}
          baselineUrl={baselineUrl}
          mode="split"
          splitPosition={splitPosition ?? 0.5}
          onSplitPositionChange={onSplitPositionChange}
          zoom={zoom}
          pan={pan}
          onViewChange={onViewChange}
          processing={processing}
          interpolation={interpolation}
          label={label}
          referenceLabel={referenceLabel}
          foregroundLabel={foregroundLabel}
          isDraggable={isDraggable}
          onDragStart={onDragStart}
          overlay={overlay}
          overlaySettings={overlaySettings}
          pixelValueNotation={pixelValueNotation}
        />
        <CompareCpuNotice text="This diff needs WebGPU — showing slide" />
      </div>
    );
  }

  // "normal" | "diff" — one pane; ImagePane already owns the pixel-diff
  // pipeline (cache, GPU/CPU dispatch) and the false-color path, so "diff"
  // is simply passing its diffMode through, not a separate implementation.
  return (
    <CpuImagePane
      toolbar={false}
      source={urlSource(imageUrl)}
      baselineUrl={baselineUrl}
      isBaseline={isReferencePane}
      diffMode={effectiveMode === "diff" ? operation : "none"}
      interpolation={interpolation}
      colormap={colormap}
      tonemap={tonemap}
      peak={peak}
      gamma={tonemap_gamma}
      showAxes={showAxes ?? false}
      processing={processing}
      zoom={zoom}
      pan={pan}
      onViewChange={onViewChange}
      isDraggable={isDraggable}
      onDragStart={onDragStart}
      onNaturalSize={onNaturalSize}
      label={
        // diff → the "<metric> · <fg> compared to <ref>" caption (bottom-left);
        // normal (single image) → the foreground caption. Falls back to `label`.
        (effectiveMode === "diff"
          ? compareCaptions({ mode: "diff", comparisonOperationId: operation, referenceLabel, foregroundLabel }).left
          : foregroundLabel) ?? label
      }
      overlay={overlay}
      overlaySettings={overlaySettings}
      pixelValueNotation={pixelValueNotation}
    />
  );
}

// ---------------------------------------------------------------------------
// CrossTypeCompositeMediaPane — a thin wrapper around `CompositeMediaPane`
// (NOT a second compare path) for WS-VC6's cross-type `diff`.
//
// Every other mode (normal/split) works on the raw `imageUrl`/
// `baselineUrl` unchanged — CSS `object-fit: contain` already handles
// mismatched aspect visually. `diff` does per-pixel math, so when
// `alignForDiff` is set (only ever true for a cross-type pane — see
// VisualContentCard's wiring) this pre-resamples both frames onto one common
// raster via `cross-type-align.ts` before calling `CompositeMediaPane`,
// which then runs its EXISTING `image/diff.ts` pipeline unmodified (the two
// aligned frames are already equal-size, so `computeDiff`'s own
// `min(width,height)` crop becomes a no-op). While alignment is still
// pending (first mount) it falls back to the raw urls, same as today.
// ---------------------------------------------------------------------------
export function CrossTypeCompositeMediaPane(
  props: CompositeMediaPaneProps & { alignForDiff?: boolean },
) {
  const { alignForDiff, mode, imageUrl, baselineUrl, ...rest } = props;
  const shouldAlign = !!alignForDiff && mode === "diff" && !!imageUrl && !!baselineUrl;
  const [aligned, setAligned] = useState<{ a: string; b: string } | null>(null);

  useEffect(() => {
    if (!shouldAlign) {
      setAligned(null);
      return;
    }
    let cancelled = false;
    alignFrameSourcesForDiff({ kind: "url", url: imageUrl! }, { kind: "url", url: baselineUrl! }).then(
      (result) => {
        if (!cancelled && result) setAligned({ a: result.primaryUrl, b: result.referenceUrl });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAlign, imageUrl, baselineUrl]);

  const useAligned = shouldAlign && aligned;
  return (
    <CompositeMediaPane
      {...rest}
      mode={mode}
      imageUrl={useAligned ? aligned!.a : imageUrl}
      baselineUrl={useAligned ? aligned!.b : baselineUrl}
    />
  );
}
