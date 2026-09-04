/** Shared input contract consumed by both image backends.
 *
 * The generic host selects a complete backend object; the image adapter then
 * projects one semantic presentation and settings command port into this
 * render-surface input. Neither backend owns settings or selection policy.
 */
import { useMemo } from "react";
import type {
  Colormap,
  DiffMode,
  ImageOverlayData,
  ImageOverlaySettings,
  ImageProcessing,
  Interpolation,
} from "../../types";
import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
import type { PixelValueNotation } from "../../../primitives/components/PixelValueOverlay";
import type { FloatPixels } from "../runtime/pixel-buffer.ts";
import type { PlotSettings } from "../../../settings/schema.ts";
import type {
  FloatImageSource,
  ImageCompareAlign,
  ImageCompareFit,
  ImageSource,
  Uint8ImageSource,
} from "../definition/content.ts";

// ---------------------------------------------------------------------------
// HDR data contract — a parsed float `.npy` (from `parseNpy`, via the `imghdr`
// DataSpec). `[H,W]` grayscale, `[H,W,C]` with `C∈{1,3,4}`.
// ---------------------------------------------------------------------------
export interface FloatImageData {
  /**
   * Flattened samples in row-major order — a SELF-DESCRIBING buffer whose
   * representation travels WITH the bytes (`image/pixel-buffer.ts`, user
   * ruling 2026-08-25): `"values"` (f32/f64, read directly) or `"f16-bits"`
   * (raw binary16 bit patterns, the F16 pipeline — kept half through to an
   * `rgba16float` upload). Read via the pixel-buffer accessors; the
   * bits-as-values misread is now unrepresentable.
   */
  pixels: FloatPixels;
  /** `[H,W]` | `[H,W,C]` with `C∈{1,3,4}`. */
  shape: number[];
  /** Raw numpy dtype string (e.g. `<f4`) — informational. */
  dtype: string;
  /**
   * Present ONLY for a DEEP EXR opened with live-flatten (the depth slider).
   * `pixels` above is the FULL composite; the controller re-flattens live at a
   * Z cutoff. The consuming pane MUST `dispose()` it on unmount. See
   * `../image/decoders.ts` and `./use-deep-flatten.ts`.
   */
  deep?: import("../resources/decoders.ts").DeepFlattenController;
}

/** The float-HDR prop shape (presence of `hdr` selects this backend path). */
export interface FloatSurfaceProps {
  hdr: FloatImageData;
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
  /** Optional authored false-color LUT for the FLOAT surface.
   *  The unified float pipeline runs a named colormap through the GPU/CPU LUT
   *  family on the scalar channel (a k>1 sample is reduced first), so a float
   *  scalar authored with `colormap=` seeds the DISPLAY encoding to that LUT —
   *  exactly as the 8-bit path does via {@link Uint8SurfaceProps.colormap}. Threaded
   *  through {@link useImageSurfaceProps} so `GpuImagePane`/`CpuImagePane` read it
   *  as `propColormap`. Unset leaves the display-operation default in effect. */
  colormap?: Colormap;
  label?: string;
  interpolation?: Interpolation;
  /** DETECTION overlay (bounding boxes + segmentation masks) drawn ON TOP of the
   *  FLOAT surface — the exact same annotation layer the 8-bit path honours (see
   *  {@link Uint8SurfaceProps.overlay}). The overlay is a display-space CSS layer
   *  ({@link ../ImageOverlay}); it composites over ANY decoded dtype, so a float
   *  EXR authored with `overlay=` draws its boxes/masks identically to a uint8
   *  PNG. Threaded through {@link useImageSurfaceProps} on BOTH dtype branches;
   *  unset ⇒ no annotations. */
  overlay?: ImageOverlayData;
  /** Display settings for {@link overlay} (visible classes, score threshold,
   *  mask opacity, box/mask toggles). Defaults on (`DEFAULT_OVERLAY_SETTINGS`).
   *  See {@link Uint8SurfaceProps.overlaySettings}. */
  overlaySettings?: ImageOverlaySettings;
  zoom?: number;
  pan?: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;
  pixelValueNotation?: PixelValueNotation;
  /** Host seam (§ "Host-controlled panes", docs/API.md): render WITHOUT the
   *  `PlotToolbar` chrome when `false`, so a host can drive the view from its own
   *  menu via the controlled props above. Default `true`. See `ImagePaneShell`'s
   *  `toolbar` for the exact hidden-toolbar convention (no toolbar, no hover
   *  `group`, only the free-floating pixel-notation toggle while the TEV overlay
   *  is active). */
  toolbar?: boolean;
  /** Multi-viewport SELECTION settings-sync group (see {@link ImageBackendInput}).
   *  Threaded through `useImageSurfaceProps` so the pane body reads it here. */
  /** CHANNELS toolbar menu (EXR part/layer selection) — a pre-built standard
   *  `ToolbarButtonSpec` dropdown supplied by the OWNER (`LeafView`, which holds
   *  the selection state and re-decodes on pick). The pane just renders it at
   *  the leading edge next to its own menus, folds `channelModified` into HOME's
   *  modified state, and calls `onChannelReset` from its reset handler. */
  channelMenu?: import("../../../primitives/controls/ToolbarConfig").ToolbarButtonSpec;
  /** True while a view-local channel override is active (drives HOME's dot). */
  channelModified?: boolean;
  /** Clear the channel override back to the authored selection (HOME/dbl-click). */
  onChannelReset?: () => void;
  /** True when this pane is the reused renderer of a STACKED viewport (see
   *  {@link ImageBackendInput.inStackedGrid}). */
  inStackedGrid?: boolean;
  resetSettings?: () => void;
}

