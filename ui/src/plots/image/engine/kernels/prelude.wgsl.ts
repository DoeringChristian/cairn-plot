/**
 * Shared WGSL prelude for the diff-kernel registry (spec §registry). Written
 * once, composed (string-concatenated) with each kernel's own source to form a
 * single shader module per kernel — see `kernel-registry.ts` /
 * `../diff-engine.ts`. Split into named fragments so each kernel/pass includes
 * only what it needs; there is NO runtime mode branching anywhere in here.
 *
 * Contents:
 *   - `VERTEX_WGSL`    — the fullscreen-triangle vertex stage (same Y-flip
 *     convention as `shaders/image.wgsl.ts` / `passthrough.wgsl.ts`).
 *   - `SAMPLING_WGSL`  — bilinear/nearest source sampling + nearest/linear LUT lookup.
 *   - `TONEMAP_WGSL`   — sRGB OETF + tone-map operators + `processSide`
 *     (the per-side exposure→[scalar LUT]→operator→encode pipeline, verbatim
 *     from `shaders/compare.wgsl.ts`, used by the split/blend compose shaders).
 *   - `FLIP_COLOR_WGSL`— sRGB→linear, linRGB↔XYZ, XYZ→YCxCz, YCxCz→linRGB,
 *     linRGB→Hunt-adjusted CIELAB, HyAB. Mirrors `flip-reference.ts` exactly so
 *     the GPU FLIP kernel and the CPU reference agree.
 *   - `SEPARABLE_CONV_NOTE` — see the doc string; the CSF/feature convolutions
 *     recompute Gaussian weights per tap in-shader (normalization factors are
 *     passed as uniforms), so no filter-coefficient buffer plumbing is needed.
 */

import { buildTonemapCurvesWGSL } from "../../../../lib/cairn-plot/image/encodings/index.ts";

export const VERTEX_WGSL = `
struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let xRaw = f32((vertexIndex << 1u) & 2u);
  let yRaw = f32(vertexIndex & 2u);
  var out: VSOut;
  out.uv = vec2<f32>(xRaw, 1.0 - yRaw);
  out.position = vec4<f32>(xRaw * 2.0 - 1.0, yRaw * 2.0 - 1.0, 0.0, 1.0);
  return out;
}
`;

export const SAMPLING_WGSL = `
// Manual bilinear blend over a source texture (see image.wgsl.ts's
// sampleBilinearF doc comment for why this is hand-rolled).
fn sampleBilinearOf(tex: texture_2d<f32>, uv: vec2<f32>, dims: vec2<f32>) -> vec4<f32> {
  let texel = uv * dims - vec2<f32>(0.5);
  let base = floor(texel);
  let frac = texel - base;
  let maxX = i32(dims.x) - 1;
  let maxY = i32(dims.y) - 1;
  let x0 = clamp(i32(base.x), 0, maxX);
  let x1 = clamp(i32(base.x) + 1, 0, maxX);
  let y0 = clamp(i32(base.y), 0, maxY);
  let y1 = clamp(i32(base.y) + 1, 0, maxY);
  let c00 = textureLoad(tex, vec2<i32>(x0, y0), 0);
  let c10 = textureLoad(tex, vec2<i32>(x1, y0), 0);
  let c01 = textureLoad(tex, vec2<i32>(x0, y1), 0);
  let c11 = textureLoad(tex, vec2<i32>(x1, y1), 0);
  let top = mix(c00, c10, frac.x);
  let bot = mix(c01, c11, frac.x);
  return mix(top, bot, frac.y);
}

// Colormap LUT lookup, nearest and linear variants (see image.wgsl.ts's
// sampleLutNearestF/sampleLutLinearF doc). Callers pick the variant with the
// SAME filterMode flag that selects nearest vs. bilinear source sampling, so a
// colormapped result shares one interpolation decision with the plain path:
//  - NEAREST (round-half-up index) at the pixelated zoom — crisp per-texel color.
//  - LINEAR (blend adjacent entries by the fractional index) at moderate zoom —
//    so a bilinearly-interpolated scalar yields a smooth color rather than
//    snapping to one of 256 discrete bins (the per-texel banding / blocky
//    corners bug). At a texel-aligned 8-bit scalar the fraction is 0, so LINEAR
//    degenerates to the exact NEAREST entry.
fn sampleLUT(lut: texture_2d<f32>, valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
  return textureLoad(lut, vec2<i32>(idx, 0), 0).rgb;
}

fn sampleLUTLinear(lut: texture_2d<f32>, valueUnit: f32) -> vec3<f32> {
  let idxF = clamp(valueUnit, 0.0, 1.0) * 255.0;
  let base = floor(idxF);
  let i0 = clamp(i32(base), 0, 255);
  let i1 = min(i0 + 1, 255);
  let frac = idxF - base;
  let c0 = textureLoad(lut, vec2<i32>(i0, 0), 0).rgb;
  let c1 = textureLoad(lut, vec2<i32>(i1, 0), 0).rgb;
  return mix(c0, c1, frac);
}
`;

