import { useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import GpuImagePane from "../webgpu/view";
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
} from "../webgpu/availability";
import { InFullscreenOverlayContext } from "../../../primitives/components/FullscreenOverlayShell";
import { InStackedGridContext } from "../../../layout/stack/stack-context";
import type {
  Colormap,
  DiffMode,
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
} from "../../types";
import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
import CpuImagePane from "../cpu/view";
import type { PixelValueNotation } from "../../../primitives/components/PixelValueOverlay";
import type { MediaCompareModeKind } from "../compare/mode";
import type { ImageCompareAlign, ImageCompareFit } from "./compare-align";
import { alignFrameSourcesForDiff } from "../compare/cross-type-align";
import { resolveRenderMode, urlSource } from "./contracts";
import {
  useSeedGroupOnFormation,
  useCellSettings,
} from "../../../state/settings/use-cell-settings";

import type {
  ImageComparisonInput,
  ImageBackendView,
} from "./contracts";
import type {
  FloatImageSource,
  ImageSource,
  ResolvedFloatImage,
} from "../definition/content.ts";

/**
 * Resolve the UNIFIED engine image pane (`GpuImagePane`, statically in core
 * since the addon fold) — only once the device gate confirms it. `null` selects
 * `CpuImagePane`, the other implementation of the SAME
 * {@link ImageBackendView} contract (probe pending, host opted out, or WebGPU
 * unavailable). It consumes the same backend availability signal as the generic
 * host, so offscreen cross-type comparison and descriptor-driven image
 * comparison agree on availability.
 */
function resolveGpuImagePane(): ImageBackendView | null {
  if (typeof window === "undefined") return null;
  const mode = resolveRenderMode();
  if (mode === "cpu") return null;
  return gpuImageGateState() === "ready" ? (GpuImagePane as ImageBackendView) : null;
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
    contentKey: src.contentKey,
    pixels: src.pixels,
    shape: [src.height, src.width, src.channels],
  };
}

// ---------------------------------------------------------------------------
// CompositeMediaPane — the single compositor entry point.
//
// This is a BACKEND ADAPTER, not a renderer: it turns the card-shaped compare
// props (foreground url/float, reference url/float, mode, kernel, split
// position) into the ONE unified `ImageBackendInput` + `ImageComparisonInput`
// contract, owns the viewport settings store, and hands the result to whichever
// backend is available — `GpuImagePane` when the device gate confirms WebGPU,
// otherwise `CpuImagePane`. BOTH backends render split, pointwise diffs, SSIM
// and FLIP from the same `compareSource`, so there is no "needs WebGPU" degraded
// path and no second split implementation here.
//
// `baselineUrl`/`baselineFloat` both null always forces "normal" regardless of
// `mode` — a mode selection with no resolved reference has nothing to compare
// against. The caller decides *whether* a reference resolves for this pane
// (including card-specific nuances like "hide split against a content-addressed
// duplicate of itself") and passes a null reference to opt a pane out.
// ---------------------------------------------------------------------------

export interface CompositeMediaPaneProps {
  mode: MediaCompareModeKind;
  imageUrl: string | null;
  baselineUrl: string | null;
  /** DECODED float sides (`.exr`/float `.npy` URLs) — the non-URL alternative to
   *  the URL sources above; see {@link ResolvedFloatImage}. Both backends ingest
   *  them (the GPU pane as an `rgba16float` texture, the CPU pane as a float
   *  source), so a float side is no longer GPU-only. */
  imageFloat?: ResolvedFloatImage;
  baselineFloat?: ResolvedFloatImage;
  /** True when this pane's own image IS the resolved reference series
   *  (the "series-same-step" baseline pane rendered alongside its peers). */
  isReferencePane?: boolean;

