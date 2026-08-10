/**
 * `renderers/image-backend.ts` — the ONE place the interchangeable image
 * BACKEND contract lives.
 *
 * cairn-plot ships two interchangeable image-rendering backends that accept the
 * EXACT SAME props and are chosen upstream by a render mode:
 *   - `renderers/CpuImagePane.tsx` — the 2D-canvas / CSS-transform CPU backend
 *     (unifies the former `ImagePane` SDR pane + `HdrImagePane` float-HDR pane).
 *   - `renderers/GpuImagePane.tsx` — the WebGPU engine backend.
 * Both are `(props: ImageBackendProps) => JSX.Element` and are picked per mount
 * by `plot-renderers.tsx`'s `resolveImageRenderer(mode)` (the "backends used
 * upstream" seam). This module holds the shared prop union, the `isHdrProps`
 * discriminant, and the user-settable render-mode resolution so BOTH backends
 * (and the seam) import them from one spot with no import cycle onto either
 * pane component.
 */
import { useMemo } from "react";
import type {
  Colormap,
  DiffMode,
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
} from "../types";
import type { Viewport as ImageViewport } from "../hooks/use-image-viewport";
import type { PixelValueNotation } from "../primitives/PixelValueOverlay";
import type { Precision } from "../image/half.ts";
import type { DeepFlattenController } from "../image/decoders.ts";

// ---------------------------------------------------------------------------
// HDR data contract — a parsed float `.npy` (from `parseNpy`, via the `imghdr`
// DataSpec). `[H,W]` grayscale, `[H,W,C]` with `C∈{1,3,4}`.
// ---------------------------------------------------------------------------
export interface HdrData {
  /**
   * Flattened samples in row-major order. Read per {@link HdrData.precision}:
   * a `Float64Array`/`Float32Array` of float VALUES (`"f32"`, the default), or
   * a `Uint16Array` of raw IEEE-754 binary16 BIT PATTERNS (`"f16-bits"` — the
   * F16 pipeline, kept half-precision through to an `rgba16float` upload; see
   * `../image/half.ts`).
   */
  data: Float64Array | Float32Array | Uint16Array;
  /** `[H,W]` | `[H,W,C]` with `C∈{1,3,4}`. */
  shape: number[];
  /** Raw numpy dtype string (e.g. `<f4`) — informational. */
  dtype: string;
  /**
   * How to interpret `data`: `"f32"` (float values, the default when absent —
   * every pre-F16 caller) or `"f16-bits"` (raw binary16 bits in a
   * `Uint16Array`). See `../image/half.ts`.
   */
  precision?: import("../image/half.ts").Precision;
  /**
   * Present ONLY for a DEEP EXR opened with live-flatten (the depth slider).
   * `data` above is the FULL composite; the controller re-flattens live at a Z
   * cutoff. The consuming pane MUST `dispose()` it on unmount. See
   * `../image/decoders.ts` and `./use-deep-flatten.ts`.
   */
  deep?: import("../image/decoders.ts").DeepFlattenController;
}

