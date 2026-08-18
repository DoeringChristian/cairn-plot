/**
 * The CURVE + REMAP display encodings (Phase 1) — the ~10 tone-map operators
 * migrated from `image/tonemap.ts` (CPU) and `engine/shaders/image.wgsl.ts` /
 * `engine/kernels/prelude.wgsl.ts` (GPU) into registry entries.
 *
 * PARITY BY CONSTRUCTION: each entry carries BOTH its WGSL curve expression and
 * its `cpu` twin, sharing the scalar helpers below. The math is RELOCATED
 * VERBATIM from the pre-registry sources (`reinhardScalar`/`acesScalar`/… are
 * the exact bodies of `tonemap.ts`'s private `reinhardCurve`/`acesCurve` and the
 * exported `extended*Curve`s), so this migration is behavior-identical — pinned
 * by `image/tonemap.test.ts` (CPU) and the GPU↔TS parity harnesses.
 */
import { registerEncoding, clamp01, type DisplayEncoding } from "./registry.ts";

// ---------------------------------------------------------------------------
// Scalar curve math — the SINGLE source of truth. `image/tonemap.ts` re-exports
// these under its historical names (`reinhardCurve` private; `extendedClampCurve`
// / `extendedReinhardCurve` / `extendedAcesCurve` public) so all existing callers
// keep working while the math lives in exactly one place.
// ---------------------------------------------------------------------------

/** Per-channel Reinhard tone curve: x/(1+x). Maps [0,∞)→[0,1), 1→0.5. */
export function reinhardScalar(x: number): number {
  const v = x < 0 ? 0 : x;
  return v / (1 + v);
}

/** Narkowicz 2015 ACES filmic approximation, per channel, clamped to [0,1]. */
export function acesScalar(x: number): number {
  const v = x < 0 ? 0 : x;
  const num = v * (2.51 * v + 0.03);
  const den = v * (2.43 * v + 0.59) + 0.14;
  return clamp01(num / den);
}

/** Extended·Linear (MANAGED) with display peak P: y = min(max(x,0), P) — identity
 *  below P, hard ceiling at P. */
export function extendedClampScalar(x: number, peak: number): number {
  const v = x < 0 ? 0 : x;
  return v > peak ? peak : v;
}

/** Extended Reinhard with display peak P: y = x/(1 + x/P) — slope 1 at 0, asymptote P. */
export function extendedReinhardScalar(x: number, peak: number): number {
  const v = x < 0 ? 0 : x;
  return v / (1 + v / peak);
}

/** ACES fit scaled to peak P: y = P·aces(x/P). At P=1 this is exactly `acesScalar`. */
export function extendedAcesScalar(x: number, peak: number): number {
  const v = x < 0 ? 0 : x;
  const p = peak > 0 ? peak : 1;
  return p * acesScalar(v / p);
}

// ---------------------------------------------------------------------------
// WGSL curve helper fns — relocated VERBATIM from image.wgsl.ts / prelude's
// TONEMAP_WGSL. Emitted ONCE (before the assembled `applyOperator`) by
// `./wgsl.ts`'s `CURVE_HELPERS_WGSL`; each entry's `wgsl` expression may call them.
// ---------------------------------------------------------------------------
export const CURVE_HELPER_FNS_WGSL = `
fn reinhardCurve(x: f32) -> f32 {
  let v = max(x, 0.0);
  return v / (1.0 + v);
}

fn acesCurve(x: f32) -> f32 {
  let v = max(x, 0.0);
  let num = v * (2.51 * v + 0.03);
  let den = v * (2.43 * v + 0.59) + 0.14;
  return clamp(num / den, 0.0, 1.0);
}

fn extendedReinhardCurve(x: f32, peak: f32) -> f32 { let v = max(x, 0.0); let p = max(peak, 1e-6); return v / (1.0 + v / p); }
fn extendedAcesCurve(x: f32, peak: f32) -> f32 { let v = max(x, 0.0); let p = max(peak, 1e-6); return p * acesCurve(v / p); }
fn extendedClampCurve(x: f32, peak: f32) -> f32 { let v = max(x, 0.0); let p = max(peak, 1e-6); return min(v, p); }
`;

