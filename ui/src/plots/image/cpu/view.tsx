/**
 * CpuImagePane — the CPU (2D-canvas) image backend. One of TWO interchangeable
 * image backends (see `webgpu/view.tsx` for the WebGPU one): both accept the
 * SAME `ImageBackendInput` union (`runtime/contracts.ts`) and are chosen
 * upstream by the user-settable render mode (`resolveRenderMode` — cpu | gpu |
 * auto), so the rest of the app is backend-agnostic.
 *
 * ## One component, two prop shapes (mirrors the GPU pane exactly)
 * `isFloatSurfaceProps(props)` (presence of `hdr`) selects the branch:
 *   - SDR (`imageUrl` shape) — the decoded 8-bit source, optionally through the
 *     display transfer, the CPU `applyColormap` false-color pass, or the legacy
 *     `baselineUrl`/`diffMode` pixel-diff pipeline.
 *   - HDR (`hdr` float shape) — the single `tonemapToImageData` pass.
 * ASYMMETRY (unchanged): the HDR branch has no colormap-vs-diff selection and no
 * `processing` block — those props only exist on the SDR shape.
 *
 * ## The unified viewport (spec §3)
 * There is ONE presentation `<canvas>` per pane, sized to the viewport element's
 * DEVICE-pixel box, and ONE geometry: `useImageViewport` measures the viewport
 * element the shell owns and derives the quad / uv window / px-per-texel /
 * magnification filter that the paint, the TEV overlay, the detection overlay
 * and the region tools all read. The CPU backend no longer zooms by scaling a
 * wrapper with a CSS transform, no longer letterboxes with `object-fit`, and no
 * longer sets `image-rendering`: `paint.ts` blits the source into the canvas at
 * the quad the viewport defines, with `imageSmoothingEnabled` from the shared
 * magnification rule. Numbers and pixels cannot disagree, because there is only
 * one mapping.
 *
 * ## Content vs. presentation
 * `use-cpu-content.ts` owns the CONTENT stage: the diff / false-color /
 * transfer / tone-map pipelines, each keyed and cached, producing an
 * `ImageBitmap` (a `PaintSource`) and a version counter. It depends only on the
 * content identity and the scalar display parameters — never on the viewport —
 * so a pan or a zoom never re-runs a pixel pass, and a source swap holds the
 * previous frame until the new one is ready. The `processing` block
 * (brightness/contrast/γ/offset/flipSign), which used to be a CSS/SVG filter on
 * the `<img>`, is a per-pixel stage there now (`processing.ts`).
 *
 * ## COMPARE
 * `compareSource` in `diff` mode becomes an ordinary float image source (the
 * cached CPU error field — `useCpuComparisonInput`). In `split` mode this ONE
 * pane paints both operands into the SAME canvas: the reference under the clip
 * `[0, split]` and the foreground under `[split, 1]`, both at the REFERENCE
 * quad with the foreground's own grid — the GPU compositor's framing. The
 * divider rides the surface and the TEV read-out is two clipped overlays.
 *
 * ## `toolbar` (the shared host seam)
 * `toolbar?: boolean` (default `true`) is an OFFICIAL host seam on the shared
 * `ImageBackendInput` contract — the SAME prop the GPU pane accepts, so both
 * backends hide the toolbar identically. When `false` the shell renders NO
 * `PlotToolbar` (and no hover `group`); the ONLY floating affordance kept is the
 * `PixelNotationToggle` chip while the TEV overlay is active.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import LabelChip from "../../../primitives/components/LabelChip";
import RefBadge from "../../../primitives/components/RefBadge";
import SplitDivider from "../compare/SplitDivider.tsx";
import { useSplitFlipKeys } from "../compare/use-split-flip-keys.ts";
import type { Colormap } from "../../types";
import PixelValueOverlay, {
  buildChannelSample,
  type PixelSample,
  type PixelSampler,
  type PixelValueNotation,
} from "../../../primitives/components/PixelValueOverlay";
import { loadImageData } from "../resources/load-image-data.ts";
import { DIFF_MODE_LABELS } from "./diff.ts";
import { floatPixelReader, floatValues } from "../runtime/pixel-buffer.ts";
import {
  resolveDisplayOperator,
  TONEMAP_GAMMA_DEFAULT,
  TONEMAP_GAMMA_MIN,
  TONEMAP_GAMMA_MAX,
  TONEMAP_GAMMA_STEP,
  DISPLAY_TRANSFER_OPERATION_IDS,
  DISPLAY_OPERATION_IDS,
  type DisplayCurveId,
} from "../runtime/tonemap";
import ImagePaneShell, {
  type EnlargeControl,
  type ImagePaneOverlaySpec,
} from "../components/ImagePaneShell";
import { useImageViewport } from "../components/use-image-viewport.ts";
import type { ImageViewport } from "../components/image-viewport.ts";
import { paintViewport } from "./paint.ts";
import { useCpuContent, type CpuContent } from "./use-cpu-content.ts";
import { u8HistogramSource, floatHistogramSource } from "../components/image-histogram-source";
import { useCellSettings } from "../../../state/settings/use-cell-settings";
import type { PlotSettings } from "../../../settings/schema.ts";
import { displayToolbarButton, reduceSegment, usePaneEncoding } from "../components/display-operation";
import type { ReduceMode } from "../definition/display-operations.ts";
import { defaultReduceMode } from "../runtime/display-settings.ts";
import { computeCpuSourceMetrics, CPU_METRIC_OPERATION_IDS, type CpuSourceMetrics } from "./source-metrics.ts";
import { useDeepFlatten } from "../components/use-deep-flatten";
import {
  isFloatSurfaceProps,
  useImageSurfaceProps,
  shapeDims,
  type FloatImageData,
  type FloatSurfaceProps,
  type Uint8SurfaceProps,
  type ImageBackendView,
  type ImageBackendInput,
} from "../runtime/contracts";
import type { ImageProcessing } from "../../types";
import type { ToolbarButtonSpec } from "../../../primitives/controls/ToolbarConfig.ts";
import { buildCompareModeMenu } from "../compare/compare-mode-menu.ts";

// The two per-pixel display passes live in their own module so the content hook
// can call them without an import cycle through this view; re-exported here so
// `import { tonemapToImageData } from "../cpu/view"` keeps working.
export { tonemapToImageData, sdrTransferToImageData } from "./tonemap-image-data.ts";

const DEFAULT_PROCESSING: ImageProcessing = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  exposure: 0,
  offset: 0,
  flipSign: false,
};

/** SPLIT compare wiring handed down to whichever branch renders the pane. */
interface CompareSplit {
  /** The FOREGROUND operand (`compareSource.b`) — any dtype. */
  b: ImageBackendInput["source"];
  splitPosition: number;
  onSplitPositionChange?: (pos: number) => void;
  inStackedGrid?: boolean;
  inOverlay?: boolean;
}

