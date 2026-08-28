import type { ColormapName, ScatterPoint } from "../types.ts";
import type { ComponentType } from "react";

import type { DataSource } from "../../resources/data/data-sources.ts";
import { projectChartSettings, type ChartSettings } from "../chart-settings.ts";
import { ensureInlinePlotType, type InlineSpec } from "../inline-register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

export interface ScatterPresentation {
  readonly points: readonly ScatterPoint[];
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly colorLabel?: string;
  readonly xLog?: boolean;
  readonly yLog?: boolean;
  readonly colormap?: ColormapName;
  readonly height?: number;
}

function scatterPresentation(value: Record<string, unknown>): ScatterPresentation {
  if (!Array.isArray(value.points) || !value.points.every(isScatterPoint)) {
    throw new Error("cairn-plot: scatter presentation requires a typed points array");
  }
  return value as unknown as ScatterPresentation;
}

function isScatterPoint(value: unknown): value is ScatterPoint {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return typeof point.id === "string" && typeof point.x === "number" &&
    Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y) &&
    (point.color === null || typeof point.color === "number");
}

export function ensureScatterPlotType(
  View: ComponentType<ReactPlotViewProps<ScatterPresentation, ChartSettings>>,
  resolve: (spec: InlineSpec, source: DataSource) => Promise<Record<string, unknown>>,
): void {
  ensureInlinePlotType<ScatterPresentation, ChartSettings>({
    kind: "scatter",
    View,
    resolve,
    parse: scatterPresentation,
    settings: { defaults: () => ({}), project: projectChartSettings },
  });
}