// Compare align/fit source mapping (mirrors engine/compare-align.ts). Maps a
// RESULT-grid pixel to a source sample so the diff compute honors the user's
// alignment anchor / fill scaling. Requires SAMPLING_WGSL (`sampleBilinearOf`).
//   fitFill < 0.5 (CROP): sample the INTEGER texel `resultPx + (offX,offY)`
//                         (the alignment anchor), clamped to the source.
//   fitFill > 0.5 (FILL): sample BILINEARLY at uv `(resultPx+0.5)/(resW,resH)`
//                         over the source's full extent (rescale to the common
//                         grid); the offset is unused.
export const SOURCE_MAP_WGSL = `
fn mapSample(
  tex: texture_2d<f32>, resultPx: vec2<i32>,
  offX: f32, offY: f32, resW: f32, resH: f32, fitFill: f32,
) -> vec4<f32> {
  let dims = vec2<i32>(textureDimensions(tex));
  if (fitFill > 0.5) {
    let uv = (vec2<f32>(resultPx) + vec2<f32>(0.5)) / vec2<f32>(resW, resH);
    return sampleBilinearOf(tex, uv, vec2<f32>(dims));
  }
  let off = vec2<i32>(i32(round(offX)), i32(round(offY)));
  let p = clamp(resultPx + off, vec2<i32>(0), dims - vec2<i32>(1));
  return textureLoad(tex, p, 0);
}
`;

