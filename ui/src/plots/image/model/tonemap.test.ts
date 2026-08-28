/**
 * Pure unit tests for the HDR tone-map operators. No test runner is configured
 * in this package, so this file is written to run under Node's built-in test
 * runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test src/plots/image/model/tonemap.test.ts
 *
 * The operators are DOM-free pure math, so this is sufficient coverage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toSdrTonemap,
  canonicalizeTonemap,
  aliasPeakHint,
  DEPRECATED_TONEMAP_ALIASES,
  resolveEffectiveTonemap,
  resolveRenderTonemap,
  SDR_TONEMAP_OPERATORS,
  SDR_DISPLAY_TRANSFER_OPERATORS,
  tonemapHasGamma,
  resolveEncodeGamma,
  TONEMAP_GAMMA_DEFAULT,
  EXTENDED_TONEMAP_PEAK_DEFAULT,
  EXTENDED_TONEMAP_PEAK_MAX,
  EXTENDED_TONEMAP_PEAK_UNBOUNDED,
  applyExposure,
  applyExposureOffset,
  srgbOetf,
  srgbEotf,
  outputEncode,
  extendedSrgbOetf,
  extendedGammaEncode,
  extendedOutputEncode,
  type RgbTriple,
} from "./tonemap.ts";
// The operator CURVE math now lives in the display-encoding registry (Phase 5).
// The peak-parameterized scalar curves are imported under their historical names;
// the former `TONEMAP_OPERATORS` table + `getTonemapOperator` / peak-aware triple
// dispatch are reconstructed here as thin REGISTRY ADAPTERS so these goldens keep
// pinning the exact same math the panes/shaders run via `getEncoding(id).cpu`.
import {
  getEncoding,
  listEncodings,
  DEFAULT_ENCODE_PARAMS,
  extendedClampScalar as extendedClampCurve,
  extendedReinhardScalar as extendedReinhardCurve,
  extendedAcesScalar as extendedAcesCurve,
} from "./encodings/index.ts";

/** The plain SDR (non-HDR-surface), non-lut curve operators as `(rgb)=>rgb` —
 *  the CPU triple path's operator table, resolved from the registry (was
 *  `image/tonemap.ts`'s `TONEMAP_OPERATORS`). Keyed on `needsHdrSurface`, NOT
 *  on "declares peak": every curve now declares `peak` in its manifest (each
 *  respects the ceiling on an HDR surface — the slider gates off the manifest),
 *  while only the extended-* entries require an HDR surface. */
const TONEMAP_OPERATORS: Record<string, (rgb: RgbTriple) => RgbTriple> = Object.fromEntries(
  listEncodings()
    .filter((e) => e.kind !== "lut" && !e.needsHdrSurface)
    .map((e) => [e.id, (rgb: RgbTriple): RgbTriple => e.cpu(rgb, 3, DEFAULT_ENCODE_PARAMS)]),
);
/** Resolve an operator name to its non-peak CPU curve fn, srgb fallback. */
const getTonemapOperator = (name: string | undefined | null): ((rgb: RgbTriple) => RgbTriple) =>
  (name && TONEMAP_OPERATORS[name]) || TONEMAP_OPERATORS.srgb!;
/** Peak-aware operator dispatch (extended-* read `peak`; the rest ignore it). */
const applyTonemapOperatorTriple = (rgb: RgbTriple, operator: string, peak: number): RgbTriple =>
  (getEncoding(operator) ?? getEncoding("srgb")!).cpu(rgb, 3, { ...DEFAULT_ENCODE_PARAMS, peak });

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

test("linear clamps to [0,1]", () => {
  const op = TONEMAP_OPERATORS.linear!;
  assert.deepEqual(op([-0.5, 0.5, 2] as RgbTriple), [0, 0.5, 1]);
});

test("srgb tone-map is a clamp (identity in linear)", () => {
  const op = TONEMAP_OPERATORS.srgb!;
  assert.deepEqual(op([-1, 0.3, 5] as RgbTriple), [0, 0.3, 1]);
});

test("reinhard: x/(1+x), reinhard(1)=0.5, reinhard(0)=0, monotonic", () => {
  const op = TONEMAP_OPERATORS.reinhard!;
  approx(op([0, 0, 0] as RgbTriple)[0], 0);
  approx(op([1, 1, 1] as RgbTriple)[0], 0.5);
  approx(op([3, 3, 3] as RgbTriple)[0], 0.75);
  // monotonic increasing
  let prev = -1;
  for (let x = 0; x <= 10; x += 0.5) {
    const y = op([x, x, x] as RgbTriple)[0];
    assert.ok(y > prev, `reinhard not monotonic at ${x}`);
    prev = y;
  }
});

test("aces(0)=0, clamps to [0,1], monotonic increasing", () => {
  const op = TONEMAP_OPERATORS.aces!;
  approx(op([0, 0, 0] as RgbTriple)[0], 0);
  // Large input clamps at 1.
  approx(op([1000, 1000, 1000] as RgbTriple)[0], 1);
  let prev = -1;
  for (let x = 0; x <= 20; x += 0.5) {
    const y = op([x, x, x] as RgbTriple)[0];
    assert.ok(y >= prev - 1e-12, `aces not monotonic at ${x}`);
    prev = y;
  }
  // ACES lifts midtones above the identity clamp at moderate values.
  assert.ok(op([0.5, 0.5, 0.5] as RgbTriple)[0] > 0.5);
});

