import ScatterPlot from "./renderer/ScatterPlot.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { ChartSettings } from "../chart-settings.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { ScatterPresentation } from "./register.ts";

export function ScatterPlotView({ presentation: p, settings, commands }: ReactPlotViewProps<ScatterPresentation, ChartSettings>) {
  const { height, points, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={settings} patch={commands.patch}>
      <ScatterPlot {...rest} points={[...points]} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