  /** Used only when the effective mode is "diff". */
  operation: DiffMode;
  /** Initial diff KERNEL id — seeds the pane's view-local kernel selection;
   *  falls back to `operation` when unset. */
  comparisonOperationId?: string;
  /** Mismatched-size diff operand handling (diff modes): `align` = overlap
   *  anchor (default "top-left"); `fit` = "crop" (default) | "fill". Ignored in
   *  split. */
  align?: ImageCompareAlign;
  fit?: ImageCompareFit;
  /** Fired when the pane's diff kernel changes (menu). */
  onComparisonOperationChange?: (operationId: string) => void;
  /** Fired when the pane's compare mode changes (split/diff menu).
   *  Lets `CompareView` keep its lifted view-mode state in sync. */
  onCompareModeChange?: (mode: "split" | "diff") => void;
  colormap: Colormap;
  interpolation: Interpolation;
  processing?: ImageProcessing;

  /** Host-controlled tone-map OPERATOR (unified 5-op set: linear · srgb · gamma
   *  · reinhard · aces) seeded onto the composited / single panes — the
   *  host-menu surface when the toolbar is hidden (`toolbar={false}`). Forwarded
   *  to whichever backend renders; the CPU 2D-canvas backend is the P=1 SDR-only
   *  hardware exception. Unset ⇒ each pane's own surface default (sRGB on SDR,
   *  Linear+managed PEAK on HDR). */
  tonemap?: string;
  /** Host-controlled PEAK ceiling `P` (the HDR mode, ×SDR white) — every operator
   *  clips at `P`. Unset ⇒ the pane default (1 on SDR / 4 on an engaged HDR
   *  surface). The CPU backend forces `P=1`. */
  peak?: number;
  /** Host-controlled Gamma-operator exponent γ (used only when `tonemap:"gamma"`).
   *  DISTINCT from `processing.gamma`, the separate display-adjust knob, so
   *  the two never double-apply. Unset ⇒ the operator default (2.2). */
  tonemap_gamma?: number;

  zoom: number;
  pan: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;

  /** Used only when the effective mode is "split". */
  splitPosition?: number;
  onSplitPositionChange?: (p: number) => void;

  /** Multi-pane SELECTION settings-sync — this compositor owns the ONE store per
   *  viewport and drives the rendered backend top-down, so a selected compare
   *  pane joins the ONE shared settings bus (mode / kernel / colormap / tonemap /
   *  … sync), the same bus the image panes use. Threaded from
   *  `CellSettingsContext` via `CompareView`. */
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

  /** Host seam — hide the rendered pane's toolbar when `false`, so a host can
   *  drive the compare view from its own menu. Default `true`. Threaded from
   *  `cp.Compare(toolbar=False)` via `CompareView` / the `ImageViewState`
   *  module. */
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
  const effectiveMode: MediaCompareModeKind = !hasBaseline ? "normal" : mode;
  useGpuCompareReadyTick();

  // Slide-flip keyboard scope, read HERE (core, inside the real providers) and
  // threaded into the pane below. The WebGPU pane ships in a separate bundle
  // whose copies of these context objects differ in identity from the core
  // providers', so IT cannot read them itself — a `useContext` there returns the
  // default `false`, which let `→` BOTH flip the slider AND change the stacked-grid
  // tab (the reported collision).
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

  // The two operands as unified, dtype-tagged sources. Memoized on the fields
  // that actually identify the content: the compare contract keys its metrics /
  // decode effects on operand IDENTITY, so a fresh wrapper per render (a settings
  // change, a gate tick) would rerun the full-resolution comparison pass.
  const foreground: ImageSource = useMemo(
    () => (imageFloat ? compareFloatToDecoded(imageFloat) : urlSource(imageUrl)),
    [imageFloat, imageUrl],
  );
  const reference: ImageSource = useMemo(
    () => (baselineFloat ? compareFloatToDecoded(baselineFloat) : urlSource(baselineUrl)),
    [baselineFloat, baselineUrl],
  );

  // ONE backend, chosen by the device gate — both implement `ImageBackendView`
  // and both render every compare mode, so nothing below branches on which.
  const Pane: ImageBackendView = resolveGpuImagePane() ?? CpuImagePane;

