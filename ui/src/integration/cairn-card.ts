// Durable descriptor types. Viewports and renderer machinery are internal.
export type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotDescriptor,
  PlotLeafNode,
  PlotNode,
  PlotSpec,
  SharedProps,
} from "../../../packages/spec/src/index.ts";

// Engine types (RHI interface — consumed by the WebGPU backend)

export type {
  Backend,
  Capabilities,
  TextureFormat,
  Texture,
  Sampler,
  RenderPipeline,
  ComputePipeline,
  BindGroupEntry,
  BindGroup,
  Surface,
  Device,
} from "../plots/image/engine/types";

// Types
export type {
  Series,
  ScatterPoint,
  ParallelColumn,
  ParallelRow,
  Viewport,
  AxisScale,
  DiffMode,
  Colormap,
  Interpolation,
  ImageProcessing,
  PromotedSeriesConfig,
  ColormapName,
  OverlayBox,
  OverlayMask,
  ImageOverlayData,
  ImageOverlaySettings,
  PlotlyFigureLike,
} from "../plots/types";

// Palette
export { SERIES_COLORS, overlayClassColor } from "../plots/types";

// Image overlays
export { DEFAULT_OVERLAY_SETTINGS } from "../plots/types";

// Colormaps
export { COLORMAP_NAMES, COLORMAP_OPTIONS, DIVERGING_COLORMAPS, getColormapLUT } from "../settings/colormaps";

// npy/npz parsing + histogram transforms
export {
  parseNpy,
  parseNpz,
  computeHistogram,
  rebinHistograms,
} from "../resources/transforms";
export type { NpyArray, HistogramData } from "../resources/transforms";

// Image processing
export { getRenderMode, setRenderMode } from "../plots/image/model";
export type { RenderMode } from "../plots/image/model";
// Content-addressing under live/redirecting query URLs (final post-redirect URL).
export { resolveFinalUrl } from "../plots/image/model";

// Multi-format image decoder registry (browser-native + raw npy/npz; EXR
// deferred). The DataSpec-resolution seam (`plot-descriptor.ts`) routes
// raw-buffer image blobs through `decodeImage`.
export {
  decodeImage,
  loadImageAny,
  sniffFormat,
  sniffMagic,
  getDecoder,
  npyArrayToDecoded,
  decodedU8ToDataUrl,
  isRawBufferFormat,
  isBrowserNativeFormat,
} from "../plots/image/model";
export type { DecodedImage, ImageSource, ImageFormat, ImageDecoder } from "../plots/image/model";

// HDR tone-mapping display pipeline (curves live in image/encodings; the shared
// exposure/output-encode stages + defaults live in image/tonemap.ts)
export {
  DEFAULT_TONEMAP,
  applyExposure,
  srgbOetf,
  outputEncode,
} from "../plots/image/model";
export type { TonemapOperator, RgbTriple } from "../plots/image/model";

// Transforms
export {
  mapToXAxis,
  strideDownsample,
  emaSmooth,
  filterOutliers,
  checkFigureMergeable,
  mergeFigures,
} from "../resources/transforms";
export type {
  AxisSource,
  ParetoDirection,
  FigureMergeabilityResult,
  FigureMergeEntry,
} from "../resources/transforms";

// Formatting
export { formatNum } from "../primitives/format";

// Hooks
export { useContainerSize } from "../host/hooks/use-container-size";

// Primitives
export { Colorbar } from "../primitives/components";
export { ColormapSwatch } from "../primitives/components";
export { LabelChip } from "../primitives/components";

// Renderers
export { ScatterPlot } from "../plots/image/components";
export {
  BarChart,
  type BarChartProps,
  type BarDatum,
  type BarCompareMode,
} from "../plots/image/components";
export { ParallelCoords } from "../plots/image/components";
export { ScalarPlot } from "../plots/image/components";
// Image backends: the CPU pane + the interchangeable-backend contract
// (`GpuImagePane` is addon-loaded via the runtime registry seam, not re-exported
// here). `tonemapToImageData` is the pure HDR-float → `ImageData` tone-mapper.
export {
  CpuImagePane,
  tonemapToImageData,
  isHdrProps,
  isFloatSource,
  useLegacyImageProps,
  hdrSource,
  urlSource,
  resolveRenderMode,
} from "../plots/image/components";
export type {
  CpuImagePaneProps,
  ImageBackend,
  ImageBackendProps,
  DecodedSource,
  FloatSource,
  Uint8Source,
  LegacyImageProps,
  HdrImageProps,
  SdrImageProps,
  HdrData,
  RenderMode as ImageBackendRenderMode,
} from "../plots/image/components";
export { Heatmap } from "../plots/image/components";
export { HistogramPlot } from "../plots/image/components";
export { ImageOverlay } from "../plots/image/components";
export { PointCloudViewer, resolveColorMode } from "../plots/image/components";
export type {
  PointCloudViewerProps,
  PointCloudChannels,
  PointColorMode,
  PointSizeMode,
  PointCloudBackground,
  PointCloudBounds,
} from "../plots/image/components";
export { Table } from "../plots/image/components";
export type { TableProps, TableData, TableColumn, ColumnType } from "../plots/image/components";
// NOTE: `Figure` (and its Plotly dependency) is intentionally NOT re-exported
// from this barrel, or from "../plots/image/components" — many eagerly-bundled cards
// (ScalarPlotCard, HistogramCard, TensorCard, VisualContentCard,
// viewport-registry) statically import from "../integration/cairn-card" /
// "../plots/image/components", and plotly.js-dist-min is a large
// non-tree-shakeable (UMD-style) bundle: merely being *reachable* through a
// re-export chain pulls its full ~5MB into the eager main chunk even when
// unused. Import Figure directly from "../plots/figure/renderer/Figure"
// (only reached by the lazy FigureInteractiveCard) to keep it in its own
// async chunk.

