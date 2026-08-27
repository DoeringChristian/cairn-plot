/** Pointwise diff kernel: relative absolute error `|a-b|/max(a,1/255)` (raw;
 *  `unit` display). Migrated from compare.wgsl.ts's diffChannel mode 4. */
import type { PointwiseKernel } from "./kernel-registry";

export const relativeAbsoluteKernel: PointwiseKernel = {
  kind: "pointwise",
  id: "relative_absolute",
  label: "Relative Absolute",
  publicName: "rel_abs",
  displayRange: "unit",
  output: "per-channel",
  source: `
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>(abs(a.rgb - b.rgb) / denom, 1.0);
}
`,
};
