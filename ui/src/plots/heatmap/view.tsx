import Heatmap from "./renderer/Heatmap.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { ChartSettings } from "../chart-settings.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { HeatmapPresentation } from "./register.ts";

export function HeatmapPlotView({ presentation: p, settings, commands }: ReactPlotViewProps<HeatmapPresentation, ChartSettings>) {
  const { height, matrix, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={settings} patch={commands.patch}>
      <Heatmap {...rest} matrix={matrix.map((row) => [...row])} colormap={p.colormap ?? "turbo"} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