test("normal: remaps [-1,1] → [0,1] per channel, clamps, identity encode", () => {
  const op = TONEMAP_OPERATORS.normal!;
  approx(op([-1, 0, 1] as RgbTriple)[0], 0); // -1 → 0
  approx(op([-1, 0, 1] as RgbTriple)[1], 0.5); //  0 → 0.5
  approx(op([-1, 0, 1] as RgbTriple)[2], 1); //  1 → 1
  // Out-of-[-1,1] clamps to the displayable range.
  approx(op([-3, 3, 0.5] as RgbTriple)[0], 0);
  approx(op([-3, 3, 0.5] as RgbTriple)[1], 1);
  approx(op([-3, 3, 0.5] as RgbTriple)[2], 0.75);
  // Shown RAW: the output-encode is identity (γ=1), like linear — not sRGB.
  assert.equal(resolveEncodeGamma("normal", 2.2), 1);
  // It is offered as an SDR-menu operator.
  assert.ok(SDR_TONEMAP_OPERATORS.includes("normal"));
});

test("getTonemapOperator falls back to srgb for unknown key", () => {
  assert.equal(getTonemapOperator("does-not-exist"), TONEMAP_OPERATORS.srgb);
  assert.equal(getTonemapOperator(null), TONEMAP_OPERATORS.srgb);
  assert.equal(getTonemapOperator("aces"), TONEMAP_OPERATORS.aces);
});

test("toSdrTonemap: SDR pass-through, extended*→SDR counterpart, else srgb", () => {
  assert.equal(toSdrTonemap("linear"), "linear");
  assert.equal(toSdrTonemap("srgb"), "srgb");
  assert.equal(toSdrTonemap("reinhard"), "reinhard");
  assert.equal(toSdrTonemap("aces"), "aces");
  // Unknown / empty / null → srgb default.
  assert.equal(toSdrTonemap("nope"), "srgb");
  assert.equal(toSdrTonemap(undefined), "srgb");
  assert.equal(toSdrTonemap(null), "srgb");
  // Extended operators fall back to their SDR counterparts (used when a pane
  // requested HDR but the surface never engaged).
  assert.equal(toSdrTonemap("extended"), "linear");
  // Managed linear degrades to the plain SDR clamp01 ("linear"), its natural
  // SDR counterpart.
  assert.equal(toSdrTonemap("extended-clamp"), "linear");
  assert.equal(toSdrTonemap("extended-reinhard"), "reinhard");
  assert.equal(toSdrTonemap("extended-aces"), "aces");
  // extended-gamma (the never-shipped alias) resolves to the Gamma curve.
  assert.equal(toSdrTonemap("extended-gamma"), "gamma");
  // SDR menu domain excludes every extended (HDR-out) operator.
  for (const op of ["extended", "extended-clamp", "extended-reinhard", "extended-aces"]) {
    assert.ok(!(SDR_TONEMAP_OPERATORS as readonly string[]).includes(op));
  }
});

// (The former `isHdrTonemap` / `tonemapHasPeak` classifiers + the
// `HDR_TONEMAP_OPERATORS` / `EXTENDED_ROLLOFF_OPERATORS` / `EXTENDED_PEAK_OPERATORS`
// menu-group arrays were removed in Phase 5 — unused post-unification. Which
// extended curves declare `peak` is still pinned by `encodings/registry.test.ts`.)

test("resolveEffectiveTonemap: UNIFIED — canonical operator passes through; surface only sets the UNSET default", () => {
  // The operator (curve) is surface-independent; only the PEAK ceiling differs
  // (that lives in resolveRenderTonemap). So an explicit descriptor is honored
  // on BOTH surfaces, canonicalized to the 5-op menu set.
  for (const engaged of [false, true]) {
    assert.equal(resolveEffectiveTonemap("aces", engaged), "aces");
    assert.equal(resolveEffectiveTonemap("srgb", engaged), "srgb");
    assert.equal(resolveEffectiveTonemap("gamma", engaged), "gamma");
    assert.equal(resolveEffectiveTonemap("garbage", engaged), "srgb");
    // Deprecated aliases canonicalize to their curve on either surface.
    assert.equal(resolveEffectiveTonemap("extended", engaged), "linear");
    assert.equal(resolveEffectiveTonemap("extended-clamp", engaged), "linear");
    assert.equal(resolveEffectiveTonemap("extended-reinhard", engaged), "reinhard");
    assert.equal(resolveEffectiveTonemap("extended-aces", engaged), "aces");
    assert.equal(resolveEffectiveTonemap("extended-gamma", engaged), "gamma");
  }
  // UNSET default is surface-dependent: Linear on an engaged HDR surface (managed
  // determinism, PEAK default 4 — replaces the old raw-extended default), sRGB on
  // SDR (the bit-exact round-trip for an 8-bit source).
  assert.equal(resolveEffectiveTonemap(undefined, true), "srgb");
  assert.equal(resolveEffectiveTonemap(null, true), "srgb");
  assert.equal(resolveEffectiveTonemap(undefined, false), "srgb");
  assert.equal(resolveEffectiveTonemap(null, false), "srgb");
});

