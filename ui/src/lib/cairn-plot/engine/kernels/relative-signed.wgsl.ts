/** Pointwise diff kernel: relative signed error `(a-b)/max(a,1/255)` (raw;
 *  `signed` display). Migrated from compare.wgsl.ts's diffChannel mode 3. */
import type { PointwiseKernel } from "./kernel-registry";

export const relativeSignedKernel: PointwiseKernel = {
  kind: "pointwise",
  id: "relative_signed",
  label: "Relative Signed",
  publicName: "rel_signed",
  displayRange: "signed",
  output: "per-channel",
  source: `
fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
  let denom = max(a.rgb, vec3<f32>(1.0 / 255.0));
  return vec4<f32>((a.rgb - b.rgb) / denom, 1.0);
}
`,
};
