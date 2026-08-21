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
  /** Authored false-color colormap for the FLOAT surface (`"none"` or a LUT id).
   *  The unified float pipeline runs a named colormap through the GPU/CPU LUT
   *  family on the scalar channel (a k>1 sample is reduced first), so a float
   *  scalar authored with `colormap=` seeds the DISPLAY encoding to that LUT —
   *  exactly as the 8-bit path does via {@link SdrImageProps.colormap}. Threaded
   *  through {@link useLegacyImageProps} so `GpuImagePane`/`CpuImagePane` read it
   *  as `propColormap`. Unset ⇒ `"none"` (plain-grayscale scalar / light RGB). */
  colormap?: Colormap;
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
  /** Multi-viewport SELECTION settings-sync group (see {@link ImageBackendProps}).
   *  Threaded through `useLegacyImageProps` so the pane body reads it here. */
  settingsSyncGroupId?: string;
  /** True when this pane is the selection ANCHOR (see {@link ImageBackendProps}). */
  syncIsAnchor?: boolean;
  /** CHANNELS toolbar menu (EXR part/layer selection) — a pre-built standard
   *  `ToolbarButtonSpec` dropdown supplied by the OWNER (`LeafView`, which holds
   *  the selection state and re-decodes on pick). The pane just renders it at
   *  the leading edge next to its own menus, folds `channelModified` into HOME's
   *  modified state, and calls `onChannelReset` from its reset handler. */
  channelMenu?: import("../controls/ToolbarConfig").ToolbarButtonSpec;
  /** True while a view-local channel override is active (drives HOME's dot). */
  channelModified?: boolean;
  /** Clear the channel override back to the authored selection (HOME/dbl-click). */
  onChannelReset?: () => void;
  /** True when this pane is the reused renderer of a STACKED viewport (see
   *  {@link ImageBackendProps.inStackedGrid}). */
  inStackedGrid?: boolean;
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
  /** Multi-viewport SELECTION settings-sync group (see {@link ImageBackendProps}).
   *  Threaded through `useLegacyImageProps` so the pane body reads it here. */
  settingsSyncGroupId?: string;
  /** True when this pane is the selection ANCHOR (see {@link ImageBackendProps}). */
  syncIsAnchor?: boolean;
  /** CHANNELS toolbar menu (EXR part/layer selection) — a pre-built standard
   *  `ToolbarButtonSpec` dropdown supplied by the OWNER (`LeafView`, which holds
   *  the selection state and re-decodes on pick). The pane just renders it at
   *  the leading edge next to its own menus, folds `channelModified` into HOME's
   *  modified state, and calls `onChannelReset` from its reset handler. */
  channelMenu?: import("../controls/ToolbarConfig").ToolbarButtonSpec;
  /** True while a view-local channel override is active (drives HOME's dot). */
  channelModified?: boolean;
  /** Clear the channel override back to the authored selection (HOME/dbl-click). */
  onChannelReset?: () => void;
  /** True when this pane is the reused renderer of a STACKED viewport (see
   *  {@link ImageBackendProps.inStackedGrid}). */
  inStackedGrid?: boolean;
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

// ---------------------------------------------------------------------------
// COMPARE source (content-op unification). Presence of `compareSource` on
// {@link ImageBackendProps} turns the GPU image pane into a COMPARE pane over two
// operands: the primary `source` is the REFERENCE (slot `a`) and `compareSource.b`
// is the FOREGROUND (slot `b`) — the pane uploads `b` via the pool's second source
// slot (`setSourceB`) and renders a compare CONTENT op (`image/content-ops`)
// instead of the single-image identity. The `opId` selects the mode:
//   - DIFF (Phase 2c): a pointwise DIRECT op (signed/absolute/…) samples both
//     slots inline, or a CACHED metric (FLIP/HDR-FLIP/SSIM) runs through
//     `renderDiffCached`; displayed as a scalar error (colormap).
//   - SPLIT / BLEND (Phase 3): a compositor DIRECT op composites the two slots by
//     the fragment uv against the compositor param (`splitPosition`/`blendAlpha`);
//     displayed as ordinary LIGHT (curves) — a divider gesture + per-side captions
//     + per-side TEV readout ride the pane's chrome.
// The single-image path is byte-identical when `compareSource` is ABSENT.
// ---------------------------------------------------------------------------

/** Where the smaller operand sits within the larger before the overlap crop (a
 *  mismatched-size diff). Mirrors `engine/compare-align`'s `CompareAlign`. */
export type CompareAlign =
  | "top-left"
  | "center"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
