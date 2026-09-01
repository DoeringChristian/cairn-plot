import { useCallback } from "react";

import ScalarPlot from "./backends/svg/ScalarPlot.tsx";
import type { ChartViewState } from "../types.ts";
import { ChartBox } from "../../host/standalone-helpers.tsx";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { ScalarPresentation, ScalarSettings } from "./types.ts";

/** Controlled scalar backend view. Its durable interaction state belongs to the cell. */
export function ScalarPlotView({ presentation: p, settings, commands }: ReactPlotViewProps<ScalarPresentation, ScalarSettings>) {
  const patch = commands.patch;
  const domainX = settings["chart.domainX"];
  const domainY = settings["chart.domainY"];
  const view: ChartViewState = {
    xMin: domainX?.[0] ?? null,
    xMax: domainX?.[1] ?? null,
    yMin: domainY?.[0] ?? null,
    yMax: domainY?.[1] ?? null,
  };
  const setView = useCallback((next: ChartViewState) => patch({
    "chart.domainX": next.xMin == null || next.xMax == null ? null : [next.xMin, next.xMax],
    "chart.domainY": next.yMin == null || next.yMax == null ? null : [next.yMin, next.yMax],
  }), [patch]);
  const {
    height,
    series,
    xAxis,
    xScale,
    yScale,
    xRange,
    yRange,
    ...rest
  } = p;
  return <ChartBox height={height}>
    <ScalarPlot
      series={[...(series ?? [])]}
      xAxis={xAxis ?? "step"}
      xScale={xScale ?? "linear"}
      yScale={yScale ?? "linear"}
      xRange={xRange ? [...xRange] : [null, null]}
      yRange={yRange ? [...yRange] : [null, null]}
      {...rest}
      view={view}
      onViewChange={setView}
    />
  </ChartBox>;
}