// UNIFIED compose tone-map pipeline — the FULL operator × peak × surface model,
// byte-identical to `shaders/image.wgsl.ts` (single-image path) so a compare
// pane tone-maps EXACTLY as the single-image pane does. All of `srgbEotf`
// (sRGB-DECODE), the extended roll-off/clamp operators (ids 4-7 + peak), and the
// extended (unclamped, origin-mirrored) output encode are ported here verbatim
// from `image.wgsl.ts`; the GPU↔TS parity harness (`compare-pass.browser.ts`)
// pins the compose path to the SAME `image/tonemap.ts` reference the image path
// uses. Keep the math in lockstep with `image.wgsl.ts` when either changes.
export const TONEMAP_WGSL = `
fn srgbOetf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.0031308) { return 12.92 * v; }
  return 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

// sRGB EOTF (sRGB code -> linear) — inverse of srgbOetf. LINEARIZES an 8-bit
// sRGB compare side when srgbDecode is set (a u8 source going through the
// display-transfer pipeline), so exposure/offset + the operator act on linear
// light. A float side leaves srgbDecode off (already scene-linear).
fn srgbEotf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.04045) { return v / 12.92; }
  return pow((v + 0.055) / 1.055, 2.4);
}

fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) { return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0); }
  return srgbOetf(x);
}

// EXTENDED output-encode (HDR-out / extended-surface transfer) — unclamped,
// origin-mirrored sRGB OETF / power curve (values past 1 survive as extended
// brightness). Mirrors image.wgsl.ts's extendedSrgbOetf/extendedGammaEncode/
// extendedOutputEncodeF exactly.
fn extendedSrgbOetf(x: f32) -> f32 {
  let a = abs(x);
  let s = sign(x);
  if (a <= 0.0031308) { return s * 12.92 * a; }
  return s * (1.055 * pow(a, 1.0 / 2.4) - 0.055);
}
fn extendedGammaEncode(x: f32, gamma: f32) -> f32 {
  let a = abs(x);
  let s = sign(x);
  return s * pow(a, 1.0 / gamma);
}
fn extendedOutputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) { return extendedGammaEncode(x, gamma); }
  return extendedSrgbOetf(x);
}

// The curve helper fns + operatorId-dispatched applyOperator are ASSEMBLED from
// the display-encoding registry (image/encodings) — the SAME source the
// single-image shader (image.wgsl.ts) and the CPU twins (image/tonemap.ts) use,
// so the compose path tone-maps byte-identically. remaps:false reproduces the
// pre-registry compose behavior exactly: operatorId 9 (normal) has NO branch
// here and falls through to the default clamp (the normal remap is a
// single-image-only path). Ids 5/6/7 read the peak uniform.
${buildTonemapCurvesWGSL({ remaps: false })}

// Per-side [sRGB-DECODE] -> exposure+offset -> [scalar LUT] -> operator(peak) ->
// encode. srgbDecode LINEARIZES a u8 side first (a float side passes it 0). The
// lut is only read when isScalar. offset is the TEV display offset (added AFTER
// exposure, BEFORE colormap/tonemap/encode). On hdrOut the EXTENDED (unclamped)
// encode runs so values past P survive to the extended HDR surface.
fn processSide(lut: texture_2d<f32>, sampled: vec4<f32>, exposureEV: f32, offset: f32, operatorId: i32, gamma: f32, isScalar: bool, hdrOut: bool, peak: f32, srgbDecode: bool, filterLinear: bool) -> vec3<f32> {
  var src = sampled.rgb;
  if (srgbDecode) { src = vec3<f32>(srgbEotf(src.r), srgbEotf(src.g), srgbEotf(src.b)); }
  var rgb = src * exp2(exposureEV) + vec3<f32>(offset);
  // LUT lookup mirrors the source filter (see sampleLUT/sampleLUTLinear doc):
  // bilinear source sampling -> linear LUT, nearest -> nearest, so colormapped
  // compare sides interpolate exactly like the plain single-image path.
  if (isScalar) {
    if (filterLinear) { rgb = sampleLUTLinear(lut, rgb.x); }
    else { rgb = sampleLUT(lut, rgb.x); }
  }
  rgb = applyOperator(rgb, operatorId, peak);
  let hasGamma = gamma > 0.0;
  if (hdrOut) {
    return vec3<f32>(extendedOutputEncodeF(rgb.r, gamma, hasGamma), extendedOutputEncodeF(rgb.g, gamma, hasGamma), extendedOutputEncodeF(rgb.b, gamma, hasGamma));
  }
  return vec3<f32>(outputEncodeF(rgb.r, gamma, hasGamma), outputEncodeF(rgb.g, gamma, hasGamma), outputEncodeF(rgb.b, gamma, hasGamma));
}
`;

