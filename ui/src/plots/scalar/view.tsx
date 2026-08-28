import { useCallback } from "react";

import ScalarPlot from "../../lib/cairn-plot/renderers/ScalarPlot.tsx";
import type { PromotedSeriesConfig, Viewport } from "../../lib/cairn-plot/types.ts";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import type { PlotViewProps } from "../view-props.ts";
import type { ScalarSettings } from "./types.ts";

/** Controlled scalar backend view. Its durable interaction state belongs to the cell. */
export function ScalarPlotView(p: PlotViewProps) {
  const settings = p.syncedSettings as ScalarSettings;
  const patch = p.setSyncedSettings as (patch: ScalarSettings) => void;
  const domainX = settings["chart.domainX"];
  const domainY = settings["chart.domainY"];
  const viewport: Viewport = {
    xMin: domainX?.[0] ?? null,
    xMax: domainX?.[1] ?? null,
    yMin: domainY?.[0] ?? null,
    yMax: domainY?.[1] ?? null,
  };
  const setViewport = useCallback((next: Viewport) => patch({
    "chart.domainX": next.xMin == null || next.xMax == null ? null : [next.xMin, next.xMax],
    "chart.domainY": next.yMin == null || next.yMax == null ? null : [next.yMin, next.yMax],
  }), [patch]);
  const setPromoted = useCallback((next: Record<string, PromotedSeriesConfig>) => {
    patch({ "chart.promotedSeries": next } as unknown as ScalarSettings);
  }, [patch]);
  const {
    height,
    viewport: _viewport,
    promotedSeries: _promoted,
    syncedSettings: _settings,
    setSyncedSettings: _patch,
    resetViewportSettings: _reset,
    ...rest
  } = p;
  return <ChartBox height={height}>
    <ScalarPlot
      series={p.series ?? []}
      xAxis={p.xAxis ?? "step"}
      xScale={p.xScale ?? "linear"}
      yScale={p.yScale ?? "linear"}
      xRange={p.xRange ?? [null, null]}
      yRange={p.yRange ?? [null, null]}
      {...rest}
      viewport={viewport}
      onViewportChange={setViewport}
      promotedSeries={settings["chart.promotedSeries"] ?? {}}
      onPromotedSeriesChange={setPromoted}
    />
  </ChartBox>;
}
