/**
 * GPU-side ASSEMBLY of the content-op registry into WGSL — the content twin of
 * `image/encodings/wgsl.ts`. Pure string building (CORE-SAFE, no device); the
 * image shader (`engine/shaders/image.wgsl.ts`) interpolates the result and
 * calls `cairnContent(sampled)` so the CONTENT stage is consumed THROUGH the
 * registry (identity's snippet is where the source sample enters the pipeline).
 */
import { getContentOp } from "./registry.ts";

/**
 * Assemble `fn cairnContent(a: vec4<f32>) -> vec4<f32>` from the registry.
 *
 * Phase 1: IDENTITY is the sole (direct, source-arity-1) content op, so the
 * function body is simply its WGSL expression over the single sampled source
 * slot `a` (identity = `a`, the passthrough). No dispatch and no new uniform is
 * emitted — there is exactly one op — so the shader is byte-for-byte the
 * pre-registry sample path.
 *
 * Forward (Phase 2+): a second sampled slot `b: vec4<f32>` and a `contentOpId`
 * uniform dispatch (`if (opId == N) { return <expr>; }` per direct op, mirroring
 * `buildApplyOperatorWGSL`) land when the diff/compositor ops arrive; cached ops
 * assemble a pass graph instead. None of that is emitted now.
 */
export function buildContentOpWGSL(): string {
  const identity = getContentOp("identity");
  if (!identity) {
    throw new Error("buildContentOpWGSL: the 'identity' content op is not registered");
  }
  return `fn cairnContent(a: vec4<f32>) -> vec4<f32> {
  return ${identity.wgsl};
}`;
}
