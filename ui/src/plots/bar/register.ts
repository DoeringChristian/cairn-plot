import type { ComponentType } from "react";

import type { BarCompareMode, BarDatum } from "./backends/svg/BarChart.tsx";
import { projectChartSettings, type ChartSettings } from "../chart-settings.ts";
import { ensureInlinePlotType, } from "../inline-register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

export interface BarPresentation {
  readonly bars: readonly BarDatum[];
  readonly valueLabel?: string;
  readonly logX?: boolean;
  readonly compareMode?: BarCompareMode;
  readonly runOrder?: readonly string[];
  readonly colors?: readonly string[];
  readonly height?: number;
}

function barPresentation(value: Record<string, unknown>): BarPresentation {
  if (!Array.isArray(value.bars) || !value.bars.every(isBarDatum)) {
    throw new Error("cairn-plot: bar presentation requires a typed bars array");
  }
  return value as unknown as BarPresentation;
}

function isBarDatum(value: unknown): value is BarDatum {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const bar = value as Record<string, unknown>;
  return typeof bar.id === "string" && typeof bar.label === "string" &&
    typeof bar.value === "number" && Number.isFinite(bar.value) &&
    (bar.color === undefined || typeof bar.color === "string");
}

export function ensureBarPlotType(
  View: ComponentType<ReactPlotViewProps<BarPresentation, ChartSettings>>,
): void {
  ensureInlinePlotType<BarPresentation, ChartSettings>({
    kind: "bar",
    View,
    parse: barPresentation,
    settings: { defaults: () => ({}), project: projectChartSettings },
  });
}
