/**
 * COMPOSE render-pass WGSL (WebGPU) — the split / blend view compositions.
 *
 * ## Spec migration (diff-kernels-and-flip): the diff branch is GONE
 * This file used to be an ubershader with a `modeId` switch (split | blend |
 * diff) and a `diffChannel(mode)` sub-switch over six submodes, all selected by
 * uniform ints. Per the diff-kernel spec that entire runtime-branching machine
 * was DELETED: diff is now a cached kernel result texture blitted by
 * `../diff-engine.ts`'s `renderDiffDisplay`, and split/blend became TWO
 * switch-free specialized pipelines built here by source composition from the
 * shared prelude (`../kernels/prelude.wgsl.ts`). There is no `mode`/`operation`
 * uniform anywhere anymore.
 *
 * Both shaders run each source texel through the SAME per-side pipeline
 * (`processSide`: exposure → [scalar LUT] → operator → output-encode) and then
 * composite:
 *   - `compareSplitWGSL`: `select(colorB, colorA, uv.x < split)` — reference
 *     (colorA) left of the DEST-space divider, foreground (colorB) right.
 *   - `compareBlendWGSL`: `mix(colorA, colorB, alpha)`.
 * Out-of-bounds (zoomed-out) fragments return transparent, exactly as before.
 *
 * Uniform/binding layout (logical → native `N*3+kind`):
 *   0 tex  texA (reference/A)     @binding(0)
 *   1 tex  texB (foreground/B)    @binding(3)
 *   2 tex  LUT (scalar-image)     @binding(6)
 *   3 unif imageParams: exposureEV, reserved, gamma, isScalar    @binding(11)
 *   4 unif uvRect: xy, wh                                         @binding(14)
 *   5 unif composeParams: split, alpha, hdrOut, filterMode        @binding(17)
 *   6 unif extraParams: offset, peak, srgbDecodeA, srgbDecodeB     @binding(20)
 *
 * UNIFIED tone-map: `processSide` runs the SAME operator × peak × surface
 * pipeline as `shaders/image.wgsl.ts` (extended operators, PEAK ceiling, the
 * extended output encode on `hdrOut`). `peak` (extraParams.y) is the HDR
 * ceiling; `srgbDecodeA`/`srgbDecodeB` (extraParams.z/.w) sRGB-DECODE a u8 side
 * to scene-linear PER SIDE (a float side passes 0) so mixed u8/float operands are
 * both compared in linear light — see `image/tonemap.ts`'s `resolveRenderTonemap`.
 */
import type { WebGpuDisplayOperation } from "../../display.ts";
import { VERTEX_WGSL, SAMPLING_WGSL, buildTonemapWGSL } from "../kernels/prelude.wgsl.ts";

function composeShader(finalExpr: string, displayOperation: WebGpuDisplayOperation): string {
  return `
${VERTEX_WGSL}
${SAMPLING_WGSL}
${buildTonemapWGSL(displayOperation)}

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(6) var lut: texture_2d<f32>;
@group(0) @binding(11) var<uniform> u_img: vec4<f32>;     // exposureEV, reserved, gamma, isScalar
@group(0) @binding(14) var<uniform> u_uv: vec4<f32>;      // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_compose: vec4<f32>; // split, alpha, hdrOut, filterMode
@group(0) @binding(20) var<uniform> u_extra: vec4<f32>;   // offset, peak, srgbDecodeA, srgbDecodeB

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_uv;
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let filterLinear = u_compose.w > 0.5;

  let dimsA = vec2<f32>(textureDimensions(texA));
  var sampledA: vec4<f32>;
  if (filterLinear) { sampledA = sampleBilinearOf(texA, srcUV, dimsA); }
  else { sampledA = textureLoad(texA, vec2<i32>(srcUV * dimsA), 0); }

  let dimsB = vec2<f32>(textureDimensions(texB));
  var sampledB: vec4<f32>;
  if (filterLinear) { sampledB = sampleBilinearOf(texB, srcUV, dimsB); }
  else { sampledB = textureLoad(texB, vec2<i32>(srcUV * dimsB), 0); }

  let exposureEV = u_img.x;
  let gamma = u_img.z;
  let isScalar = u_img.w > 0.5;
  let hdrOut = u_compose.z > 0.5;
  let offset = u_extra.x;
  let peak = u_extra.y;
  let srgbDecodeA = u_extra.z > 0.5;
  let srgbDecodeB = u_extra.w > 0.5;

  let colorA = processSide(lut, sampledA, exposureEV, offset, gamma, isScalar, hdrOut, peak, srgbDecodeA, filterLinear);
  let colorB = processSide(lut, sampledB, exposureEV, offset, gamma, isScalar, hdrOut, peak, srgbDecodeB, filterLinear);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${finalExpr};
  return vec4<f32>(outColor, 1.0);
}
`;
}

export function buildCompareWGSL(mode: "split" | "blend", displayOperation: WebGpuDisplayOperation): string {
  return composeShader(
    mode === "split" ? "select(colorB, colorA, uv.x < split)" : "mix(colorA, colorB, alpha)",
    displayOperation,
  );
}
