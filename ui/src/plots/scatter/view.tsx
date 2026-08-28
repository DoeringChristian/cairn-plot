import ScatterPlot from "../../lib/cairn-plot/renderers/ScatterPlot.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { PlotViewProps } from "../view-props.ts";

export function ScatterPlotView(p: PlotViewProps) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={p.syncedSettings} patch={p.setSyncedSettings}>
      <ScatterPlot points={p.points ?? []} {...rest} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
