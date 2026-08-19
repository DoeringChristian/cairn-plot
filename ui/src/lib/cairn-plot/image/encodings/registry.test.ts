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
  type ParamName,
  type EncodeParams,
} from "./index.ts";

const ALLOWED_PARAMS: ParamName[] = ["exposure", "offset", "peak", "gamma", "min", "max", "norm"];
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

test("lut entries: kind lut, arity [1], needsLut, lutName, sensitivity params", () => {
  const luts = listEncodings().filter((e) => e.kind === "lut");
  assert.ok(luts.length >= 3, "expected the migrated colormap LUT entries");
  // Includes the canonical colormaps.
  const ids = luts.map((e) => e.id);
  for (const id of ["viridis", "magma"]) assert.ok(ids.includes(id), `missing lut "${id}"`);
  for (const e of luts) {
    assert.deepEqual(e.arities, [1], `${e.id} lut arity must be [1]`);
    assert.equal(e.needsLut, true, `${e.id} lut must set needsLut`);
    assert.equal(typeof e.lutName, "string", `${e.id} lut must reference a table`);
    assert.ok(e.lutName!.length > 0, `${e.id} lut has empty lutName`);
    // Phase 4: sensitivity (exposure/offset) + bounds (min/max) + norm.
    assert.deepEqual(
      e.params,
      ["exposure", "offset", "min", "max", "norm"],
      `${e.id} lut declares sensitivity + bounds + norm params (Phase 4)`,
    );
  }
});

test("lut cpu twins return finite display triples in [0,1] across the scalar range", () => {
  const luts = listEncodings().filter((e) => e.kind === "lut");
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
