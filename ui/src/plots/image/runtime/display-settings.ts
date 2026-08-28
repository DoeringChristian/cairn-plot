import type { ReduceMode } from "../definition/display-operations.ts";

export type NormMode = "linear" | "log" | "power";

export interface DisplayParameters {
  exposure: number;
  offset: number;
  peak: number;
  gamma: number;
  min?: number;
  max?: number;
  norm?: NormMode;
  reduce?: ReduceMode;
}

export const DEFAULT_DISPLAY_PARAMETERS: DisplayParameters = {
  exposure: 0,
  offset: 0,
  peak: 1,
  gamma: 2.2,
  norm: "linear",
};

export const DEFAULT_COMPARISON_DISPLAY_OPERATION_ID = "linear" as const;

export function defaultReduceMode(channels: number): ReduceMode {
  return channels >= 3 ? "luminance" : "mean";
}

