import { getDisplayOperation } from "../definition/display-operations.ts";
import {
  registerWebGpuDisplayOperation,
  type WebGpuDisplayOperation,
} from "./display-operations.ts";

const perChannel = (id: string, wgsl: string): WebGpuDisplayOperation => ({
  definition: getDisplayOperation(id)!,
  implementation: { kind: "per-channel", wgsl },
});

export const WEBGPU_DISPLAY_CURVES: readonly WebGpuDisplayOperation[] = [
  perChannel("linear", `
    return min(max(value, 0.0), max(peak, 1e-6));
  `),
  perChannel("srgb", `
    return min(max(value, 0.0), max(peak, 1e-6));
  `),
  perChannel("gamma", `
    return min(max(value, 0.0), max(peak, 1e-6));
  `),
  perChannel("reinhard", `
    let positive = max(value, 0.0);
    return positive / (1.0 + positive / max(peak, 1e-6));
  `),
  perChannel("aces", `
    let p = max(peak, 1e-6);
    let normalized = max(value, 0.0) / p;
    let numerator = normalized * (2.51 * normalized + 0.03);
    let denominator = normalized * (2.43 * normalized + 0.59) + 0.14;
    return p * clamp(numerator / denominator, 0.0, 1.0);
  `),
  perChannel("normal", `
    return clamp((value + 1.0) * 0.5, 0.0, 1.0);
  `),
];

for (const operation of WEBGPU_DISPLAY_CURVES) registerWebGpuDisplayOperation(operation);
