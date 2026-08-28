export { default as ScatterPlot, type ScatterPlotProps } from "../../scatter/renderer/ScatterPlot";
export {
  default as BarChart,
  type BarChartProps,
  type BarDatum,
  type BarCompareMode,
} from "../../bar/renderer/BarChart";
export {
  default as ParallelCoords,
  type ParallelCoordsProps,
} from "../../parallel/renderer/ParallelCoords";
export { default as ScalarPlot, type ScalarPlotProps } from "../../scalar/renderer/ScalarPlot";
// The CPU image backend + the shared backend contract. `CpuImagePane` and the
// WebGPU `GpuImagePane` (addon-loaded via the runtime registry seam) are the
// two interchangeable backends behind `ImageBackendProps` — see
// `image-backend.ts`'s module doc.
export { default as CpuImagePane, type CpuImagePaneProps, tonemapToImageData } from "../backend/cpu";
export {
  isHdrProps,
  isFloatSource,
  useLegacyImageProps,
  hdrSource,
  urlSource,
  resolveRenderMode,
  type ImageBackend,
  type ImageBackendProps,
  type DecodedSource,
  type FloatSource,
  type Uint8Source,
  type LegacyImageProps,
  type HdrImageProps,
  type SdrImageProps,
  type HdrData,
  type RenderMode,
} from "../backend/contracts";
export { default as Heatmap, type HeatmapProps } from "../../heatmap/renderer/Heatmap";
export {
  default as HistogramPlot,
  type HistogramPlotProps,
} from "../../histogram/renderer/HistogramPlot";
export {
  default as ImageOverlay,
  type ImageOverlayProps,
} from "./ImageOverlay";
export {
  default as PointCloudViewer,
  resolveColorMode,
  type PointCloudViewerProps,
  type PointCloudChannels,
  type PointColorMode,
  type PointSizeMode,
  type PointCloudBackground,
  type PointCloudBounds,
} from "../../../engines/three/PointCloudViewer";
export {
  default as Table,
  type TableProps,
  type TableData,
  type TableColumn,
  type ColumnType,
} from "../../table/renderer/Table";
// NOTE: `Figure` is intentionally NOT re-exported from this barrel — see the
// comment in `../index.ts`. Import it directly from "../../figure/renderer/Figure" (or
// "../plots/figure/renderer/Figure" from app code) so its Plotly
// dependency stays out of the eagerly-bundled reexport graph.