  // NORMAL: a single image (the reference is tracked by the caller but not
  // shown). No `compareSource`, so this is the byte-identical single-image path.
  if (!hasBaseline || effectiveMode === "normal") {
    return (
      <Pane
        source={foreground}
        toolbar={toolbar}
        syncedSettings={syncedSettings ?? undefined}
        setSyncedSettings={vst.set}
        colormap={colormap}
        tonemap={tonemap}
        peak={peak}
        gamma={tonemap_gamma}
        processing={processing}
        interpolation={interpolation}
        isBaseline={isReferencePane}
        zoom={zoom}
        pan={pan}
        onViewChange={onViewChange}
        onNaturalSize={onNaturalSize}
        label={foregroundLabel ?? label}
        isDraggable={isDraggable}
        onDragStart={onDragStart}
        overlay={overlay}
        overlaySettings={overlaySettings}
        pixelValueNotation={pixelValueNotation}
      />
    );
  }

  // SPLIT / DIFF: one pane over two operands. Slot convention (matches both
  // backends): `source` = slot `a` = REFERENCE (`baselineUrl`/`baselineFloat`),
  // `compareSource.b` = slot `b` = FOREGROUND (`imageUrl`/`imageFloat`), so
  // `diff = a − b` and split shows the reference left of the divider. The
  // metrics chip / per-side captions / divider gesture ride the pane's chrome,
  // so the compositor passes an empty `label` — the pane suppresses its own
  // label chip in compare mode and captions from `compareSource` instead.
  //
  // That makes the legacy single `label` the FOREGROUND caption's fallback (the
  // semantics the deleted `MediaComparePane` had, `caps.right ?? label`): a
  // caller that names only the primary side — `OffscreenComparePanes` passes
  // `label={primaryLabel}` and no per-side captions — would otherwise render a
  // compare pane with NO caption at all. Applied here, so both backends inherit it.
  //
  // Stable diff-cache identity keys (a source URL / float contentKey, NOT the
  // decoded bytes) — `a` = reference, `b` = foreground, matching the pool's
  // `ensureDiff(texA, texB)` ordering (see `renderers/image-backend.ts`).
  const compareSource: ImageComparisonInput = {
    b: foreground,
    operationId: comparisonOperationId ?? operation,
    mode: effectiveMode as "split" | "diff",
    colormap,
    splitPosition: splitPosition ?? 0.5,
    align,
    fit,
    contentKeyA: baselineFloat?.contentKey ?? baselineUrl ?? "diff:a",
    contentKeyB: imageFloat?.contentKey ?? imageUrl ?? "diff:b",
    referenceLabel,
    foregroundLabel: foregroundLabel ?? (label || undefined),
    inStackedGrid,
    inOverlay,
    onComparisonOperationChange,
    onCompareModeChange,
    onSplitPositionChange,
  };
  return (
    <Pane
      source={reference}
      compareSource={compareSource}
      toolbar={toolbar}
      syncedSettings={syncedSettings ?? undefined}
      setSyncedSettings={vst.set}
      tonemap={tonemap}
      peak={peak}
      gamma={tonemap_gamma}
      processing={processing}
      interpolation={interpolation}
      zoom={zoom}
      pan={pan}
      onViewChange={onViewChange}
      onNaturalSize={onNaturalSize}
      label=""
      isDraggable={isDraggable}
      onDragStart={onDragStart}
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
// `baselineUrl` unchanged — the shared viewport geometry already handles
// mismatched aspect visually. `diff` does per-pixel math, so when
// `alignForDiff` is set (only ever true for a cross-type pane — see
// VisualContentCard's wiring) this pre-resamples both frames onto one common
// raster via `cross-type-align.ts` before calling `CompositeMediaPane`,
// which then runs its EXISTING comparison pipeline unmodified (the two
// aligned frames are already equal-size, so the overlap crop becomes a no-op).
// While alignment is still pending (first mount) it falls back to the raw urls,
// same as today.
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
