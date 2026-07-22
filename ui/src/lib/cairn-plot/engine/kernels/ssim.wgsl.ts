/**
 * SSIM multi-pass diff kernel (Wang et al. 2004), registered as the public
 * `ssim` mode. A drop-in on the diff-kernel registry (spec
 * §"SSIM (next kernel, the registry makes it a drop-in)") — NO switch growth.
 *
 * Numerically mirrors the CPU reference (`ssim-reference.ts`), which is itself
 * pinned to scikit-image's `structural_similarity` (`ssim-reference.test.ts`);
 * the GPU kernel is cross-verified against the CPU reference in the browser
 * harness (`engine/__tests__/ssim.browser.ts`).
 *
 * ## Pass graph (all intermediates rgba16float, source resolution)
 *   momA  : srcA/srcB (sRGB) -> luminance Ya,Yb -> vec4(Ya, Yb, Ya^2, Yb^2).
 *   momB  : srcA/srcB (sRGB) -> luminance Ya,Yb -> vec4(Ya*Yb, 0, 0, 0).
 *   blurHA/blurVA : separable 11-tap Gaussian (sigma=1.5, reflect) of momA ->
 *                   (ux, uy, E[x^2], E[y^2]).
 *   blurHB/blurVB : same separable Gaussian of momB -> (E[xy], .., .., ..).
 *   ssim  : per-pixel SSIM from the local statistics; OUTPUT = the ERROR map
 *           value 1 - SSIM (replicated across R/G/B, alpha=1) so a sequential
 *           colormap reads "more error = brighter". `displayRange:"unit"`
 *           (1-SSIM is 0 for identical inputs; >1 only for anticorrelated
 *           regions, which clamp).
 *
 * The Gaussian is SEPARABLE: one shared `BLUR_SHADER` runs twice per moment
 * texture (horizontal then vertical), the direction + sigma + radius passed as a
 * uniform, weights recomputed per tap in-shader and normalized to sum 1
 * (matching scipy's normalized 1D kernel; reflect boundary means every tap is a
 * valid sample, so the in-shader weight sum == the full-kernel sum).
 *
 * ## LDR / HDR handling
 * Sources are treated as sRGB-encoded display values; the luminance front-end
 * sRGB-decodes then takes Rec.709 luminance and CLAMPS to [0,1] — the same
 * "clip highlights to the display range" choice FLIP's forced-LDR path makes for
 * float sources (`flip.wgsl.ts` `YCXCZ_LINEAR_CLAMP_SHADER`). SSIM's dynamic
 * range L is therefore 1, consistent with `data_range=1`.
 */
import { VERTEX_WGSL } from "./prelude.wgsl.ts";
import { SSIM_K1, SSIM_K2, SSIM_L, SSIM_SIGMA, SSIM_RADIUS } from "./ssim-reference.ts";
import type { MultipassKernel, KernelPass, KernelBuildCtx } from "./kernel-registry";
import type { BindGroupEntry } from "../types";

// Shared luminance front-end (matches ssim-reference.ts's ssimLuminance).
const LUMA_WGSL = `
fn ssim_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
fn ssim_luma(srgb: vec3<f32>) -> f32 {
  let lin = vec3<f32>(ssim_srgb2linear(srgb.r), ssim_srgb2linear(srgb.g), ssim_srgb2linear(srgb.b));
  return clamp(dot(lin, vec3<f32>(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
}
`;

// Moment pass A: (Ya, Yb, Ya^2, Yb^2).
const MOMENT_A_SHADER = `
${VERTEX_WGSL}
${LUMA_WGSL}
@group(0) @binding(0) var srcA: texture_2d<f32>;
@group(0) @binding(3) var srcB: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dimsA = vec2<i32>(textureDimensions(srcA));
  let dimsB = vec2<i32>(textureDimensions(srcB));
  let px = vec2<i32>(in.position.xy);
  let ya = ssim_luma(textureLoad(srcA, clamp(px, vec2<i32>(0), dimsA - vec2<i32>(1)), 0).rgb);
  let yb = ssim_luma(textureLoad(srcB, clamp(px, vec2<i32>(0), dimsB - vec2<i32>(1)), 0).rgb);
  return vec4<f32>(ya, yb, ya * ya, yb * yb);
}
`;

// Moment pass B: (Ya*Yb, 0, 0, 0).
const MOMENT_B_SHADER = `
${VERTEX_WGSL}
${LUMA_WGSL}
@group(0) @binding(0) var srcA: texture_2d<f32>;
@group(0) @binding(3) var srcB: texture_2d<f32>;
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dimsA = vec2<i32>(textureDimensions(srcA));
  let dimsB = vec2<i32>(textureDimensions(srcB));
  let px = vec2<i32>(in.position.xy);
  let ya = ssim_luma(textureLoad(srcA, clamp(px, vec2<i32>(0), dimsA - vec2<i32>(1)), 0).rgb);
  let yb = ssim_luma(textureLoad(srcB, clamp(px, vec2<i32>(0), dimsB - vec2<i32>(1)), 0).rgb);
  return vec4<f32>(ya * yb, 0.0, 0.0, 0.0);
}
`;