/** The 8-bit `imageUrl` prop shape (plus the legacy compare/diff plumbing). */
export interface Uint8SurfaceProps {
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
   *  HDR mode (§B), identical to {@link FloatSurfaceProps.peak}: every operator clips
   *  at `P` (SDR = `P=1`, `P>1` extends onto an HDR surface). Seeds the pane's PEAK
   *  slider (shown only when the extended surface engages); unset → the pane
   *  default (4). See `image/tonemap.ts`'s `resolveRenderTonemap`. */
  peak?: number;
  /** Base exposure in EV stops. Both backends sRGB-decode to scene-linear and
   *  apply `color * 2^EV` before display encoding; the CPU backend switches from
   *  its plain `<img>` fast path to an exact canvas recompute when adjusted. */
  exposure?: number;
  /** Base additive OFFSET applied after exposure by both backends. */
  offset?: number;
  colormap?: Colormap;
  processing?: ImageProcessing;
  zoom?: number;
  pan?: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;
  onNaturalSize?: (w: number, h: number) => void;
  label: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
  overlay?: ImageOverlayData;
  overlaySettings?: ImageOverlaySettings;
  pixelValueNotation?: PixelValueNotation;
  /** Host seam — hide the `PlotToolbar` when `false` (default `true`); see
   *  {@link FloatSurfaceProps.toolbar} and `ImagePaneShell`. */
  toolbar?: boolean;
  /** Multi-viewport SELECTION settings-sync group (see {@link ImageBackendInput}).
   *  Threaded through `useImageSurfaceProps` so the pane body reads it here. */
  /** CHANNELS toolbar menu (EXR part/layer selection) — a pre-built standard
   *  `ToolbarButtonSpec` dropdown supplied by the OWNER (`LeafView`, which holds
   *  the selection state and re-decodes on pick). The pane just renders it at
   *  the leading edge next to its own menus, folds `channelModified` into HOME's
   *  modified state, and calls `onChannelReset` from its reset handler. */
  channelMenu?: import("../../../primitives/controls/ToolbarConfig").ToolbarButtonSpec;
  /** True while a view-local channel override is active (drives HOME's dot). */
  channelModified?: boolean;
  /** Clear the channel override back to the authored selection (HOME/dbl-click). */
  onChannelReset?: () => void;
  /** True when this pane is the reused renderer of a STACKED viewport (see
   *  {@link ImageBackendInput.inStackedGrid}). */
  inStackedGrid?: boolean;
  resetSettings?: () => void;
}

