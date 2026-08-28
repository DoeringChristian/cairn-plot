/**
 * Registry SHAPE tests (pure, DOM/GPU-free) — run under Node's built-in runner:
 *   node --experimental-strip-types --test src/plots/image/model/display-operations/registry.test.ts
 *
 * Guards the invariants the GPU/CPU consumers rely on: ids unique,
 * arities sane, params drawn from the allowed manifest, `normal` is the arity-3
 * paramless remap, and every `cpu` twin returns FINITE triples across a spread of
 * inputs (incl. HDR + negatives). The GPU↔CPU byte parity itself is proven by the
 * `display-operation-registry.browser.ts` harness (needs WebGPU); this is the cheap shape
 * gate that runs in plain Node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listDisplayOperations,
  listDisplayOperationsByCategory,
  evaluateDisplayOperation,
  getDisplayOperation,
  DEFAULT_ENCODE_PARAMS,
  computeDataIndex,
  boundsActive,
  LOG_NORM_EPS,
  NORM_ID,
  REDUCE_ID,
  REC709_LUMA,
  reduceToScalar,
  defaultReduceMode,
  colorChannelCount,
  signedAnalyticColor,
  SIGNED_ANALYTIC_AMPLITUDE,
  turboDataIndex,
  TURBO_LOG2_OFFSET,
  TURBO_LOG2_STOPS,
  type ParamName,
  type EncodeParams,
} from "./index.ts";

const ALLOWED_PARAMS: ParamName[] = ["exposure", "offset", "peak", "gamma", "min", "max", "reduce"];
const ALLOWED_CATEGORIES = new Set(["curve", "colormap", "remap"]);

test("registry includes the five curve operations and normal remap", () => {
  const ids = listDisplayOperations().map((e) => e.id);
  for (const id of [
    "linear",
    "srgb",
    "gamma",
    "reinhard",
    "aces",
    "normal",
  ]) {
    assert.ok(ids.includes(id), `missing encoding "${id}"`);
  }
});

test("ids are unique", () => {
  const ids = listDisplayOperations().map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate encoding id");
});

test("arities are non-empty, positive integers", () => {
  for (const e of listDisplayOperations()) {
    assert.ok(e.arities.length > 0, `${e.id} has empty arities`);
    for (const k of e.arities) {
      assert.ok(Number.isInteger(k) && k >= 1 && k <= 4, `${e.id} bad arity ${k}`);
    }
  }
});

test("kinds + params are drawn from the allowed sets", () => {
  for (const e of listDisplayOperations()) {
    assert.ok(ALLOWED_CATEGORIES.has(e.category), `${e.id} bad category ${e.category}`);
    for (const p of e.params) {
      assert.ok(ALLOWED_PARAMS.includes(p), `${e.id} declares unknown param ${p}`);
    }
    assert.equal(new Set(e.params).size, e.params.length, `${e.id} has duplicate params`);
  }
});

test("normal is the arity-3 paramless remap and every curve owns its channel transform", () => {
  const normal = getDisplayOperation("normal");
  assert.ok(normal);
  assert.equal(normal!.category, "remap");
  assert.deepEqual(normal!.arities, [3]);
  assert.deepEqual(normal!.params, []);

  for (const operation of listDisplayOperationsByCategory("curve")) {
    assert.equal(operation.implementation.kind, "per-channel", `${operation.id} must define a per-channel implementation`);
    assert.ok(operation.params.includes("peak"), `${operation.id} must declare peak`);
  }
});

test("cpu twins return finite triples across HDR + signed inputs", () => {
  const inputs: number[][] = [
    [0, 0, 0],
    [0.25, 0.5, 0.75],
    [1, 1, 1],
    [3, 3, 3],
    [-1, -0.5, 0.5], // signed (normal map territory)
    [16, 8, 4],
  ];
  const peaks = [1, 4, 6, 16];
  for (const e of listDisplayOperations()) {
    for (const v of inputs) {
      for (const peak of peaks) {
        const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, peak };
        const out = evaluateDisplayOperation(e, v, 3, p);
        assert.equal(out.length, 3, `${e.id} cpu returned non-triple`);
        for (const c of out) {
          assert.ok(Number.isFinite(c), `${e.id} cpu(${v}, peak=${peak}) non-finite: ${c}`);
        }
      }
    }
  }
});

test("every display operation owns a non-empty WGSL implementation", () => {
  for (const e of listDisplayOperations()) {
    const wgsl = e.implementation.kind === "lut" ? e.implementation.index.wgsl : e.implementation.wgsl;
    assert.ok(wgsl.trim().length > 0, `${e.id} has empty wgsl`);
  }
});

test("table-backed colormaps own GPU-ready tables", () => {
  const luts = listDisplayOperations().filter((e) => e.implementation.kind === "lut" && e.id !== "turbo");
  assert.ok(luts.length >= 3, "expected the migrated colormap LUT entries");
  // Includes the canonical colormaps.
  const ids = luts.map((e) => e.id);
  for (const id of ["magma", "plasma"]) assert.ok(ids.includes(id), `missing lut "${id}"`);
  for (const e of luts) {
    // Multi-channel follow-up: colormaps are legal at every k∈[1,4] (a k>1 sample
    // is reduced to a scalar before the LUT).
    assert.deepEqual(e.arities, [1, 2, 3, 4], `${e.id} lut arity must be [1,2,3,4]`);
    assert.equal(e.implementation.kind, "lut");
    assert.equal(e.implementation.table.length, 256 * 4);
    // Sensitivity (exposure/offset) + bounds (min/max) + multi-channel reduce. NO
    // `norm` — the norm picker was removed (norm-UI-removal follow-up).
    assert.deepEqual(
      e.params,
      ["exposure", "offset", "min", "max", "reduce"],
      `${e.id} lut declares sensitivity + bounds + reduce params`,
    );
  }
});

test("lut cpu twins return finite display triples in [0,1] across the scalar range", () => {
  const luts = listDisplayOperations().filter((e) => e.implementation.kind === "lut");
  const scalars = [-0.5, 0, 0.25, 0.5, 0.75, 1, 1.5];
  for (const e of luts) {
    for (const s of scalars) {
      const out = evaluateDisplayOperation(e, [s, 0, 0], 1, DEFAULT_ENCODE_PARAMS);
      assert.equal(out.length, 3, `${e.id} cpu returned non-triple`);
      for (const c of out) {
        assert.ok(Number.isFinite(c) && c >= 0 && c <= 1, `${e.id} cpu(${s}) out of [0,1]: ${c}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Analytic signed encoding (tev-style red-green) — the CPU twin the WGSL
// cairnSignedAnalyticColor mirrors (GPU↔CPU parity proven by the browser harness).
// ---------------------------------------------------------------------------

test("red-green owns an analytic implementation", () => {
  const rg = getDisplayOperation("red-green");
  assert.ok(rg, "red-green missing from the registry");
  assert.equal(rg!.category, "colormap");
  assert.equal(rg!.implementation.kind, "analytic");
  assert.deepEqual(rg!.arities, [1, 2, 3, 4]);
  // No norm/min/max — the signed map is linear in |v|.
  assert.deepEqual(rg!.params, ["exposure", "offset", "reduce"]);
});

test("SIGNED_ANALYTIC_AMPLITUDE is 2 (tev POS_NEG) and signedAnalyticColor matches tev's convention", () => {
  assert.equal(SIGNED_ANALYTIC_AMPLITUDE, 2);
  // Negative → RED (channel 0), positive → GREEN (channel 1), blue always 0.
  assert.deepEqual(signedAnalyticColor(-1), [2, 0, 0]); // amplitude 2*1 = 2 (>1, unclamped)
  assert.deepEqual(signedAnalyticColor(-0.25), [0.5, 0, 0]);
  assert.deepEqual(signedAnalyticColor(0), [0, 0, 0]); // zero → black
  assert.deepEqual(signedAnalyticColor(0.25), [0, 0.5, 0]);
  assert.deepEqual(signedAnalyticColor(1), [0, 2, 0]); // 2*1 = 2 (>1, unclamped)
  // UNCLAMPED past 1 (the HDR-survivable over-range error).
  assert.deepEqual(signedAnalyticColor(3), [0, 6, 0]);
});

test("red-green cpu twin: reduces multi-channel then applies the analytic color (UNCLAMPED, linear)", () => {
  const rg = getDisplayOperation("red-green")!;
  // k=1: channel 0 straight through.
  assert.deepEqual(evaluateDisplayOperation(rg, [-0.5, 9, 9], 1, DEFAULT_ENCODE_PARAMS), [1, 0, 0]);
  assert.deepEqual(evaluateDisplayOperation(rg, [0.5, 9, 9], 1, DEFAULT_ENCODE_PARAMS), [0, 1, 0]);
  // k=3 mean of (0.3, -0.9, 0.3) = -0.1 → red 0.2 (negative wins the mean).
  const outMean = evaluateDisplayOperation(rg, [0.3, -0.9, 0.3], 3, { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" });
  assert.ok(Math.abs(outMean[0] - 0.2) < 1e-12 && outMean[1] === 0 && outMean[2] === 0, `got ${outMean}`);
});

// ---------------------------------------------------------------------------
// TURBO false-color (the tev-exact follow-up) — a table-backed lut whose INDEX is
// tev's FIXED log2 mapping (turboDataIndex), BAKED into the encoding. GPU↔CPU
// parity is proven by the browser harness; these pin the shape + the index math.
// ---------------------------------------------------------------------------

test("turbo owns its table and baked log2 index", () => {
  const t = getDisplayOperation("turbo");
  assert.ok(t, "turbo missing from the registry");
  assert.equal(t!.category, "colormap");
  assert.equal(t!.implementation.kind, "lut");
  assert.equal(t!.implementation.kind === "lut" ? t!.implementation.table.length : 0, 256 * 4);
  assert.deepEqual(t!.arities, [1, 2, 3, 4]);
  // NO norm/min/max — the log2 index is intrinsic (see turboDataIndex).
  assert.deepEqual(t!.params, ["exposure", "offset", "reduce"]);
});

test("turboDataIndex is tev's FIXED log2 mapping (2⁻⁵ offset, ten stops)", () => {
  assert.equal(TURBO_LOG2_OFFSET, 0.03125); // 2⁻⁵
  assert.equal(TURBO_LOG2_STOPS, 10);
  // Value 1.0 lands mid-ramp (~0.504, green); ~32 saturates at 1 (dark red); a
  // tiny value floors near 0 (dark indigo).
  assert.equal(turboDataIndex(1.0), 0.5);
  assert.equal(turboDataIndex(32), 1, "~32 saturates the ramp top (clamps to 1)");
  assert.equal(turboDataIndex(0), 0, "2⁻⁵ input → 0 (log2(2⁻⁵)/10+0.5 = 0)");
  // Monotone increasing over the exercised range, always in [0,1].
  let prev = -1;
  for (const s of [0, 0.05, 0.2, 0.5, 1, 2, 8, 32]) {
    const v = turboDataIndex(s);
    assert.ok(v >= 0 && v <= 1, `turbo index out of [0,1] at ${s}: ${v}`);
    assert.ok(v >= prev, `turbo index not monotone at ${s}`);
    prev = v;
  }
});

test("turbo cpu twin: reduce (mean default) then the BAKED log2 index into the turbo table", () => {
  const t = getDisplayOperation("turbo")!;
  // k=1: channel 0 straight through the log2 index.
  const out1 = evaluateDisplayOperation(t, [1.0], 1, DEFAULT_ENCODE_PARAMS);
  assert.equal(out1.length, 3);
  for (const c of out1) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1);
  // k=3 default reduce is MEAN (tev averages RGB), NOT the k≥3 luminance default:
  // cpu([a,b,c],3) === cpu([mean],1).
  const rgb = [0.2, 0.5, 0.8];
  const mean = (0.2 + 0.5 + 0.8) / 3;
  assert.deepEqual(
    evaluateDisplayOperation(t, rgb, 3, DEFAULT_ENCODE_PARAMS),
    evaluateDisplayOperation(t, [mean], 1, DEFAULT_ENCODE_PARAMS),
    "turbo default reduce must be mean (tev averages RGB)",
  );
});

// ---------------------------------------------------------------------------
// Phase 4 — norms + bounds (computeDataIndex, the shared CPU source of truth the
// WGSL cairnDataIndex mirrors). GPU↔CPU byte parity is proven by the browser
// harness; these pin the math + the single-application invariant in plain Node.
// ---------------------------------------------------------------------------

test("NORM_ID ids are the stable {linear:0, log:1, power:2}", () => {
  assert.deepEqual(NORM_ID, { linear: 0, log: 1, power: 2 });
});

test("linear norm is the identity (index === scalar; unclamped — LUT clamps)", () => {
  const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, norm: "linear" };
  for (const s of [-0.5, 0, 0.3, 0.5, 1, 1.7]) {
    assert.equal(computeDataIndex(s, p), s, `linear norm changed ${s}`);
  }
  // Unset norm behaves as linear (back-compat with the Phase-2 default).
  assert.equal(computeDataIndex(0.42, { ...DEFAULT_ENCODE_PARAMS, norm: undefined }), 0.42);
});

test("log norm: monotone, maps [eps,1]→[0,1], non-positive floors to 0", () => {
  const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, norm: "log" };
  assert.equal(computeDataIndex(LOG_NORM_EPS, p), 0, "eps → 0");
  assert.ok(Math.abs(computeDataIndex(1, p) - 1) < 1e-9, "1 → 1");
  // Non-positive inputs clamp to the eps floor → the bottom of the ramp.
  assert.equal(computeDataIndex(0, p), 0, "0 floors to 0");
  assert.equal(computeDataIndex(-3, p), 0, "negative floors to 0");
  // Strictly increasing across the ramp, and above-1 clamps to 1.
  let prev = -1;
  for (const s of [0.01, 0.1, 0.3, 0.6, 0.9, 1]) {
    const v = computeDataIndex(s, p);
    assert.ok(v > prev, `log not increasing at ${s}`);
    assert.ok(v >= 0 && v <= 1, `log out of [0,1] at ${s}`);
    prev = v;
  }
  assert.equal(computeDataIndex(1.5, p), 1, "above 1 clamps to 1");
});

test("power norm: clamp01(t)^gamma (exponent reuses the gamma slot)", () => {
  const p2: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, norm: "power", gamma: 2 };
  assert.ok(Math.abs(computeDataIndex(0.5, p2) - 0.25) < 1e-9, "0.5^2 = 0.25");
  assert.equal(computeDataIndex(0, p2), 0);
  assert.equal(computeDataIndex(1, p2), 1);
  assert.equal(computeDataIndex(1.5, p2), 1, "clamps above 1 before the power");
  // gamma <= 0 falls back to exponent 1 (identity on [0,1]).
  const pBad: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, norm: "power", gamma: 0 };
  assert.equal(computeDataIndex(0.3, pBad), 0.3);
});

test("bounds affine: (scalar-min)/(max-min); active iff BOTH set", () => {
  // boundsActive predicate.
  assert.equal(boundsActive({ ...DEFAULT_ENCODE_PARAMS }), false, "no bounds");
  assert.equal(boundsActive({ ...DEFAULT_ENCODE_PARAMS, min: 0 }), false, "only min");
  assert.equal(boundsActive({ ...DEFAULT_ENCODE_PARAMS, min: 0, max: 4 }), true, "both");
  const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, min: 2, max: 6 };
  assert.equal(computeDataIndex(2, p), 0, "min → 0");
  assert.equal(computeDataIndex(6, p), 1, "max → 1");
  assert.equal(computeDataIndex(4, p), 0.5, "midpoint → 0.5");
  // Degenerate min===max → 0 (no divide-by-zero).
  assert.equal(computeDataIndex(3, { ...DEFAULT_ENCODE_PARAMS, min: 5, max: 5 }), 0);
});

test("SINGLE-APPLICATION invariant: bounds skin ignores exposure/offset (never composed)", () => {
  // The exposure/offset sensitivity is folded into `scalar` by the CALLER. When
  // the bounds skin is active, computeDataIndex re-normalizes from the RAW value
  // via (scalar-min)/(max-min) — it must NOT additionally apply exposure/offset
  // (they are skins over the SAME affine; the shared.colorRange audit fix hinges
  // on this). So the exposure/offset fields on the params are inert here.
  const withEvOff: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, min: 0, max: 4, exposure: 3, offset: 0.9 };
  const noEvOff: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, min: 0, max: 4 };
  assert.equal(computeDataIndex(2, withEvOff), computeDataIndex(2, noEvOff), "bounds index must not read exposure/offset");
  assert.equal(computeDataIndex(2, noEvOff), 0.5);
});

// ---------------------------------------------------------------------------
// LINEAR SCALAR (the linear scalar DATA encoding — HDR-native follow-up).
// A single-channel "none" scalar is DATA: its color is the SCENE-LINEAR gray
// vec3(idx) where `idx` is the SAME computeDataIndex the LUT path computes, run
// through the shared output-encode (so SDR clamps, an HDR surface keeps >1). No
// registry entry (it's the absence of a colormap), so its CPU twin IS
// computeDataIndex + a gray broadcast — these pin that convention (the shape the
// `display-operation-registry` browser harness's linear scalar case + the GpuImagePane
// linear scalar routing + the WGSL `scalarMode==2` branch all agree on).
// ---------------------------------------------------------------------------

/** The linear scalar CPU twin: scalar → data index → SCENE-LINEAR gray triple
 *  (pre-output-encode, exactly what the WGSL `scalarMode==2` branch feeds the
 *  shared output-encode). */