// Separable 1D Gaussian pass. `u_blur` = (dirX, dirY, radius, sigma). Reflect
// boundary (scipy 'reflect' / skimage default), weights recomputed per tap and
// normalized to sum 1 in-shader.
const BLUR_SHADER = `
${VERTEX_WGSL}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(5) var<uniform> u_blur: vec4<f32>;

fn ssim_reflect(i: i32, n: i32) -> i32 {
  if (n == 1) { return 0; }
  let period = 2 * n;
  var p = ((i % period) + period) % period;
  if (p >= n) { p = period - 1 - p; }
  return p;
}

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dims = vec2<i32>(textureDimensions(src));
  let px = vec2<i32>(in.position.xy);
  let dir = vec2<i32>(i32(round(u_blur.x)), i32(round(u_blur.y)));
  let r = i32(round(u_blur.z));
  let sigma = u_blur.w;
  var acc = vec4<f32>(0.0);
  var wsum = 0.0;
  for (var k = -r; k <= r; k = k + 1) {
    let g = exp(-0.5 * f32(k * k) / (sigma * sigma));
    let sx = ssim_reflect(px.x + dir.x * k, dims.x);
    let sy = ssim_reflect(px.y + dir.y * k, dims.y);
    acc = acc + g * textureLoad(src, vec2<i32>(sx, sy), 0);
    wsum = wsum + g;
  }
  return acc / wsum;
}
`;

// Final combine: local statistics -> SSIM -> error map (1 - SSIM).
const SSIM_SHADER = `
${VERTEX_WGSL}
@group(0) @binding(0) var statsA: texture_2d<f32>; // (ux, uy, E[x^2], E[y^2])
@group(0) @binding(3) var statsB: texture_2d<f32>; // (E[xy], .., .., ..)
@group(0) @binding(8) var<uniform> u_c: vec4<f32>; // C1, C2, 0, 0
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let px = vec2<i32>(in.position.xy);
  let s = textureLoad(statsA, px, 0);
  let exy = textureLoad(statsB, px, 0).x;
  let ux = s.x;
  let uy = s.y;
  let vx = s.z - ux * ux;
  let vy = s.w - uy * uy;
  let vxy = exy - ux * uy;
  let c1 = u_c.x;
  let c2 = u_c.y;
  let a1 = 2.0 * ux * uy + c1;
  let a2 = 2.0 * vxy + c2;
  let b1 = ux * ux + uy * uy + c1;
  let b2 = vx + vy + c2;
  let ssim = (a1 * a2) / (b1 * b2);
  let err = 1.0 - ssim;
  return vec4<f32>(err, err, err, 1.0);
}
`;

function u(binding: number, arr: number[]): BindGroupEntry {
  return { binding, resource: { uniform: new Float32Array(arr) } };
}

/** A horizontal + vertical separable-Gaussian blur sub-graph over `input`. */
function blurPasses(input: string, prefix: string): { passes: KernelPass[]; out: string } {
  const h = `${prefix}H`;
  const v = `${prefix}V`;
  const passes: KernelPass[] = [
    { name: h, shader: BLUR_SHADER, inputs: [input], output: h, uniforms: () => [u(1, [1, 0, SSIM_RADIUS, SSIM_SIGMA])] },
    { name: v, shader: BLUR_SHADER, inputs: [h], output: v, uniforms: () => [u(1, [0, 1, SSIM_RADIUS, SSIM_SIGMA])] },
  ];
  return { passes, out: v };
}

export const ssimKernel: MultipassKernel = {
  kind: "multipass",
  id: "ssim",
  label: "SSIM (1−SSIM)",
  publicName: "ssim",
  displayRange: "unit",
  // SSIM is a single structural-error value per pixel (1-SSIM, replicated across
  // R/G/B); the overlay prints ONE untinted number, never three channels.
  output: "scalar",
  buildPasses(_ctx: KernelBuildCtx): { passes: KernelPass[]; final: string } {
    const c1 = (SSIM_K1 * SSIM_L) ** 2;
    const c2 = (SSIM_K2 * SSIM_L) ** 2;
    const blurA = blurPasses("momA", "statsA");
    const blurB = blurPasses("momB", "statsB");
    const passes: KernelPass[] = [
      { name: "momA", shader: MOMENT_A_SHADER, inputs: ["srcA", "srcB"], output: "momA" },
      { name: "momB", shader: MOMENT_B_SHADER, inputs: ["srcA", "srcB"], output: "momB" },
      ...blurA.passes,
      ...blurB.passes,
      {
        name: "ssim",
        shader: SSIM_SHADER,
        inputs: [blurA.out, blurB.out],
        output: "ssim",
        uniforms: () => [u(2, [c1, c2, 0, 0])],
      },
    ];
    return { passes, final: "ssim" };
  },
};
