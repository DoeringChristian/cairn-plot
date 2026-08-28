import ParallelCoords from "./renderer/ParallelCoords.tsx";
import { ChartBox } from "../../host/standalone-helpers.tsx";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { ParallelPresentation } from "./register.ts";

export function ParallelPlotView({ presentation: p }: ReactPlotViewProps<ParallelPresentation, Record<string, never>>) {
  const { height, columns, rows, columnDomains, ...rest } = p;
  return <ChartBox height={height}>
    <ParallelCoords
      {...rest}
      columns={[...columns]}
      rows={[...rows]}
      columnDomains={[...columnDomains]}
    />
  </ChartBox>;
}
