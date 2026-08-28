/**
 * GPU-side ASSEMBLY of the curve-encoding registry into WGSL — the encoding
 * twin of how `engine/diff-engine.ts` composes a kernel's `source` into a
 * pipeline. Pure string building (CORE-SAFE, no device); the shader modules
 * (`engine/shaders/image.wgsl.ts`, `engine/kernels/prelude.wgsl.ts`) interpolate
 * the result into their template.
 *
 * ## One curve FAMILY, one pipeline (per the design)
 * All curve operators share ONE cached pipeline and are selected at render time
 * by the `operatorId` uniform (`u_bind2.y`) — NOT a per-operator pipeline. A
 * slider drag only updates uniforms, so the pipeline never recompiles. This
 * assembler emits one scalar function from each operation-owned WGSL body and
 * one shared RGB dispatcher selected by the numeric operation id.
 */
import { listDisplayOperations } from "./registry.ts";
import { DEFAULT_CLAMP_WGSL } from "./curves.ts";

export interface ApplyOperatorOptions {
  /** Emit `kind:"remap"` entries (the `normal` remap). The single-image path
   *  passes `true`; the compose (split/blend) path passes `false` to preserve
   *  its pre-registry behavior (operatorId 9 fell through to the default clamp
   *  there). */
  remaps: boolean;
}

/**
 * Assemble `fn applyOperator(rgb, operatorId, peak) -> vec3<f32>` from the
 * registry. Function bodies belong to operations; this assembler supplies only
 * stable function names, per-channel application, and numeric dispatch.
 */
export function buildApplyOperatorWGSL(opts: ApplyOperatorOptions): string {
  const entries = listDisplayOperations()
    .filter((e) => e.kind !== "lut") // curves + remaps only (Phase 1)
    .filter((e) => opts.remaps || e.kind !== "remap")
    .slice()
    .sort((a, b) => a.operatorId - b.operatorId);

  const functions = entries
    .map((entry) => `fn cairnDisplayChannel${entry.operatorId}(value: f32, peak: f32) -> f32 {
${entry.channel!.wgsl.trim()}
}`)
    .join("\n\n");

  const branches = entries
    .map((e) => `  if (operatorId == ${e.operatorId}) { return ${e.wgsl}; }`)
    .join("\n");

  return `${functions}

fn applyOperator(rgb: vec3<f32>, operatorId: i32, peak: f32) -> vec3<f32> {
${branches}
  return ${DEFAULT_CLAMP_WGSL};
}`;
}

/** The assembled display-operation dispatch interpolated by both shader modules. */
export function buildTonemapCurvesWGSL(opts: ApplyOperatorOptions): string {
  return buildApplyOperatorWGSL(opts);
}

/**
 * The shared OUTPUT-ENCODE WGSL — the display-transfer stage (sRGB OETF / gamma,
 * plus the sRGB EOTF used to LINEARIZE an 8-bit source), ported BYTE-IDENTICALLY
 * from `image/tonemap.ts`'s `srgbOetf`/`srgbEotf`/`outputEncode` and the EXTENDED
 * (unclamped, origin-mirrored) `extendedSrgbOetf`/`extendedGammaEncode`/
 * `extendedOutputEncode`. The image shader (`engine/shaders/image.wgsl.ts`) AND
 * the diff-display blit (`engine/diff-engine.ts`) both interpolate this so the
 * transfer math lives in ONE place — the diff path needs it for the ANALYTIC
 * signed encoding (whose scene-linear color must be display-encoded, and must let
 * `|v|>1` survive on the extended surface). `outputEncodeF`/`extendedOutputEncodeF`
 * take `(x, gamma, hasGamma)`: `hasGamma` false → the sRGB curve, true → the
 * `1/gamma` power curve (WGSL has no `undefined`, so "unset" is `gamma <= 0`).
 */
export const OUTPUT_ENCODE_WGSL = `
fn srgbOetf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.0031308) {
    return 12.92 * v;
  }
  return 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}
fn srgbEotf(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  if (v <= 0.04045) {
    return v / 12.92;
  }
  return pow((v + 0.055) / 1.055, 2.4);
}
fn outputEncodeF(x: f32, gamma: f32, hasGamma: bool) -> f32 {
  if (hasGamma) {
    return clamp(pow(clamp(x, 0.0, 1.0), 1.0 / gamma), 0.0, 1.0);
  }
  return srgbOetf(x);
}
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
`;