/** The WGSL curve expression the shader's default `applyOperator` fall-through
 *  returns (`linear`/`srgb`/`gamma` — the RANGE-MAP clamp; the transfer lives in
 *  the output-encode stage). Entries equal to this are covered by the default and
 *  emit no explicit dispatch branch — reproducing the pre-registry shaders exactly. */
export const DEFAULT_CLAMP_WGSL = "clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0))";

// Curves apply per-channel to the first up-to-4 channels — but the operator
// stage always sees an rgb triple (the pipeline packs the selected channels
// into rgb upstream), so the arities are declared metadata (Phase-3 gating).
const CURVE_ARITIES = [1, 2, 3, 4];

/** Build the CPU triple by applying a per-channel scalar curve to v[0..2]. */
function perChannel(
  fn: (x: number) => number,
): DisplayEncoding["cpu"] {
  return (v) => [fn(v[0] ?? 0), fn(v[1] ?? 0), fn(v[2] ?? 0)];
}

// ---------------------------------------------------------------------------
// Entries. operatorId values are STABLE (baked into image.wgsl.ts's uniform doc
// + assembled dispatch + OPERATOR_ID); do not renumber. Registration order is
// chosen so `image/tonemap.ts`'s `TONEMAP_OPERATORS` (built from the non-peak
// entries) comes out in its historical key order.
// ---------------------------------------------------------------------------

const linear: DisplayEncoding = {
  id: "linear",
  label: "Linear",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset"],
  operatorId: 0,
  // RANGE-MAP clamp; the display transfer (identity, γ=1) lives in output-encode.
  wgsl: DEFAULT_CLAMP_WGSL,
  cpu: (v) => [clamp01(v[0] ?? 0), clamp01(v[1] ?? 0), clamp01(v[2] ?? 0)],
};

const srgb: DisplayEncoding = {
  id: "srgb",
  label: "sRGB",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset"],
  operatorId: 1,
  // Identity tone-map: the HDR→[0,1] step is a clamp; the sRGB OETF is applied by
  // the output-encode stage (`tonemap === "srgb"`).
  wgsl: DEFAULT_CLAMP_WGSL,
  cpu: (v) => [clamp01(v[0] ?? 0), clamp01(v[1] ?? 0), clamp01(v[2] ?? 0)],
};

const gamma: DisplayEncoding = {
  id: "gamma",
  label: "Gamma",
  kind: "curve",
  arities: CURVE_ARITIES,
  // Reads γ — the power curve `pow(x,1/γ)` is applied at the output-encode stage
  // (resolveEncodeGamma), the RANGE-MAP here is the same clamp as linear/srgb.
  params: ["exposure", "offset", "gamma"],
  operatorId: 8,
  wgsl: DEFAULT_CLAMP_WGSL,
  cpu: (v) => [clamp01(v[0] ?? 0), clamp01(v[1] ?? 0), clamp01(v[2] ?? 0)],
};

const reinhard: DisplayEncoding = {
  id: "reinhard",
  label: "Reinhard",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset"],
  operatorId: 2,
  wgsl: "vec3<f32>(reinhardCurve(rgb.x), reinhardCurve(rgb.y), reinhardCurve(rgb.z))",
  cpu: perChannel(reinhardScalar),
};

const aces: DisplayEncoding = {
  id: "aces",
  label: "ACES",
  kind: "curve",
  arities: CURVE_ARITIES,
  params: ["exposure", "offset"],
  operatorId: 3,
  wgsl: "vec3<f32>(acesCurve(rgb.x), acesCurve(rgb.y), acesCurve(rgb.z))",
  cpu: perChannel(acesScalar),
};

