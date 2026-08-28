import type { ComponentProps } from "react";
import HistogramPlot from "./renderer/HistogramPlot.tsx";
import { ChartBox } from "../../host/standalone-helpers.tsx";
import { ChartSettingsBoundary } from "../chart-host.tsx";
import type { ChartSettings } from "../chart-settings.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { HistogramPresentation } from "./register.ts";

export function HistogramPlotView({ presentation: p, settings, commands }: ReactPlotViewProps<HistogramPresentation, ChartSettings>) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ChartSettingsBoundary settings={settings} patch={commands.patch}>
      <HistogramPlot {...(rest as ComponentProps<typeof HistogramPlot>)} />
    </ChartSettingsBoundary>
  </ChartBox>;
}