/** The float-HDR prop shape (presence of `hdr` selects this backend path). */
export interface HdrImageProps {
  hdr: HdrData;
  tonemap?: string;
  /** Base exposure in EV stops (`color * 2^EV`), applied in scene-linear BEFORE
   *  the tone-map operator. The CONTROLLED surface for the host-menu EV: the
   *  toolbar's EV slider is an ADDITIVE runtime adjustment ON TOP of this base
   *  (render EV = `exposure + sliderEV`), and HOME resets only the slider (to 0),
   *  so `exposure` persists. With the toolbar hidden (`toolbar={false}`) the host
   *  drives EV entirely through this prop. Default 0. */
  exposure?: number;
  /** Base additive OFFSET, applied AFTER exposure (before the operator) — the
   *  offset counterpart of {@link exposure}. Same controlled/additive contract:
   *  the toolbar's OFF slider adds on top and HOME zeroes only the slider. Default
   *  0 (unset ⇒ no base offset). Host-driven when `toolbar={false}`. */
  offset?: number;
  gamma?: number;
  /** Default PEAK ceiling `P` (×SDR white) — the UNIFIED HDR mode: every operator
   *  clips at `P` (SDR = `P=1`, `P>1` extends onto an HDR surface, `P=∞`/`Infinity`
   *  = raw browser-clipped). Seeds the pane's PEAK slider; unset → the pane default
   *  (4 on an engaged HDR surface). See `image/tonemap.ts`'s `resolveRenderTonemap`. */
  peak?: number;
  showAxes?: boolean;
  label?: string;
  interpolation?: Interpolation;
  zoom?: number;
  pan?: { x: number; y: number };
  onViewportChange?: (v: ImageViewport) => void;
  pixelValueNotation?: PixelValueNotation;
  /** Host seam (§ "Host-controlled panes", docs/API.md): render WITHOUT the
   *  `PlotToolbar` chrome when `false`, so a host can drive the view from its own
   *  menu via the controlled props above. Default `true`. See `ImagePaneShell`'s
   *  `toolbar` for the exact hidden-toolbar convention (no toolbar, no hover
   *  `group`, only the free-floating pixel-notation toggle while the TEV overlay
   *  is active). */
  toolbar?: boolean;
}

/** The 8-bit `imageUrl` prop shape (plus the legacy compare/diff plumbing). */
export interface SdrImageProps {
  imageUrl: string | null;
  baselineUrl?: string | null;
  isBaseline?: boolean;
  diffMode?: "none" | DiffMode;
  interpolation?: Interpolation;
  /** TONE-MAP operator for the plain 8-bit path (§B UNIFIED — the SAME 5-operator
   *  set as the HDR pane: linear · srgb · gamma · reinhard · aces). The GPU pane
   *  sRGB-DECODEs the 8-bit source to scene-linear, then runs the unified operator
   *  × PEAK pipeline (reinhard/aces are meaningful post-decode, and PEAK>1 extends
   *  onto an HDR surface). Seeds the pane's leading tonemap menu; default `"srgb"`
   *  (identity round-trip on an already-sRGB source). Ignored when a `colormap` is
   *  active (the false-color LUT output is already display-ready). DISTINCT from the
   *  8-bit CSS-filter `processing.gamma` (a separate brightness-style knob). NOTE:
   *  the CPU backend (2D canvas) is the P=1 hardware exception — SDR rendition
   *  only, no extended output. */
  tonemap?: string;
  /** Default γ for the Gamma operator (used only when `tonemap:"gamma"`), the
   *  exponent in `display = clamp(value)^(1/γ)`. Default 2.2. */
  gamma?: number;
  /** Default PEAK ceiling `P` (×SDR white) for the plain 8-bit path — the UNIFIED
   *  HDR mode (§B), identical to {@link HdrImageProps.peak}: every operator clips
   *  at `P` (SDR = `P=1`, `P>1` extends onto an HDR surface). Seeds the pane's PEAK
   *  slider (shown only when the extended surface engages); unset → the pane
   *  default (4). See `image/tonemap.ts`'s `resolveRenderTonemap`. */
  peak?: number;
  /** Base exposure in EV stops for the WebGPU 8-bit pipeline (`GpuImagePane`'s
   *  plain-SDR path sRGB-decodes to scene-linear, then applies `color * 2^EV`) —
   *  the controlled EV surface, additive with the toolbar's runtime EV slider (see
   *  {@link HdrImageProps.exposure}). Default 0. NOTE: the CPU 2D-canvas backend
   *  has no scene-linear recompute stage on the plain-SDR `<img>` path, so it does
   *  NOT apply this (documented graceful degradation — the WebGPU backend does). */
  exposure?: number;
  /** Base additive OFFSET for the WebGPU 8-bit pipeline (offset counterpart of
   *  {@link exposure}). Default 0. Same CPU-backend caveat. */
  offset?: number;
  colormap?: Colormap;
  showAxes?: boolean;
  processing?: ImageProcessing;
  zoom?: number;
  pan?: { x: number; y: number };
  onViewportChange?: (v: ImageViewport) => void;
  onNaturalSize?: (w: number, h: number) => void;
  label: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
  overlay?: ImageOverlayData;
  overlaySettings?: ImageOverlaySettings;
  pixelValueNotation?: PixelValueNotation;
  /** Host seam — hide the `PlotToolbar` when `false` (default `true`); see
   *  {@link HdrImageProps.toolbar} and `ImagePaneShell`. */
  toolbar?: boolean;
}