test("extended·Linear is a pure pass-through; SDR operators clamp HDR into [0,1]", () => {
  // The "SDR preview on an HDR display" semantics: switching from extended to an
  // SDR operator (e.g. aces) on an HDR-engaged pane clamps values into range.
  // (`extended` is an HDR-surface entry, so it lives outside the SDR table —
  // resolve it straight from the registry.)
  const hi: RgbTriple = [8, 8, 8];
  const extendedOp = (rgb: RgbTriple): RgbTriple =>
    getEncoding("extended")!.cpu(rgb, 3, DEFAULT_ENCODE_PARAMS);
  assert.deepEqual(extendedOp(hi), [8, 8, 8]); // unclamped, past 1.0
  const [ar, ag, ab] = TONEMAP_OPERATORS.aces!(hi);
  assert.ok(ar <= 1 && ag <= 1 && ab <= 1, "aces clamps to SDR range");
  const [lr] = TONEMAP_OPERATORS.linear!(hi);
  assert.equal(lr, 1, "linear clamps to 1");
});

test("extendedReinhardCurve: monotone, ≈x for x≪1, →P asymptote", () => {
  const P = 4; // explicit peak — a curve-SHAPE test, independent of the default
  approx(extendedReinhardCurve(0, P), 0);
  // Identity-like at low x (slope exactly 1 at 0).
  approx(extendedReinhardCurve(0.001, P), 0.001, 5e-6);
  approx(extendedReinhardCurve(0.01, P), 0.01, 5e-4);
  // Monotone increasing across the HDR range.
  let prev = -1;
  for (let x = 0; x <= 32; x += 0.25) {
    const y = extendedReinhardCurve(x, P);
    assert.ok(y > prev, `extended-reinhard not monotone at ${x}`);
    prev = y;
  }
  // Negative input pre-clamps to 0.
  approx(extendedReinhardCurve(-3, P), 0);
  // Exact formula spot-checks: y = x/(1 + x/P). At x=P: P/2. Approaches P for
  // large x and never exceeds it (the extended-output ceiling).
  approx(extendedReinhardCurve(4, 4), 2);
  approx(extendedReinhardCurve(1e6, P), P, 1e-3);
  assert.ok(extendedReinhardCurve(1e9, P) < P);
  // Midrange stays NEAR identity (the SDR white-point form dipped x=1 to 0.53
  // at P=4 — the bug this formula replaces): x=1 → 1/(1+1/4) = 0.8.
  approx(extendedReinhardCurve(1, 4), 0.8);
});

test("extendedAcesCurve: P·aces(x/P) — P=1 ≡ narkowicz, monotone, →P asymptote", () => {
  const P = 4; // explicit peak — a curve-SHAPE test, independent of the default
  approx(extendedAcesCurve(0, P), 0);
  // Peak-parameterized as the CANONICAL curve scaled to P: y = P·aces(x/P).
  // Spot-check the closed form directly.
  for (const x of [0.1, 0.5, 1, 2, 8]) {
    approx(extendedAcesCurve(x, P), P * acesFit(x / P), 1e-12);
  }
  // Monotone increasing.
  let prev = -1;
  for (let x = 0; x <= 64; x += 0.5) {
    const y = extendedAcesCurve(x, P);
    assert.ok(y >= prev - 1e-12, `extended-aces not monotone at ${x}`);
    prev = y;
  }
  // Never exceeds the peak, and saturates to exactly P for very bright inputs.
  assert.ok(extendedAcesCurve(1000, P) <= P + 1e-9);
  approx(extendedAcesCurve(1000, P), P, 1e-6);
  // Peak scales: a larger P raises the asymptote proportionally.
  approx(extendedAcesCurve(1000, 8), 8, 1e-6);
});

// Narkowicz 2015 ACES fit reference (matches acesCurve in tonemap.ts) — used to
// pin extendedAcesCurve's P·aces(x/P) closed form above.
function acesFit(x: number): number {
  const v = x < 0 ? 0 : x;
  const num = v * (2.51 * v + 0.03);
  const den = v * (2.43 * v + 0.59) + 0.14;
  return Math.min(1, Math.max(0, num / den));
}

