// ---------------------------------------------------------------------------
// Compare-settings SHAPE + defaults + option enumeration — the pure, app-
// agnostic half of every visual-media card's "Compare" settings block,
// extracted from `card-kit/visual-compare-settings.ts` +
// `card-kit/CompareSettingsPanel.tsx`.
//
// The FORM UI (the actual `<Select>`/`<Slider>`/`<Toggle>` JSX) stays app-
// side; so do the fields that reference app concepts (a `SeriesRef` metric
// list, the card-persistence `BaseCardSettings` envelope). What lives here is
// what a renderer library can own without reaching into the app:
//   - `MediaCompareSettings`: the compare/reference/rendering fields whose
//     types are all cairn-plot types (mode/diff/colormap/interpolation/…).
//   - `DEFAULT_MEDIA_COMPARE_SETTINGS`: neutral baselines for those fields.
//   - the labelled option lists (core modes, diff sub-modes, colormaps).
//   - `enumerateCompareModeOptions(caps)`: "list the valid compare modes for
//     these capabilities" — the pure computation behind the panel's mode
//     `<Select>` options (core modes + capability-gated native modes).
// ---------------------------------------------------------------------------

import type { MediaCompareModeKind } from "./mode";
import type { Colormap, DiffMode, Interpolation, ImageOverlaySettings } from "../types";
import type { DiffColormap } from "../three/diff";

/**
 * The renderer-owned subset of a visual-media card's persisted settings: the
 * compare mode, reference policy, and rendering fields whose types are all
 * cairn-plot types. An app card's full settings interface intersects this
 * with its own app-typed fields (the metric `SeriesRef[]`, the external
 * baseline `SeriesRef`, the `BaseCardSettings` persistence envelope), e.g.
 *
 *   interface VisualCompareSettings
 *     extends BaseCardSettings, MediaCompareSettings {
 *     metrics: SeriesRef[];
 *     externalBaseline?: SeriesRef;
 *     paneWidths?: number[];
 *   }
 *
 * Field names + optionality are unchanged from the pre-extraction app type
 * (persisted-settings compatibility for existing cards is the acceptance bar).
 */
export interface MediaCompareSettings {
  // Post-processing (capability: postProcessing) -------------------------
  brightness: number;
  contrast: number;
  gamma: number;
  exposure: number;
  offset: number;
  flipSign: boolean;

  // View state (image2d today; camera3d variants per module) -------------
  zoom: number;
  pan: { x: number; y: number };

  // Reference / compare --------------------------------------------------
  /** series-same-step baseline: index into the card's own series list. */
  baselineIndex?: number;
  /** The single exclusive media-compare mode. When unset, derived from the
   *  legacy fields below via `migrateLegacyMode` on every read. */
  mode?: MediaCompareModeKind;
  /** The active CARD-NATIVE mode (e.g. a 3D geometry diff), when one of
   *  `capabilities.nativeModes` is selected instead of a core mode.
   *  `undefined` for every type with no native modes. */
  nativeMode?: string;
  /** Legacy exclusive-mode axis #1 (kept for rollback; also doubles as the
   *  "diff" mode's sub-mode selector: signed/absolute/squared/relative*). */
  diffMode: "none" | DiffMode;
  /** Color mapping for a 3D type's diff coloring — BOTH the core pixel `diff`
   *  mode (fed to `OffscreenComparePanes`/`CrossTypeCompositeMediaPane` as
   *  `colormap`) and every native (geometry) diff mode. `undefined` for image. */
  diffColormap?: DiffColormap;
  referenceMode?: "global" | "per-run";
  perRunBaselineStep?: number;
  /** Pins the series-same-step baseline to one fixed step instead of tracking
   *  the primary's current step 1:1. */
  refFixedStep?: number;
  /** Opt-in for cross-type (image<->3D) pixel `diff` (split/blend cross-
   *  type are offered unconditionally; `diff` additionally resamples both
   *  rasters, so it's gated behind this explicit confirmation). */
  crossTypeDiffOptIn?: boolean;
  /** "Sync 3D views" camera-lockstep toggle (capability: `cameraSync`). */
  syncViews?: boolean;
  /** Legacy exclusive-mode axis #2 (kept for rollback). */
  compareMode?: "side-by-side" | "split" | "blend";
  splitPosition?: number;
  blendAlpha?: number;
  splitSynced?: boolean;

  // Rendering (capability-gated) -----------------------------------------
  interpolation?: Interpolation;
  colormap?: Colormap;
  showAxes?: boolean;
  overlay?: ImageOverlaySettings;

  // Step slider / layout -------------------------------------------------
  sliderStep?: number;
  imageColumns?: 1 | 2;
  missingImageMode?: "nothing" | "last_available";
  xAxis?: "step" | "relative_time" | "wall_time";
}

/**
 * Neutral baselines for the compare-relevant `MediaCompareSettings` fields — a
 * module's own `defaultSettings()` spreads these and overrides per capability.
 * Only the fields with an unambiguous neutral value are asserted here; the
 * rest are left optional/`undefined` (their absence IS the default).
 */
export const DEFAULT_MEDIA_COMPARE_SETTINGS = {
  mode: "split",
  diffMode: "none",
  diffColormap: "red-green",
  splitPosition: 0.5,
  blendAlpha: 0.5,
} as const satisfies Partial<MediaCompareSettings>;

// ---------------------------------------------------------------------------
// Labelled option lists — the pure data behind the panel's `<Select>`s.
// ---------------------------------------------------------------------------

export interface LabelledOption<V extends string> {
  value: V;
  label: string;
}

