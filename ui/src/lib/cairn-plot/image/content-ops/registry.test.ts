/**
 * Content-op registry SHAPE + twin tests (pure, DOM/GPU-free) — run under Node's
 * built-in runner:
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/image/content-ops/registry.test.ts
 *
 * Guards the Phase-2 invariants the GPU/CPU consumers rely on: the registered op
 * set (identity + six pointwise diffs + three cached metrics), each op's declared
 * shape (source arity / render class / output arity / range / default encoding),
 * the dynamic-output-arity resolution, the pointwise `cpu` twins' diff math, and
 * the direct/cached discrimination + dispatch-id assignment (identity → 0). The
 * GPU↔CPU byte parity of the WGSL twins is proven by the `content-ops` /
 * `encoding-registry` GPU harnesses; this is the cheap shape gate that runs in
 * plain Node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listContentOps,
  listDirectContentOps,
  getContentOp,
  resolveOutputArity,
  isDirectContentOp,
  contentOpId,
  CONTENT_OP_ID,
  type RenderClass,
} from "./index.ts";

const POINTWISE = ["absolute", "signed", "squared", "relative_absolute", "relative_signed", "relative_squared"];
const COMPOSITOR = ["split"];
const CACHED = ["flip", "hdr-flip", "ssim"];

test("the expected op set is registered (identity + pointwise diffs + compositor + cached metrics)", () => {
  const ids = listContentOps().map((o) => o.id);
  assert.deepEqual(ids, ["identity", ...POINTWISE, ...COMPOSITOR, ...CACHED]);
});

test("ids are unique", () => {
  const ids = listContentOps().map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate content-op id");
});

test("identity declares the expected shape (arity-1 direct passthrough)", () => {
  const id = getContentOp("identity");
  assert.ok(id && isDirectContentOp(id));
  assert.equal(id!.sourceArity, 1);
  assert.equal<RenderClass>(id!.renderClass, "direct");
  assert.equal(id!.outputArity, "source"); // passthrough marker
  assert.equal(id!.outputRange, "light");
  assert.equal(id!.defaultEncoding, "srgb");
  assert.deepEqual(id!.params ?? [], []);
  assert.equal((id as { wgsl: string }).wgsl.trim(), "a");
});

test("pointwise diffs are arity-2 direct ops, scalar-gated, range-matched default encoding", () => {
  for (const opId of POINTWISE) {
    const op = getContentOp(opId);
    assert.ok(op && isDirectContentOp(op), `${opId} must be a registered direct op`);
    assert.equal(op!.sourceArity, 2, `${opId} sourceArity`);
    assert.equal(op!.renderClass, "direct", `${opId} renderClass`);
    assert.equal(op!.outputArity, 1, `${opId} scalar-error DISPLAY gating`);
    // signed variants → diverging red-green (ℝ); magnitudes → turbo (ℝ⁺).
    const signed = opId === "signed" || opId === "relative_signed";
    assert.equal(op!.outputRange, signed ? "R" : "R+", `${opId} range`);
    // `defaultEncoding` is asserted against the ONE kernel→default-colormap table in
    // engine/kernels/kernel-default-colormap.test.ts (no second literal pin here).
  }
});

test("cached metrics are arity-2 cached ops (magma default) delegating to a kernel", () => {
  for (const opId of CACHED) {
    const op = getContentOp(opId);
    assert.ok(op, `${opId} registered`);
    assert.equal(op!.renderClass, "cached", `${opId} renderClass`);
    assert.equal(isDirectContentOp(op!), false, `${opId} is not a direct op`);
    assert.equal(op!.sourceArity, 2, `${opId} sourceArity`);
    assert.equal(op!.outputArity, 1, `${opId} scalar-metric DISPLAY gating`);
    assert.equal(op!.outputRange, "R+", `${opId} range`);
    // `defaultEncoding` (magma) is asserted against the ONE kernel→default-colormap
    // table in kernel-default-colormap.test.ts (no second literal pin here).
    assert.equal((op as { kernelId: string }).kernelId, opId, `${opId} delegates to its kernel id`);
  }
});

test("compositor ops are arity-2 direct LIGHT ops (k=3, srgb default) with a split param", () => {
  for (const opId of COMPOSITOR) {
    const op = getContentOp(opId);
    assert.ok(op && isDirectContentOp(op), `${opId} must be a registered direct op`);
    assert.equal(op!.sourceArity, 2, `${opId} sourceArity`);
    assert.equal(op!.renderClass, "direct", `${opId} renderClass`);
    assert.equal(op!.outputArity, 3, `${opId} light RGB → k=3 DISPLAY gating (luts off, curves offered)`);
    assert.equal(op!.outputRange, "light", `${opId} range`);
    assert.equal(op!.defaultEncoding, "srgb", `${opId} default encoding`);
    assert.deepEqual(op!.params ?? [], [opId], `${opId} declares its own param name`);
  }
});

test("compositor cpu twins composite over the fragment uv + param (readout parity)", () => {
  const a = [0.8, 0.6, 0.4];
  const b = [0.2, 0.3, 0.1];
  const splitOp = getContentOp("split")!;
  assert.ok(isDirectContentOp(splitOp));
  // split: uv.x < param → reference (a); else foreground (b).
  assert.deepEqual(splitOp.cpu([a, b], 3, { uv: [0.2, 0.5], param: 0.5 }), a);
  assert.deepEqual(splitOp.cpu([a, b], 3, { uv: [0.8, 0.5], param: 0.5 }), b);
  // No ctx → param/uv default 0: split picks foreground everywhere (uv.x 0 < 0 is false).
  assert.deepEqual(splitOp.cpu([a, b], 3), b);
});

test("getContentOp is falsy-safe", () => {
  assert.equal(getContentOp(undefined), undefined);
  assert.equal(getContentOp(null), undefined);
  assert.equal(getContentOp(""), undefined);
  assert.equal(getContentOp("nope"), undefined);
});

test("resolveOutputArity: identity is a passthrough, diffs are fixed scalar", () => {
  const id = getContentOp("identity")!;
  for (const k of [1, 2, 3, 4]) {
    assert.equal(resolveOutputArity(id, k), k, `identity output arity must equal source arity k=${k}`);
  }
  const signed = getContentOp("signed")!;
  for (const k of [1, 2, 3, 4]) assert.equal(resolveOutputArity(signed, k), 1, "diff gates as scalar regardless of k");
});

test("dispatch ids: identity is 0, direct ops are contiguous, cached ops are unmapped", () => {
  const direct = listDirectContentOps().map((o) => o.id);
  assert.deepEqual(direct, ["identity", ...POINTWISE, ...COMPOSITOR], "direct set == identity + pointwise + compositor");
  assert.equal(CONTENT_OP_ID["identity"], 0, "identity must dispatch to 0 (zero-filled default)");
  assert.equal(contentOpId("identity"), 0);
  assert.equal(contentOpId(undefined), 0, "unknown/undefined → identity fallthrough");
  // Contiguous 0..N over the direct ops; every direct id has a distinct id.
  const ids = direct.map((d) => CONTENT_OP_ID[d]!);
  assert.deepEqual([...ids].sort((a, b) => a - b), direct.map((_, i) => i));
  // Cached ops carry NO dispatch id (they render into a result texture).
  for (const c of CACHED) assert.equal(CONTENT_OP_ID[c], undefined, `${c} is not inline-dispatched`);
});

test("identity cpu twin is a passthrough of source slot A", () => {
  const id = getContentOp("identity")!;
  assert.ok(isDirectContentOp(id));
  assert.deepEqual(id.cpu([[0.25, 0.5, 0.75]], 3), [0.25, 0.5, 0.75]);
  assert.deepEqual(id.cpu([[0.42]], 1), [0.42]);
  assert.deepEqual(id.cpu([[-1, 2.5, 100]], 3), [-1, 2.5, 100]);
});

test("pointwise cpu twins compute the per-channel diff math (readout source of truth)", () => {
  const a = [0.8, 0.5, 0.2];
  const b = [0.3, 0.6, 0.2];
  const get = (opId: string) => {
    const op = getContentOp(opId)!;
    assert.ok(isDirectContentOp(op));
    return op.cpu([a, b], 3);
  };
  const near = (got: number[], exp: number[]) => {
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i]! - exp[i]!) < 1e-9, `${got} !~ ${exp}`);
  };
  near(get("signed"), [0.5, -0.1, 0.0]);
  near(get("absolute"), [0.5, 0.1, 0.0]);
  near(get("squared"), [0.25, 0.01, 0.0]);
  // relative: denom = max(a_i, 1/255).
  near(get("relative_signed"), [0.5 / 0.8, -0.1 / 0.5, 0.0]);
  near(get("relative_absolute"), [0.5 / 0.8, 0.1 / 0.5, 0.0]);
  near(get("relative_squared"), [0.25 / (0.8 * 0.8), 0.01 / (0.5 * 0.5), 0.0]);
});

test("relative diffs guard divide-by-zero with the 1/255 denominator floor", () => {
  const op = getContentOp("relative_signed")!;
  assert.ok(isDirectContentOp(op));
  // a=0 → denom floors to 1/255, so the value is finite (b/-denom), not Infinity.
  const [v] = op.cpu([[0, 0, 0], [0.1, 0, 0]], 3);
  assert.ok(Number.isFinite(v!), "relative diff must not divide by zero");
  assert.ok(Math.abs(v! - (0 - 0.1) / (1 / 255)) < 1e-9);
});