// FLIP color-space transforms — MUST match flip-reference.ts numerically.
export const FLIP_COLOR_WGSL = `
const M_RGB2XYZ = mat3x3<f32>(
  // column-major: WGSL mat3x3 columns are the 3 args; we store rows via transpose usage below.
  vec3<f32>(10135552.0/24577794.0, 2613072.0/12288897.0, 1425312.0/73733382.0),
  vec3<f32>(8788810.0/24577794.0, 8788810.0/12288897.0, 8788810.0/73733382.0),
  vec3<f32>(4435075.0/24577794.0, 887015.0/12288897.0, 70074185.0/73733382.0)
);
// Exact inverse of M_RGB2XYZ (columns), so ycxcz->linrgb round-trips the
// forward transform used in flip-reference.ts.
const M_XYZ2RGB = mat3x3<f32>(
  vec3<f32>(3.241003232976358, -0.9692242522025163, 0.0556394198519754),
  vec3<f32>(-1.537398969488785, 1.875929983695176, -0.2040112061239099),
  vec3<f32>(-0.4986158819963628, 0.04155422634008469, 1.057148977187533)
);
const WHITE_INV = vec3<f32>(1.052156925, 1.0, 0.918357670);
const LAB_DELTA = 6.0 / 29.0;

fn flip_srgb2linear(c: f32) -> f32 {
  if (c <= 0.04045) { return c / 12.92; }
  return pow((c + 0.055) / 1.055, 2.4);
}
// Linear RGB -> YCxCz (no OETF decode). Used by HDR-FLIP (tone-mapped, already
// linear inputs, hdr-flip.ts) and forced-LDR-on-float (linear-clamp input,
// flip.wgsl.ts); matches flip-reference.ts's linrgb2ycxcz.
fn flip_linrgb2ycxcz(lin: vec3<f32>) -> vec3<f32> {
  let xyz = M_RGB2XYZ * lin;
  let n = xyz * WHITE_INV;
  return vec3<f32>(116.0 * n.y - 16.0, 500.0 * (n.x - n.y), 200.0 * (n.y - n.z));
}
fn flip_rgb2ycxcz(srgb: vec3<f32>) -> vec3<f32> {
  let lin = vec3<f32>(flip_srgb2linear(srgb.r), flip_srgb2linear(srgb.g), flip_srgb2linear(srgb.b));
  return flip_linrgb2ycxcz(lin);
}
fn flip_ycxcz2linrgb(yc: vec3<f32>) -> vec3<f32> {
  let yy = (yc.x + 16.0) / 116.0;
  let x = (yy + yc.y / 500.0) / WHITE_INV.x;
  let yN = yy / WHITE_INV.y;
  let z = (yy - yc.z / 200.0) / WHITE_INV.z;
  return M_XYZ2RGB * vec3<f32>(x, yN, z);
}
fn flip_labF(t: f32) -> f32 {
  if (t > LAB_DELTA * LAB_DELTA * LAB_DELTA) { return pow(t, 1.0 / 3.0); }
  return t / (3.0 * LAB_DELTA * LAB_DELTA) + 4.0 / 29.0;
}
fn flip_linrgb2huntlab(rgb: vec3<f32>) -> vec3<f32> {
  let xyz = M_RGB2XYZ * clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
  let n = xyz * WHITE_INV;
  let fx = flip_labF(n.x);
  let fy = flip_labF(n.y);
  let fz = flip_labF(n.z);
  let L = 116.0 * fy - 16.0;
  let a = 500.0 * (fx - fy);
  let b = 200.0 * (fy - fz);
  return vec3<f32>(L, 0.01 * L * a, 0.01 * L * b);
}
fn flip_hyab(l1: vec3<f32>, l2: vec3<f32>) -> f32 {
  let d = l1 - l2;
  return abs(d.x) + sqrt(d.y * d.y + d.z * d.z);
}
`;

/**
 * The CSF and feature convolutions (FLIP) recompute their Gaussian weights per
 * tap in-shader from `deltaX = 1/ppd` (CSF) or `sd = 0.5*gw*ppd` (features);
 * only the per-channel normalization factors (which need the whole-window sum)
 * are precomputed on the CPU and passed as uniforms. This avoids uploading a
 * filter-coefficient texture/buffer for what is a one-time-per-content compute.
 */
export const SEPARABLE_CONV_NOTE = "see prelude doc comment";