/**
 * The two INTERNAL, dtype-keyed pane representations. Formerly the public
 * backend union; now a pane-private detail reconstructed from the ONE unified
 * {@link ImageBackendProps} by {@link useLegacyImageProps}. Kept (and still
 * exported for back-compat) because both panes' bodies dispatch on
 * {@link isHdrProps} and the "SDR-`rgba8unorm`-surface vs float-`rgba16float`-
 * surface" choice is exactly this internal split, keyed on the decoded source's
 * dtype (design §3).
 */
export type LegacyImageProps = HdrImageProps | SdrImageProps;

/** Discriminant on the INTERNAL union: `true` for the float-HDR pane path. */
export function isHdrProps(p: LegacyImageProps): p is HdrImageProps {
  return "hdr" in p && (p as HdrImageProps).hdr != null;
}

// ---------------------------------------------------------------------------
// The ONE unified, dtype-tagged decoded-source prop (design §3). Both backends
// consume THIS shape; the CPU/GPU split and the surface-format choice are
// INTERNAL, keyed on `source.dtype`.
// ---------------------------------------------------------------------------

/** A decoded FLOAT source (EXR / float `.npy` / PFM / float-by-reference). */
export interface FloatSource {
  dtype: "float";
  /** Row-major samples; read per {@link precision} (see `../image/half.ts`). */
  data: Float64Array | Float32Array | Uint16Array;
  /** `[H,W]` | `[H,W,C]` with `C∈{1,3,4}`. */
  shape: number[];
  /** How to interpret `data`: `"f32"` (values) or `"f16-bits"` (binary16 bits). */
  precision?: Precision;
  /** Informational numpy dtype string (e.g. `"<f4"`). */
  numpyDtype?: string;
  /** Present only for a DEEP EXR opened with live-flatten (the depth slider). */
  deep?: DeepFlattenController;
}

/** A decoded UINT8 (SDR) source — a URL/data-URL the browser `<img>`-decodes
 *  (browser-native passthrough OR a uint8 `.npy` re-encoded to a PNG data URL).
 *  Kept as a URL so the byte-exact `<img>` path + URL-keyed caches survive. */
export interface Uint8Source {
  dtype: "uint8";
  url: string | null;
}

/** The ONE decoded-source shape, tagged by dtype (design §3). */
export type DecodedSource = FloatSource | Uint8Source;

/**
 * The ONE unified prop shape BOTH image backends accept. Carries the decoded
 * `source` (dtype-tagged) plus the FULL display-control set — each pane applies
 * what is meaningful for its surface (an SDR surface honours colormap/diff/
 * processing; a float surface honours tonemap/exposure/offset/peak/gamma; both
 * honour the common view controls). No `imageUrl` vs `hdr` fork.
 */
