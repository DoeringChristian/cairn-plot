/** Pointwise diff kernel: squared per-channel error `(a-b)^2` (raw; `unit`
 *  display). Migrated from compare.wgsl.ts's diffChannel mode 2. */
import type { PointwiseKernel } from "./kernel-registry";

export const squaredKernel: PointwiseKernel = {
  kind: "pointwise",
  id: "squared",
  label: "Squared Error",
  publicName: "square",
  displayRange: "unit",
  source: `
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let d = a.rgb - b.rgb;
  return vec4<f32>(d * d, 1.0);
}
`,
};
