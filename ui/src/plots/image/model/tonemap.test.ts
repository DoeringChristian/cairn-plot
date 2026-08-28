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
  resolveDisplayOperator,
  resolveRenderTonemap,
  DISPLAY_OPERATION_IDS,
  DISPLAY_TRANSFER_OPERATION_IDS,
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
// The operator CURVE math now lives in the display-operation registry (Phase 5).
// The peak-parameterized scalar curves are imported under their historical names;
// the former `TONEMAP_OPERATORS` table + `getDisplayCurveId` / peak-aware triple
// dispatch are reconstructed here as thin REGISTRY ADAPTERS so these goldens keep
// pinning the exact same math the panes/shaders run via `getDisplayOperation(id).cpu`.
import {
  evaluateDisplayOperation,
  getDisplayOperation,
  listDisplayOperations,
  DEFAULT_ENCODE_PARAMS,
} from "./display-operations/index.ts";

/** The plain SDR (non-HDR-surface), non-lut curve operators as `(rgb)=>rgb` —
 *  the CPU triple path's operator table, resolved from the registry (was
 *  `image/tonemap.ts`'s `TONEMAP_OPERATORS`). Every curve is surface-independent. */
const TONEMAP_OPERATORS: Record<string, (rgb: RgbTriple) => RgbTriple> = Object.fromEntries(
  listDisplayOperations()
    .filter((e) => e.category !== "colormap")
    .map((e) => [e.id, (rgb: RgbTriple): RgbTriple => evaluateDisplayOperation(e, rgb, 3, DEFAULT_ENCODE_PARAMS)]),
);
/** Resolve an operator name to its non-peak CPU curve fn, srgb fallback. */
const getDisplayCurveId = (name: string | undefined | null): ((rgb: RgbTriple) => RgbTriple) =>
  (name && TONEMAP_OPERATORS[name]) || TONEMAP_OPERATORS.srgb!;
/** Peak-aware operator dispatch (extended-* read `peak`; the rest ignore it). */
const applyDisplayCurveIdTriple = (rgb: RgbTriple, operator: string, peak: number): RgbTriple =>
  evaluateDisplayOperation((getDisplayOperation(operator) ?? getDisplayOperation("srgb")!), rgb, 3, { ...DEFAULT_ENCODE_PARAMS, peak });
const curveValue = (id: "linear" | "reinhard" | "aces", value: number, peak: number): number =>
  (getDisplayOperation(id)!.implementation.kind === "per-channel" ? getDisplayOperation(id)!.implementation.cpu(value, { ...DEFAULT_ENCODE_PARAMS, peak }) : value);

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
  assert.ok(DISPLAY_OPERATION_IDS.includes("normal"));
});

test("getDisplayCurveId falls back to srgb for unknown key", () => {
  assert.equal(getDisplayCurveId("does-not-exist"), TONEMAP_OPERATORS.srgb);
  assert.equal(getDisplayCurveId(null), TONEMAP_OPERATORS.srgb);
  assert.equal(getDisplayCurveId("aces"), TONEMAP_OPERATORS.aces);
});

test("resolveDisplayOperator: canonical pass-through, else srgb", () => {
  assert.equal(resolveDisplayOperator("linear"), "linear");
  assert.equal(resolveDisplayOperator("srgb"), "srgb");
  assert.equal(resolveDisplayOperator("reinhard"), "reinhard");
  assert.equal(resolveDisplayOperator("aces"), "aces");
  // Unknown / empty / null → srgb default.
  assert.equal(resolveDisplayOperator("nope"), "srgb");
  assert.equal(resolveDisplayOperator(undefined), "srgb");
  assert.equal(resolveDisplayOperator(null), "srgb");
  assert.equal(resolveDisplayOperator("not-an-operation"), "srgb");
});

test("reinhard operation: monotone, ≈x for x≪1, →P asymptote", () => {
  const P = 4; // explicit peak — a curve-SHAPE test, independent of the default
  approx(curveValue("reinhard", 0, P), 0);
  // Identity-like at low x (slope exactly 1 at 0).
  approx(curveValue("reinhard", 0.001, P), 0.001, 5e-6);
  approx(curveValue("reinhard", 0.01, P), 0.01, 5e-4);
  // Monotone increasing across the HDR range.
  let prev = -1;
  for (let x = 0; x <= 32; x += 0.25) {
    const y = curveValue("reinhard", x, P);
    assert.ok(y > prev, `extended-reinhard not monotone at ${x}`);
    prev = y;
  }
  // Negative input pre-clamps to 0.
  approx(curveValue("reinhard", -3, P), 0);
  // Exact formula spot-checks: y = x/(1 + x/P). At x=P: P/2. Approaches P for
  // large x and never exceeds it (the extended-output ceiling).
  approx(curveValue("reinhard", 4, 4), 2);
  approx(curveValue("reinhard", 1e6, P), P, 1e-3);
  assert.ok(curveValue("reinhard", 1e9, P) < P);
  // Midrange stays NEAR identity (the SDR white-point form dipped x=1 to 0.53
  // at P=4 — the bug this formula replaces): x=1 → 1/(1+1/4) = 0.8.
  approx(curveValue("reinhard", 1, 4), 0.8);
});

