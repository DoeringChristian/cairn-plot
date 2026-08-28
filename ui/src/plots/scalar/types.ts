import type { JsonValue } from "../../../../packages/spec/src/json.ts";
import type { AxisScale, Series } from "../../lib/cairn-plot/types.ts";
import type { AxisSource } from "../../lib/cairn-plot/transforms/x-axis.ts";
import type { SettingsRecord } from "../contracts.ts";

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

export type ScalarSettings = SettingsRecord & {
  "chart.domainX"?: [number, number] | null;
  "chart.domainY"?: [number, number] | null;
};

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
  const projected: ScalarSettings = {};
  const x = settings["chart.domainX"];
  const y = settings["chart.domainY"];
  if (x === null || isDomain(x)) projected["chart.domainX"] = x;
  if (y === null || isDomain(y)) projected["chart.domainY"] = y;
  return projected;
}

function isDomain(value: JsonValue | undefined): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) &&
    typeof value[1] === "number" && Number.isFinite(value[1]);
}
