/**
 * Content-op REGISTRY ⟷ SHADER drift guard (Phase 1) — pure Node, no GPU/DOM:
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/image/content-ops/registry-drift.test.ts
 *
 * The content-op registry (`image/content-ops`) is the SINGLE SOURCE OF TRUTH for
 * the CONTENT stage. Unlike the display-encoding drift guard (which pins TS↔Python
 * enum echoes), content ops have no cross-language mirror — the surface that could
 * DRIFT is the GPU shader, which must ASSEMBLE its content function from the
 * registry rather than hand-inline a source-sample-to-content path. This test
 * proves that seam: the image shader interpolates `buildContentOpWGSL()` verbatim
 * and routes the sampled source through the assembled `cairnContent`, so the op
 * is declared in exactly one place. To change the content stage you touch the
 * registry; this test then fails if the shader stops consuming it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentOpWGSL, getContentOp, listContentOps } from "./index.ts";
import { imageWGSL } from "../../engine/shaders/image.wgsl.ts";

test("the image shader interpolates the registry-assembled content function", () => {
  const assembled = buildContentOpWGSL();
  assert.ok(
    imageWGSL.includes(assembled),
    "image.wgsl must interpolate buildContentOpWGSL() verbatim — the content stage is assembled from the registry, not hand-written",
  );
});

test("the image shader consumes cairnContent at the content seam", () => {
  // The sampled source enters the display pipeline THROUGH the assembled function.
  assert.ok(
    imageWGSL.includes("cairnContent(sampled)"),
    "image.wgsl must route the sampled source through cairnContent(...)",
  );
});

test("the assembled content function is identity's declared WGSL, not a literal", () => {
  const identity = getContentOp("identity")!;
  const assembled = buildContentOpWGSL();
  // The function body is the registry entry's own `wgsl` expression (passthrough).
  assert.ok(assembled.includes(`return ${identity.wgsl};`));
  assert.ok(assembled.startsWith("fn cairnContent(a: vec4<f32>) -> vec4<f32>"));
});

test("Phase 1 declares exactly one content op (no scattered op declarations)", () => {
  assert.deepEqual(listContentOps().map((o) => o.id), ["identity"]);
});