/**
 * The two INTERNAL, dtype-keyed pane representations. Formerly the public
 * backend union; now a pane-private detail reconstructed from the ONE unified
 * {@link ImageBackendInput} by {@link useImageSurfaceProps}. Kept (and still
 * used by both backend views because their bodies dispatch on
 * {@link isFloatSurfaceProps} and the "SDR-`rgba8unorm`-surface vs float-`rgba16float`-
 * surface" choice is exactly this internal split, keyed on the decoded source's
 * dtype (design §3).
 */
export type ImageSurfaceProps = FloatSurfaceProps | Uint8SurfaceProps;

/** Discriminant on the INTERNAL union: `true` for the float-HDR pane path. */
export function isFloatSurfaceProps(p: ImageSurfaceProps): p is FloatSurfaceProps {
  return "hdr" in p && (p as FloatSurfaceProps).hdr != null;
}

// ---------------------------------------------------------------------------
// The ONE unified, dtype-tagged decoded-source prop (design §3). Both backends
// consume THIS shape; the CPU/GPU split and the surface-format choice are
// INTERNAL, keyed on `source.dtype`.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// COMPARE source (content-op unification). Presence of `compareSource` on
// {@link ImageBackendInput} turns the GPU image pane into a COMPARE pane over two
// operands: the primary `source` is the REFERENCE (slot `a`) and `compareSource.b`
// is the FOREGROUND (slot `b`) — the pane uploads `b` via the pool's second source
// slot (`setSourceB`) and renders a compare IMAGE operation (`image/operations`)
// instead of the single-image identity. The `operationId` selects the mode:
//   - DIFF (Phase 2c): a pointwise DIRECT op (signed/absolute/…) samples both
//     slots inline, or a CACHED metric (FLIP/HDR-FLIP/SSIM) runs through
//     `renderDiffCached`; displayed as a scalar error (colormap).
//   - SPLIT (Phase 3): a compositor DIRECT op composites the two slots by the
//     fragment uv against the compositor param (`splitPosition`); displayed as
//     ordinary LIGHT (curves) — a divider gesture + per-side captions + per-side
//     TEV readout ride the pane's chrome.
// The single-image path is byte-identical when `compareSource` is ABSENT.
// ---------------------------------------------------------------------------

/** Where the smaller operand sits within the larger before the overlap crop (a
 *  mismatched-size diff). Mirrors `engine/compare-align`'s `ImageCompareAlign`. */
/**
 * The COMPARE operand + diff settings that turn the GPU image pane into a diff
 * pane. Ported from `GpuComparePane`'s diff plumbing, but routed THROUGH the pool
 * (`setSourceB` + `renderDiffCached`) rather than self-managed textures.
 */
