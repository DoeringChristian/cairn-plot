/**
 * GPU-side ASSEMBLY of the curve-encoding registry into WGSL — the encoding
 * twin of how `engine/diff-engine.ts` composes a kernel's `source` into a
 * pipeline. Pure string building (CORE-SAFE, no device); the shader modules
 * (`engine/shaders/image.wgsl.ts`, `engine/kernels/prelude.wgsl.ts`) interpolate
 * the result into their template.
 *
 * ## One curve FAMILY, one pipeline (per the design)
 * All curve operators share ONE cached pipeline and are selected at render time
 * by the `operatorId` uniform (`u_bind2.y`) — NOT a per-operator pipeline. A
 * slider drag only updates uniforms, so the pipeline never recompiles. This
 * assembler therefore emits ONE `applyOperator` dispatch covering every entry
 * (each entry's `wgsl` expression inlined into its `operatorId` branch), plus the
 * shared curve helper fns — reproducing the pre-registry `applyOperator` exactly.
 */
import { listEncodings } from "./registry.ts";
import { CURVE_HELPER_FNS_WGSL, DEFAULT_CLAMP_WGSL } from "./curves.ts";

/** The curve helper fns (`reinhardCurve`/`acesCurve`/`extended*Curve`) — emit
 *  ONCE, before `buildApplyOperatorWGSL`, so entry `wgsl` expressions can call
 *  them. Exported under this name for the shader modules that want the helpers
 *  and dispatch as separate strings. */
export const CURVE_HELPERS_WGSL = CURVE_HELPER_FNS_WGSL;

export interface ApplyOperatorOptions {
  /** Emit `kind:"remap"` entries (the `normal` remap). The single-image path
   *  passes `true`; the compose (split/blend) path passes `false` to preserve
   *  its pre-registry behavior (operatorId 9 fell through to the default clamp
   *  there). */
  remaps: boolean;
}

/**
 * Assemble `fn applyOperator(rgb, operatorId, peak) -> vec3<f32>` from the
 * registry: one `if (operatorId == N) { return <expr>; }` per entry whose curve
 * differs from the default clamp (`linear`/`srgb`/`gamma` ARE the default, so
 * they emit no branch and fall through). Branches are ordered by `operatorId`
 * for readability; the ids are mutually exclusive so order is irrelevant to
 * behavior. Requires {@link CURVE_HELPERS_WGSL} earlier in the module.
 */
export function buildApplyOperatorWGSL(opts: ApplyOperatorOptions): string {
  const entries = listEncodings()
    .filter((e) => e.kind !== "lut") // curves + remaps only (Phase 1)
    .filter((e) => opts.remaps || e.kind !== "remap")
    .filter((e) => e.wgsl.trim() !== DEFAULT_CLAMP_WGSL) // default-clamp entries fall through
    .slice()
    .sort((a, b) => a.operatorId - b.operatorId);

  const branches = entries
    .map((e) => `  if (operatorId == ${e.operatorId}) { return ${e.wgsl}; }`)
    .join("\n");

  return `fn applyOperator(rgb: vec3<f32>, operatorId: i32, peak: f32) -> vec3<f32> {
${branches}
  return ${DEFAULT_CLAMP_WGSL};
}`;
}

/** The full curve WGSL block: helper fns + the assembled `applyOperator`. The
 *  single value both shader modules interpolate in place of their old hand-written
 *  curve helpers + `applyOperator`. */
export function buildTonemapCurvesWGSL(opts: ApplyOperatorOptions): string {
  return `${CURVE_HELPERS_WGSL}
${buildApplyOperatorWGSL(opts)}`;
}
