/** Pointwise diff kernel: absolute per-channel error `|a-b|` (raw; `unit`
 *  display). Migrated from compare.wgsl.ts's diffChannel mode 1. */
import type { PointwiseKernel } from "./kernel-registry";

export const absoluteKernel: PointwiseKernel = {
  kind: "pointwise",
  id: "absolute",
  label: "Absolute Error",
  publicName: "abs",
  displayRange: "unit",
  defaultColormap: "turbo", // ℝ⁺ magnitude → sequential map (tev false-color)
  output: "per-channel",
  source: `
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
}
`,
};