export interface ImageComparisonInput {
  /** The FOREGROUND operand `b` — same dtype-tagged shape as the primary
   *  {@link ImageBackendInput.source} (which is the REFERENCE / slot `a`). Slot
   *  convention (diff + compositor): `a` = reference (texA), `b` = foreground
   *  (texB), so `diff = a − b` and split shows the reference left of the divider. */
  b: ImageSource;
  /** Backend-supported comparison operations, resolved by the shared image
   * runtime from the selected backend's capability declaration. */
  operationOptions?: { id: string; label: string }[];
  /** The DIFF kernel — a menu selection token (a pointwise id, `"flip"`, or
   *  `"ssim"`). SEEDS the pane's diff-kernel state (always a real
   *  kernel, even while {@link mode} is a compositor mode — so switching INTO diff
   *  restores it). Resolved to a concrete kernel id by `resolveComparisonOperationId`. */
  operationId: string;
  /** Concrete FLIP algorithm selected by shared settings. */
  flipMode?: "sdr" | "hdr";
  /** The COMPARE mode: `"diff"` (the scalar-error diff of {@link operationId}, the
   *  default when absent) OR the Phase-3 compositor mode `"split"` (a LIGHT
   *  composite of the two operands by divider). Selecting a mode is an OP switch
   *  on the reused pane — the display + chrome change, no remount. */
  mode?: "diff" | "split";
  /** Split-divider position `[0,1]` (`operationId:"split"`) — the reference is shown
   *  where the fragment `uv.x < splitPosition`. Controlled: the pane's divider /
   *  `[`·`]` keys report up via {@link onSplitPositionChange}; the owner lifts it
   *  and the new value flows back. Default 0.5. */
  splitPosition?: number;
  /** Fired when the split divider / flip keys move the divider — lifts the split
   *  position to the owner (`CompareView`'s lifted `splitPos`). */
  onSplitPositionChange?: (pos: number) => void;
  /** True when this compare pane is inside a STACKED grid — threaded from the CORE
   *  side (the addon bundle's context identity differs) so `useSplitFlipKeys`
   *  scopes the `←`/`→`/`h`/`l` flip aliases correctly (`[`·`]` always flip). */
  inStackedGrid?: boolean;
  /** True when this compare pane is inside a FULLSCREEN overlay (see above). */
  inOverlay?: boolean;
  /** Optional authored display operation for the comparison. Absence uses the
   *  shared Linear default.
   *  Kernel changes do not alter it. */
  colormap?: Colormap | null;
  /** Alignment anchor for mismatched-size operands (ignored under `fit:"fill"`). */
  align?: ImageCompareAlign;
  /** Mismatched-size handling (`"crop"` default | `"fill"`). */
  fit?: ImageCompareFit;
  /** Content-identity cache keys for the diff cache (stable across remount — a
   *  source URL, not the decoded bytes). `a` = foreground/primary, `b` = reference. */
  contentKeyA?: string;
  contentKeyB?: string;
  /** Per-side captions for the diff caption ("<metric> · <fg> compared to <ref>"). */
  referenceLabel?: string;
  foregroundLabel?: string;
  /** Fired when the pane's diff MODE changes via its own MODE menu — lets an owner
   *  (`CompareView`) keep its lifted mode/kernel state coherent (Phase 2c routing). */
  onComparisonOperationChange?: (operationId: string) => void;
  /** Fired when the pane's MODE menu switches mode (slide ↔ diff) — the
   *  owner lifts it (`CompareView`'s `viewMode`). Phase 3: split now ALSO
   *  renders on THIS unified pane, so a mode switch is an OP switch on the reused
   *  instance (NO remount) — not the old route-to-`GpuComparePane` remount. */
  onCompareModeChange?: (mode: "split" | "diff") => void;
  /** True when the hoisted compare control (mode / kernel / split) differs
   *  from the descriptor — folds into the pane's HOME-enabled ("modified") state. */
  compareModified?: boolean;
}

/**
 * The ONE unified prop shape BOTH image backends accept. Carries the decoded
 * `source` (dtype-tagged) plus the FULL display-control set — each pane applies
 * what is meaningful for its surface (an SDR surface honours colormap/diff/
 * processing; a float surface honours tonemap/exposure/offset/peak/gamma; both
 * honour the common view controls). No `imageUrl` vs `hdr` fork.
 */