/** The plumbing both branches receive from the public component. */
interface CpuPaneSyncProps {
  toolbar?: boolean;
  /** The viewport's effective settings from its store (group > local merge),
   *  driven down by the store owner (see `ImageBackendInput.syncedSettings`). */
  syncedSettings?: PlotSettings;
  /** The store's ONE write path (see `ImageBackendInput.setSyncedSettings`). */
  setSyncedSettings?: (patch: PlotSettings) => void;
  /** Controlled fullscreen state (see `ImageBackendInput.enlargeControl`). */
  enlargeControl?: EnlargeControl;
  /** Shared comparison captions/metrics; suppresses the ordinary label chip. */
  compareChrome?: ReactNode;
  compareLeadingMenus?: ToolbarButtonSpec[];
  cpuComparisonOperation?: string;
  isCompareMode?: boolean;
  compareSplit?: CompareSplit;
}

// ---------------------------------------------------------------------------
// The ONE presentation surface.
// ---------------------------------------------------------------------------

/**
 * The pane's presentation canvas and its paint. The backing store is assigned
 * ONLY when the device-pixel size actually changes (assigning `width`/`height`
 * clears the canvas, so an unconditional write would flash on every commit), and
 * the blit runs in a layout effect keyed on the viewport + the content version —
 * never the other way round. A pipeline that has not produced its first frame
 * leaves the canvas untouched, so the previous frame stays up while a new source
 * loads.
 */
function CpuPresentation({
  content,
  viewport,
  canvasRef,
  foreground,
  split,
}: {
  content: CpuContent;
  viewport: ImageViewport | null;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  /** Split compare: the foreground source drawn right of the divider, on the
   *  REFERENCE quad with its own grid (the GPU compositor's framing). */
  foreground?: CpuContent;
  split?: number;
}) {
  const appliedRef = useRef<{ width: number; height: number } | null>(null);
  const foregroundSource = foreground?.source ?? null;
  const foregroundVersion = foreground?.version ?? 0;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport) return;
    // HOLD THE PREVIOUS FRAME: with no source there is nothing to repaint, and
    // assigning `width`/`height` CLEARS a canvas — so the resize is skipped
    // too. A box change while a new source loads leaves the held frame up
    // (CSS-scaled by `w-full h-full` for the moment); the backing store is
    // re-sized by the very next run, which has a source to paint with it.
    if (!content.source) return;
    const { backing } = viewport;
    const applied = appliedRef.current;
    if (!applied || applied.width !== backing.width || applied.height !== backing.height) {
      canvas.width = backing.width;
      canvas.height = backing.height;
      appliedRef.current = { width: backing.width, height: backing.height };
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (foregroundSource && split != null) {
      paintViewport(ctx, viewport, content.source, { clipFraction: [0, split] });
      paintViewport(ctx, viewport, foregroundSource, {
        clipFraction: [split, 1],
        grid: { w: foregroundSource.width, h: foregroundSource.height },
        clear: false,
      });
    } else {
      paintViewport(ctx, viewport, content.source);
    }
  }, [viewport, content.source, content.version, foregroundSource, foregroundVersion, split, canvasRef]);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
      // Structural, not cosmetic: the viewport element measures itself, so this
      // canvas must stay OUT of flow even on a page with no Tailwind.
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      data-cpu-image-canvas=""
      aria-hidden
    />
  );
}

/** The centred status placeholder ("computing diff…" / "no image"). */
function CpuStatus({ content }: { content: CpuContent }) {
  const text = content.status === "empty" ? "no image" : content.statusText;
  if (!text) return null;
  return (
    <span
      className={`absolute inset-0 flex items-center justify-center text-xs text-fg-muted${
        content.status === "loading" ? " motion-safe:animate-pulse" : ""
      }`}
    >
      {text}
    </span>
  );
}

/**
 * The two split-clipped TEV overlays: LEFT of the divider the REFERENCE (the
 * framing grid), RIGHT the FOREGROUND on its OWN grid — so its numbers land on
 * its pixels even when the two resolutions differ. Mirrors the GPU compositor.
 */
function splitOverlaySpec(args: {
  viewport: ImageViewport | null;
  split: number;
  sample: PixelSampler;
  version: number;
  foregroundSample: PixelSampler;
  foregroundVersion: number;
  foregroundDims: { w: number; h: number } | null;
}): ImagePaneOverlaySpec {
  const { viewport, split, sample, version, foregroundSample, foregroundVersion, foregroundDims } = args;
  return {
    render: ({ notation, setOverlayActive }) =>
      !viewport ? null : (
        <>
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}
          >
            <PixelValueOverlay viewport={viewport} sample={sample} notation={notation} version={version} />
          </div>
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
          >
            <PixelValueOverlay
              viewport={viewport}
              sourceDims={foregroundDims ?? undefined}
              sample={foregroundSample}
              notation={notation}
              version={foregroundVersion}
              onActiveChange={setOverlayActive}
            />
          </div>
        </>
      ),
  };
}

/**
 * The SPLIT foreground's RAW buffer — the numbers the right-hand TEV overlay
 * prints. Independent of the display pipeline (like the reference side's
 * `valueDataRef`): a uint8 operand is decoded once per url, a float operand is
 * read straight out of its sample buffer.
 */
