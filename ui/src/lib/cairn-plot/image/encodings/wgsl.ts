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
 * assembler therefore emits ONE `applyOperator` dispatch covering every entry
 * (each entry's `wgsl` expression inlined into its `operatorId` branch), plus the
 * shared curve helper fns — reproducing the pre-registry `applyOperator` exactly.
 */
import { listEncodings } from "./registry.ts";
import { CURVE_HELPER_FNS_WGSL, DEFAULT_CLAMP_WGSL } from "./curves.ts";

/** The curve helper fns (`reinhardCurve`/`acesCurve`/`extended*Curve`) — emit
 *  ONCE, before `buildApplyOperatorWGSL`, so entry `wgsl` expressions can call
 *  them. Exported under this name for the shader modules that want the helpers
 *  and dispatch as separate strings. */
export const CURVE_HELPERS_WGSL = CURVE_HELPER_FNS_WGSL;

export interface ApplyOperatorOptions {
  /** Emit `kind:"remap"` entries (the `normal` remap). The single-image path
   *  passes `true`; the compose (split/blend) path passes `false` to preserve
   *  its pre-registry behavior (operatorId 9 fell through to the default clamp
   *  there). */
  remaps: boolean;
}

/**
 * Assemble `fn applyOperator(rgb, operatorId, peak) -> vec3<f32>` from the
 * registry: one `if (operatorId == N) { return <expr>; }` per entry whose curve
 * differs from the default clamp (`linear`/`srgb`/`gamma` ARE the default, so
 * they emit no branch and fall through). Branches are ordered by `operatorId`
 * for readability; the ids are mutually exclusive so order is irrelevant to
 * behavior. Requires {@link CURVE_HELPERS_WGSL} earlier in the module.
 */
export function buildApplyOperatorWGSL(opts: ApplyOperatorOptions): string {
  const entries = listEncodings()
    .filter((e) => e.kind !== "lut") // curves + remaps only (Phase 1)
    .filter((e) => opts.remaps || e.kind !== "remap")
    .filter((e) => e.wgsl.trim() !== DEFAULT_CLAMP_WGSL) // default-clamp entries fall through
    .slice()
    .sort((a, b) => a.operatorId - b.operatorId);

  const branches = entries
    .map((e) => `  if (operatorId == ${e.operatorId}) { return ${e.wgsl}; }`)
    .join("\n");

  return `fn applyOperator(rgb: vec3<f32>, operatorId: i32, peak: f32) -> vec3<f32> {
${branches}
  return ${DEFAULT_CLAMP_WGSL};
}`;
}

/** The full curve WGSL block: helper fns + the assembled `applyOperator`. The
 *  single value both shader modules interpolate in place of their old hand-written
 *  curve helpers + `applyOperator`. */
export function buildTonemapCurvesWGSL(opts: ApplyOperatorOptions): string {
  return `${CURVE_HELPERS_WGSL}
${buildApplyOperatorWGSL(opts)}`;
}

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
