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
    assert.deepEqual(e.params, ["exposure", "offset"], `${e.id} lut declares only sensitivity params (Phase 2)`);
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