// =====================================================================
// OPERATOR-FAMILY INVARIANT (the structural rule): every operator is ONE
// peak-parameterized curve, and the SDR variant IS the extended variant with
// P=1. These goldens LOCK that — any drift where an SDR operator stops equaling
// its extended sibling at P=1 fails here.
// =====================================================================
test("INVARIANT: SDR operator ≡ extended curve at P=1 (only difference is the clip point P)", () => {
  for (let x = -0.5; x <= 8; x += 0.13) {
    // Linear = clamp(x,0,P): SDR linear (clamp01) === extended-clamp at P=1.
    assert.equal(TONEMAP_OPERATORS.linear!([x, x, x] as RgbTriple)[0], extendedClampCurve(x, 1));
    // Reinhard = x/(1+x/P): SDR reinhard === extended-reinhard at P=1.
    approx(TONEMAP_OPERATORS.reinhard!([x, x, x] as RgbTriple)[0], extendedReinhardCurve(x, 1), 1e-12);
    // ACES = P·aces(x/P): SDR aces === extended-aces at P=1 (the FIX — the old
    // S=0.14/0.03 input scaling broke this).
    approx(TONEMAP_OPERATORS.aces!([x, x, x] as RgbTriple)[0], extendedAcesCurve(x, 1), 1e-12);
  }
});

test("Gamma operator: RANGE-MAP is the clamp; γ lives in the encode (resolveEncodeGamma)", () => {
  // The operator itself is the SAME clamp as linear/srgb (range-map to [0,1]).
  assert.deepEqual(TONEMAP_OPERATORS.gamma!([-0.5, 0.5, 2] as RgbTriple), [0, 0.5, 1]);
  assert.equal(tonemapHasGamma("gamma"), true);
  assert.equal(tonemapHasGamma("srgb"), false);
  assert.equal(tonemapHasGamma("linear"), false);
  // resolveEncodeGamma maps the operator to the output-encode `gamma` param:
  //   gamma → γ ; linear → 1 (identity) ; everything else → undefined (sRGB).
  assert.equal(resolveEncodeGamma("gamma", 2.2), 2.2);
  assert.equal(resolveEncodeGamma("gamma", 0), TONEMAP_GAMMA_DEFAULT); // guard
  assert.equal(resolveEncodeGamma("linear", 2.2), 1);
  assert.equal(resolveEncodeGamma("srgb", 2.2), undefined);
  assert.equal(resolveEncodeGamma("reinhard", 2.2), undefined);
  assert.equal(resolveEncodeGamma("aces", 2.2), undefined);
  // gamma is in the SDR group (menu order Linear · sRGB · Gamma · Reinhard ·
  // ACES) and passes through toSdrTonemap unchanged.
  assert.ok(SDR_TONEMAP_OPERATORS.includes("gamma"));
  assert.equal(toSdrTonemap("gamma"), "gamma");
});

test("Gamma DISPLAY value goldens (tev): pow(clamp01(x), 1/γ)", () => {
  // The full display value for the Gamma operator = outputEncode(clamp01(x), γ).
  // 0.5^(1/2.2) ≈ 0.7297 (the brief's golden); DISTINCT from sRGB's 0.5→0.7354.
  const g = (x: number, gamma: number) => outputEncode(TONEMAP_OPERATORS.gamma!([x, x, x] as RgbTriple)[0], gamma);
  approx(g(0.5, 2.2), 0.729740, 1e-5); // brief golden ≈ 0.7297
  approx(g(0.5, 2.2), Math.pow(0.5, 1 / 2.2), 1e-12);
  assert.ok(Math.abs(g(0.5, 2.2) - srgbOetf(0.5)) > 1e-3, "Gamma 2.2 ≠ sRGB (approximate only)");
  // A non-default γ (the brief asks for a second golden).
  approx(g(0.5, 1.8), Math.pow(0.5, 1 / 1.8), 1e-12);
  approx(g(0.25, 2.0), 0.5, 1e-12); // sqrt
  // Endpoints are fixed points of any γ.
  approx(g(0, 2.2), 0);
  approx(g(1, 2.2), 1);
});

test("srgbEotf ∘ srgbOetf round-trips (linearize an 8-bit sRGB source)", () => {
  approx(srgbEotf(0), 0);
  approx(srgbEotf(1), 1);
  // Exact inverse of srgbOetf across the range.
  for (let x = 0; x <= 1; x += 0.037) approx(srgbEotf(srgbOetf(x)), x, 1e-12);
  // Byte-exact round-trip for all 256 8-bit sRGB code values (the SDR-pane
  // decode→…→re-encode identity the default `srgb` operator relies on).
  for (let b = 0; b <= 255; b++) {
    const v = b / 255;
    assert.equal(Math.round(srgbOetf(srgbEotf(v)) * 255), b);
  }
});

test("SDR_DISPLAY_TRANSFER_OPERATORS: the 8-bit pane's menu subset (sRGB · Gamma · Linear)", () => {
  assert.deepEqual([...SDR_DISPLAY_TRANSFER_OPERATORS], ["srgb", "gamma", "linear"]);
  // Subset of the full SDR group (no reinhard/aces on an already-[0,1] source).
  for (const op of SDR_DISPLAY_TRANSFER_OPERATORS) assert.ok(SDR_TONEMAP_OPERATORS.includes(op));
});

