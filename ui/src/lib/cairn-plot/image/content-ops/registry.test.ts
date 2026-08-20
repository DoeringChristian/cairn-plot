/**
 * Content-op registry SHAPE + identity-twin tests (pure, DOM/GPU-free) — run
 * under Node's built-in runner:
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/image/content-ops/registry.test.ts
 *
 * Guards the Phase-1 invariants the GPU/CPU consumers rely on: exactly the
 * IDENTITY op is registered, its declared shape (source arity / render class /
 * output arity / range / default encoding), the dynamic-output-arity resolution
 * (identity = passthrough), and the identity `cpu` twin is a genuine passthrough.
 * The GPU↔CPU byte parity is byte-pinned by the unchanged engine parity harnesses
 * (identity is a passthrough, so every existing golden still holds); this is the
 * cheap shape gate that runs in plain Node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listContentOps,
  getContentOp,
  resolveOutputArity,
  type RenderClass,
} from "./index.ts";

test("exactly the identity op is registered (Phase 1)", () => {
  const ids = listContentOps().map((o) => o.id);
  assert.deepEqual(ids, ["identity"], `Phase 1 registers only identity, got ${JSON.stringify(ids)}`);
});

test("ids are unique", () => {
  const ids = listContentOps().map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate content-op id");
});

test("identity declares the expected shape", () => {
  const id = getContentOp("identity");
  assert.ok(id, "identity not registered");
  assert.equal(id!.sourceArity, 1);
  assert.equal<RenderClass>(id!.renderClass, "direct");
  assert.equal(id!.outputArity, "source"); // passthrough marker
  assert.equal(id!.outputRange, "light");
  assert.equal(id!.defaultEncoding, "srgb");
  // Identity declares NO toolbar params (split/blend belong to future ops).
  assert.deepEqual(id!.params ?? [], []);
  // Its WGSL is the bare passthrough expression over the sampled source slot.
  assert.equal(id!.wgsl.trim(), "a");
});

test("getContentOp is falsy-safe", () => {
  assert.equal(getContentOp(undefined), undefined);
  assert.equal(getContentOp(null), undefined);
  assert.equal(getContentOp(""), undefined);
  assert.equal(getContentOp("nope"), undefined);
});

test("resolveOutputArity: identity is a passthrough (= source channel count)", () => {
  const id = getContentOp("identity")!;
  for (const k of [1, 2, 3, 4]) {
    assert.equal(resolveOutputArity(id, k), k, `identity output arity must equal source arity k=${k}`);
  }
});

test("identity cpu twin is a passthrough of source slot A", () => {
  const id = getContentOp("identity")!;
  // RGB source: returned unchanged.
  assert.deepEqual(id.cpu([[0.25, 0.5, 0.75]], 3), [0.25, 0.5, 0.75]);
  // Scalar source: the single channel passes through.
  assert.deepEqual(id.cpu([[0.42]], 1), [0.42]);
  // HDR + negative values pass through untouched (no clamp in the content stage).
  assert.deepEqual(id.cpu([[-1, 2.5, 100]], 3), [-1, 2.5, 100]);
  // A second slot (if ever supplied) is ignored by identity (source arity 1).
  assert.deepEqual(id.cpu([[1, 2, 3], [9, 9, 9]], 3), [1, 2, 3]);
});
