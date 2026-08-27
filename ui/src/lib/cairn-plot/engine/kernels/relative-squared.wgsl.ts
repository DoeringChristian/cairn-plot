/** Pointwise diff kernel: relative squared error `(a-b)^2/max(a,1/255)^2` (raw;
 *  `unit` display). Migrated from compare.wgsl.ts's diffChannel mode 5. */
import type { PointwiseKernel } from "./kernel-registry";

export const relativeSquaredKernel: PointwiseKernel = {
  kind: "pointwise",
  id: "relative_squared",
  label: "Relative Squared",
  publicName: "rel_square",
  displayRange: "unit",
  output: "per-channel",
  source: `
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  let d = a.rgb - b.rgb;
  return vec4<f32>((d * d) / (denom * denom), 1.0);
}
`,
};