test("extendedClampCurve: identity below P (exact), hard ceiling at/above P (exact), monotone", () => {
  const P = 4; // explicit peak — a curve-SHAPE test, independent of the default
  // EXACT identity for 0 <= x <= P (no curvature, no float drift — plain min).
  approx(extendedClampCurve(0, P), 0);
  assert.equal(extendedClampCurve(0.001, P), 0.001);
  assert.equal(extendedClampCurve(1, P), 1);
  assert.equal(extendedClampCurve(2.5, P), 2.5);
  assert.equal(extendedClampCurve(P, P), P); // at the ceiling: y = P exactly
  // EXACT hard ceiling at/above P.
  assert.equal(extendedClampCurve(P, P), 4);
  assert.equal(extendedClampCurve(5, P), 4);
  assert.equal(extendedClampCurve(1e9, P), 4);
  // Negative input pre-clamps to 0.
  assert.equal(extendedClampCurve(-3, P), 0);
  // Monotone non-decreasing across the HDR range (flat once past P).
  let prev = -1;
  for (let x = 0; x <= 32; x += 0.25) {
    const y = extendedClampCurve(x, P);
    assert.ok(y >= prev, `extended-clamp not monotone at ${x}`);
    prev = y;
  }
  // Peak scales the ceiling: a larger P raises the clip point proportionally.
  assert.equal(extendedClampCurve(6, 8), 6); // below 8 → identity
  assert.equal(extendedClampCurve(10, 8), 8); // above 8 → clamped to 8
});

test("applyTonemapOperatorTriple dispatches SDR + extended(peak) operators", () => {
  const hi: RgbTriple = [2, 2, 2];
  // SDR / pass-through operators ignore peak and match TONEMAP_OPERATORS.
  assert.deepEqual(applyTonemapOperatorTriple(hi, "aces", 4), TONEMAP_OPERATORS.aces!(hi));
  assert.deepEqual(applyTonemapOperatorTriple(hi, "extended", 4), [2, 2, 2]);
  // Managed clamp is identity below P (2 < 4 → passes through unchanged).
  assert.deepEqual(applyTonemapOperatorTriple(hi, "extended-clamp", 4), [2, 2, 2]);
  // ...and hard-clips above P.
  assert.deepEqual(applyTonemapOperatorTriple([8, 8, 8], "extended-clamp", 4), [4, 4, 4]);
  // Extended roll-off operators apply the peak curve per channel.
  const r = extendedReinhardCurve(2, 4);
  assert.deepEqual(applyTonemapOperatorTriple(hi, "extended-reinhard", 4), [r, r, r]);
  const a = extendedAcesCurve(2, 4);
  assert.deepEqual(applyTonemapOperatorTriple(hi, "extended-aces", 4), [a, a, a]);
});

test("applyExposure scales by 2**ev", () => {
  approx(applyExposure(1, 0), 1);
  approx(applyExposure(1, 1), 2);
  approx(applyExposure(1, -2), 0.25);
  approx(applyExposure(0.5, 2), 2);
});

test("applyExposureOffset: v*2**ev + offset (TEV convention)", () => {
  // Identity at rest — the sliders' defaults leave a value unchanged.
  approx(applyExposureOffset(0.4, 0, 0), 0.4);
  // Exposure is multiplicative, applied first.
  approx(applyExposureOffset(1, 1, 0), 2);
  approx(applyExposureOffset(1, -2, 0), 0.25);
  // Offset is additive AFTER exposure.
  approx(applyExposureOffset(1, 0, 0.25), 1.25);
  approx(applyExposureOffset(0.5, 1, -0.25), 0.75); // 0.5*2 - 0.25
  approx(applyExposureOffset(0.5, 2, 0), 2);
});

test("srgbOetf matches known reference points", () => {
  approx(srgbOetf(0), 0);
  approx(srgbOetf(1), 1);
  // Linear 0.5 -> ~0.7353569 in sRGB.
  approx(srgbOetf(0.5), 1.055 * Math.pow(0.5, 1 / 2.4) - 0.055, 1e-12);
});

test("outputEncode: sRGB OETF by default (all operators), gamma overrides", () => {
  // Default (no gamma) → sRGB OETF for EVERY operator (encoding is independent
  // of the tone-map operator; raw display-linear would be too dark).
  approx(outputEncode(0.5), srgbOetf(0.5));
  // Explicit gamma → pure power curve override. gamma=1 = linear/identity.
  approx(outputEncode(0.5, 1), 0.5);
  // gamma=2 => sqrt
  approx(outputEncode(0.25, 2), 0.5);
  // gamma<=0 falls back to sRGB (not identity)
  approx(outputEncode(0.3, 0), srgbOetf(0.3));
});

// ---------------------------------------------------------------------------
// EXTENDED output-encode (the HDR-out / extended-surface transfer). Goldens
// pinned so the WGSL port (image.wgsl.ts's extendedSrgbOetf / extendedGammaEncode
// / extendedOutputEncodeF) stays byte-identical.
// ---------------------------------------------------------------------------