/**
 * The shared LUT-FAMILY WGSL — the `kind:"lut"` twin of the curve dispatch. ONE
 * family for every colormap: the entry only parameterizes the bound 256×1
 * `rgba32float` texture (the colormap TABLE), never the code — so no
 * per-colormap pipeline. Both the single-image shader (`engine/shaders/
 * image.wgsl.ts`, `isScalar` path) and the diff-display blit (`engine/
 * diff-engine.ts`) interpolate this and call `cairnLutColor(lut, scalar, mode,
 * filterLinear)`, so the colormap math lives in exactly one place (the
 * duplicated diff LUT plumbing folds into this).
 *
 * The samplers are byte-identical to the pre-registry `sampleLutNearestF`/
 * `sampleLutLinearF` (`image.wgsl.ts`) and `sampleLUT`/`sampleLUTLinear`
 * (`prelude.wgsl.ts`'s `SAMPLING_WGSL`): the SAME round-half-UP nearest index
 * (matches the CPU `Math.round` reference — WGSL `round()` is round-half-to-EVEN)
 * and the SAME two-tap adjacent-entry blend on the linear (moderate-zoom) path.
 * The LUT stores DISPLAY (sRGB-encoded) colors and the sampled value is written
 * to the surface unchanged (no output re-encode) — the family produces final
 * display RGB, matching the diff blit's long-standing convention.
 *
 * `cmapMode` (matches `engine/diff-cmap-mode.ts`'s `DiffCmapMode` ids):
 *   0 `linear`   — the full ramp (sequential maps; the float-image colormap).
 *   1 `signed`   — linear index of an ALREADY value-remapped input (the diff
 *                  blit does the `(v+1)/2` remap before calling), so it behaves
 *                  like `linear` here.
 *   2 `positive` — fold `[0,1]` into the LUT's UPPER half so zero lands on a
 *                  diverging map's neutral midpoint.
 */