export interface ImageBackendProps {
  /** The decoded image, tagged by dtype (`float` | `uint8`). */
  source: DecodedSource;
  // — display controls (full set) —
  colormap?: Colormap;
  tonemap?: string;
  exposure?: number;
  offset?: number;
  peak?: number;
  gamma?: number;
  diffMode?: "none" | DiffMode;
  processing?: ImageProcessing;
  interpolation?: Interpolation;
  // — SDR compare / overlay plumbing —
  baselineUrl?: string | null;
  isBaseline?: boolean;
  overlay?: ImageOverlayData;
  overlaySettings?: ImageOverlaySettings;
  onNaturalSize?: (w: number, h: number) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
  // — common view controls —
  showAxes?: boolean;
  label?: string;
  zoom?: number;
  pan?: { x: number; y: number };
  onViewportChange?: (v: ImageViewport) => void;
  pixelValueNotation?: PixelValueNotation;
  /** Host seam — hide the `PlotToolbar` when `false` (default `true`). */
  toolbar?: boolean;
  // — multi-viewport SELECTION settings sync (viewport/image-settings-sync.ts) —
  /** When set (this pane is part of a ≥2 selection), the pane links its
   *  view-local display-setting overrides (colormap/tonemap/gamma/peak/exposure/
   *  offset) to this group: a local control change broadcasts to the group, and
   *  peers' changes apply here. Threaded down by `plot-node.tsx`'s
   *  `SelectionCell`; absent = no settings sync. */
  settingsSyncGroupId?: string;
  /** True when this pane is the selection ANCHOR — it seeds the group with its
   *  full current settings when the group forms, so members adopt the anchor's
   *  settings (design req 5). */
  syncIsAnchor?: boolean;
}

/**
 * The interchangeable image-backend interface: a component accepting the ONE
 * {@link ImageBackendProps}. Both `CpuImagePane` and `GpuImagePane` are
 * assignable; `resolveImageRenderer(mode)` returns one of them.
 */
export type ImageBackend = (props: ImageBackendProps) => JSX.Element;

/** `true` when the unified props carry a FLOAT source (the HDR surface path). */
export function isFloatSource(p: ImageBackendProps): boolean {
  return p.source.dtype === "float";
}

/** Wrap a decoded float `HdrData` as the unified {@link FloatSource}. */
export function hdrSource(hdr: HdrData): FloatSource {
  return {
    dtype: "float",
    data: hdr.data,
    shape: hdr.shape,
    numpyDtype: hdr.dtype,
    precision: hdr.precision,
    deep: hdr.deep,
  };
}

/** Wrap a URL/data-URL as the unified uint8 (SDR) {@link Uint8Source}. */
export function urlSource(url: string | null): Uint8Source {
  return { dtype: "uint8", url };
}

/**
 * Reconstruct a pane's INTERNAL {@link LegacyImageProps} from the ONE unified
 * {@link ImageBackendProps}, keyed on `source.dtype`. This is the ONE place the
 * unified shape fans out into the two dtype-keyed internal representations the
 * pane bodies already consume — so those ~1000-line bodies stay unchanged. The
 * float `hdr` wrapper is memoized on the (stable, resolve-once) `source` so its
 * identity is preserved across renders — the decode/upload/deep-flatten effects
 * depend on it. A hook (uses `useMemo`); call it once at the top of each pane.
 */
