// ---------------------------------------------------------------------------
// media-compare — the unified visual-media comparison core.
//
// See spec-visual-compare.md. This module is consumed by ImageGalleryCard
// (WS-VC1) today and will be consumed by the 3D cards (WS-VC2) once they
// adopt image-space comparison + native modes. Card-specific data-fetching
// (the react-query half of reference resolution) lives in
// components/card-kit/use-media-reference.ts, layered on top of the pure
// functions exported here.
// ---------------------------------------------------------------------------

export {
  type MediaCompareModeKind,
  type MediaCompareMode,
  MEDIA_COMPARE_MODE_KINDS,
  isCoreCompareMode,
  type SplitConfig,
  type DiffConfig,
} from "./mode";

export {
  type StepArtifactPoint,
  type MissingArtifactMode,
  resolveArtifactAtStep,
  resolveArtifactPointAtStep,
  resolveGlobalPositionalReference,
  resolveReferenceHashes,
  type ReferenceSource,
  type ReferenceSelection,
  type ReferenceResolutionPolicy,
  type ReferenceResolutionData,
  type ReferenceResolutionContext,
  type ResolvedReferenceHashes,
} from "./reference";

export {
  type MediaCompareSettings,
  DEFAULT_MEDIA_COMPARE_SETTINGS,
  type LabelledOption,
  CORE_COMPARE_MODE_OPTIONS,
  DIFF_SUBMODE_OPTIONS,
  PIXEL_DIFF_COLORMAP_OPTIONS,
  DIFF_COLORMAP_OPTIONS,
  type CompareModeCapabilities,
  type CompareModeOption,
  type CompareModeExtras,
  enumerateCompareModeOptions,
} from "./compare-settings";

export {
  useOffscreenSnapshot,
  type UseOffscreenSnapshotResult,
} from "./use-offscreen-snapshot";

// NB: `OffscreenComparePanes` (and its `frameSourceToUrl`) are intentionally
// NOT re-exported as runtime values from this barrel — the component imports
// `three` (via the camera-sync controller + the hidden mirror viewers), and
// this barrel is reachable from `core` (whose bundle ships NO three.js — see
// the `GpuComparePane` note above for the same pattern). Consumers import the
// component directly from `media-compare/OffscreenComparePanes` so `three`
// stays in the three.js addon chunk. Only its TYPES cross the barrel here.
export type {
  OffscreenComparePanesProps,
  ComparePaneSource,
} from "./OffscreenComparePanes";

export {
  hasForeignFrameBridge,
  type ForeignFrameProps,
  type ForeignFrameLoader,
  type ForeignFrameLoaders,
} from "./cross-type-frame";

export { CrossTypeForeignFrame } from "./CrossTypeForeignFrame";

export {
  buildProcessingFilterList,
  useGammaFilter,
  GammaFilterSvg,
} from "./post-processing";

export {
  MediaComparePane,
  type MediaComparePaneProps,
  CompositeMediaPane,
  type CompositeMediaPaneProps,
  CrossTypeCompositeMediaPane,
  CompareFloatUnsupportedError,
} from "../runtime/compare-compositor";
export type { ResolvedFloatImage } from "../definition/content.ts";

// Image comparisons render through the same image backend input as ordinary
// images. The compositor exports below remain for offscreen/cross-type capture.

export {
  migrateLegacyMode,
  type LegacyModeInputs,
  LEGACY_MODE_MIGRATION_TABLE,
  assertLegacyModeMigrationTable,
} from "./migrate-legacy-mode";

export { alignFrameSourcesForDiff, type RasterAlignmentResult } from "./cross-type-align";