/** Mismatched-size handling — `"crop"` (min-crop overlap) or `"fill"` (rescale to
 *  the primary). Mirrors `engine/compare-align`'s `CompareFit`. */
export type CompareFit = "crop" | "fill";

/**
 * The COMPARE operand + diff settings that turn the GPU image pane into a diff
 * pane. Ported from `GpuComparePane`'s diff plumbing, but routed THROUGH the pool
 * (`setSourceB` + `renderDiffCached`) rather than self-managed textures.
 */
export interface CompareSource {
  /** The FOREGROUND operand `b` — same dtype-tagged shape as the primary
   *  {@link ImageBackendProps.source} (which is the REFERENCE / slot `a`). Slot
   *  convention (diff + compositor): `a` = reference (texA), `b` = foreground
   *  (texB), so `diff = a − b` and split shows the reference left of the divider. */
  b: DecodedSource;
  /** The DIFF kernel — a menu selection token (a pointwise id, `"flip"`,
   *  `"flip_ldr"`, `"ssim"`). SEEDS the pane's diff-kernel state (always a real
   *  kernel, even while {@link mode} is a compositor mode — so switching INTO diff
   *  restores it). Resolved to a concrete kernel id by `resolveDiffKernelId`. */
  opId: string;
  /** The COMPARE mode: `"diff"` (the scalar-error diff of {@link opId}, the
   *  default when absent) OR the Phase-3 compositor modes `"split"` / `"blend"` (a
   *  LIGHT composite of the two operands by divider / alpha). Selecting a mode is
   *  an OP switch on the reused pane — the display + chrome change, no remount. */
  mode?: "diff" | "split" | "blend";
  /** Split-divider position `[0,1]` (`opId:"split"`) — the reference is shown
   *  where the fragment `uv.x < splitPosition`. Controlled: the pane's divider /
   *  `[`·`]` keys report up via {@link onSplitPositionChange}; the owner lifts it
   *  and the new value flows back. Default 0.5. */
  splitPosition?: number;
  /** Blend mix alpha `[0,1]` (`opId:"blend"`) — `mix(reference, foreground,
   *  blendAlpha)`. Controlled like {@link splitPosition}. Default 0.5. */
  blendAlpha?: number;
  /** Fired when the split divider / flip keys move the divider — lifts the split
   *  position to the owner (`CompareView`'s lifted `splitPos`). */
  onSplitPositionChange?: (pos: number) => void;
  /** Fired when the blend alpha changes (owner lifts it). */
  onBlendAlphaChange?: (alpha: number) => void;
  /** True when this compare pane is inside a STACKED grid — threaded from the CORE
   *  side (the addon bundle's context identity differs) so `useSplitFlipKeys`
   *  scopes the `←`/`→`/`h`/`l` flip aliases correctly (`[`·`]` always flip). */
  inStackedGrid?: boolean;
  /** True when this compare pane is inside a FULLSCREEN overlay (see above). */
  inOverlay?: boolean;
  /** Colormap OVERRIDE for the diff display (a display-encoding/colormap id, or
   *  `"none"` for the raw per-channel error). `null`/absent = follow the selected
   *  kernel's default (`resolveDiffColormap`). An explicit pick STICKS across
   *  kernel switches; HOME clears it. */
  colormap?: Colormap | null;
  /** Alignment anchor for mismatched-size operands (ignored under `fit:"fill"`). */
  align?: CompareAlign;
  /** Mismatched-size handling (`"crop"` default | `"fill"`). */
  fit?: CompareFit;
  /** Content-identity cache keys for the diff cache (stable across remount — a
   *  source URL, not the decoded bytes). `a` = foreground/primary, `b` = reference. */
  contentKeyA?: string;
  contentKeyB?: string;
  /** Per-side captions for the diff caption ("<metric> · <fg> compared to <ref>"). */
  referenceLabel?: string;
  foregroundLabel?: string;
  /** Fired when the pane's diff MODE changes via its own MODE menu — lets an owner
   *  (`CompareView`) keep its lifted mode/kernel state coherent (Phase 2c routing). */
  onDiffKernelChange?: (kernelId: string) => void;
  /** Fired when the pane's MODE menu switches mode (slide ↔ blend ↔ diff) — the
   *  owner lifts it (`CompareView`'s `viewMode`). Phase 3: split/blend now ALSO
   *  render on THIS unified pane, so a mode switch is an OP switch on the reused
   *  instance (NO remount) — not the old route-to-`GpuComparePane` remount. */
  onCompareModeChange?: (mode: "split" | "blend" | "diff") => void;
  /** HOME / double-click reset for the HOISTED compare control (mode + kernel +
   *  split + blend). The compare VIEW-MODE / kernel / split / blend state lives in
   *  the owner's `useCompareControl` (hoisted out of the pane so it survives stacked
   *  flips), so the pane's own HOME handler cannot reach it — it calls this to
   *  restore those to the DESCRIPTOR (the old `GpuComparePane` reset every view-local
   *  selection incl. the mode; the unified pane must too). Diff↔slide transitions
   *  re-lower via `NodeDispatch`. Colormap/encoding are display-only + pane-local, so
   *  the pane resets those itself. */
  onCompareReset?: () => void;
  /** True when the hoisted compare control (mode / kernel / split / blend) differs
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
export interface ImageBackendProps {
  /** The decoded image, tagged by dtype (`float` | `uint8`). */
  source: DecodedSource;
  /** When set, the pane renders a DIFF of `source` (foreground/`a`) against
   *  `compareSource.b` (reference) — see {@link CompareSource}. Absent = the
   *  byte-identical single-image path. Only the GPU backend honors it; the CPU
   *  backend ignores it (single-image fallback). */
  compareSource?: CompareSource;
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
  /** CHANNELS toolbar menu (EXR part/layer selection) — a pre-built standard
   *  `ToolbarButtonSpec` dropdown supplied by the OWNER (`LeafView`, which holds
   *  the selection state and re-decodes on pick). The pane just renders it at
   *  the leading edge next to its own menus, folds `channelModified` into HOME's
   *  modified state, and calls `onChannelReset` from its reset handler. */
  channelMenu?: import("../controls/ToolbarConfig").ToolbarButtonSpec;
  /** True while a view-local channel override is active (drives HOME's dot). */
  channelModified?: boolean;
  /** Clear the channel override back to the authored selection (HOME/dbl-click). */
  onChannelReset?: () => void;
  /** RESERVE the compare chrome slots on a PLAIN-IMAGE pane (no `compareSource`).
   *  Set by `plot-node.tsx` when this image leaf lives in a STACKED viewport whose
   *  grid ALSO holds a compare child (the report's Validation `[image, FLIP]`
   *  stack): the image slot and the diff slot are the ONE reused pane, so their
   *  chrome must be structurally IDENTICAL or the image↔diff flip
   *  mounts/unmounts the MODE menu + metrics/caption chips (visible popping +
   *  toolbar reflow — the residual "flicker"). When set, the plain-image pane
   *  reserves the MODE menu (rendered greyed/inert — the image is not a compare),
   *  the second-row EV/OFF sliders, and the caption/metrics chip CONTAINERS, and
   *  swaps only their CONTENT across the flip — never their structure. Ignored
   *  when `compareSource` is present (a diff/compositor slot already renders the
   *  chrome) and by the CPU backend. Absent = today's plain-image chrome exactly. */
  reserveCompareChrome?: boolean;
  /** True when this pane is the ONE reused renderer of a STACKED viewport (set by
   *  `LeafView` from the CORE-side `InStackedGridContext`). A stack owns ONE SHARED
   *  display-settings object: every slot renders under the stack's current
   *  encoding/colormap, a pick applies to all slots + survives flips, each image's
   *  authored props are SEEDS only, HOME adopts the focused slot's defaults, and
   *  leaving stacked mode (this pane unmounts) discards the shared settings. Absent ⇒
   *  a standalone pane / normal grid cell (each keeps its own authored defaults). */
  inStackedGrid?: boolean;
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
      // The unified float surface honours a named colormap (LUT display encoding)
      // on its scalar channel — forward it so the pane seeds DISPLAY to the
      // authored LUT. Omitting it (the stale pre-unification float contract) is
      // exactly what dropped `cp.Image(float, colormap="magma")` to sRGB grayscale.
      colormap: p.colormap,
      showAxes: p.showAxes,
      label: p.label,
      interpolation: p.interpolation,
      zoom: p.zoom,
      pan: p.pan,
      onViewportChange: p.onViewportChange,
      pixelValueNotation: p.pixelValueNotation,
      toolbar: p.toolbar,
      settingsSyncGroupId: p.settingsSyncGroupId,
      syncIsAnchor: p.syncIsAnchor,
      channelMenu: p.channelMenu,
      channelModified: p.channelModified,
      onChannelReset: p.onChannelReset,
      inStackedGrid: p.inStackedGrid,
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
    settingsSyncGroupId: p.settingsSyncGroupId,
    syncIsAnchor: p.syncIsAnchor,
    channelMenu: p.channelMenu,
    channelModified: p.channelModified,
    onChannelReset: p.onChannelReset,
    inStackedGrid: p.inStackedGrid,
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
