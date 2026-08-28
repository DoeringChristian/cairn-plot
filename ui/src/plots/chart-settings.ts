import type { JsonValue } from "../../../packages/spec/src/json.ts";
import type { SettingsRecord } from "./contracts.ts";

export type ChartSettings = SettingsRecord & {
  "chart.domainX"?: [number, number] | null;
  "chart.domainY"?: [number, number] | null;
};

export function projectChartSettings(settings: Readonly<SettingsRecord>): ChartSettings {
  const projected: ChartSettings = {};
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
