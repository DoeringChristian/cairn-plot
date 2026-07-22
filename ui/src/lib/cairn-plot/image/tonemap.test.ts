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
  HDR_TONEMAP_OPERATORS,
  EXTENDED_ROLLOFF_OPERATORS,
  isHdrTonemap,
  tonemapHasPeak,
  extendedReinhardCurve,
  extendedAcesCurve,
  applyTonemapOperatorTriple,
  ACES_IDENTITY_SCALE,
  EXTENDED_TONEMAP_PEAK_DEFAULT,
  applyExposure,
  applyExposureOffset,
  srgbOetf,
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
  assert.equal(toSdrTonemap("extended-reinhard"), "reinhard");
  assert.equal(toSdrTonemap("extended-aces"), "aces");
  // SDR menu domain excludes every extended operator.
  for (const op of HDR_TONEMAP_OPERATORS) {
    assert.ok(!(SDR_TONEMAP_OPERATORS as readonly string[]).includes(op));
  }
});

test("isHdrTonemap / tonemapHasPeak classify the operator groups", () => {
  assert.deepEqual([...HDR_TONEMAP_OPERATORS], ["extended", "extended-reinhard", "extended-aces"]);
  for (const op of HDR_TONEMAP_OPERATORS) assert.ok(isHdrTonemap(op));
  for (const op of SDR_TONEMAP_OPERATORS) assert.ok(!isHdrTonemap(op));
  assert.ok(!isHdrTonemap(undefined));
  // Only the roll-off pair reads the PEAK parameter (extended·Linear does not).
  assert.deepEqual([...EXTENDED_ROLLOFF_OPERATORS], ["extended-reinhard", "extended-aces"]);
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
  assert.equal(resolveEffectiveTonemap("extended-reinhard", false), "reinhard");
  assert.equal(resolveEffectiveTonemap("extended-aces", false), "aces");
  // Engaged → an explicit HDR descriptor is honored verbatim; an SDR/unset
  // descriptor defaults to "extended" (Extended · Linear).
  assert.equal(resolveEffectiveTonemap("extended", true), "extended");
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

test("extendedAcesCurve: monotone, ≈x for x≪1 (slope 1), →P asymptote", () => {
  const P = EXTENDED_TONEMAP_PEAK_DEFAULT; // 4
  approx(extendedAcesCurve(0, P), 0);
  // Low-x slope is exactly 1 (the ACES_IDENTITY_SCALE normalization). ACES
  // curvature lifts midtones, so "≈x" only holds as x→0 (check a very small x);
  // the slope at 1e-5 pins the normalization directly.
  approx(extendedAcesCurve(1e-5, P), 1e-5, 1e-8);
  const slope = extendedAcesCurve(1e-5, P) / 1e-5;
  approx(slope, 1, 1e-3);
  assert.equal(ACES_IDENTITY_SCALE, 0.14 / 0.03);
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

test("applyTonemapOperatorTriple dispatches SDR + extended(peak) operators", () => {
  const hi: RgbTriple = [2, 2, 2];
  // SDR / pass-through operators ignore peak and match TONEMAP_OPERATORS.
  assert.deepEqual(applyTonemapOperatorTriple(hi, "aces", 4), TONEMAP_OPERATORS.aces!(hi));
  assert.deepEqual(applyTonemapOperatorTriple(hi, "extended", 4), [2, 2, 2]);
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
