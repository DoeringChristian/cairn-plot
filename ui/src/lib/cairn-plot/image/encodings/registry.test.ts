/**
 * Registry SHAPE tests (pure, DOM/GPU-free) — run under Node's built-in runner:
 *   node --experimental-strip-types --test src/lib/cairn-plot/image/encodings/registry.test.ts
 *
 * Guards the invariants the GPU/CPU consumers rely on: ids + operatorIds unique,
 * arities sane, params drawn from the allowed manifest, `normal` is the arity-3
 * paramless remap, and every `cpu` twin returns FINITE triples across a spread of
 * inputs (incl. HDR + negatives). The GPU↔CPU byte parity itself is proven by the
 * `encoding-registry.browser.ts` harness (needs WebGPU); this is the cheap shape
 * gate that runs in plain Node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listEncodings,
  getEncoding,
  OPERATOR_ID,
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
const ALLOWED_KINDS = new Set(["curve", "lut", "remap"]);

test("registry is non-empty and includes the 10 migrated operators", () => {
  const ids = listEncodings().map((e) => e.id);
  for (const id of [
    "linear",
    "srgb",
    "gamma",
    "reinhard",
    "aces",
    "normal",
    "extended",
    "extended-clamp",
    "extended-reinhard",
    "extended-aces",
  ]) {
    assert.ok(ids.includes(id), `missing encoding "${id}"`);
  }
});

test("ids are unique", () => {
  const ids = listEncodings().map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate encoding id");
});

test("operatorIds are unique integers and match OPERATOR_ID", () => {
  const seen = new Set<number>();
  for (const e of listEncodings()) {
    assert.ok(Number.isInteger(e.operatorId), `${e.id} operatorId not an integer`);
    assert.ok(!seen.has(e.operatorId), `duplicate operatorId ${e.operatorId} (${e.id})`);
    seen.add(e.operatorId);
    assert.equal(OPERATOR_ID[e.id], e.operatorId, `OPERATOR_ID[${e.id}] mismatch`);
  }
});

test("arities are non-empty, positive integers", () => {
  for (const e of listEncodings()) {
    assert.ok(e.arities.length > 0, `${e.id} has empty arities`);
    for (const k of e.arities) {
      assert.ok(Number.isInteger(k) && k >= 1 && k <= 4, `${e.id} bad arity ${k}`);
    }
  }
});

test("kinds + params are drawn from the allowed sets", () => {
  for (const e of listEncodings()) {
    assert.ok(ALLOWED_KINDS.has(e.kind), `${e.id} bad kind ${e.kind}`);
    for (const p of e.params) {
      assert.ok(ALLOWED_PARAMS.includes(p), `${e.id} declares unknown param ${p}`);
    }
    assert.equal(new Set(e.params).size, e.params.length, `${e.id} has duplicate params`);
  }
});

test("normal is the arity-3 paramless remap; extended* need the HDR surface", () => {
  const normal = getEncoding("normal");
  assert.ok(normal);
  assert.equal(normal!.kind, "remap");
  assert.deepEqual(normal!.arities, [3]);
  assert.deepEqual(normal!.params, []);

  for (const id of ["extended", "extended-clamp", "extended-reinhard", "extended-aces"]) {
    assert.equal(getEncoding(id)!.needsHdrSurface, true, `${id} should need the HDR surface`);
  }
  // Peak is declared exactly by the peak-parameterized curves.
  for (const id of ["extended-clamp", "extended-reinhard", "extended-aces"]) {
    assert.ok(getEncoding(id)!.params.includes("peak"), `${id} should declare peak`);
  }
  assert.ok(!getEncoding("extended")!.params.includes("peak"), "raw extended has no peak");
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
  for (const e of listEncodings()) {
    for (const v of inputs) {
      for (const peak of peaks) {
        const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS, peak };
        const out = e.cpu(v, 3, p);
        assert.equal(out.length, 3, `${e.id} cpu returned non-triple`);
        for (const c of out) {
          assert.ok(Number.isFinite(c), `${e.id} cpu(${v}, peak=${peak}) non-finite: ${c}`);
        }
      }
    }
  }
});

test("wgsl curve expression is a non-empty string for every entry", () => {
  for (const e of listEncodings()) {
    assert.equal(typeof e.wgsl, "string");
    assert.ok(e.wgsl.trim().length > 0, `${e.id} has empty wgsl`);
  }
});

test("lut entries: kind lut, arity [1,2,3,4], needsLut, lutName, sensitivity+reduce params", () => {
  // Table-backed NORM luts only (the ANALYTIC entries are computed — no
  // needsLut/lutName; TURBO is table-backed but bakes its own log2 index, so it
  // declares no norm/min/max — both tested separately below).
  const luts = listEncodings().filter((e) => e.kind === "lut" && !e.analytic && !e.turbo);
  assert.ok(luts.length >= 3, "expected the migrated colormap LUT entries");
  // Includes the canonical colormaps.
  const ids = luts.map((e) => e.id);
  for (const id of ["viridis", "magma"]) assert.ok(ids.includes(id), `missing lut "${id}"`);
  for (const e of luts) {
    // Multi-channel follow-up: colormaps are legal at every k∈[1,4] (a k>1 sample
    // is reduced to a scalar before the LUT).
    assert.deepEqual(e.arities, [1, 2, 3, 4], `${e.id} lut arity must be [1,2,3,4]`);
    assert.equal(e.needsLut, true, `${e.id} lut must set needsLut`);
    assert.equal(typeof e.lutName, "string", `${e.id} lut must reference a table`);
    assert.ok(e.lutName!.length > 0, `${e.id} lut has empty lutName`);
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
  const luts = listEncodings().filter((e) => e.kind === "lut" && !e.analytic);
  const scalars = [-0.5, 0, 0.25, 0.5, 0.75, 1, 1.5];
  for (const e of luts) {
    for (const s of scalars) {
      const out = e.cpu([s, 0, 0], 1, DEFAULT_ENCODE_PARAMS);
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

test("red-green is an ANALYTIC lut: kind lut, no needsLut/lutName, exposure/offset/reduce params", () => {
  const rg = getEncoding("red-green");
  assert.ok(rg, "red-green missing from the registry");
  assert.equal(rg!.kind, "lut", "red-green stays in the COLORMAPS section");
  assert.equal(rg!.analytic, true, "red-green must be analytic (computed, no LUT bind)");
  assert.ok(!rg!.needsLut, "analytic red-green must NOT bind a LUT");
  assert.equal(rg!.lutName, undefined, "analytic red-green references no table");
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
  const rg = getEncoding("red-green")!;
  // k=1: channel 0 straight through.
  assert.deepEqual(rg.cpu([-0.5, 9, 9], 1, DEFAULT_ENCODE_PARAMS), [1, 0, 0]);
  assert.deepEqual(rg.cpu([0.5, 9, 9], 1, DEFAULT_ENCODE_PARAMS), [0, 1, 0]);
  // k=3 mean of (0.3, -0.9, 0.3) = -0.1 → red 0.2 (negative wins the mean).
  const outMean = rg.cpu([0.3, -0.9, 0.3], 3, { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" });
  assert.ok(Math.abs(outMean[0] - 0.2) < 1e-12 && outMean[1] === 0 && outMean[2] === 0, `got ${outMean}`);
});

// ---------------------------------------------------------------------------
// TURBO false-color (the tev-exact follow-up) — a table-backed lut whose INDEX is
// tev's FIXED log2 mapping (turboDataIndex), BAKED into the encoding. GPU↔CPU
// parity is proven by the browser harness; these pin the shape + the index math.
// ---------------------------------------------------------------------------

test("turbo is a table-backed lut with the BAKED log2 index: needsLut, lutName, no norm/min/max, turbo flag", () => {
  const t = getEncoding("turbo");
  assert.ok(t, "turbo missing from the registry");
  assert.equal(t!.kind, "lut", "turbo stays in the COLORMAPS section");
  assert.equal(t!.turbo, true, "turbo must set the turbo flag (scalar-mode 3)");
  assert.equal(t!.needsLut, true, "turbo binds the turbo table");
  assert.equal(t!.lutName, "turbo", "turbo references the turbo table");
  assert.ok(!t!.analytic, "turbo is table-backed, not analytic");
  assert.deepEqual(t!.arities, [1, 2, 3, 4]);
  // NO norm/min/max — the log2 index is intrinsic (see turboDataIndex).
  assert.deepEqual(t!.params, ["exposure", "offset", "reduce"]);
});

test("turboDataIndex is tev's FIXED log2 mapping (2⁻⁵ offset, ten stops)", () => {
  assert.equal(TURBO_LOG2_OFFSET, 0.03125); // 2⁻⁵
  assert.equal(TURBO_LOG2_STOPS, 10);
  // Value 1.0 lands mid-ramp (~0.504, green); ~32 saturates at 1 (dark red); a
  // tiny value floors near 0 (dark indigo).
  assert.ok(Math.abs(turboDataIndex(1.0) - (Math.log2(1.03125) / 10 + 0.5)) < 1e-12);
  assert.ok(Math.abs(turboDataIndex(1.0) - 0.5044) < 1e-3, `1.0 → ~0.504, got ${turboDataIndex(1.0)}`);
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
  const t = getEncoding("turbo")!;
  // k=1: channel 0 straight through the log2 index.
  const out1 = t.cpu([1.0], 1, DEFAULT_ENCODE_PARAMS);
  assert.equal(out1.length, 3);
  for (const c of out1) assert.ok(Number.isFinite(c) && c >= 0 && c <= 1);
  // k=3 default reduce is MEAN (tev averages RGB), NOT the k≥3 luminance default:
  // cpu([a,b,c],3) === cpu([mean],1).
  const rgb = [0.2, 0.5, 0.8];
  const mean = (0.2 + 0.5 + 0.8) / 3;
  assert.deepEqual(
    t.cpu(rgb, 3, DEFAULT_ENCODE_PARAMS),
    t.cpu([mean], 1, DEFAULT_ENCODE_PARAMS),
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
// GRAY NONE (the plain-grayscale "none" DATA encoding — HDR-native follow-up).
// A single-channel "none" scalar is DATA: its color is the SCENE-LINEAR gray
// vec3(idx) where `idx` is the SAME computeDataIndex the LUT path computes, run
// through the shared output-encode (so SDR clamps, an HDR surface keeps >1). No
// registry entry (it's the absence of a colormap), so its CPU twin IS
// computeDataIndex + a gray broadcast — these pin that convention (the shape the
// `encoding-registry` browser harness's gray-none case + the GpuImagePane
// `scalarNoneData` routing + the WGSL `scalarMode==2` branch all agree on).
// ---------------------------------------------------------------------------

/** The gray-none CPU twin: scalar → data index → SCENE-LINEAR gray triple
 *  (pre-output-encode, exactly what the WGSL `scalarMode==2` branch feeds the
 *  shared output-encode). */