/** The four core (image-space) media-compare kinds, labelled once. */
export const CORE_COMPARE_MODE_OPTIONS: ReadonlyArray<LabelledOption<MediaCompareModeKind>> = [
  { value: "normal", label: "Normal (primary only)" },
  { value: "split", label: "Slide (image-space, default)" },
  { value: "blend", label: "Blend (image-space)" },
  { value: "diff", label: "Pixel diff (image-space)" },
];

/** Pixel-diff sub-modes for the image-space "diff" compositor mode. */
export const DIFF_SUBMODE_OPTIONS: ReadonlyArray<LabelledOption<DiffMode>> = [
  { value: "signed", label: "Signed" },
  { value: "absolute", label: "Absolute" },
  { value: "squared", label: "Squared" },
  { value: "relative_signed", label: "Relative signed" },
  { value: "relative_absolute", label: "Relative absolute" },
  { value: "relative_squared", label: "Relative squared" },
];

/** False-color maps offered for the image-space pixel "diff" mode. */
export const PIXEL_DIFF_COLORMAP_OPTIONS: ReadonlyArray<LabelledOption<Colormap>> = [
  { value: "turbo", label: "Turbo" },
  { value: "red-green", label: "Red-green" },
  { value: "red-blue", label: "Red-blue" },
];

/** The two native-diff-mode colormaps (signed red-green / magnitude turbo). */
export const DIFF_COLORMAP_OPTIONS: ReadonlyArray<LabelledOption<DiffColormap>> = [
  { value: "red-green", label: "Red–green (signed)" },
  { value: "turbo", label: "Turbo (magnitude)" },
];

// ---------------------------------------------------------------------------
// Mode enumeration — "list the valid compare modes for these capabilities".
// ---------------------------------------------------------------------------

/** The compare capabilities a card advertises to the mode picker: which
 *  native (non-compositor) modes it has, and whether their precondition
 *  (typically topology match) currently holds. */
export interface CompareModeCapabilities<M extends string = string> {
  /** Native per-type kinds appended after the core kinds (e.g. mesh's
   *  `diff-property`/`diff-geometry`). Empty for a type with no native modes. */
  nativeModes: ReadonlyArray<LabelledOption<M>>;
  /** Whether the native modes' precondition holds (e.g. the two series'
   *  topology matches). Native modes are enumerated as `disabled` when false;
   *  core modes are never disabled. */
  topologyOk: boolean;
}

export interface CompareModeOption<M extends string = string> {
  value: M;
  label: string;
  /** True for a native (non-compositor) mode; false for a core kind. */
  native: boolean;
  /** True for an ENGINE diff-KERNEL entry (a sub-kind of the `diff` mode, e.g.
   *  `hdr-flip`/`ssim`) appended via `extras.engineKernels`; false for a core
   *  or native mode. GPU-only, so gated by `extras.gpuAvailable`. */
  kernel?: boolean;
  /** True when the mode is offered but not currently selectable (native mode
   *  whose precondition fails, or an engine kernel with no GPU). Core kinds are
   *  always selectable. */
  disabled: boolean;
}

/**
 * Optional extras for {@link enumerateCompareModeOptions} — the ENGINE diff
 * kernels a host settings panel wants to enumerate alongside the core+native
 * modes (so the panel can offer the FULL diff-kernel set, GPU-gated).
 *
 * The kernel list is passed IN by the caller (from the gpu-image addon's
 * `listDiffMenuModes()`, or the `window.__cairnPlotDiffMenuModes` list
 * `plot-node` reads) — this module NEVER imports `engine/kernels`, exactly
 * mirroring how `compare-mode-menu.ts` stays engine-free, so it remains safe
 * for the core bundle.
 */
export interface CompareModeExtras {
  /** Engine diff-kernel entries appended after the core+native modes. Empty /
   *  omitted = none (the addon not loaded / no WebGPU), i.e. the original
   *  core+native list. */
  engineKernels?: ReadonlyArray<LabelledOption<string>>;
  /** Whether the WebGPU compare engine is available — engine kernels are
   *  GPU-only, so they enumerate as `disabled` when false. Defaults to `true`
   *  (the caller already gated by only supplying `engineKernels` when the addon
   *  published them). */
  gpuAvailable?: boolean;
}

/**
 * Enumerate the ordered compare-mode options for the given capabilities: the
 * four core (image-space) kinds first — always enabled — then each native
 * kind, disabled when `topologyOk` is false, then (when `extras.engineKernels`
 * is supplied) each engine diff KERNEL, disabled when `extras.gpuAvailable` is
 * false. This is exactly the option list the compare-mode `<Select>` renders;
 * the app panel maps it to its own `<Select>` option shape and adds the
 * disabled-reason description.
 */
export function enumerateCompareModeOptions<M extends string = string>(
  caps: CompareModeCapabilities<M>,
  extras?: CompareModeExtras,
): Array<CompareModeOption<M>> {
  const core: Array<CompareModeOption<M>> = CORE_COMPARE_MODE_OPTIONS.map((o) => ({
    value: o.value as unknown as M,
    label: o.label,
    native: false,
    disabled: false,
  }));
  const native: Array<CompareModeOption<M>> = caps.nativeModes.map((o) => ({
    value: o.value,
    label: o.label,
    native: true,
    disabled: !caps.topologyOk,
  }));
  const gpuAvailable = extras?.gpuAvailable ?? true;
  const kernels: Array<CompareModeOption<M>> = (extras?.engineKernels ?? []).map((o) => ({
    value: o.value as unknown as M,
    label: o.label,
    native: false,
    kernel: true,
    disabled: !gpuAvailable,
  }));
  return [...core, ...native, ...kernels];
}
