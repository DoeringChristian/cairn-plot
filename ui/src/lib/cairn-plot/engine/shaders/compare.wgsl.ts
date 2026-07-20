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
 * shared prelude (`../kernels/prelude.wgsl.ts`). There is no `mode`/`diffSubmode`
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
 *   3 unif imageParams: exposureEV, operatorId, gamma, isScalar   @binding(11)
 *   4 unif uvRect: xy, wh                                         @binding(14)
 *   5 unif composeParams: split, alpha, hdrOut, filterMode        @binding(17)
 *   6 unif extraParams: offset, _, _, _ (TEV display offset)       @binding(20)
 */
import { VERTEX_WGSL, SAMPLING_WGSL, TONEMAP_WGSL } from "../kernels/prelude.wgsl";

function composeShader(finalExpr: string): string {
  return `
${VERTEX_WGSL}
${SAMPLING_WGSL}
${TONEMAP_WGSL}

@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(6) var lut: texture_2d<f32>;
@group(0) @binding(11) var<uniform> u_img: vec4<f32>;     // exposureEV, operatorId, gamma, isScalar
@group(0) @binding(14) var<uniform> u_uv: vec4<f32>;      // uvRect.xy, uvRect.wh
@group(0) @binding(17) var<uniform> u_compose: vec4<f32>; // split, alpha, hdrOut, filterMode
@group(0) @binding(20) var<uniform> u_extra: vec4<f32>;   // offset, _, _, _ (TEV display offset; default 0)

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
  let operatorId = i32(round(u_img.y));
  let gamma = u_img.z;
  let isScalar = u_img.w > 0.5;
  let hdrOut = u_compose.z > 0.5;
  let offset = u_extra.x;

  let colorA = processSide(lut, sampledA, exposureEV, offset, operatorId, gamma, isScalar, hdrOut);
  let colorB = processSide(lut, sampledB, exposureEV, offset, operatorId, gamma, isScalar, hdrOut);

  let split = u_compose.x;
  let alpha = u_compose.y;
  let outColor = ${finalExpr};
  return vec4<f32>(outColor, 1.0);
}
`;
}

export const compareSplitWGSL = composeShader("select(colorB, colorA, uv.x < split)");
export const compareBlendWGSL = composeShader("mix(colorA, colorB, alpha)");
