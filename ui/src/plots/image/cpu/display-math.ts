import { clamp01 } from "../../../primitives/util/clamp.ts";
import type { ReduceMode } from "../definition/display-operations.ts";
import type { DisplayParameters } from "../runtime/display-settings.ts";

export const REC709_LUMA = [0.2126, 0.7152, 0.0722] as const;
export const LOG_NORM_EPS = 1e-4;

export function reduceToScalar(values: readonly number[], channels: number, mode: ReduceMode): number {
  if (channels <= 1) return values[0] ?? 0;
  const count = Math.min(channels, 3);
  if (mode === "luminance") {
    return REC709_LUMA[0] * (values[0] ?? 0)
      + REC709_LUMA[1] * (values[1] ?? 0)
      + REC709_LUMA[2] * (count >= 3 ? values[2] ?? 0 : 0);
  }
  let sum = 0;
  for (let channel = 0; channel < count; channel++) sum += values[channel] ?? 0;
  return sum / count;
}

export function boundsActive(parameters: DisplayParameters): boolean {
  return Number.isFinite(parameters.min) && Number.isFinite(parameters.max);
}

export function computeDataIndex(value: number, parameters: DisplayParameters): number {
  let index = value;
  if (boundsActive(parameters)) {
    const range = parameters.max! - parameters.min!;
    index = range === 0 ? 0 : (value - parameters.min!) / range;
  }
  if (parameters.norm === "log") {
    const bounded = Math.min(Math.max(index, LOG_NORM_EPS), 1);
    return (Math.log(bounded) - Math.log(LOG_NORM_EPS)) / -Math.log(LOG_NORM_EPS);
  }
  if (parameters.norm === "power") return Math.pow(clamp01(index), parameters.gamma > 0 ? parameters.gamma : 1);
  return index;
}

export function turboDataIndex(value: number): number {
  return clamp01((Math.log2(Math.max(value, 0.03125)) + 5) / 10);
}

export function signedAnalyticColor(value: number): [number, number, number] {
  return [value < 0 ? -2 * value : 0, value > 0 ? 2 * value : 0, 0];
}