function useCompareForeground(
  b: ImageBackendInput["source"] | undefined,
  colormap: Colormap | null,
): { imageUrl: string | null; hdr?: FloatImageData; sample: PixelSampler; version: number } {
  const url = b && b.dtype === "uint8" ? b.url : null;
  const pixels = b && b.dtype === "float" ? b.pixels : null;
  const shape = b && b.dtype === "float" ? b.shape : null;
  const numpyDtype = b && b.dtype === "float" ? b.numpyDtype : undefined;
  const hdr = useMemo<FloatImageData | undefined>(
    () => (pixels ? { pixels, shape: shape ?? [], dtype: numpyDtype ?? "<f4" } : undefined),
    [pixels, shape, numpyDtype],
  );

  const dataRef = useRef<ImageData | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!url) {
      dataRef.current = null;
      setVersion((v) => v + 1);
      return;
    }
    let cancelled = false;
    void loadImageData(url).then((d) => {
      if (cancelled) return;
      dataRef.current = d;
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const sample = useCallback<PixelSampler>(
    (px, py, notation) => {
      if (hdr) {
        const { h, w, c } = shapeDims(hdr.shape);
        if (px < 0 || py < 0 || px >= w || py >= h) return null;
        const base = (py * w + px) * c;
        const readV = floatPixelReader(hdr.pixels);
        const values =
          c === 1
            ? [readV(base)]
            : colormap != null
              ? [readV(base), ...(c >= 4 ? [readV(base + 3)] : [])]
              : [readV(base), readV(base + 1), readV(base + 2), ...(c >= 4 ? [readV(base + 3)] : [])];
        return buildChannelSample(values, "unit", notation);
      }
      const vd = dataRef.current;
      if (!vd || px < 0 || py < 0 || px >= vd.width || py >= vd.height) return null;
      const i = (py * vd.width + px) * 4;
      const r = vd.data[i]!;
      const g = vd.data[i + 1]!;
      const bb = vd.data[i + 2]!;
      const a = vd.data[i + 3]!;
      return buildChannelSample(colormap != null ? [r, a] : [r, g, bb, a], "uint8", notation);
    },
    [hdr, colormap, version],
  );

  return { imageUrl: url, hdr, sample, version };
}

// ---------------------------------------------------------------------------
// SDR branch — the 8-bit source (plain / transfer / false-color / diff).
// ---------------------------------------------------------------------------

function CpuSdrImagePane(props: Uint8SurfaceProps & CpuPaneSyncProps) {
  const {
    imageUrl,
    baselineUrl = null,
    isBaseline = false,
    diffMode = "none",
    interpolation = "auto",
    colormap: colormapProp,
    tonemap: tonemapProp,
    gamma: gammaProp,
    exposure: baseExposure = 0,
    offset: baseOffset = 0,
    processing = DEFAULT_PROCESSING,
    zoom: zoomProp = 1,
    pan: panProp = { x: 0, y: 0 },
    onViewChange,
    onNaturalSize,
    label,
    isDraggable = false,
    onDragStart,
    overlay,
    overlaySettings,
    pixelValueNotation = "decimal",
    toolbar = true,
  } = props;

  // The viewport's settings STORE (see use-cell-settings.ts): threaded down from
  // its owner when present; a BARE mount owns its own group-of-one store —
  // settings live ONLY in stores, never in pane state.
  const sdrOwnStore = useCellSettings();
  const sdrThreadedSet = props.setSyncedSettings;
  const synced = sdrThreadedSet ? props.syncedSettings : sdrOwnStore.settings;
  const setSynced = sdrThreadedSet ?? sdrOwnStore.set;

  // UNIFIED DISPLAY ENCODING (Phase 3): ONE `encoding` id — the colormap LUTs
  // and the tev DISPLAY-TRANSFER curves (sRGB · Gamma · Linear) in one menu,
  // mutually exclusive by construction. `mode:"sdr"` (an 8-bit source has no
  // channel-count signal) offers the full set; the default curve coerces
  // `tonemap=` to a transfer (reinhard/aces/unknown → srgb). The γ for the Gamma
  // transfer rides `tonemapGamma` (slider gated by the active encoding's manifest).
  const enc = usePaneEncoding({
    mode: "sdr",
    arity: 1,
    curveSet: DISPLAY_TRANSFER_OPERATION_IDS,
    propColormap: colormapProp,
    propTonemap: tonemapProp,
    resolveDefaultCurve: (t) => {
      const s = resolveDisplayOperator(t);
      return s === "gamma" || s === "linear" ? s : "srgb";
    },
    // The settings store rules when present; picks publish and flow back down.
    settings: synced,
  });
  const colormap = enc.colormap as Colormap | null;
  const sdrTransfer = enc.curveId as DisplayCurveId;
  const gammaSeed = gammaProp && gammaProp > 0 ? gammaProp : TONEMAP_GAMMA_DEFAULT;
  // γ resolves at RENDER: store value > descriptor seed (the one lookup).
  const tonemapGamma =
    synced?.["image.tonemapGamma"] != null && synced["image.tonemapGamma"] > 0 ? synced["image.tonemapGamma"] : gammaSeed;
  const gammaModified = tonemapGamma !== gammaSeed;
  const displayEV = synced?.["image.exposureEV"] ?? 0;
  const displayOffset = synced?.["image.offset"] ?? 0;
  const effectiveExposure = baseExposure + displayEV;
  const effectiveOffset = baseOffset + displayOffset;
  const effectiveReduce = (synced?.["image.reduce"] as ReduceMode | undefined) ?? "luminance";
  const colorRange = synced?.["image.colorRange"];
  const colorBounds = useMemo<readonly [number, number] | null>(
    () => colorRange && Number.isFinite(colorRange.min) && Number.isFinite(colorRange.max)
      ? [colorRange.min, colorRange.max]
      : null,
    [colorRange?.min, colorRange?.max],
  );

  const publishSettings = setSynced;
  const changeEncoding = useCallback(
    (id: string) => {
      publishSettings({ "image.encoding": id });
    },
    [enc, publishSettings],
  );
  const changeGamma = useCallback(
    (v: number) => publishSettings({ "image.tonemapGamma": v }),
    [publishSettings],
  );
  const changeExposure = useCallback(
    (v: number) => publishSettings({ "image.exposureEV": v }),
    [publishSettings],
  );
  const changeOffset = useCallback(
    (v: number) => publishSettings({ "image.offset": v }),
    [publishSettings],
  );
  const changeReduce = useCallback(
    (v: ReduceMode) => publishSettings({ "image.reduce": v }),
    [publishSettings],
  );
  const changeInfoPanel = useCallback(
    (open: boolean) => publishSettings({ "panel.info": open }),
    [publishSettings],
  );

  // -----------------------------------------------------------------------
  // CONTENT + the ONE viewport geometry.
  // -----------------------------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const split = props.compareSplit;

  const content = useCpuContent({
    kind: "sdr",
    imageUrl,
    baselineUrl,
    isBaseline,
    diffMode,
    processing,
    sdrTransfer,
    colormap,
    tonemapGamma,
    effectiveExposure,
    effectiveOffset,
    effectiveReduce,
    colorBounds,
  });

  // SPLIT compare: the FOREGROUND operand, rendered through the same display
  // parameters and painted on the reference quad with its own grid.
  const foreground = useCompareForeground(split?.b, colormap);
  const foregroundContent = useCpuContent({
    kind: foreground.hdr ? "hdr" : "sdr",
    imageUrl: foreground.imageUrl,
    hdr: foreground.hdr,
    tonemapOp: sdrTransfer,
    sdrTransfer,
    processing,
    colormap,
    tonemapGamma,
    effectiveExposure,
    effectiveOffset,
    effectiveReduce,
    colorBounds,
  });

  const naturalDims = content.dims;
  const viewport = useImageViewport({ viewportRef, zoom: zoomProp, pan: panProp, naturalDims, interpolation });
  // The paint is synchronous in `CpuPresentation`'s layout effect, so the
  // controller's pre-screenshot repaint has nothing to schedule.
  const requestRender = useCallback(() => {}, []);

  // `[`/`]` (and the arrows outside a stacked grid) flip the divider to an edge.
  useSplitFlipKeys(viewportRef, split ? "split" : "none", split?.onSplitPositionChange, {
    inStackedGrid: split?.inStackedGrid,
    inOverlay: split?.inOverlay,
  });

  // Report the decoded source size up to the descriptor's listener.
  const onNaturalSizeRef = useRef(onNaturalSize);
  onNaturalSizeRef.current = onNaturalSize;
  const dimW = naturalDims?.w;
  const dimH = naturalDims?.h;
  useEffect(() => {
    if (dimW && dimH) onNaturalSizeRef.current?.(dimW, dimH);
  }, [dimW, dimH]);

  // -----------------------------------------------------------------------
  // TEV per-pixel value overlay — the RAW source pixels (the numbers we print),
  // decoded once per url and independent of the display pipeline.
  // -----------------------------------------------------------------------
  const valueDataRef = useRef<ImageData | null>(null);
  const [pixelDataVersion, setPixelDataVersion] = useState(0);
  const bumpPixelData = useCallback(() => setPixelDataVersion((v) => v + 1), []);

  useEffect(() => {
    if (!imageUrl) {
      valueDataRef.current = null;
      bumpPixelData();
      return;
    }
    let cancelled = false;
    void loadImageData(imageUrl).then((d) => {
      if (cancelled) return;
      valueDataRef.current = d;
      bumpPixelData();
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, bumpPixelData]);

  const samplePixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const vd = valueDataRef.current;
      if (!vd || px < 0 || py < 0 || px >= vd.width || py >= vd.height) return null;
      const i = (py * vd.width + px) * 4;
      const r = vd.data[i]!;
      const g = vd.data[i + 1]!;
      const b = vd.data[i + 2]!;
      const a = vd.data[i + 3]!;
      // A false-colored (colormap) pixel prints one untinted scalar line, plus
      // alpha when the source carries transparency. An RGB pixel ALWAYS prints
      // channel-tinted RGBA lines, even when RGB happens to be gray.
      const single = colormap != null;
      return buildChannelSample(single ? [r, a] : [r, g, b, a], "uint8", notation);
    },
    [colormap],
  );

  // In-pane HISTOGRAM source — bins the RAW RGBA source (the same `valueDataRef`
  // buffer the pixel-value overlay samples), not the colormapped display.
  const histogramSource = useMemo(
    () => u8HistogramSource(valueDataRef.current, pixelDataVersion),
    [pixelDataVersion],
  );

  return (
    <ImagePaneShell
      paneAttrs={{
        "data-cpu-image-pane": "",
        ...(props.cpuComparisonOperation ? { "data-cpu-comparison-result": props.cpuComparisonOperation } : {}),
      }}
      surfaceAttrs={{ "data-cpu-image-surface": "" }}
      toolbar={toolbar}
      viewportRef={viewportRef}
      viewport={viewport}
      zoom={zoomProp}
      pan={panProp}
      onViewChange={onViewChange}
      naturalDims={naturalDims}
      surface={
        <>
          <CpuPresentation
            content={content}
            viewport={viewport}
            canvasRef={canvasRef}
            foreground={split ? foregroundContent : undefined}
            split={split?.splitPosition}
          />
          <CpuStatus content={content} />
          {split && (
            <SplitDivider
              splitPosition={split.splitPosition}
              onChange={split.onSplitPositionChange}
              onReset={() => split.onSplitPositionChange?.(0.5)}
            />
          )}
        </>
      }
      imageOverlay={
        overlay && overlaySettings?.enabled && ((overlay.boxes?.length ?? 0) > 0 || (overlay.masks?.length ?? 0) > 0)
          ? { data: overlay, settings: overlaySettings }
          : undefined
      }
      overlay={
        split
          ? splitOverlaySpec({
              viewport,
              split: split.splitPosition,
              sample: samplePixel,
              version: pixelDataVersion,
              foregroundSample: foreground.sample,
              foregroundVersion: foreground.version + foregroundContent.version,
              foregroundDims: foregroundContent.dims,
            })
          : { sample: samplePixel, version: pixelDataVersion }
      }
      notationSeed={pixelValueNotation}
      exportCanvasRef={canvasRef}
      requestRender={requestRender}
      // SDR single-image: ONE unified DISPLAY menu (the tev DISPLAY-TRANSFER
      // curves sRGB · Gamma · Linear + the colormap LUTs) — mutually exclusive by
      // construction (`enc`), replacing the old colormap + transfer menu pair.
      leadingMenus={[
        ...(props.compareLeadingMenus ?? []),
        // CHANNELS (EXR part/layer) menu, owner-supplied — leading, like the rest.
        ...(props.channelMenu ? [props.channelMenu] : []),
        displayToolbarButton({ value: enc.displayOperationId, ids: enc.ids, onSelect: changeEncoding }),
      ]}
      rowSegments={enc.hasParam("reduce") ? [reduceSegment(effectiveReduce, changeReduce)] : []}
      displayAdjust={{
        exposureEV: displayEV,
        offset: displayOffset,
        onExposureChange: changeExposure,
        onOffsetChange: changeOffset,
      }}
      // γ slider — gated by the active encoding's manifest (only the Gamma curve
      // declares γ; a colormap LUT / other transfers do not).
      extraSliders={
        enc.hasParam("gamma")
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
          : undefined
      }
      onReset={() => {
        props.resetSettings?.();
        props.onChannelReset?.(); // channel override folds into HOME
      }}
      extraModified={
        enc.displayOperationModified ||
        gammaModified ||
        displayEV !== 0 ||
        displayOffset !== 0 ||
        !!props.channelModified
      }
      enlargeControl={props.enlargeControl}
      histogram={histogramSource}
      infoPanelSetting={synced?.["panel.info"]}
      onInfoPanelChange={changeInfoPanel}
      // COMPARE mode: the caption chips carry the labeling (suppress the pane's
      // own label chip); else the ordinary bottom-left label.
      label={props.isCompareMode ? "" : label}
      // Gate on a non-empty label (matching the CPU HDR path + the GPU pane), so
      // an empty label renders NO chip. The `side`-compare reference pane relies
      // on this: it passes `label=""` and shows the shared top-left `RefBadge`
      // instead of a bottom-left "REF" label chip.
      showLabelChip={!props.isCompareMode && !!label}
      extraChips={props.compareChrome}
      isDraggable={isDraggable}
      onDragStart={onDragStart}
    />
  );
}

// ---------------------------------------------------------------------------
// HDR branch — the float source through the single tone-map pass. No colormap-
// vs-diff selection and no `processing` here — asymmetric by design.
// ---------------------------------------------------------------------------

function CpuHdrImagePane(props: FloatSurfaceProps & CpuPaneSyncProps) {
  const {
    tonemap = "srgb",
    exposure = 0,
    offset: baseOffset = 0,
    gamma,
    label = "",
    interpolation = "auto",
    zoom = 1,
    pan = { x: 0, y: 0 },
    onViewChange,
    pixelValueNotation = "decimal",
    overlay,
    overlaySettings,
    toolbar = true,
  } = props;

  // The viewport's settings STORE (see use-cell-settings.ts): threaded down from
  // its owner when present; a BARE mount owns its own group-of-one store.
  const hdrOwnStore = useCellSettings();
  const hdrThreadedSet = props.setSyncedSettings;
  const synced = hdrThreadedSet ? props.syncedSettings : hdrOwnStore.settings;
  const setSynced = hdrThreadedSet ?? hdrOwnStore.set;

  // DEEP EXR depth slider: `hdr` is the live-flattened effective source; the
  // depth slider + HOME reset ride the shell (absent for non-deep sources).
  const deepFlatten = useDeepFlatten(props.hdr);
  const hdr = deepFlatten.hdr;

  // UNIFIED DISPLAY ENCODING (Phase 3): ONE `encoding` id replaces the separate
  // tone-map + colormap overrides. Like the GPU float pane, this pane KNOWS its
  // channel arity (`hdr.shape`), so it gates by arity: luts@k=1, `normal`@k=3,
  // curves always.
  const propColormap: Colormap | null =
    (props as unknown as { colormap?: Colormap }).colormap ?? null;
  const sourceArity = shapeDims(hdr.shape).c;
  const resolveDefaultCurve = useCallback(
    (t: string | null | undefined) => resolveDisplayOperator(t ?? undefined),
    [],
  );
  const enc = usePaneEncoding({
    mode: "arity",
    arity: sourceArity,
    curveSet: DISPLAY_OPERATION_IDS,
    propColormap,
    propTonemap: tonemap,
    resolveDefaultCurve,
    settings: synced,
  });
  const colormap = enc.colormap as Colormap;
  const tonemapOp = enc.curveId as DisplayCurveId;

  // Gamma(γ) for the Gamma operator (the γ slider is gated by the active
  // encoding's param manifest). Seeded from the descriptor `gamma=`, else 2.2.
  const gammaSeed = gamma && gamma > 0 ? gamma : TONEMAP_GAMMA_DEFAULT;
  const tonemapGamma =
    synced?.["image.tonemapGamma"] != null && synced["image.tonemapGamma"] > 0 ? synced["image.tonemapGamma"] : gammaSeed;
  const gammaModified = tonemapGamma !== gammaSeed;

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // EXPOSURE / OFFSET display-adjust sliders (§requirement B). View-local,
  // display-only — recomputes the CPU tone-map pass. The display EV ADDS to the
  // prop exposure; HOME zeroes only the slider, so the descriptor value persists.
  const displayEV = synced?.["image.exposureEV"] ?? 0;
  const displayOffset = synced?.["image.offset"] ?? 0;
  const effectiveExposure = exposure + displayEV;
  const effectiveOffset = baseOffset + displayOffset;

  // DATA-ENCODING BOUNDS (Phase 4) — mirrors the GPU pane. `colorRange` (grid-
  // shared descriptor) SEEDS the min/max BOUNDS skin — the ALTERNATIVE to EV/OFF
  // (never composed).
  const propColorRange = (props as unknown as { colorRange?: [number, number] }).colorRange;
  // MULTI-CHANNEL REDUCE — `null` = the k-based default (luminance for k≥3, mean
  // for k=2); the segmented control shows only while a lut is active AND k>1.
  const reduceDefault = defaultReduceMode(sourceArity);
  const effectiveReduce = (synced?.["image.reduce"] as ReduceMode | undefined) ?? reduceDefault;
  const colorBounds = useMemo<[number, number] | null>(
    () =>
      synced?.["image.colorRange"] !== undefined
        ? synced["image.colorRange"] === null
          ? null
          : [synced["image.colorRange"]!.min, synced["image.colorRange"]!.max]
        : (propColorRange ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [synced?.["image.colorRange"], propColorRange?.[0], propColorRange?.[1]],
  );
  const boundsSeedVal: [number, number] | null = propColorRange ?? null;
  const boundsModified =
    (colorBounds?.[0] ?? null) !== (boundsSeedVal?.[0] ?? null) ||
    (colorBounds?.[1] ?? null) !== (boundsSeedVal?.[1] ?? null);
  const boundsEngaged =
    enc.isLut && enc.hasParam("min") && !!colorBounds && Number.isFinite(colorBounds[0]) && Number.isFinite(colorBounds[1]);
  const boundsRange = useMemo(() => {
    const seed = propColorRange ?? [0, 1];
    const lo = seed[0];
    const hi = seed[1];
    const span = hi > lo ? hi - lo : 1;
    return { lo, hi, span };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propColorRange?.[0], propColorRange?.[1]]);

  const publishSettings = setSynced;
  // Every display gesture is ONE store write; the value flows back down through
  // the render lookup — no pane state to keep consistent.
  const changeEncoding = useCallback(
    (id: string) => {
      // Legacy colormap/tonemap wire keys are RETIRED (registry ruling): the
      // one `image.encoding` id carries the whole display look.
      publishSettings({ "image.encoding": id });
    },
    [enc, publishSettings, tonemapOp],
  );
  const changeGamma = useCallback(
    (v: number) => publishSettings({ "image.tonemapGamma": v }),
    [publishSettings],
  );
  const changeExposure = useCallback(
    (ev: number) => publishSettings({ "image.exposureEV": ev }),
    [publishSettings],
  );
  const changeOffset = useCallback(
    (off: number) => publishSettings({ "image.offset": off }),
    [publishSettings],
  );
  const changeReduce = useCallback(
    (mode: ReduceMode) => publishSettings({ "image.reduce": mode }),
    [publishSettings],
  );
  const changeBounds = useCallback(
    (next: [number, number]) =>
      publishSettings({ "image.colorRange": { min: next[0], max: next[1] } }),
    [publishSettings],
  );
  const changeInfoPanel = useCallback(
    (open: boolean) => publishSettings({ "panel.info": open }),
    [publishSettings],
  );

  // -----------------------------------------------------------------------
  // CONTENT + the ONE viewport geometry.
  // -----------------------------------------------------------------------
  const split = props.compareSplit;
  const content = useCpuContent({
    kind: "hdr",
    hdr,
    tonemapOp,
    colormap,
    tonemapGamma,
    // When bounds are engaged the tone-map reads the RAW value, so EV/OFF are
    // neutralized here to avoid a double-apply (single-application).
    effectiveExposure: boundsEngaged ? 0 : effectiveExposure,
    effectiveOffset: boundsEngaged ? 0 : effectiveOffset,
    effectiveReduce,
    colorBounds,
    boundsEngaged,
  });

  const foreground = useCompareForeground(split?.b, colormap);
  const foregroundContent = useCpuContent({
    kind: foreground.hdr ? "hdr" : "sdr",
    imageUrl: foreground.imageUrl,
    hdr: foreground.hdr,
    tonemapOp,
    sdrTransfer: tonemapOp,
    colormap,
    tonemapGamma,
    effectiveExposure: boundsEngaged ? 0 : effectiveExposure,
    effectiveOffset: boundsEngaged ? 0 : effectiveOffset,
    effectiveReduce,
    colorBounds,
    boundsEngaged,
  });

  const dims = content.dims;
  const viewport = useImageViewport({ viewportRef, zoom, pan, naturalDims: dims, interpolation });
  const requestRender = useCallback(() => {}, []);
  const pixelDataVersion = content.version;

  useSplitFlipKeys(viewportRef, split ? "split" : "none", split?.onSplitPositionChange, {
    inStackedGrid: split?.inStackedGrid,
    inOverlay: split?.inOverlay,
  });

  // TEV-style per-pixel value overlay: reads the RAW float samples so the
  // numbers are the true scene values (not the tone-mapped display pixels).
  const samplePixel = useCallback(
    (px: number, py: number, notation: PixelValueNotation): PixelSample | null => {
      const d = dims;
      if (!d || px < 0 || py < 0 || px >= d.w || py >= d.h) return null;
      const c = hdr.shape.length === 2 ? 1 : (hdr.shape[2] ?? 1);
      const base = (py * d.w + px) * c;
      // F16 pipeline: widen the touched samples lazily (single pixel) — the
      // self-describing buffer's reader hoists the representation branch.
      const readV = floatPixelReader(hdr.pixels);
      // A colormapped scalar prints one value plus alpha for RGBA sources, like
      // the SDR colormap pane. Plain multi-channel images print RGBA.
      const values =
        c === 1
          ? [readV(base)]
          : colormap != null
            ? [readV(base), ...(c >= 4 ? [readV(base + 3)] : [])]
            : [readV(base), readV(base + 1), readV(base + 2), ...(c >= 4 ? [readV(base + 3)] : [])];
      return buildChannelSample(values, "unit", notation);
    },
    [hdr, dims, colormap],
  );

  // In-pane HISTOGRAM source — bins the RAW float scene values. For a DEEP EXR,
  // `getGpuCsr` exports the retained samples so the panel can list the cursor
  // pixel's per-sample value + DEPTH (Z).
  const histogramSource = useMemo(
    () =>
      floatHistogramSource(
        hdr,
        pixelDataVersion,
        hdr.deep ? () => hdr.deep!.getGpuCsr() : undefined,
      ),
    [hdr, pixelDataVersion],
  );

  return (
    <ImagePaneShell
      paneAttrs={{
        "data-cpu-image-pane": "",
        ...(props.cpuComparisonOperation ? { "data-cpu-comparison-result": props.cpuComparisonOperation } : {}),
      }}
      surfaceAttrs={{ "data-cpu-image-surface": "" }}
      toolbar={toolbar}
      viewportRef={viewportRef}
      viewport={viewport}
      zoom={zoom}
      pan={pan}
      onViewChange={onViewChange}
      naturalDims={dims}
      surface={
        <>
          <CpuPresentation
            content={content}
            viewport={viewport}
            canvasRef={canvasRef}
            foreground={split ? foregroundContent : undefined}
            split={split?.splitPosition}
          />
          <CpuStatus content={content} />
          {split && (
            <SplitDivider
              splitPosition={split.splitPosition}
              onChange={split.onSplitPositionChange}
              onReset={() => split.onSplitPositionChange?.(0.5)}
            />
          )}
        </>
      }
      imageOverlay={
        overlay && overlaySettings?.enabled && ((overlay.boxes?.length ?? 0) > 0 || (overlay.masks?.length ?? 0) > 0)
          ? { data: overlay, settings: overlaySettings }
          : undefined
      }
      overlay={
        split
          ? splitOverlaySpec({
              viewport,
              split: split.splitPosition,
              sample: samplePixel,
              version: pixelDataVersion,
              foregroundSample: foreground.sample,
              foregroundVersion: foreground.version + foregroundContent.version,
              foregroundDims: foregroundContent.dims,
            })
          : { sample: samplePixel, version: pixelDataVersion }
      }
      notationSeed={pixelValueNotation}
      exportCanvasRef={canvasRef}
      requestRender={requestRender}
      // UNIFIED DISPLAY menu (Phase 3): ONE arity-gated dropdown (CURVES /
      // COLORMAPS / REMAPS sections). The CPU fallback tone-maps to an 8-bit
      // surface (never engages true HDR), so it is the SDR rendition by
      // construction (no PEAK slider).
      leadingMenus={[
        ...(props.compareLeadingMenus ?? []),
        // CHANNELS (EXR part/layer) menu, owner-supplied — leading, like the rest.
        ...(props.channelMenu ? [props.channelMenu] : []),
        displayToolbarButton({ value: enc.displayOperationId, ids: enc.ids, onSelect: changeEncoding }),
      ]}
      // SECOND-ROW segmented controls (controls-row-separation directive): the
      // multi-channel REDUCE (lut + k>1) picker sits in the second toolbar row
      // alongside EV/OFF/γ, not next to the DISPLAY menu.
      rowSegments={[
        ...(enc.hasParam("reduce") && sourceArity > 1 ? [reduceSegment(effectiveReduce, changeReduce)] : []),
      ]}
      // EXPOSURE / OFFSET display-adjust sliders — the CPU HDR tone-map pass
      // applies them. Gated by the ACTIVE encoding's param manifest: shown for
      // curves + luts, hidden for the paramless `normal` remap AND when the
      // min/max BOUNDS skin is engaged (the two are never composed).
      displayAdjust={
        enc.hasParam("exposure") && !boundsEngaged
          ? {
              exposureEV: displayEV,
              offset: displayOffset,
              onExposureChange: changeExposure,
              onOffsetChange: changeOffset,
            }
          : undefined
      }
      // γ slider — gated by the active encoding's manifest. Phase 4's min/max
      // bounds sliders follow.
      extraSliders={[
        ...(enc.hasParam("gamma")
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
      // DEEP depth-window sliders (Z-NEAR/Z-FAR) + region-select (absent for
      // non-deep); HOME resets the window to [zMin,zMax] and the tonemap override.
      depthSliders={deepFlatten.sliders}
      regionSelect={
        deepFlatten.hasDeep
          ? {
              rect: deepFlatten.region,
              queryLive: deepFlatten.queryRegionWindow,
              commit: deepFlatten.commitRegion,
              remove: deepFlatten.removeRegion,
            }
          : undefined
      }
      onReset={() => {
        deepFlatten.reset();
        props.resetSettings?.();
        props.onChannelReset?.(); // channel override folds into HOME
      }}
      extraModified={
        deepFlatten.isModified ||
        enc.displayOperationModified ||
        gammaModified ||
        effectiveReduce !== reduceDefault ||
        boundsModified ||
        !!props.channelModified
      }
      enlargeControl={props.enlargeControl}
      histogram={histogramSource}
      depthWindow={deepFlatten.hasDeep ? deepFlatten.window : undefined}
      infoPanelSetting={synced?.["panel.info"]}
      onInfoPanelChange={changeInfoPanel}
      label={props.isCompareMode ? "" : label}
      showLabelChip={!props.isCompareMode && !!label}
      extraChips={props.compareChrome}
    />
  );
}

// ---------------------------------------------------------------------------
// COMPARE chrome (captions / metrics / mode menu).
// ---------------------------------------------------------------------------

/**
 * COMPARE chrome for the CPU backend (content-op unification). Captions are
 * inlined (NOT `compareCaptions`, which pulls `engine/kernels` into the CORE
 * bundle — the CPU pane must stay engine-free). */
function cpuMetricsLabel(metrics: CpuSourceMetrics | null): string | null {
  if (!metrics) return null;
  const source = `MSE ${metrics.mse.toExponential(2)} · PSNR ${Number.isFinite(metrics.psnr) ? metrics.psnr.toFixed(1) : "∞"} dB`;
  return metrics.ssim == null
    ? source
    : `${source} · SSIM ${Number.isFinite(metrics.ssim) ? metrics.ssim.toFixed(4) : "—"}`;
}

function CpuMetricsChip({ label, stacked }: { label: string; stacked: boolean }) {
  return (
    <span
      className={`absolute right-1 z-30 max-w-[calc(100%-0.5rem)] truncate whitespace-nowrap overflow-hidden rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm font-mono ${stacked ? "bottom-7" : "bottom-1"}`}
      data-cpu-compare-metrics=""
      title={label}
    >
      {label}
    </span>
  );
}

function cpuCompareChrome(cs: ImageBackendInput["compareSource"], metricsLabel: string | null): ReactNode {
  if (!cs) return undefined;
  const mode = cs.mode ?? "diff";
  if (mode === "diff") {
    // ONE bottom-left caption "<fg> compared to <ref>" (no metric display name —
    // that needs the kernel registry the CPU bundle must not import).
    const fg = cs.foregroundLabel || "image";
    const ref = cs.referenceLabel || "reference";
    return (
      <>
        <LabelChip
          label={`${fg} compared to ${ref}`}
          corner="bottom-left"
          attrs={{ "data-cairn-compare-caption": "reference" }}
        />
        {metricsLabel && <CpuMetricsChip label={metricsLabel} stacked />}
      </>
    );
  }
  // split: REFERENCE bottom-left, FOREGROUND bottom-right (the foreground
  // chip is the selection stage's click-to-set-reference affordance).
  return (
    <>
      {mode === "split" && <RefBadge />}
      {cs.referenceLabel ? (
        <LabelChip
          label={cs.referenceLabel}
          corner="bottom-left"
          maxWidth={cs.foregroundLabel ? "half" : "full"}
          attrs={{ "data-cairn-compare-caption": "reference" }}
        />
      ) : null}
      {cs.foregroundLabel ? (
        <LabelChip
          label={cs.foregroundLabel}
          corner="bottom-right"
          maxWidth={cs.referenceLabel ? "half" : "full"}
          attrs={{ "data-cairn-compare-caption": "foreground" }}
        />
      ) : null}
      {metricsLabel && <CpuMetricsChip label={metricsLabel} stacked={!!(cs.referenceLabel || cs.foregroundLabel)} />}
    </>
  );
}

function useCpuCompareMetrics(input: ImageBackendInput): CpuSourceMetrics | null {
  const compare = input.compareSource;
  const [metrics, setMetrics] = useState<CpuSourceMetrics | null>(null);
  useEffect(() => {
    let cancelled = false;
    setMetrics(null);
    if (!compare) return () => { cancelled = true; };
    void computeCpuSourceMetrics({
      reference: input.source,
      foreground: compare.b,
      align: compare.align,
      fit: compare.fit,
      // The metric path speaks PUBLIC operation ids, so the selection passes
      // straight through; the membership check only guards ids this backend's
      // reference path does not implement (which yield no metrics at all).
      operation: compare.operationId in DIFF_MODE_LABELS ||
        (CPU_METRIC_OPERATION_IDS as readonly string[]).includes(compare.operationId)
        ? compare.operationId as NonNullable<Parameters<typeof computeCpuSourceMetrics>[0]["operation"]>
        : undefined,
    }).then((next) => {
      if (!cancelled) setMetrics(next);
    }).catch((error) => {
      console.warn("cairn-plot CPU comparison metrics failed", error);
    });
    return () => { cancelled = true; };
  }, [input.source, compare?.b, compare?.align, compare?.fit, compare?.operationId]);
  return metrics;
}

function cpuCompareModeMenu(compare: NonNullable<ImageBackendInput["compareSource"]>): ToolbarButtonSpec {
  return buildCompareModeMenu({
    mode: compare.mode ?? "diff",
    operation: compare.operationId,
    // No fallback list: the host adapter always supplies the menu, built once
    // from the active backend's capabilities (`runtime/comparison-menu.ts`), so
    // the CPU and WebGPU panes can never offer different operations.
    kernelOptions: compare.operationOptions ?? [],
    onSplit: () => compare.onCompareModeChange?.("split"),
    onOperation: (operationId) => compare.onComparisonOperationChange?.(operationId),
  });
}

function useCpuComparisonInput(input: ImageBackendInput, metrics: CpuSourceMetrics | null): ImageBackendInput {
  const compare = input.compareSource;
  // A diff is an ordinary float image source, but its wrapper and shape MUST stay
  // stable while only the viewport changes. Recreating `shape` here on every pan
  // invalidates `useImageSurfaceProps`'s memoized HDR object, which reruns the
  // full native-resolution tone-map pass for every pointer event.
  const comparisonSource = useMemo<ImageBackendInput["source"] | null>(() => {
    if (!compare || !metrics?.errorMap || !metrics.width || !metrics.height || !metrics.channels) return null;
    return {
      dtype: "float",
      pixels: floatValues(metrics.errorMap),
      shape: metrics.channels === 1
        ? [metrics.height, metrics.width]
        : [metrics.height, metrics.width, metrics.channels],
      numpyDtype: "<f4",
      contentKey: JSON.stringify([
        input.source.contentKey ?? "reference",
        compare.b.contentKey ?? "foreground",
        compare.operationId,
        compare.align ?? "top-left",
        compare.fit ?? "crop",
      ]),
    };
  }, [
    input.source.contentKey,
    compare?.b.contentKey,
    compare?.operationId,
    compare?.align,
    compare?.fit,
    metrics?.errorMap,
    metrics?.width,
    metrics?.height,
    metrics?.channels,
  ]);
  return comparisonSource
    ? { ...input, source: comparisonSource, exposure: 0, offset: 0 }
    : input;
}

// ---------------------------------------------------------------------------
// Public component.
// ---------------------------------------------------------------------------

/**
 * One of the two interchangeable image backends (the CPU/2D-canvas one — see the
 * WebGPU pane for the other); both accept the ONE {@link ImageBackendInput} and
 * are assignable to `ImageBackendView`. The unified `source` fans out (keyed on
 * `source.dtype`) into the two internal branches via {@link useImageSurfaceProps}.
 * A `split` compare keeps the ORIGINAL reference source (the error-field
 * substitution below is the DIFF mode's) and hands the foreground operand down
 * as `compareSplit`.
 */
export default function CpuImagePane(backendProps: ImageBackendInput): JSX.Element {
  const compareMetrics = useCpuCompareMetrics(backendProps);
  const comparisonInput = useCpuComparisonInput(backendProps, compareMetrics);
  const compare = backendProps.compareSource;
  const isSplit = compare?.mode === "split";
  // SPLIT composites the two operands live, so the pane keeps the REFERENCE as
  // its source; DIFF renders the cached error field as an ordinary float image.
  const props = useImageSurfaceProps(isSplit ? backendProps : comparisonInput);
  const isCompare = !!compare;
  const sync: CpuPaneSyncProps = {
    syncedSettings: backendProps.syncedSettings,
    setSyncedSettings: backendProps.setSyncedSettings,
    enlargeControl: backendProps.enlargeControl,
    // In compare mode the caption chips carry the labeling — suppress the pane's
    // own bottom-left label chip and hand the shell the compare chrome.
    compareChrome: cpuCompareChrome(compare, cpuMetricsLabel(compareMetrics)),
    compareLeadingMenus: compare ? [cpuCompareModeMenu(compare)] : undefined,
    cpuComparisonOperation: compare?.mode === "diff" &&
      (compare.operationId in DIFF_MODE_LABELS || !!compareMetrics?.errorMap)
      ? compare.operationId
      : undefined,
    isCompareMode: isCompare,
    compareSplit: isSplit && compare
      ? {
          b: compare.b,
          splitPosition: compare.splitPosition ?? 0.5,
          onSplitPositionChange: compare.onSplitPositionChange,
          inStackedGrid: compare.inStackedGrid,
          inOverlay: compare.inOverlay,
        }
      : undefined,
  };
  return isFloatSurfaceProps(props) ? (
    <CpuHdrImagePane {...props} {...sync} />
  ) : (
    <CpuSdrImagePane {...props} {...sync} />
  );
}

// Compile-time contract check: CpuImagePane implements the shared backend
// interface (accepts the plain `ImageBackendInput` union — `toolbar` is
// optional, so the plain union is assignable to `ImageBackendInput`).
const _backendCheck: ImageBackendView = CpuImagePane;
void _backendCheck;