function linearScalarColor(scalar: number, p: EncodeParams): [number, number, number] {
  const idx = computeDataIndex(scalar, p);
  return [idx, idx, idx];
}

test("linear scalar convention: linear norm + no bounds passes the RAW scalar UNCLAMPED (HDR-native)", () => {
  const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS }; // linear, no bounds
  // The over-range value survives as-is (the shared output-encode — extended on an
  // HDR surface — decides the range, NOT this stage). This is the whole point of
  // the follow-up: a scalar > 1 is NOT clamped here.
  assert.deepEqual(linearScalarColor(1.5, p), [1.5, 1.5, 1.5], "1.5 rides through unclamped as gray");
  assert.deepEqual(linearScalarColor(0.3, p), [0.3, 0.3, 0.3], "in-range value is plain gray");
  assert.deepEqual(linearScalarColor(-0.2, p), [-0.2, -0.2, -0.2], "negatives ride through too");
});

test("linear scalar convention: bounds / log / power map the index to [0,1] (explicit normalize)", () => {
  // Bounds: the over-range scalar normalizes to the ramp (LUT/clamp semantics).
  assert.deepEqual(linearScalarColor(6, { ...DEFAULT_ENCODE_PARAMS, min: 2, max: 6 }), [1, 1, 1], "max → 1");
  assert.deepEqual(linearScalarColor(4, { ...DEFAULT_ENCODE_PARAMS, min: 2, max: 6 }), [0.5, 0.5, 0.5], "midpoint → 0.5");
  // Power norm reshapes the index (clamp01(t)^gamma).
  assert.deepEqual(linearScalarColor(0.5, { ...DEFAULT_ENCODE_PARAMS, norm: "power", gamma: 2 }), [0.25, 0.25, 0.25], "0.5^2");
  // Log floors non-positive to the ramp bottom.
  assert.deepEqual(linearScalarColor(0, { ...DEFAULT_ENCODE_PARAMS, norm: "log" }), [0, 0, 0], "0 floors to 0");
});