export interface ImageBackendInput {
  /** The decoded image, tagged by dtype (`float` | `uint8`). */
  source: ImageSource;
  /** When set, the pane renders a DIFF of `source` (foreground/`a`) against
   *  `compareSource.b` (reference) — see {@link ImageComparisonInput}. Absent = the
   *  byte-identical single-image path. Both backends render split, pointwise
   *  differences, SDR/HDR-FLIP, and SSIM; capability metadata controls the shared
   *  operation menu. */
  compareSource?: ImageComparisonInput;
  /** The viewport's EFFECTIVE settings from its ONE store (`useCellSettings`
   *  at the node/stage/compositor level): the `group > local` merge, driven DOWN.
   *  The pane derives its display values from these at RENDER (no adoption, no
   *  local copy) and writes changes back via {@link setSyncedSettings}. The pane
   *  itself is NEVER a bus subscriber. Absent = no store (a bare host mount);
   *  the pane falls back to its own local state / prop seeds. */
  syncedSettings?: PlotSettings;
  /** The ONE write path into the viewport's settings store (the GROUP store
   *  while selected — transient, gone on unselect; else the local store, which
   *  sticks). Every user gesture on a display control calls this; absent = no
   *  store. */
  setSyncedSettings?: (patch: PlotSettings) => void;
  /** LOCAL apply (no fan-out) — the INITIALIZATION write path: the pane seeds
   *  MISSING settings keys from the first content it shows (single source of
   *  truth rule); init must never fan to group peers. */
  /** HOME command supplied by the viewport owner. The renderer does not derive
   *  defaults from its current rendering mode or source. */
  resetSettings?: () => void;
  /** CONTROLLED single-pane fullscreen state, owned by the plot leaf ABOVE the
   *  async-resolve swap (`LeafView`) so a cold re-resolve (a channel pick's
   *  "Loading…" placeholder unmounting this pane) cannot reset it. Threaded to
   *  `ImagePaneShell.enlargeControl`; absent = shell-local state. */
  enlargeControl?: { enlarged: boolean; setEnlarged: (v: boolean) => void };
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
  label?: string;
  zoom?: number;
  pan?: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;
  pixelValueNotation?: PixelValueNotation;
  /** Host seam — hide the `PlotToolbar` when `false` (default `true`). */
  toolbar?: boolean;
  // — multi-viewport SELECTION settings sync (viewport/viewport-settings.ts) —
  /** CHANNELS toolbar menu (EXR part/layer selection) — a pre-built standard
   *  `ToolbarButtonSpec` dropdown supplied by the OWNER (`LeafView`, which holds
   *  the selection state and re-decodes on pick). The pane just renders it at
   *  the leading edge next to its own menus, folds `channelModified` into HOME's
   *  modified state, and calls `onChannelReset` from its reset handler. */
  channelMenu?: import("../../../primitives/controls/ToolbarConfig").ToolbarButtonSpec;
  /** True while a view-local channel override is active (drives HOME's dot). */
  channelModified?: boolean;
  /** Clear the channel override back to the authored selection (HOME/dbl-click). */
  onChannelReset?: () => void;
  /** True when this pane is the ONE reused renderer of a STACKED viewport (set by
   *  `LeafView` from the CORE-side `InStackedGridContext`). A stack owns ONE SHARED
   *  display-settings object: every slot renders under the stack's current
   *  encoding/colormap, a pick applies to all slots + survives flips, each image's
   *  authored props are SEEDS only, HOME adopts the focused slot's defaults, and
   *  leaving stacked mode (this pane unmounts) discards the shared settings. Absent ⇒
   *  a standalone pane / normal grid cell (each keeps its own authored defaults). */
  inStackedGrid?: boolean;
  /** Report an unrecoverable backend failure to the owning runtime. Backends do
   * not import or mount one another; fallback policy lives above this seam. */
  onBackendFailure?: (error?: unknown) => void;
}

/**
 * The interchangeable image-backend interface: a component accepting the ONE
 * {@link ImageBackendInput}. Both `CpuImagePane` and `GpuImagePane` are
 * assignable; `resolveImageRenderer(mode)` returns one of them.
 */
export type ImageBackendView = (props: ImageBackendInput) => JSX.Element;

/** `true` when the unified props carry a FLOAT source (the HDR surface path). */
export function isFloatSource(p: ImageBackendInput): boolean {
  return p.source.dtype === "float";
}

/** Wrap decoded float data as a backend-neutral image source. */
export function hdrSource(hdr: FloatImageData, contentKey?: string): FloatImageSource {
  return {
    dtype: "float",
    contentKey,
    pixels: hdr.pixels,
    shape: hdr.shape,
    numpyDtype: hdr.dtype,
    deep: hdr.deep,
  };
}

