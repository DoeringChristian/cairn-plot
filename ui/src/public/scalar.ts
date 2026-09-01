/** Supported scalar-card integration surface, split from core for host adapters. */
export { default as ScalarPlot } from "../plots/scalar/backends/svg/ScalarPlot.tsx";
export { SERIES_COLORS } from "../plots/types.ts";
export {
  emaSmooth,
  filterOutliers,
  mapToXAxis,
  strideDownsample,
} from "../plots/transforms/index.ts";
export type { AxisSource } from "../plots/transforms/index.ts";
export type { AxisScale, Series } from "../plots/types.ts";
