import Heatmap from "../../lib/cairn-plot/renderers/Heatmap.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { PlotViewProps } from "../view-props.ts";

export function HeatmapPlotView(p: PlotViewProps) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={p.syncedSettings} patch={p.setSyncedSettings}>
      <Heatmap matrix={p.matrix ?? []} colormap={p.colormap ?? "turbo"} {...rest} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
