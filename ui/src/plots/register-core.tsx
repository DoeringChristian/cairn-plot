/** Composition root for the always-present typed plot definitions. */
import { ensureBarPlotType } from "./bar/register.ts";
import { BarPlotView } from "./bar/view.tsx";
import { ensureHeatmapPlotType } from "./heatmap/register.ts";
import { HeatmapPlotView } from "./heatmap/view.tsx";
import { ensureHistogramPlotType } from "./histogram/register.ts";
import { HistogramPlotView } from "./histogram/view.tsx";
import { ensureImagePlotType } from "./image/runtime/register.ts";
import { ImagePlotView } from "./image/runtime/view.tsx";
import { ensureParallelPlotType } from "./parallel/register.ts";
import { ParallelPlotView } from "./parallel/view.tsx";
import { ensureScalarPlotType } from "./scalar/register.ts";
import { ScalarPlotView } from "./scalar/view.tsx";
import { ensureScatterPlotType } from "./scatter/register.ts";
import { ScatterPlotView } from "./scatter/view.tsx";
import { ensureTablePlotType } from "./table/register.ts";
import { TablePlotView } from "./table/view.tsx";
import { ensureThreePlotTypes } from "./three/register.ts";
import { ensureFigurePlotType } from "./figure/register.ts";

export function registerCoreRenderers(): void {
  ensureImagePlotType(ImagePlotView);
  ensureScalarPlotType(ScalarPlotView);
  ensureScatterPlotType(ScatterPlotView);
  ensureBarPlotType(BarPlotView);
  ensureHistogramPlotType(HistogramPlotView);
  ensureHeatmapPlotType(HeatmapPlotView);
  ensureParallelPlotType(ParallelPlotView);
  ensureTablePlotType(TablePlotView);
  ensureThreePlotTypes();
  ensureFigurePlotType();
}
