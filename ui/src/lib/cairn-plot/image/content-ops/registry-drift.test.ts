/**
 * Content-op REGISTRY ⟷ SHADER drift guard — pure Node, no GPU/DOM:
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/image/content-ops/registry-drift.test.ts
 *
 * The content-op registry (`image/content-ops`) is the SINGLE SOURCE OF TRUTH for
 * the CONTENT stage. Unlike the display-encoding drift guard (which pins TS↔Python
 * enum echoes), content ops have no cross-language mirror — the surface that could
 * DRIFT is the GPU shader, which must ASSEMBLE its content function from the
 * registry rather than hand-inline the source-sample-to-content path. This test
 * proves that seam: the image shader interpolates `buildContentOpWGSL()` verbatim
 * and routes the two sampled slots through the assembled `cairnContent(a, b, opId)`,
 * so the op set is declared in exactly one place.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentOpWGSL, getContentOp, listDirectContentOps, CONTENT_OP_ID } from "./index.ts";
import { imageWGSL } from "../../../../plots/image/engine/shaders/image.wgsl.ts";
import { CONTENT_OPS } from "./ops.ts";
import type { CachedContentOp } from "./registry.ts";
import { DEFAULT_DIFF_COLORMAP, getDiffKernel } from "../../../../plots/image/engine/kernels/index.ts";

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
  const identity = getContentOp("identity")!;
  assert.equal(identity.renderClass, "direct");
  const assembled = buildContentOpWGSL();
  assert.ok(
    assembled.startsWith(
      "fn cairnContent(a: vec4<f32>, b: vec4<f32>, uv: vec2<f32>, param: vec4<f32>, opId: i32) -> vec4<f32>",
    ),
  );
  // Identity is the fallthrough (opId 0 / any unmatched id → return a).
  assert.ok(assembled.trimEnd().endsWith(`return ${(identity as { wgsl: string }).wgsl};\n}`));
  // Every non-identity direct op emits its own `if (opId == N)` branch.
  for (const op of listDirectContentOps()) {
    if (op.id === "identity") continue;
    assert.ok(
      assembled.includes(`if (opId == ${CONTENT_OP_ID[op.id]}) { return ${op.wgsl}; }`),
      `dispatch branch missing for ${op.id}`,
    );
  }
});

test("D2 drift: every diff op uses the single shared diff default", () => {
  const diffOps = CONTENT_OPS.filter((op) => op.sourceArity === 2 && op.outputArity === 1);
  assert.ok(diffOps.length >= 9, `expected the 6 pointwise + 3 cached diff ops, got ${diffOps.length}`);
  for (const op of diffOps) {
    // pointwise: op.id IS the kernel id; cached: op.kernelId.
    const kernelId = op.renderClass === "cached" ? (op as CachedContentOp).kernelId : op.id;
    const kernel = getDiffKernel(kernelId);
    assert.ok(kernel, `diff op "${op.id}" must map to a registered kernel "${kernelId}"`);
    assert.equal(op.defaultEncoding, DEFAULT_DIFF_COLORMAP);
  }
});

test("D2: compositor/identity ops keep a NON-kernel literal encoding (no kernel default to derive)", () => {
  // identity + split have no kernel — their `defaultEncoding` is a legitimate
  // standalone literal (srgb), NOT part of the derived diff subset.
  for (const id of ["identity", "split"]) {
    const op = getContentOp(id)!;
    assert.equal(op.defaultEncoding, "srgb", `${id} should keep its literal srgb encoding`);
    assert.equal(getDiffKernel(id), undefined, `${id} must not be a diff kernel`);
  }
});

test("cached ops are NOT inlined into the content dispatch (they render a result texture)", () => {
  const assembled = buildContentOpWGSL();
  for (const id of ["flip", "hdr-flip", "ssim"]) {
    // No dispatch id → no branch. (kernelId strings never appear in the shader.)
    assert.equal(CONTENT_OP_ID[id], undefined);
    assert.ok(!assembled.includes(`"${id}"`));
  }
});