const normal: DisplayEncoding = {
  id: "normal",
  label: "Normal map",
  // The remap `(x+1)/2` IS the whole mapping — declares NOTHING, arity 3 only.
  kind: "remap",
  arities: [3],
  params: [],
  operatorId: 9,
  wgsl: "clamp((rgb + vec3<f32>(1.0)) * 0.5, vec3<f32>(0.0), vec3<f32>(1.0))",
  cpu: (v) => [clamp01(((v[0] ?? 0) + 1) / 2), clamp01(((v[1] ?? 0) + 1) / 2), clamp01(((v[2] ?? 0) + 1) / 2)],
};

const extended: DisplayEncoding = {
  id: "extended",
  label: "Extended · Linear",
  kind: "curve",
  arities: CURVE_ARITIES,
  needsHdrSurface: true,
  params: ["exposure", "offset"],
  operatorId: 4,
  // Pure identity — no compression, no clamp — values above 1 survive for a real
  // HDR surface.
  wgsl: "rgb",
  cpu: (v) => [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0],
};

const extendedClamp: DisplayEncoding = {
  id: "extended-clamp",
  label: "Extended · Linear (managed)",
  kind: "curve",
  arities: CURVE_ARITIES,
  needsHdrSurface: true,
  params: ["exposure", "offset", "peak"],
  operatorId: 7,
  wgsl: "vec3<f32>(extendedClampCurve(rgb.x, peak), extendedClampCurve(rgb.y, peak), extendedClampCurve(rgb.z, peak))",
  cpu: (v, _k, p) => [
    extendedClampScalar(v[0] ?? 0, p.peak),
    extendedClampScalar(v[1] ?? 0, p.peak),
    extendedClampScalar(v[2] ?? 0, p.peak),
  ],
};

const extendedReinhard: DisplayEncoding = {
  id: "extended-reinhard",
  label: "Extended · Reinhard",
  kind: "curve",
  arities: CURVE_ARITIES,
  needsHdrSurface: true,
  params: ["exposure", "offset", "peak"],
  operatorId: 5,
  wgsl: "vec3<f32>(extendedReinhardCurve(rgb.x, peak), extendedReinhardCurve(rgb.y, peak), extendedReinhardCurve(rgb.z, peak))",
  cpu: (v, _k, p) => [
    extendedReinhardScalar(v[0] ?? 0, p.peak),
    extendedReinhardScalar(v[1] ?? 0, p.peak),
    extendedReinhardScalar(v[2] ?? 0, p.peak),
  ],
};

const extendedAces: DisplayEncoding = {
  id: "extended-aces",
  label: "Extended · ACES",
  kind: "curve",
  arities: CURVE_ARITIES,
  needsHdrSurface: true,
  params: ["exposure", "offset", "peak"],
  operatorId: 6,
  wgsl: "vec3<f32>(extendedAcesCurve(rgb.x, peak), extendedAcesCurve(rgb.y, peak), extendedAcesCurve(rgb.z, peak))",
  cpu: (v, _k, p) => [
    extendedAcesScalar(v[0] ?? 0, p.peak),
    extendedAcesScalar(v[1] ?? 0, p.peak),
    extendedAcesScalar(v[2] ?? 0, p.peak),
  ],
};

/** Registration order → chosen so the non-peak subset yields `TONEMAP_OPERATORS`'
 *  historical key order (linear, srgb, gamma, reinhard, aces, normal, extended). */
export const CURVE_ENCODINGS: DisplayEncoding[] = [
  linear,
  srgb,
  gamma,
  reinhard,
  aces,
  normal,
  extended,
  extendedClamp,
  extendedReinhard,
  extendedAces,
];

let registered = false;
export function registerCurveEncodings(): void {
  if (registered) return;
  registered = true;
  for (const e of CURVE_ENCODINGS) registerEncoding(e);
}
