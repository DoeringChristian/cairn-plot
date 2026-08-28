import type { ComponentProps } from "react";
import HistogramPlot from "../../lib/cairn-plot/renderers/HistogramPlot.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { PlotViewProps } from "../view-props.ts";

export function HistogramPlotView(p: PlotViewProps) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={p.syncedSettings} patch={p.setSyncedSettings}>
      <HistogramPlot {...(rest as ComponentProps<typeof HistogramPlot>)} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
