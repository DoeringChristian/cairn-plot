/**
 * Pure unit tests for the HDR tone-map operators. No test runner is configured
 * in this package, so this file is written to run under Node's built-in test
 * runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test src/lib/cairn-plot/image/tonemap.test.ts
 *
 * The operators are DOM-free pure math, so this is sufficient coverage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TONEMAP_OPERATORS,
  getTonemapOperator,
  toSdrTonemap,
  resolveEffectiveTonemap,
  SDR_TONEMAP_OPERATORS,
  SDR_DISPLAY_TRANSFER_OPERATORS,
  HDR_TONEMAP_OPERATORS,
  EXTENDED_ROLLOFF_OPERATORS,
  EXTENDED_PEAK_OPERATORS,
  isHdrTonemap,
  tonemapHasPeak,
  tonemapHasGamma,
  resolveEncodeGamma,
  TONEMAP_GAMMA_DEFAULT,
  extendedClampCurve,
  extendedReinhardCurve,
  extendedAcesCurve,
  applyTonemapOperatorTriple,
  EXTENDED_TONEMAP_PEAK_DEFAULT,
  applyExposure,
  applyExposureOffset,
  srgbOetf,
  srgbEotf,
  outputEncode,
  type RgbTriple,
} from "./tonemap.ts";

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
  // SDR menu domain excludes every extended operator.
  for (const op of HDR_TONEMAP_OPERATORS) {
    assert.ok(!(SDR_TONEMAP_OPERATORS as readonly string[]).includes(op));
  }
});

test("isHdrTonemap / tonemapHasPeak classify the operator groups", () => {
  // Menu order: Linear · Linear (managed) · Reinhard · ACES.
  assert.deepEqual(
    [...HDR_TONEMAP_OPERATORS],
    ["extended", "extended-clamp", "extended-reinhard", "extended-aces"],
  );
  for (const op of HDR_TONEMAP_OPERATORS) assert.ok(isHdrTonemap(op));
  for (const op of SDR_TONEMAP_OPERATORS) assert.ok(!isHdrTonemap(op));
  assert.ok(!isHdrTonemap(undefined));
  // The roll-off pair are the SOFT-shoulder operators (managed clamp is a hard
  // clip, so it is NOT a roll-off).
  assert.deepEqual([...EXTENDED_ROLLOFF_OPERATORS], ["extended-reinhard", "extended-aces"]);
  // The PEAK parameter is read by the roll-off pair PLUS managed linear
  // (extended-clamp) — raw extended·Linear has no peak.
  assert.deepEqual(
    [...EXTENDED_PEAK_OPERATORS],
    ["extended-clamp", "extended-reinhard", "extended-aces"],
  );
  assert.ok(tonemapHasPeak("extended-clamp"));
  assert.ok(tonemapHasPeak("extended-reinhard"));
  assert.ok(tonemapHasPeak("extended-aces"));
  assert.ok(!tonemapHasPeak("extended"));
  assert.ok(!tonemapHasPeak("aces"));
});

test("resolveEffectiveTonemap: SDR fallback when not engaged; HDR verbatim + extended default when engaged", () => {
  // NOT engaged → descriptor coerced to SDR (extended*→counterpart, srgb default).
  assert.equal(resolveEffectiveTonemap("aces", false), "aces");
  assert.equal(resolveEffectiveTonemap("srgb", false), "srgb");
  assert.equal(resolveEffectiveTonemap(undefined, false), "srgb");
  assert.equal(resolveEffectiveTonemap("garbage", false), "srgb");
  assert.equal(resolveEffectiveTonemap("extended", false), "linear");
  assert.equal(resolveEffectiveTonemap("extended-clamp", false), "linear");
  assert.equal(resolveEffectiveTonemap("extended-reinhard", false), "reinhard");
  assert.equal(resolveEffectiveTonemap("extended-aces", false), "aces");
  // Engaged → an explicit HDR descriptor is honored verbatim; an SDR/unset
  // descriptor defaults to "extended" (Extended · Linear) — NOT the managed
  // clamp: managed is an explicit opt-in, raw fidelity is the default.
  assert.equal(resolveEffectiveTonemap("extended", true), "extended");
  assert.equal(resolveEffectiveTonemap("extended-clamp", true), "extended-clamp");
  assert.equal(resolveEffectiveTonemap("extended-reinhard", true), "extended-reinhard");
  assert.equal(resolveEffectiveTonemap("extended-aces", true), "extended-aces");
  assert.equal(resolveEffectiveTonemap("aces", true), "extended");
  assert.equal(resolveEffectiveTonemap("srgb", true), "extended");
  assert.equal(resolveEffectiveTonemap(undefined, true), "extended");
});

test("extended·Linear is a pure pass-through; SDR operators clamp HDR into [0,1]", () => {
  // The "SDR preview on an HDR display" semantics: switching from extended to an
  // SDR operator (e.g. aces) on an HDR-engaged pane clamps values into range.
  const hi: RgbTriple = [8, 8, 8];
  assert.deepEqual(TONEMAP_OPERATORS.extended!(hi), [8, 8, 8]); // unclamped, past 1.0
  const [ar, ag, ab] = TONEMAP_OPERATORS.aces!(hi);
  assert.ok(ar <= 1 && ag <= 1 && ab <= 1, "aces clamps to SDR range");
  const [lr] = TONEMAP_OPERATORS.linear!(hi);
  assert.equal(lr, 1, "linear clamps to 1");
});

test("extendedReinhardCurve: monotone, ≈x for x≪1, →P asymptote", () => {
  const P = EXTENDED_TONEMAP_PEAK_DEFAULT; // 4
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
  const P = EXTENDED_TONEMAP_PEAK_DEFAULT; // 4
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
  const P = EXTENDED_TONEMAP_PEAK_DEFAULT; // 4
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