test("aces operation: P·aces(x/P) — P=1 ≡ narkowicz, monotone, →P asymptote", () => {
  const P = 4; // explicit peak — a curve-SHAPE test, independent of the default
  approx(curveValue("aces", 0, P), 0);
  // Peak-parameterized as the CANONICAL curve scaled to P: y = P·aces(x/P).
  // Spot-check the closed form directly.
  for (const x of [0.1, 0.5, 1, 2, 8]) {
    approx(curveValue("aces", x, P), P * acesFit(x / P), 1e-12);
  }
  // Monotone increasing.
  let prev = -1;
  for (let x = 0; x <= 64; x += 0.5) {
    const y = curveValue("aces", x, P);
    assert.ok(y >= prev - 1e-12, `extended-aces not monotone at ${x}`);
    prev = y;
  }
  // Never exceeds the peak, and saturates to exactly P for very bright inputs.
  assert.ok(curveValue("aces", 1000, P) <= P + 1e-9);
  approx(curveValue("aces", 1000, P), P, 1e-6);
  // Peak scales: a larger P raises the asymptote proportionally.
  approx(curveValue("aces", 1000, 8), 8, 1e-6);
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
    assert.equal(TONEMAP_OPERATORS.linear!([x, x, x] as RgbTriple)[0], curveValue("linear", x, 1));
    // Reinhard = x/(1+x/P): SDR reinhard === extended-reinhard at P=1.
    approx(TONEMAP_OPERATORS.reinhard!([x, x, x] as RgbTriple)[0], curveValue("reinhard", x, 1), 1e-12);
    // ACES = P·aces(x/P): SDR aces === extended-aces at P=1 (the FIX — the old
    // S=0.14/0.03 input scaling broke this).
    approx(TONEMAP_OPERATORS.aces!([x, x, x] as RgbTriple)[0], curveValue("aces", x, 1), 1e-12);
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
  // ACES) and passes through resolveDisplayOperator unchanged.
  assert.ok(DISPLAY_OPERATION_IDS.includes("gamma"));
  assert.equal(resolveDisplayOperator("gamma"), "gamma");
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

test("DISPLAY_TRANSFER_OPERATION_IDS: the 8-bit pane's menu subset (sRGB · Gamma · Linear)", () => {
  assert.deepEqual([...DISPLAY_TRANSFER_OPERATION_IDS], ["srgb", "gamma", "linear"]);
  // Subset of the full SDR group (no reinhard/aces on an already-[0,1] source).
  for (const op of DISPLAY_TRANSFER_OPERATION_IDS) assert.ok(DISPLAY_OPERATION_IDS.includes(op));
});

test("linear operation: identity below P, hard ceiling at/above P, monotone", () => {
  const P = 4; // explicit peak — a curve-SHAPE test, independent of the default
  // EXACT identity for 0 <= x <= P (no curvature, no float drift — plain min).
  approx(curveValue("linear", 0, P), 0);
  assert.equal(curveValue("linear", 0.001, P), 0.001);
  assert.equal(curveValue("linear", 1, P), 1);
  assert.equal(curveValue("linear", 2.5, P), 2.5);
  assert.equal(curveValue("linear", P, P), P); // at the ceiling: y = P exactly
  // EXACT hard ceiling at/above P.
  assert.equal(curveValue("linear", P, P), 4);
  assert.equal(curveValue("linear", 5, P), 4);
  assert.equal(curveValue("linear", 1e9, P), 4);
  // Negative input pre-clamps to 0.
  assert.equal(curveValue("linear", -3, P), 0);
  // Monotone non-decreasing across the HDR range (flat once past P).
  let prev = -1;
  for (let x = 0; x <= 32; x += 0.25) {
    const y = curveValue("linear", x, P);
    assert.ok(y >= prev, `extended-clamp not monotone at ${x}`);
    prev = y;
  }
  // Peak scales the ceiling: a larger P raises the clip point proportionally.
  assert.equal(curveValue("linear", 6, 8), 6); // below 8 → identity
  assert.equal(curveValue("linear", 10, 8), 8); // above 8 → clamped to 8
});

test("applyDisplayCurveIdTriple dispatches one peak-aware operation per authored id", () => {
  const hi: RgbTriple = [2, 2, 2];
  assert.deepEqual(applyDisplayCurveIdTriple(hi, "linear", 4), [2, 2, 2]);
  assert.deepEqual(applyDisplayCurveIdTriple([8, 8, 8], "linear", 4), [4, 4, 4]);
  const r = curveValue("reinhard", 2, 4);
  assert.deepEqual(applyDisplayCurveIdTriple(hi, "reinhard", 4), [r, r, r]);
  const a = curveValue("aces", 2, 4);
  assert.deepEqual(applyDisplayCurveIdTriple(hi, "aces", 4), [a, a, a]);
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

test("resolveDisplayOperator accepts only canonical operators", () => {
  // The 5 canonical operators pass through.
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    assert.equal(resolveDisplayOperator(op), op);
  }
  // Garbage / null → the srgb default.
  assert.equal(resolveDisplayOperator("nope"), "srgb");
  assert.equal(resolveDisplayOperator(null), "srgb");
});

test("resolveRenderTonemap preserves the operation id independently of the surface", () => {
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    assert.equal(resolveRenderTonemap(op, 4, false, 2.2).displayOperationId, op);
    assert.equal(resolveRenderTonemap(op, 4, true, 2.2).displayOperationId, op);
  }
  assert.deepEqual(resolveRenderTonemap("srgb", 4, false, 2.2), { displayOperationId: "srgb", hdrOut: false, peak: 4, gamma: undefined });
  assert.deepEqual(resolveRenderTonemap("srgb", 4, true, 2.2), { displayOperationId: "srgb", hdrOut: true, peak: 4, gamma: undefined });
});

test("resolveRenderTonemap makes the peak GPU-safe without changing operations", () => {
  const inf = EXTENDED_TONEMAP_PEAK_UNBOUNDED;
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    const resolved = resolveRenderTonemap(op, inf, true, 2.2);
    assert.equal(resolved.displayOperationId, op);
    assert.equal(resolved.peak, EXTENDED_TONEMAP_PEAK_MAX);
  }
});

test("UNIFIED INVARIANT: P=1 render == the legacy SDR curve+encode, per operator (byte-for-byte)", () => {
  // The full display value at P=1 (engaged HDR pane) equals the SDR rendition.
  // resolveRenderTonemap returns the SDR path at P=1, so simulate the pass:
  //   rangeMap = applyDisplayCurveIdTriple(x, op, peak) ; encode = outputEncode.
  const encodeOf = (v: number, g: number | undefined) => outputEncode(v, g);
  for (const op of ["linear", "srgb", "gamma", "reinhard", "aces"]) {
    const rt = resolveRenderTonemap(op, 1, true, 2.2);
    assert.equal(rt.hdrOut, true);
    assert.equal(rt.peak, 1);
    for (let x = -0.25; x <= 6; x += 0.37) {
      const uni = encodeOf(applyDisplayCurveIdTriple([x, x, x], rt.displayOperationId, rt.peak)[0], rt.gamma);
      const legacy = outputEncode(TONEMAP_OPERATORS[op]!([x, x, x] as RgbTriple)[0], resolveEncodeGamma(op, 2.2));
      approx(uni, legacy, 1e-12);
    }
  }
});

test("UNIFIED goldens: HDR Gamma is UNCLAMPED (above-white survives), P>1 clips at the ceiling", () => {
  // Gamma on an engaged HDR pane, x=4 below the P=8 ceiling: the value survives
  // above 1.0, gamma-corrected. extended-clamp(4, 8)=4 → extendedGammaEncode(4, 2.2).
  const rt = resolveRenderTonemap("gamma", 8, true, 2.2);
  const ranged = applyDisplayCurveIdTriple([4, 4, 4], rt.displayOperationId, rt.peak)[0]; // extended-clamp(4,8)=4
  approx(ranged, 4, 1e-12);
  const display = extendedOutputEncode(ranged, rt.gamma);
  approx(display, Math.pow(4, 1 / 2.2), 1e-12); // ≈ 1.877776 — ABOVE 1.0 (extended)
  assert.ok(display > 1.0, "HDR Gamma preserves extended brightness (above-white survives)");
  // At a LOWER ceiling P=2, the same x=4 hard-clips to 2 first: 2^(1/2.2).
  const rt2 = resolveRenderTonemap("gamma", 2, true, 2.2);
  const ranged2 = applyDisplayCurveIdTriple([4, 4, 4], rt2.displayOperationId, rt2.peak)[0]; // extended-clamp(4,2)=2
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

test("default display operation is unchanged across output surfaces", () => {
  const defaultOperation = resolveDisplayOperator(undefined);
  assert.equal(defaultOperation, "srgb");
  assert.deepEqual(resolveRenderTonemap(defaultOperation, EXTENDED_TONEMAP_PEAK_DEFAULT, true, 2.2), {
    displayOperationId: "srgb",
    hdrOut: true,
    peak: EXTENDED_TONEMAP_PEAK_DEFAULT,
    gamma: undefined,
  });
  assert.deepEqual(resolveRenderTonemap(defaultOperation, 1, false, 2.2), {
    displayOperationId: "srgb",
    hdrOut: false,
    peak: 1,
    gamma: undefined,
  });
});