// ---------------------------------------------------------------------------
// Multi-channel colormaps — reduceToScalar (the ℝᵏ→scalar collapse the WGSL
// cairnReduceScalar mirrors; GPU↔CPU byte parity is proven by the browser
// harness). These pin the reduction math (Rec.709 weights exact) in plain Node.
// ---------------------------------------------------------------------------

test("REDUCE_ID ids are the stable {luminance:1, mean:2}", () => {
  assert.deepEqual(REDUCE_ID, { luminance: 1, mean: 2 });
});

test("REC709_LUMA weights are the exact Rec.709 coefficients (sum to 1)", () => {
  assert.deepEqual(REC709_LUMA, [0.2126, 0.7152, 0.0722]);
  assert.ok(Math.abs(REC709_LUMA[0] + REC709_LUMA[1] + REC709_LUMA[2] - 1) < 1e-12);
});

test("defaultReduceMode: luminance for k>=3, mean for k=2", () => {
  assert.equal(defaultReduceMode(2), "mean");
  assert.equal(defaultReduceMode(3), "luminance");
  assert.equal(defaultReduceMode(4), "luminance");
});

test("colorChannelCount ignores alpha (min(k,3))", () => {
  assert.equal(colorChannelCount(1), 1);
  assert.equal(colorChannelCount(2), 2);
  assert.equal(colorChannelCount(3), 3);
  assert.equal(colorChannelCount(4), 3, "k=4 drops the alpha channel");
});