function grayNoneColor(scalar: number, p: EncodeParams): [number, number, number] {
  const idx = computeDataIndex(scalar, p);
  return [idx, idx, idx];
}

test("gray-none convention: linear norm + no bounds passes the RAW scalar UNCLAMPED (HDR-native)", () => {
  const p: EncodeParams = { ...DEFAULT_ENCODE_PARAMS }; // linear, no bounds
  // The over-range value survives as-is (the shared output-encode — extended on an
  // HDR surface — decides the range, NOT this stage). This is the whole point of
  // the follow-up: a scalar > 1 is NOT clamped here.
  assert.deepEqual(grayNoneColor(1.5, p), [1.5, 1.5, 1.5], "1.5 rides through unclamped as gray");
  assert.deepEqual(grayNoneColor(0.3, p), [0.3, 0.3, 0.3], "in-range value is plain gray");
  assert.deepEqual(grayNoneColor(-0.2, p), [-0.2, -0.2, -0.2], "negatives ride through too");
});

test("gray-none convention: bounds / log / power map the index to [0,1] (explicit normalize)", () => {
  // Bounds: the over-range scalar normalizes to the ramp (LUT/clamp semantics).
  assert.deepEqual(grayNoneColor(6, { ...DEFAULT_ENCODE_PARAMS, min: 2, max: 6 }), [1, 1, 1], "max → 1");
  assert.deepEqual(grayNoneColor(4, { ...DEFAULT_ENCODE_PARAMS, min: 2, max: 6 }), [0.5, 0.5, 0.5], "midpoint → 0.5");
  // Power norm reshapes the index (clamp01(t)^gamma).
  assert.deepEqual(grayNoneColor(0.5, { ...DEFAULT_ENCODE_PARAMS, norm: "power", gamma: 2 }), [0.25, 0.25, 0.25], "0.5^2");
  // Log floors non-positive to the ramp bottom.
  assert.deepEqual(grayNoneColor(0, { ...DEFAULT_ENCODE_PARAMS, norm: "log" }), [0, 0, 0], "0 floors to 0");
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
  const viridis = getEncoding("viridis")!;
  // At k=1 the multi-channel path is inert: cpu([s],1) === cpu([s, junk],1).
  const a = viridis.cpu([0.5], 1, DEFAULT_ENCODE_PARAMS);
  const b = viridis.cpu([0.5, 9, 9], 1, DEFAULT_ENCODE_PARAMS);
  assert.deepEqual(a, b, "k=1 lut cpu must read only channel 0");
  // At k=3 with an explicit reduce, the twin equals the LUT of the reduced scalar
  // (which equals the k=1 lut cpu of that scalar) — i.e. reduce THEN index.
  const rgb = [0.2, 0.5, 0.8];
  const meanScalar = reduceToScalar(rgb, 3, "mean");
  assert.deepEqual(
    viridis.cpu(rgb, 3, { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" }),
    viridis.cpu([meanScalar], 1, DEFAULT_ENCODE_PARAMS),
    "lut cpu(k=3, mean) === lut cpu(reduced scalar)",
  );
  // Unset reduce falls back to the k-based default (luminance for k=3).
  const lumScalar = reduceToScalar(rgb, 3, "luminance");
  assert.deepEqual(
    viridis.cpu(rgb, 3, DEFAULT_ENCODE_PARAMS),
    viridis.cpu([lumScalar], 1, DEFAULT_ENCODE_PARAMS),
    "unset reduce → luminance default at k=3",
  );
});
