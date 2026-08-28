import BarChart, { type BarChartProps } from "./renderer/BarChart.tsx";
import { ChartBox } from "../../host/standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { ChartSettings } from "../chart-settings.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { BarPresentation } from "./register.ts";

export function BarPlotView({ presentation: p, settings, commands }: ReactPlotViewProps<BarPresentation, ChartSettings>) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={settings} patch={commands.patch}>
      <BarChart {...(rest as BarChartProps)} bars={[...p.bars]} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