// Controls — the renderer-local toolbar facade.
export type {
  DragMode,
  HoverMode,
  AxisScale as ControllerAxisScale,
  ControllerAxis,
  ToPNGOptions,
  ControllerCapabilities,
  PlotController,
} from "../primitives/controls/types";
export type { ToolbarConfig } from "../primitives/controls/ToolbarConfig";

// Controller adapter (SVG charts) — projects useChartViewport onto PlotController.
export { useChartController } from "../plots/image/components/use-chart-controller";
export type { UseChartControllerArgs } from "../plots/image/components/use-chart-controller";

// media-compare — unified visual-media comparison core (see media-compare/index.ts)
export {
  MEDIA_COMPARE_MODE_KINDS,
  isCoreCompareMode,
  resolveArtifactAtStep,
  resolveArtifactPointAtStep,
  resolveGlobalPositionalReference,
  resolveReferenceHashes,
  CompositeMediaPane,
  CrossTypeCompositeMediaPane,
  CompareFloatUnsupportedError,
  migrateLegacyMode,
  LEGACY_MODE_MIGRATION_TABLE,
  alignFrameSourcesForDiff,
  DEFAULT_MEDIA_COMPARE_SETTINGS,
  CORE_COMPARE_MODE_OPTIONS,
  DIFF_SUBMODE_OPTIONS,
  PIXEL_DIFF_COLORMAP_OPTIONS,
  DIFF_COLORMAP_OPTIONS,
  enumerateCompareModeOptions,
  useOffscreenSnapshot,
  CrossTypeForeignFrame,
  hasForeignFrameBridge,
} from "../plots/image/compare";
export type {
  MediaCompareModeKind,
  MediaCompareMode,
  SplitConfig,
  DiffConfig,
  StepArtifactPoint,
  MissingArtifactMode,
  ReferenceSource,
  ReferenceSelection,
  ReferenceResolutionPolicy,
  ReferenceResolutionData,
  ReferenceResolutionContext,
  ResolvedReferenceHashes,
  CompositeMediaPaneProps,
  CompareFloatSource,
  LegacyModeInputs,
  RasterAlignmentResult,
  MediaCompareSettings,
  LabelledOption,
  CompareModeCapabilities,
  CompareModeOption,
  CompareModeExtras,
  UseOffscreenSnapshotResult,
  ForeignFrameProps,
  ForeignFrameLoader,
  ForeignFrameLoaders,
  OffscreenComparePanesProps,
  ComparePaneSource,
} from "../plots/image/compare";

// Viewport — the pluggable-rendering contract behind VisualContentCard
// (see viewport/types.ts).
export {
  ImageViewportPane,
  imageViewportCapabilities,
  CROSS_TYPE_VISUAL_OBJECT_TYPES,
  canCrossTypeCompare,
  createEndpointDataSource,
  resolveImageViewportItems,
  resolveImageViewportItemsAsync,
  decodeImageSource,
  decodedFloatToCompareSource,
  isFloatCandidateArtifact,
  fetchPointCloudArrays,
  fetchMeshArrays,
  fetchVolumeArray,
  fetchBoxesArrays,
  parseOverlay,
  createLocalDataSource,
  registerPlotStore,
  loadPlotStoreFromDom,
  PLOT_STORE_SCRIPT_ID,
  registerRuntimeEntries,
  getRuntimeEntry,
  getRuntimeStore,
  mintRuntimeHash,
} from "./cairn-card/index.ts";
export type {
  RuntimeStore,
  RuntimeStoreEntry,
  RuntimeBytesEntry,
  RuntimeFloatEntry,
} from "./cairn-card/index.ts";
export type {
  PlotStore,
  PlotStoreEntry,
  FrameSource,
  ViewState,
  NativeModeSpec,
  ViewportCapabilities,
  ViewportSeriesRef,
  ViewportDataArgs,
  ViewportDataResult,
  ViewportPaneProps,
  ViewportModule,
  ImageViewportItem,
  ImageViewState,
  ImageViewportSettings,
  DataSource,
  ResolvedImageSource,
  PointCloudArrays,
  MeshArrays,
  BoxesArrays,
} from "./cairn-card/index.ts";
