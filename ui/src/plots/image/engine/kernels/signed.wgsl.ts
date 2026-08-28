/** Pointwise diff kernel: signed per-channel error `a-b` (raw; displayed via
 *  the `signed` range → `(v+1)/2`). Migrated from compare.wgsl.ts's diffChannel
 *  mode 0. */
import type { PointwiseKernel } from "./kernel-registry";

export const signedKernel: PointwiseKernel = {
  kind: "pointwise",
  id: "signed",
  label: "Signed Error",
  publicName: "signed",
  displayRange: "signed",
  output: "per-channel",
  source: `
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(a.rgb - b.rgb, 1.0);
}
`,
};