test("extendedSrgbOetf: golden values (0.5, 4.0, negative mirror, continuity)", () => {
  // 0.5 -> 1.055*0.5^(1/2.4)-0.055 ≈ 0.7353569 (same as srgbOetf on [0,1]).
  approx(extendedSrgbOetf(0.5), 1.055 * Math.pow(0.5, 1 / 2.4) - 0.055, 1e-12);
  approx(extendedSrgbOetf(0.5), 0.7353569830524495, 1e-12);
  // ABOVE 1 (the whole point): 4.0 -> 1.055*4^(1/2.4)-0.055 ≈ 1.8247963 — an
  // encoded value > 1 the extended HDR canvas renders as extended brightness.
  // (NB: the task brief's "≈1.848" is a typo for the formula it quotes; the
  // formula 1.055*4^(1/2.4)-0.055 evaluates to 1.8247963.)
  approx(extendedSrgbOetf(4.0), 1.055 * Math.pow(4, 1 / 2.4) - 0.055, 1e-12);
  approx(extendedSrgbOetf(4.0), 1.8247962952761159, 1e-9);
  // Continuous with srgbOetf at white and origin.
  approx(extendedSrgbOetf(1.0), 1.0, 1e-12);
  approx(extendedSrgbOetf(0.0), 0.0, 1e-12);
  // Negative mirror: sign(x)*oetf(|x|).
  approx(extendedSrgbOetf(-0.5), -extendedSrgbOetf(0.5), 1e-12);
  approx(extendedSrgbOetf(-4.0), -1.8247962952761159, 1e-9);
  // Linear segment below the split point (magnitude-based).
  approx(extendedSrgbOetf(0.002), 12.92 * 0.002, 1e-12);
  approx(extendedSrgbOetf(-0.002), -12.92 * 0.002, 1e-12);
  // Matches the SDR srgbOetf exactly on [0,1] (where srgbOetf does not clamp).
  for (let x = 0; x <= 1; x += 0.05) approx(extendedSrgbOetf(x), srgbOetf(x), 1e-12);
});

test("extendedGammaEncode: unclamped, origin-mirrored power curve", () => {
  // sign(x)*|x|^(1/γ), unclamped (values past 1 survive).
  approx(extendedGammaEncode(4.0, 2.2), Math.pow(4, 1 / 2.2), 1e-12);
  approx(extendedGammaEncode(0.25, 2.0), 0.5, 1e-12);
  approx(extendedGammaEncode(1.0, 2.2), 1.0, 1e-12);
  // Negative mirror.
  approx(extendedGammaEncode(-0.25, 2.0), -0.5, 1e-12);
});

test("extendedOutputEncode: gamma convention mirrors outputEncode (unclamped)", () => {
  // No/<=0 gamma → extended sRGB OETF.
  approx(extendedOutputEncode(4.0), extendedSrgbOetf(4.0), 1e-12);
  approx(extendedOutputEncode(0.3, 0), extendedSrgbOetf(0.3), 1e-12);
  // Positive gamma → extended power curve.
  approx(extendedOutputEncode(4.0, 2.2), extendedGammaEncode(4.0, 2.2), 1e-12);
  // NEVER clamps (unlike SDR outputEncode, which clamps to [0,1]).
  assert.ok(extendedOutputEncode(4.0) > 1.0, "extended encode preserves >1 (extended brightness)");
  assert.ok(outputEncode(4.0) <= 1.0, "SDR outputEncode clamps to [0,1] (contrast)");
});

// =====================================================================
// UNIFIED SURFACE — "pick a curve, pick a ceiling". ONE 5-operator menu; the
// PEAK ceiling P is the mode. These pin canonicalization, the alias table, and
// the whole operator × peak × surface matrix (resolveRenderTonemap).
// =====================================================================

test("canonicalizeTonemap / DEPRECATED_TONEMAP_ALIASES / aliasPeakHint", () => {
  // The 5 canonical operators pass through.
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    assert.equal(canonicalizeTonemap(op), op);
  }
  // Deprecated aliases resolve to their curve.
  assert.deepEqual(
    [...DEPRECATED_TONEMAP_ALIASES],
    ["extended", "extended-clamp", "extended-reinhard", "extended-aces", "extended-gamma"],
  );
  assert.equal(canonicalizeTonemap("extended"), "linear");
  assert.equal(canonicalizeTonemap("extended-clamp"), "linear");
  assert.equal(canonicalizeTonemap("extended-reinhard"), "reinhard");
  assert.equal(canonicalizeTonemap("extended-aces"), "aces");
  assert.equal(canonicalizeTonemap("extended-gamma"), "gamma");
  // Garbage / null → the srgb default.
  assert.equal(canonicalizeTonemap("nope"), "srgb");
  assert.equal(canonicalizeTonemap(null), "srgb");
  // Only raw `extended` implies an unbounded ceiling (∞); everything else none.
  assert.equal(aliasPeakHint("extended"), EXTENDED_TONEMAP_PEAK_UNBOUNDED);
  assert.equal(aliasPeakHint("extended-clamp"), undefined);
  assert.equal(aliasPeakHint("linear"), undefined);
  assert.equal(aliasPeakHint(null), undefined);
});

