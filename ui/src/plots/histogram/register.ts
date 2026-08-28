import type { ComponentType } from "react";

import type { ColormapName } from "../types.ts";
import type { DataSource } from "../../resources/data/data-source.ts";
import { projectChartSettings, type ChartSettings } from "../chart-settings.ts";
import { ensureInlinePlotType, type InlineSpec } from "../inline-register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

interface HistogramSeries {
  readonly step: number;
  readonly counts: readonly number[];
  readonly edges: readonly number[];
}

export type HistogramPresentation =
  | {
      readonly view?: "bars";
      readonly counts: readonly number[];
      readonly edges: readonly number[];
      readonly logY?: boolean;
      readonly className?: string;
      readonly height?: number;
    }
  | {
      readonly view: "heatmap";
      readonly perStep: readonly HistogramSeries[];
      readonly colormap: ColormapName;
      readonly logColor?: boolean;
      readonly bins?: number;
      readonly className?: string;
      readonly height?: number;
    };

function histogramPresentation(value: Record<string, unknown>): HistogramPresentation {
  if (value.view === "heatmap") {
    if (!Array.isArray(value.perStep) || !value.perStep.every(isHistogramSeries) ||
        typeof value.colormap !== "string") {
      throw new Error("cairn-plot: histogram heatmap requires typed perStep data and a colormap");
    }
    return value as unknown as HistogramPresentation;
  }
  if ((value.view !== undefined && value.view !== "bars") ||
      !isNumberArray(value.counts) || !isNumberArray(value.edges)) {
    throw new Error("cairn-plot: histogram bars require typed counts and edges arrays");
  }
  return { ...value, view: "bars" } as HistogramPresentation;
}

function isHistogramSeries(value: unknown): value is HistogramSeries {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const series = value as Record<string, unknown>;
  return typeof series.step === "number" && Number.isFinite(series.step) &&
    isNumberArray(series.counts) && isNumberArray(series.edges);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function ensureHistogramPlotType(
  View: ComponentType<ReactPlotViewProps<HistogramPresentation, ChartSettings>>,
  resolve: (spec: InlineSpec, source: DataSource) => Promise<Record<string, unknown>>,
): void {
  ensureInlinePlotType<HistogramPresentation, ChartSettings>({
    kind: "histogram",
    View,
    resolve,
    parse: histogramPresentation,
    settings: { defaults: () => ({}), project: projectChartSettings },
  });
}