export const LUT_FAMILY_WGSL = `
fn cairnLutSampleNearest(lut: texture_2d<f32>, t: f32) -> vec3<f32> {
  let idxF = clamp(t, 0.0, 1.0) * 255.0;
  let idx = clamp(i32(floor(idxF + 0.5)), 0, 255);
  return textureLoad(lut, vec2<i32>(idx, 0), 0).rgb;
}
fn cairnLutSampleLinear(lut: texture_2d<f32>, t: f32) -> vec3<f32> {
  let idxF = clamp(t, 0.0, 1.0) * 255.0;
  let base = floor(idxF);
  let i0 = clamp(i32(base), 0, 255);
  let i1 = min(i0 + 1, 255);
  let frac = idxF - base;
  let c0 = textureLoad(lut, vec2<i32>(i0, 0), 0).rgb;
  let c1 = textureLoad(lut, vec2<i32>(i1, 0), 0).rgb;
  return mix(c0, c1, frac);
}
fn cairnLutColor(lut: texture_2d<f32>, scalar: f32, cmapMode: i32, filterLinear: bool) -> vec3<f32> {
  var idx = clamp(scalar, 0.0, 1.0);
  if (cmapMode == 2) { idx = 0.5 + idx * 0.5; }
  if (filterLinear) { return cairnLutSampleLinear(lut, idx); }
  return cairnLutSampleNearest(lut, idx);
}

// DATA-encoding LUT INDEX (Phase 4) — the WGSL twin of image/encodings'
// computeDataIndex (the CPU source of truth), kept byte-parallel. Two stages:
//   1. AFFINE -> normalized index. boundsActive (min/max seeded from the
//      descriptor colorRange) -> (scalar-min)/(max-min); else pass scalar
//      through (the caller already folded the exposure/offset sensitivity in --
//      the two are skins over ONE affine, never composed).
//   2. NORM reshape: 0 linear (identity) / 1 log (squeeze, non-positive clamped
//      to LOG_NORM_EPS=1e-4) / 2 power (clamp01(t)^expo; expo reuses the gamma
//      uniform -- free on the lut path). The LUT sampler clamps to [0,1], so
//      linear needs no pre-clamp here (matches the CPU twin).
// Multi-channel REDUCTION (the multi-channel-colormap follow-up) — the WGSL twin
// of image/encodings' reduceToScalar (the CPU source of truth), kept
// byte-parallel. Collapses the post-exposure/offset rgb to the scalar the LUT
// indexes, BEFORE cairnDataIndex. k<=1 -> channel 0 (identity, matching the
// pre-follow-up scalar path). k>1: reduce the min(k,3) COLOR channels (alpha, the
// 4th, is never a color channel and is excluded — rgb carries only channels 0..2).
//   reduceMode 1 luminance: Rec.709 weighted sum (0.2126 R + 0.7152 G + 0.0722 B),
//     a missing color channel (k=2 -> B) counts as 0.
//   reduceMode 2 (or other) mean: arithmetic mean of the min(k,3) color channels.
fn cairnReduceScalar(rgb: vec3<f32>, reduceMode: i32, k: i32) -> f32 {
  if (k <= 1) { return rgb.x; }
  if (reduceMode == 1) {
    var b = rgb.z;
    if (k < 3) { b = 0.0; }
    return 0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * b;
  }
  if (k == 2) { return (rgb.x + rgb.y) * 0.5; }
  return (rgb.x + rgb.y + rgb.z) / 3.0;
}

// ANALYTIC signed error color (the tev-style red-green follow-up) — the WGSL twin
// of image/encodings' signedAnalyticColor (the CPU source of truth), kept
// byte-parallel. Ports tev's POS_NEG tonemap: a NEGATIVE scalar → RED, a POSITIVE
// scalar → GREEN, blue 0, amplitude 2*|v|. Returns SCENE-LINEAR color, UNCLAMPED —
// the caller runs it through the shared output-encode stage (outputEncodeF /
// extendedOutputEncodeF), so |v|>1 survives on the extended/HDR surface while
// |v|<=1 renders identically on SDR (the two encoders agree on [0,1]). The input
// is the post-exposure/offset, already-reduced signed scalar (cairnReduceScalar
// ran before this — exposure SCALES the amplitude, matching tev).
fn cairnSignedAnalyticColor(s: f32) -> vec3<f32> {
  return vec3<f32>(2.0 * max(-s, 0.0), 2.0 * max(s, 0.0), 0.0);
}

// TURBO false-color BAKED index (the tev-exact follow-up) — the WGSL twin of
// image/encodings' turboDataIndex (the CPU source of truth), kept byte-parallel.
// tev's FIXED false-color log mapping: index = clamp(log2(s + 2⁻⁵)/10 + 0.5, 0, 1)
// where s is the (reduced, exposure/offset-adjusted) scalar. This is BAKED into
// the turbo encoding (NOT the user-facing cairnDataIndex norm path): the isScalar
// path calls THIS (scalar-mode 3, u_bind10.z==3) instead of cairnDataIndex before
// sampling the bound turbo table. Value 1.0 → ~0.504 (mid-ramp, green); ~32 → 1
// (dark red); tiny inputs floor to 0 (dark indigo).
fn cairnTurboDataIndex(s: f32) -> f32 {
  return clamp(log2(s + 0.03125) / 10.0 + 0.5, 0.0, 1.0);
}

fn cairnDataIndex(scalar: f32, normMode: i32, minV: f32, maxV: f32, boundsActive: bool, expo: f32) -> f32 {
  var t = scalar;
  if (boundsActive) {
    let denom = maxV - minV;
    if (denom != 0.0) { t = (scalar - minV) / denom; } else { t = 0.0; }
  }
  if (normMode == 1) {
    let eps = 1e-4;
    let tc = clamp(t, eps, 1.0);
    return (log(tc) - log(eps)) / (0.0 - log(eps));
  }
  if (normMode == 2) {
    var g = expo;
    if (g <= 0.0) { g = 1.0; }
    return pow(clamp(t, 0.0, 1.0), g);
  }
  return t;
}
`;
