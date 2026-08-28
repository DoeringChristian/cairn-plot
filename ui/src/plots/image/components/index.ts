export { default as ScatterPlot, type ScatterPlotProps } from "../../scatter/backends/svg/ScatterPlot";
export {
  default as BarChart,
  type BarChartProps,
  type BarDatum,
  type BarCompareMode,
} from "../../bar/backends/svg/BarChart";
export {
  default as ParallelCoords,
  type ParallelCoordsProps,
} from "../../parallel/backends/svg/ParallelCoords";
export { default as ScalarPlot, type ScalarPlotProps } from "../../scalar/backends/svg/ScalarPlot";
// The CPU image backend + the shared backend contract. `CpuImagePane` and the
// WebGPU `GpuImagePane` (addon-loaded via the runtime registry seam) are the
// two interchangeable backends behind `ImageBackendProps` — see
// `image-backend.ts`'s module doc.
export { default as CpuImagePane, tonemapToImageData } from "../cpu/view";
export {
  isFloatSurfaceProps,
  isFloatSource,
  useImageSurfaceProps,
  hdrSource,
  urlSource,
  resolveRenderMode,
  type ImageBackend,
  type ImageBackendProps,
  type ImageSurfaceProps,
  type FloatSurfaceProps,
  type Uint8SurfaceProps,
  type HdrData,
  type RenderMode,
} from "../runtime/contracts";
export type {
  ImageSource,
  FloatImageSource,
  Uint8ImageSource,
} from "../definition/content.ts";
export { default as Heatmap, type HeatmapProps } from "../../heatmap/backends/svg/Heatmap";
export {
  default as HistogramPlot,
  type HistogramPlotProps,
} from "../../histogram/backends/svg/HistogramPlot";
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
} from "../../three/backends/three/PointCloudViewer";
export {
  default as Table,
  type TableProps,
  type TableData,
  type TableColumn,
  type ColumnType,
} from "../../table/backends/dom/Table";
// NOTE: `Figure` is intentionally NOT re-exported from this barrel — see the
// comment in `../index.ts`. Import it directly from "../../figure/backends/plotly/Figure" (or
// "../plots/figure/backends/plotly/Figure" from app code) so its Plotly
// dependency stays out of the eagerly-bundled reexport graph.
