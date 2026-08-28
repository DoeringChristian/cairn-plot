import type { ComponentType } from "react";

import type { ColormapName } from "../../lib/cairn-plot/types.ts";
import type { DataSource } from "../../lib/cairn-plot/store/data-sources.ts";
import { projectChartSettings, type ChartSettings } from "../chart-settings.ts";
import { ensureInlinePlotType, type InlineSpec } from "../inline-register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

export interface HeatmapPresentation {
  readonly matrix: readonly (readonly number[])[];
  readonly colormap?: ColormapName;
  readonly min?: number;
  readonly max?: number;
  readonly logColor?: boolean;
  readonly originTop?: boolean;
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly valueLabel?: string;
  readonly lockAspect?: boolean;
  readonly className?: string;
  readonly height?: number;
}

function heatmapPresentation(value: Record<string, unknown>): HeatmapPresentation {
  if (!Array.isArray(value.matrix) || !value.matrix.every(isNumberArray)) {
    throw new Error("cairn-plot: heatmap presentation requires a numeric matrix");
  }
  const widths = new Set(value.matrix.map((row) => row.length));
  if (widths.size > 1) {
    throw new Error("cairn-plot: heatmap matrix rows must have equal length");
  }
  return value as unknown as HeatmapPresentation;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function ensureHeatmapPlotType(
  View: ComponentType<ReactPlotViewProps<HeatmapPresentation, ChartSettings>>,
  resolve: (spec: InlineSpec, source: DataSource) => Promise<Record<string, unknown>>,
): void {
  ensureInlinePlotType<HeatmapPresentation, ChartSettings>({
    kind: "heatmap",
    View,
    resolve,
    parse: heatmapPresentation,
    settings: { defaults: () => ({}), project: projectChartSettings },
  });
}
