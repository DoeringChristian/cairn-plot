import ParallelCoords from "../../lib/cairn-plot/renderers/ParallelCoords.tsx";
import { ChartBox } from "../../plot-standalone-helpers.tsx";
import type { PlotViewProps } from "../view-props.ts";

export function ParallelPlotView(p: PlotViewProps) {
  const { height, ...rest } = p;
  return <ChartBox height={height}>
    <ParallelCoords
      columns={p.columns ?? []}
      rows={p.rows ?? []}
      columnDomains={p.columnDomains ?? []}
      {...rest}
    />
  </ChartBox>;
}