export function useLegacyImageProps(p: ImageBackendProps): LegacyImageProps {
  const src = p.source;
  // Memoize on the UNDERLYING stable fields (data/shape/precision/deep), NOT the
  // `source` wrapper identity — call sites (the compare side panes) may build a
  // fresh wrapper each render around a stable `data`/`deep`, and the decode/
  // upload/deep-flatten effects that key on `hdr` must not thrash.
  const floatData = src.dtype === "float" ? src.data : null;
  const floatShape = src.dtype === "float" ? src.shape : null;
  const floatPrecision = src.dtype === "float" ? src.precision : undefined;
  const floatNumpyDtype = src.dtype === "float" ? src.numpyDtype : undefined;
  const floatDeep = src.dtype === "float" ? src.deep : undefined;
  const hdr = useMemo<HdrData | null>(
    () =>
      floatData
        ? {
            data: floatData,
            shape: floatShape ?? [],
            dtype: floatNumpyDtype ?? "<f4",
            precision: floatPrecision,
            deep: floatDeep,
          }
        : null,
    [floatData, floatShape, floatPrecision, floatNumpyDtype, floatDeep],
  );
  if (hdr) {
    return {
      hdr,
      tonemap: p.tonemap,
      exposure: p.exposure,
      offset: p.offset,
      gamma: p.gamma,
      peak: p.peak,
      showAxes: p.showAxes,
      label: p.label,
      interpolation: p.interpolation,
      zoom: p.zoom,
      pan: p.pan,
      onViewportChange: p.onViewportChange,
      pixelValueNotation: p.pixelValueNotation,
      toolbar: p.toolbar,
    };
  }
  return {
    imageUrl: src.dtype === "uint8" ? src.url : null,
    baselineUrl: p.baselineUrl,
    isBaseline: p.isBaseline,
    diffMode: p.diffMode,
    interpolation: p.interpolation,
    tonemap: p.tonemap,
    gamma: p.gamma,
    peak: p.peak,
    exposure: p.exposure,
    offset: p.offset,
    colormap: p.colormap,
    showAxes: p.showAxes,
    processing: p.processing,
    zoom: p.zoom,
    pan: p.pan,
    onViewportChange: p.onViewportChange,
    onNaturalSize: p.onNaturalSize,
    label: p.label ?? "",
    isDraggable: p.isDraggable,
    onDragStart: p.onDragStart,
    className: p.className,
    overlay: p.overlay,
    overlaySettings: p.overlaySettings,
    pixelValueNotation: p.pixelValueNotation,
    toolbar: p.toolbar,
  };
}

// ---------------------------------------------------------------------------
// Shared HDR-decode primitives — used identically by both backends when they
// walk the raw float buffer (CpuImagePane's `tonemapToImageData`,
// GpuImagePane's `hdrToRGBAFloat32`). Kept here (not duplicated per pane) so
// the shape/channel contract has ONE definition.
// ---------------------------------------------------------------------------

/**
 * Decode an HDR `shape` into `(H, W, C)`. Grayscale `[H,W]` is treated as
 * `C=1`; `[H,W,C]` passes `C` through. Throws on any other rank.
 */
export function shapeDims(shape: number[]): { h: number; w: number; c: number } {
  if (shape.length === 2) return { h: shape[0]!, w: shape[1]!, c: 1 };
  if (shape.length === 3) return { h: shape[0]!, w: shape[1]!, c: shape[2]! };
  throw new Error(
    `cairn-plot image: unsupported HDR shape [${shape.join(",")}] (want [H,W] or [H,W,C]).`,
  );
}

/** NaN/±Inf → 0; finite values pass through. */
export function finite(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

// ---------------------------------------------------------------------------
// User-settable render mode (backend selection).
//
// NOTE: distinct from `image.ts`'s `getRenderMode()`, which is the (unrelated)
// WebGL2-vs-CPU switch for the pixel-DIFF compute path. This `RenderMode`
// picks which whole image BACKEND (CPU 2D-canvas vs. WebGPU) renders a pane.
// ---------------------------------------------------------------------------
export type RenderMode = "cpu" | "gpu" | "auto";

declare global {
  interface Window {
    /** Settable global override for the image backend (see `resolveRenderMode`). */
    __cairnPlotRenderMode?: RenderMode;
  }
}

function isRenderMode(v: unknown): v is RenderMode {
  return v === "cpu" || v === "gpu" || v === "auto";
}

/**
 * Resolve the active render mode. FIRST DEFINED WINS:
 *   1. an explicit `renderMode` (threaded from the plot spec),
 *   2. `window.__cairnPlotRenderMode` (a settable global),
 *   3. the URL query `?render=cpu|gpu|auto`,
 *   4. default `"auto"`.
 */
export function resolveRenderMode(explicit?: RenderMode | string | null): RenderMode {
  if (isRenderMode(explicit)) return explicit;
  if (typeof window !== "undefined") {
    if (isRenderMode(window.__cairnPlotRenderMode)) return window.__cairnPlotRenderMode;
    try {
      const q = new URLSearchParams(window.location.search).get("render");
      if (isRenderMode(q)) return q;
    } catch {
      /* location unavailable — fall through to default */
    }
  }
  return "auto";
}