test("reduceToScalar k<=1: channel 0 passes through (both modes)", () => {
  assert.equal(reduceToScalar([0.42, 9, 9], 1, "luminance"), 0.42);
  assert.equal(reduceToScalar([0.42, 9, 9], 1, "mean"), 0.42);
});

test("reduceToScalar luminance: EXACT Rec.709 over the color channels", () => {
  // k=3: full Rec.709.
  const r = 0.2, g = 0.5, b = 0.8;
  assert.ok(
    Math.abs(reduceToScalar([r, g, b], 3, "luminance") - (0.2126 * r + 0.7152 * g + 0.0722 * b)) < 1e-12,
  );
  // k=4: alpha (index 3) is ignored — same as the k=3 luminance of RGB.
  assert.equal(
    reduceToScalar([r, g, b, 0.99], 4, "luminance"),
    reduceToScalar([r, g, b], 3, "luminance"),
    "alpha must not affect luminance",
  );
  // k=2: the missing blue channel counts as 0.
  assert.ok(
    Math.abs(reduceToScalar([r, g], 2, "luminance") - (0.2126 * r + 0.7152 * g)) < 1e-12,
  );
  // Equal channels → the reduced scalar is that value (weights sum to 1).
  assert.ok(Math.abs(reduceToScalar([0.3, 0.3, 0.3], 3, "luminance") - 0.3) < 1e-12);
});

