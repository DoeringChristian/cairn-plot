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

test("toSdrTonemap validates + falls back to srgb, never yields extended", () => {
  assert.equal(toSdrTonemap("linear"), "linear");
  assert.equal(toSdrTonemap("srgb"), "srgb");
  assert.equal(toSdrTonemap("reinhard"), "reinhard");
  assert.equal(toSdrTonemap("aces"), "aces");
  // Unknown / empty / null → srgb default.
  assert.equal(toSdrTonemap("nope"), "srgb");
  assert.equal(toSdrTonemap(undefined), "srgb");
  assert.equal(toSdrTonemap(null), "srgb");
  // "extended" is NOT an SDR operator — it is coerced back to the default.
  assert.equal(toSdrTonemap("extended"), "srgb");
  // SDR menu domain excludes extended.
  assert.ok(!(SDR_TONEMAP_OPERATORS as readonly string[]).includes("extended"));
});

test("resolveEffectiveTonemap: descriptor prop when SDR, extended when HDR engaged", () => {
  // NOT engaged → the descriptor's (validated) operator, srgb default.
  assert.equal(resolveEffectiveTonemap("aces", false), "aces");
  assert.equal(resolveEffectiveTonemap("srgb", false), "srgb");
  assert.equal(resolveEffectiveTonemap(undefined, false), "srgb");
  assert.equal(resolveEffectiveTonemap("garbage", false), "srgb");
  // HDR surface engaged → "extended" IN EFFECT, regardless of the descriptor's
  // SDR operator (the SDR tonemap is bypassed by the pass-through HDR-out path).
  assert.equal(resolveEffectiveTonemap("aces", true), "extended");
  assert.equal(resolveEffectiveTonemap("srgb", true), "extended");
  assert.equal(resolveEffectiveTonemap(undefined, true), "extended");
});

test("extended is a pure pass-through; SDR operators clamp HDR into [0,1]", () => {
  // The "SDR preview on an HDR display" semantics: switching from extended to an
  // SDR operator (e.g. aces) on an HDR-engaged pane clamps values into range.
  const hi: RgbTriple = [8, 8, 8];
  assert.deepEqual(TONEMAP_OPERATORS.extended!(hi), [8, 8, 8]); // unclamped, past 1.0
  const [ar, ag, ab] = TONEMAP_OPERATORS.aces!(hi);
  assert.ok(ar <= 1 && ag <= 1 && ab <= 1, "aces clamps to SDR range");
  const [lr] = TONEMAP_OPERATORS.linear!(hi);
  assert.equal(lr, 1, "linear clamps to 1");
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
