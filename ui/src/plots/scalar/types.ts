import type { AxisScale, Series } from "../types.ts";
import type { AxisSource } from "../transforms/x-axis.ts";
import type { SettingsRecord } from "../contracts.ts";
import { projectChartSettings, type ChartSettings } from "../chart-settings.ts";

export interface ScalarPresentation {
  readonly series: readonly Series[];
  readonly xAxis?: AxisSource;
  readonly xScale?: AxisScale;
  readonly yScale?: AxisScale;
  readonly xRange?: readonly [number | null, number | null];
  readonly yRange?: readonly [number | null, number | null];
  readonly lineType?: "linear" | "monotone" | "step" | "stepBefore" | "stepAfter";
  readonly showLegend?: boolean;
  readonly tooltip?: { readonly showContext?: boolean; readonly showWallTime?: boolean };
  readonly height?: number;
}

export type ScalarSettings = ChartSettings;

function isSeries(value: unknown): value is Series {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.key === "string" &&
    typeof record.label === "string" &&
    typeof record.color === "string" &&
    Array.isArray(record.points);
}

/** The one checked type-erasure boundary for resolved scalar content. */
export function scalarPresentation(value: Record<string, unknown>): ScalarPresentation {
  if (!Array.isArray(value.series) || !value.series.every(isSeries)) {
    throw new Error("cairn-plot: scalar presentation requires a typed series array");
  }
  return value as unknown as ScalarPresentation;
}

export function projectScalarSettings(settings: Readonly<SettingsRecord>): ScalarSettings {
  return projectChartSettings(settings);
}
