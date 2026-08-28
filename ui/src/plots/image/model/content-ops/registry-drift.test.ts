/**
 * Content-op REGISTRY ⟷ SHADER drift guard — pure Node, no GPU/DOM:
 *   node --experimental-strip-types --test \
 *     src/plots/image/model/content-ops/registry-drift.test.ts
 *
 * The content-op registry (`image/content-ops`) is the SINGLE SOURCE OF TRUTH for
 * the CONTENT stage. Unlike the display-operation drift guard (which pins TS↔Python
 * enum echoes), content ops have no cross-language mirror — the surface that could
 * DRIFT is the GPU shader, which must ASSEMBLE its content function from the
 * registry rather than hand-inline the source-sample-to-content path. This test
 * proves that seam: the image shader interpolates `buildContentOpWGSL()` verbatim
 * and routes the two sampled slots through the assembled `cairnContent(a, b, opId)`,
 * so the op set is declared in exactly one place.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentOpWGSL, getImageOperation, listInlineImageOperations, CONTENT_OP_ID } from "./index.ts";
import { imageWGSL } from "../../engine/shaders/image.wgsl.ts";
import { IMAGE_OPERATIONS } from "./ops.ts";
import { DEFAULT_COMPARISON_DISPLAY_OPERATION_ID } from "../display-operations/index.ts";

test("the image shader interpolates the registry-assembled content function", () => {
  const assembled = buildContentOpWGSL();
  assert.ok(
    imageWGSL.includes(assembled),
    "image.wgsl must interpolate buildContentOpWGSL() verbatim — the content stage is assembled from the registry, not hand-written",
  );
});

test("the image shader consumes cairnContent(a, b, uv, param, opId) at the content seam", () => {
  // The two sampled slots + the fragment uv + the compositor param enter the
  // display pipeline THROUGH the assembled function.
  assert.ok(
    imageWGSL.includes("cairnContent(sampled, sampledB, uv, u_bind13, contentOpId)"),
    "image.wgsl must route both sampled slots + the fragment uv + the compositor param + the op id through cairnContent(...)",
  );
});

test("the image shader binds the second source slot + the content-op id + compositor param uniforms", () => {
  assert.ok(imageWGSL.includes("t_bind11"), "image.wgsl must declare the second source texture (t_bind11)");
  assert.ok(imageWGSL.includes("u_bind12"), "image.wgsl must declare the contentOpId uniform (u_bind12)");
  assert.ok(imageWGSL.includes("u_bind13"), "image.wgsl must declare the compositor param uniform (u_bind13)");
});

test("the assembled dispatch has identity as the fallthrough + a branch per non-identity direct op", () => {
  const identity = getImageOperation("identity")!;
  assert.equal(identity.implementation.kind, "inline");
  const assembled = buildContentOpWGSL();
  assert.ok(
    assembled.startsWith(
      "fn cairnContent(a: vec4<f32>, b: vec4<f32>, uv: vec2<f32>, param: vec4<f32>, opId: i32) -> vec4<f32>",
    ),
  );
  // Identity is the fallthrough (opId 0 / any unmatched id → return a).
  assert.ok(identity.implementation.kind === "inline");
  assert.ok(assembled.trimEnd().endsWith(`return ${identity.implementation.wgsl};\n}`));
  // Every non-identity direct op emits its own `if (opId == N)` branch.
  for (const op of listInlineImageOperations()) {
    if (op.id === "identity") continue;
    assert.ok(
      assembled.includes(`if (opId == ${CONTENT_OP_ID[op.id]}) { return ${op.implementation.wgsl}; }`),
      `dispatch branch missing for ${op.id}`,
    );
  }
});

test("comparison display policy is independent from image operations", () => {
  const diffOps = IMAGE_OPERATIONS.filter((op) => op.inputCount === 2 && op.outputArity === 1);
  assert.ok(diffOps.length >= 10, `expected the 6 pointwise + 4 multipass diff ops, got ${diffOps.length}`);
  for (const op of diffOps) {
    assert.ok(op.implementation.kind === "inline" || op.implementation.kind === "multipass");
  }
  assert.equal(DEFAULT_COMPARISON_DISPLAY_OPERATION_ID, "linear");
});

test("identity and split remain ordinary image operations", () => {
  for (const id of ["identity", "split"]) {
    const op = getImageOperation(id)!;
    assert.ok(op);
  }
});

test("cached ops are NOT inlined into the content dispatch (they render a result texture)", () => {
  const assembled = buildContentOpWGSL();
  for (const id of ["flip", "hdr-flip", "ssim"]) {
    // No dispatch id → no branch. (operationId strings never appear in the shader.)
    assert.equal(CONTENT_OP_ID[id], undefined);
    assert.ok(!assembled.includes(`"${id}"`));
  }
});