test("resolveRenderTonemap: NON-HDR surface / P<=1 → the plain SDR operator (the degrade rule)", () => {
  // The degrade rule IS "force P=1, no extended encode": the render params are
  // exactly the legacy SDR operator's, for every operator and any peak.
  for (const peak of [4, 1, 0.5]) {
    const engaged = false;
    assert.deepEqual(resolveRenderTonemap("linear", peak, engaged, 2.2), { operator: "linear", hdrOut: false, peak: 1, gamma: 1 });
    assert.deepEqual(resolveRenderTonemap("srgb", peak, engaged, 2.2), { operator: "srgb", hdrOut: false, peak: 1, gamma: undefined });
    assert.deepEqual(resolveRenderTonemap("gamma", peak, engaged, 2.2), { operator: "gamma", hdrOut: false, peak: 1, gamma: 2.2 });
    assert.deepEqual(resolveRenderTonemap("reinhard", peak, engaged, 2.2), { operator: "reinhard", hdrOut: false, peak: 1, gamma: undefined });
    assert.deepEqual(resolveRenderTonemap("aces", peak, engaged, 2.2), { operator: "aces", hdrOut: false, peak: 1, gamma: undefined });
  }
  // On an ENGAGED surface, P=1 also collapses to the SDR path (identical output).
  assert.deepEqual(resolveRenderTonemap("srgb", 1, true, 2.2), { operator: "srgb", hdrOut: false, peak: 1, gamma: undefined });
  assert.deepEqual(resolveRenderTonemap("gamma", 1, true, 1.8), { operator: "gamma", hdrOut: false, peak: 1, gamma: 1.8 });
});

test("resolveRenderTonemap: ENGAGED HDR surface, finite P>1 → the peak-parameterized extended operator", () => {
  // linear/srgb/gamma share the CLAMP range-map (extended-clamp); the encode γ
  // is what differs (identity / sRGB / power).
  assert.deepEqual(resolveRenderTonemap("linear", 4, true, 2.2), { operator: "extended-clamp", hdrOut: true, peak: 4, gamma: 1 });
  assert.deepEqual(resolveRenderTonemap("srgb", 4, true, 2.2), { operator: "extended-clamp", hdrOut: true, peak: 4, gamma: undefined });
  assert.deepEqual(resolveRenderTonemap("gamma", 4, true, 2.2), { operator: "extended-clamp", hdrOut: true, peak: 4, gamma: 2.2 });
  assert.deepEqual(resolveRenderTonemap("gamma", 6, true, 1.8), { operator: "extended-clamp", hdrOut: true, peak: 6, gamma: 1.8 });
  assert.deepEqual(resolveRenderTonemap("reinhard", 4, true, 2.2), { operator: "extended-reinhard", hdrOut: true, peak: 4, gamma: undefined });
  assert.deepEqual(resolveRenderTonemap("aces", 8, true, 2.2), { operator: "extended-aces", hdrOut: true, peak: 8, gamma: undefined });
});

test("resolveRenderTonemap: P=∞ (unbounded) → raw browser-clipped extended (aces clamps to MAX)", () => {
  const inf = EXTENDED_TONEMAP_PEAK_UNBOUNDED;
  // Linear/sRGB/Gamma → raw `extended` (no in-shader ceiling; the browser clips).
  assert.deepEqual(resolveRenderTonemap("linear", inf, true, 2.2), { operator: "extended", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: 1 });
  assert.deepEqual(resolveRenderTonemap("srgb", inf, true, 2.2), { operator: "extended", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: undefined });
  assert.deepEqual(resolveRenderTonemap("gamma", inf, true, 2.2), { operator: "extended", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: 2.2 });
  // Reinhard degenerates to pass-through at ∞ → raw `extended` (sRGB-encoded).
  assert.deepEqual(resolveRenderTonemap("reinhard", inf, true, 2.2), { operator: "extended", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: undefined });
  // ACES has no meaningful ∞ (P·aces(x/P) → 0); its ceiling CLAMPS to the max.
  assert.deepEqual(resolveRenderTonemap("aces", inf, true, 2.2), { operator: "extended-aces", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: undefined });
  // A non-finite peak (NaN) is also treated as unbounded, never leaked to the GPU.
  const nan = resolveRenderTonemap("linear", Number.NaN, true, 2.2);
  assert.ok(Number.isFinite(nan.peak), "peak handed to the GPU is always finite");
});

test("resolveRenderTonemap: aliases route through canonicalization", () => {
  // A descriptor alias resolves the same as its canonical operator at a given P.
  assert.deepEqual(
    resolveRenderTonemap("extended-reinhard", 4, true, 2.2),
    resolveRenderTonemap("reinhard", 4, true, 2.2),
  );
  assert.deepEqual(
    resolveRenderTonemap("extended-gamma", 4, true, 2.2),
    resolveRenderTonemap("gamma", 4, true, 2.2),
  );
});

