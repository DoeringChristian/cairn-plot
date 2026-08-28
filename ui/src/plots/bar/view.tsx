import BarChart from "../../lib/cairn-plot/renderers/BarChart.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { PlotViewProps } from "../view-props.ts";

export function BarPlotView(p: PlotViewProps) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={p.syncedSettings} patch={p.setSyncedSettings}>
      <BarChart bars={p.bars ?? []} {...rest} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