/** Wrap a URL/data-URL as a backend-neutral uint8 image source. */
export function urlSource(url: string | null): Uint8ImageSource {
  return { dtype: "uint8", url, contentKey: url ?? undefined };
}

/**
 * Reconstruct a pane's INTERNAL {@link ImageSurfaceProps} from the ONE unified
 * {@link ImageBackendInput}, keyed on `source.dtype`. This is the ONE place the
 * unified shape fans out into the two dtype-keyed internal representations the
 * pane bodies already consume — so those ~1000-line bodies stay unchanged. The
 * float `hdr` wrapper is memoized on the (stable, resolve-once) `source` so its
 * identity is preserved across renders — the decode/upload/deep-flatten effects
 * depend on it. A hook (uses `useMemo`); call it once at the top of each pane.
 */
export function useImageSurfaceProps(p: ImageBackendInput): ImageSurfaceProps {
  const src = p.source;
  // Memoize on the UNDERLYING stable fields (pixels/shape/deep), NOT the
  // `source` wrapper identity — call sites (the compare side panes) may build a
  // fresh wrapper each render around a stable `pixels`/`deep`, and the decode/
  // upload/deep-flatten effects that key on `hdr` must not thrash.
  const floatPixels = src.dtype === "float" ? src.pixels : null;
  const floatShape = src.dtype === "float" ? src.shape : null;
  const floatNumpyDtype = src.dtype === "float" ? src.numpyDtype : undefined;
  const floatDeep = src.dtype === "float" ? src.deep : undefined;
  const hdr = useMemo<FloatImageData | null>(
    () =>
      floatPixels
        ? {
            pixels: floatPixels,
            shape: floatShape ?? [],
            dtype: floatNumpyDtype ?? "<f4",
            deep: floatDeep,
          }
        : null,
    [floatPixels, floatShape, floatNumpyDtype, floatDeep],
  );
  if (hdr) {
    return {
      hdr,
      tonemap: p.tonemap,
      exposure: p.exposure,
      offset: p.offset,
      gamma: p.gamma,
      peak: p.peak,
      // The unified float surface honours a named colormap (LUT display encoding)
      // on its scalar channel — forward it so the pane seeds DISPLAY to the
      // authored LUT. Omitting it (the stale pre-unification float contract) is
      // exactly what dropped `cp.Image(float, colormap="magma")` to sRGB grayscale.
      colormap: p.colormap,
      label: p.label,
      interpolation: p.interpolation,
      // Detection overlays composite over ANY dtype (display-space CSS layer),
      // so the float surface honours `overlay`/`overlaySettings` exactly as the
      // uint8 branch below does — omitting them here is what silently dropped
      // boxes/masks on an EXR/float image (M7).
      overlay: p.overlay,
      overlaySettings: p.overlaySettings,
      zoom: p.zoom,
      pan: p.pan,
      onViewChange: p.onViewChange,
      pixelValueNotation: p.pixelValueNotation,
      toolbar: p.toolbar,
      channelMenu: p.channelMenu,
      channelModified: p.channelModified,
      onChannelReset: p.onChannelReset,
      inStackedGrid: p.inStackedGrid,
      resetSettings: p.resetSettings,
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
    processing: p.processing,
    zoom: p.zoom,
    pan: p.pan,
    onViewChange: p.onViewChange,
    onNaturalSize: p.onNaturalSize,
    label: p.label ?? "",
    isDraggable: p.isDraggable,
    onDragStart: p.onDragStart,
    className: p.className,
    overlay: p.overlay,
    overlaySettings: p.overlaySettings,
    pixelValueNotation: p.pixelValueNotation,
    toolbar: p.toolbar,
    channelMenu: p.channelMenu,
    channelModified: p.channelModified,
    onChannelReset: p.onChannelReset,
    inStackedGrid: p.inStackedGrid,
    resetSettings: p.resetSettings,
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
 * Resolve the internal backend preference from the runtime override or query.
 */
export function resolveRenderMode(): RenderMode {
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
