/** Composition root for the always-present typed plot definitions. */
import { resolveDataProps } from "./plot-descriptor.ts";
import { ensureBarPlotType } from "./plots/bar/register.ts";
import { BarPlotView } from "./plots/bar/view.tsx";
import { ensureHeatmapPlotType } from "./plots/heatmap/register.ts";
import { HeatmapPlotView } from "./plots/heatmap/view.tsx";
import { ensureHistogramPlotType } from "./plots/histogram/register.ts";
import { HistogramPlotView } from "./plots/histogram/view.tsx";
import { ensureImagePlotType } from "./plots/image/register.ts";
import { ImagePlotView } from "./plots/image/view.tsx";
import { ensureParallelPlotType } from "./plots/parallel/register.ts";
import { ParallelPlotView } from "./plots/parallel/view.tsx";
import { ensureScalarPlotType } from "./plots/scalar/register.ts";
import { ScalarPlotView } from "./plots/scalar/view.tsx";
import { ensureScatterPlotType } from "./plots/scatter/register.ts";
import { ScatterPlotView } from "./plots/scatter/view.tsx";
import { ensureTablePlotType } from "./plots/table/register.ts";
import { TablePlotView } from "./plots/table/view.tsx";
import { ensureThreePlotTypes } from "./plots/three/register.ts";
import { ensureFigurePlotType } from "./plots/figure/register.ts";

export function registerCoreRenderers(): void {
  ensureImagePlotType(ImagePlotView, resolveDataProps);
  ensureScalarPlotType(ScalarPlotView, resolveDataProps);
  ensureScatterPlotType(ScatterPlotView, resolveDataProps);
  ensureBarPlotType(BarPlotView, resolveDataProps);
  ensureHistogramPlotType(HistogramPlotView, resolveDataProps);
  ensureHeatmapPlotType(HeatmapPlotView, resolveDataProps);
  ensureParallelPlotType(ParallelPlotView, resolveDataProps);
  ensureTablePlotType(TablePlotView, resolveDataProps);
  ensureThreePlotTypes(resolveDataProps);
  ensureFigurePlotType(resolveDataProps);
}