test("reduceToScalar mean: average over the color channels (alpha ignored)", () => {
  assert.ok(Math.abs(reduceToScalar([0.2, 0.5, 0.8], 3, "mean") - 0.5) < 1e-12);
  assert.ok(Math.abs(reduceToScalar([0.2, 0.6], 2, "mean") - 0.4) < 1e-12);
  // k=4: mean of the first 3 (RGB), alpha (index 3) excluded.
  assert.ok(Math.abs(reduceToScalar([0.3, 0.6, 0.9, 0.0], 4, "mean") - 0.6) < 1e-12);
});

test("lut cpu twin reduces multi-channel input before the LUT (k=1 unchanged)", () => {
  const magmaEnc = getDisplayOperation("magma")!;
  // At k=1 the multi-channel path is inert: cpu([s],1) === cpu([s, junk],1).
  const a = evaluateDisplayOperation(magmaEnc, [0.5], 1, DEFAULT_ENCODE_PARAMS);
  const b = evaluateDisplayOperation(magmaEnc, [0.5, 9, 9], 1, DEFAULT_ENCODE_PARAMS);
  assert.deepEqual(a, b, "k=1 lut cpu must read only channel 0");
  // At k=3 with an explicit reduce, the twin equals the LUT of the reduced scalar
  // (which equals the k=1 lut cpu of that scalar) — i.e. reduce THEN index.
  const rgb = [0.2, 0.5, 0.8];
  const meanScalar = reduceToScalar(rgb, 3, "mean");
  assert.deepEqual(
    evaluateDisplayOperation(magmaEnc, rgb, 3, { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" }),
    evaluateDisplayOperation(magmaEnc, [meanScalar], 1, DEFAULT_ENCODE_PARAMS),
    "lut cpu(k=3, mean) === lut cpu(reduced scalar)",
  );
  // Unset reduce falls back to the k-based default (luminance for k=3).
  const lumScalar = reduceToScalar(rgb, 3, "luminance");
  assert.deepEqual(
    evaluateDisplayOperation(magmaEnc, rgb, 3, DEFAULT_ENCODE_PARAMS),
    evaluateDisplayOperation(magmaEnc, [lumScalar], 1, DEFAULT_ENCODE_PARAMS),
    "unset reduce → luminance default at k=3",
  );
});