test("UNIFIED INVARIANT: P=1 render == the legacy SDR curve+encode, per operator (byte-for-byte)", () => {
  // The full display value at P=1 (engaged HDR pane) equals the SDR rendition.
  // resolveRenderTonemap returns the SDR path at P=1, so simulate the pass:
  //   rangeMap = applyTonemapOperatorTriple(x, op, peak) ; encode = outputEncode.
  const encodeOf = (v: number, g: number | undefined) => outputEncode(v, g);
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    const rt = resolveRenderTonemap(op, 1, true, 2.2);
    assert.equal(rt.hdrOut, false);
    assert.equal(rt.peak, 1);
    for (let x = -0.25; x <= 6; x += 0.37) {
      const uni = encodeOf(applyTonemapOperatorTriple([x, x, x], rt.operator, rt.peak)[0], rt.gamma);
      const legacy = outputEncode(TONEMAP_OPERATORS[op]!([x, x, x] as RgbTriple)[0], resolveEncodeGamma(op, 2.2));
      approx(uni, legacy, 1e-12);
    }
  }
});

test("UNIFIED goldens: HDR Gamma is UNCLAMPED (above-white survives), P>1 clips at the ceiling", () => {
  // Gamma on an engaged HDR pane, x=4 below the P=8 ceiling: the value survives
  // above 1.0, gamma-corrected. extended-clamp(4, 8)=4 → extendedGammaEncode(4, 2.2).
  const rt = resolveRenderTonemap("gamma", 8, true, 2.2);
  const ranged = applyTonemapOperatorTriple([4, 4, 4], rt.operator, rt.peak)[0]; // extended-clamp(4,8)=4
  approx(ranged, 4, 1e-12);
  const display = extendedOutputEncode(ranged, rt.gamma);
  approx(display, Math.pow(4, 1 / 2.2), 1e-12); // ≈ 1.877776 — ABOVE 1.0 (extended)
  assert.ok(display > 1.0, "HDR Gamma preserves extended brightness (above-white survives)");
  // At a LOWER ceiling P=2, the same x=4 hard-clips to 2 first: 2^(1/2.2).
  const rt2 = resolveRenderTonemap("gamma", 2, true, 2.2);
  const ranged2 = applyTonemapOperatorTriple([4, 4, 4], rt2.operator, rt2.peak)[0]; // extended-clamp(4,2)=2
  approx(ranged2, 2, 1e-12);
  approx(extendedOutputEncode(ranged2, rt2.gamma), Math.pow(2, 1 / 2.2), 1e-12);
});

test("UNIFIED §B: the render matrix is SOURCE-AGNOSTIC (u8-post-decode ≡ float)", () => {
  // "Unified no matter what the input data was": resolveRenderTonemap takes only
  // (operator, P, surface, γ) — NOT the source's bit depth. So an 8-bit source
  // (sRGB-DECODED to scene-linear by the pane before this runs) and a float
  // source resolve to the SAME engine params for the SAME operator/P/surface.
  // The pane supplies srgbDecode:true for the u8 side; the operator × P pipeline
  // downstream is IDENTICAL. Spot-check every operator on both surfaces.
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    // Non-HDR surface (or a pane whose extended surface never engaged) → P=1 SDR
    // rendition, table-free: exactly the plain SDR operator (the DEGRADE rule).
    const sdr = resolveRenderTonemap(op, 1, false, 2.2);
    assert.equal(sdr.hdrOut, false);
    assert.equal(sdr.peak, 1);
    // Engaged HDR surface, P=4 → the SAME operator extends onto the surface, so
    // an EV+n u8 source (once decoded) genuinely exceeds SDR white just like a
    // float source would (hdrOut:true, finite peak carried to the shader).
    const hdr = resolveRenderTonemap(op, 4, true, 2.2);
    assert.equal(hdr.hdrOut, true);
    assert.equal(hdr.peak, 4);
  }
});

test("UNIFIED default matrix: resolveEffectiveTonemap ∘ resolveRenderTonemap", () => {
  // UNSET descriptor: sRGB on EVERY surface (user decision — tev's default).
  // Engaged HDR → extended sRGB encode with the managed PEAK ceiling (default).
  const hdrDefault = resolveEffectiveTonemap(undefined, true); // "srgb"
  assert.equal(hdrDefault, "srgb");
  assert.deepEqual(resolveRenderTonemap(hdrDefault, EXTENDED_TONEMAP_PEAK_DEFAULT, true, 2.2), {
    operator: "extended-clamp",
    hdrOut: true,
    peak: EXTENDED_TONEMAP_PEAK_DEFAULT,
    gamma: undefined,
  });
  const sdrDefault = resolveEffectiveTonemap(undefined, false); // "srgb"
  assert.equal(sdrDefault, "srgb");
  assert.deepEqual(resolveRenderTonemap(sdrDefault, 1, false, 2.2), {
    operator: "srgb",
    hdrOut: false,
    peak: 1,
    gamma: undefined,
  });
  // The deprecated raw `extended` alias: Linear curve + ∞ ceiling → raw extended.
  const raw = resolveEffectiveTonemap("extended", true); // "linear"
  assert.deepEqual(resolveRenderTonemap(raw, aliasPeakHint("extended")!, true, 2.2), {
    operator: "extended",
    hdrOut: true,
    peak: EXTENDED_TONEMAP_PEAK_MAX,
    gamma: 1,
  });
});
