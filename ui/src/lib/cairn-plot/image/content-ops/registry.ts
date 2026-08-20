/**
 * CONTENT-OP REGISTRY (Phase 1 — identity) — the single source of truth for the
 * CONTENT stage of a pane's frame `display_encode(content(uv))`. A ContentOp
 * produces the k-channel value at each texel from 1–2 source SLOTS; the DISPLAY
 * stage (the display-encoding registry — curves / LUTs / reduce / gray-none /
 * output-encode) then maps that content → RGB, UNCHANGED downstream. See
 * `docs/plans/2026-08-20-content-op-unification.md` (the authoritative design)
 * and `docs/plans/2026-08-18-display-encoding-registry.md` (the house pattern
 * this registry mirrors).
 *
 * ## The house pattern (mirrors `image/encodings` + `engine/kernels`)
 * This is the content twin of `image/encodings/registry.ts`: a CORE-SAFE
 * registry that holds, per op, the metadata + a WGSL snippet (a string) + a CPU
 * twin (pure). It pulls NO GPU code — exactly like the encoding registry holds
 * WGSL curve strings without importing the device. The GPU-side consumer
 * (`engine/shaders/image.wgsl.ts`) ASSEMBLES its content function from this
 * registry's WGSL (`./wgsl.ts`); the CPU pane (`renderers/CpuImagePane.tsx`)
 * consumes the `cpu` twin. So the CONTENT stage is declared in exactly one place.
 *
 * ## Phase 1 scope (behavior-identical)
 * Only the IDENTITY op is registered (source arity 1, render class "direct",
 * output arity = source channel count). Its `wgsl`/`cpu` are a PASSTHROUGH of the
 * single sampled source — i.e. "where the source sample enters the display
 * pipeline" — so routing the panes' content through it is byte-for-byte the
 * pre-registry behavior. The `direct` diff ops (signed/absolute/…) and the
 * `cached` ops (FLIP/SSIM) are scheduled for later phases and are NOT modeled
 * here beyond the interface shape (per the design's "don't over-abstract for ops
 * that don't exist yet").
 */

/**
 * Render class of a content op:
 *  - `direct`: inlined into the display shader — a few ALU ops on 1–2 sampled
 *    texels, per frame (no cache; divider drag / blend slider are free). Its
 *    {@link ContentOp.wgsl} is a WGSL EXPRESSION.
 *  - `cached`: a multi-pass compute into a result texture keyed by (source keys,
 *    op id, params) the display shader samples (zoom/encoding never recompute).
 *    Phase 2+ — its `wgsl` will become a pass-graph builder (a discriminated
 *    union, like `engine/kernels`' PointwiseKernel vs MultipassKernel); Phase 1
 *    has no cached op, so the interface keeps `wgsl` a string and documents the
 *    forward shape rather than abstracting it prematurely.
 */
export type RenderClass = "direct" | "cached";

/**
 * The value range the op's output carries, gating the DISPLAY stage exactly as
 * the source arity used to: `R+` (a magnitude — sequential colormaps), `R` (a
 * signed error — diverging colormaps), `light` (ordinary scene light — curves).
 * Identity is `light` (an identity image is displayed as light).
 */
export type OutputRange = "R+" | "R" | "light";

/**
 * DYNAMIC OUTPUT ARITY (the identity decision, documented). The k the DISPLAY
 * stage sees is either a FIXED number (a scalar error is always k=1; split/blend
 * are always k=3) OR the marker `"source"` — a PASSTHROUGH whose output arity
 * equals the source channel count. Identity is `"source"`: an RGB source stays
 * k=3, a scalar source stays k=1. Resolve it against a concrete source arity with
 * {@link resolveOutputArity}. (Chosen over a `(sourceArity) => number` function:
 * a marker is declarative, serializable, and honest — identity is the ONLY
 * passthrough op, so a full function would be over-abstraction.)
 */
export type OutputArity = number | "source";

/**
 * Named parameters a content op may DECLARE it reads (its toolbar-row manifest,
 * UI-gating only). Phase 1 identity declares NONE. Future compositor ops add
 * `split`/`blend`; future cached ops add kernel params — declared here when they
 * land, not before.
 */
export type ContentParamName = "split" | "blend";

/**
 * React contributions the ONE pane shell renders for an op (Phase 3+). Identity
 * declares none; kept in the interface so the shape is fixed (metrics chips /
 * per-side captions / a divider gesture controller are the known future members).
 */
export interface ContentOpChrome {
  metrics?: unknown;
  captions?: unknown;
  gesture?: unknown;
}

/**
 * A single content op — the CPU twin (`cpu`) and its WGSL twin (`wgsl`) live on
 * ONE object so the seam is mechanical (assemble the shader from `wgsl`, run the
 * CPU pane through `cpu`).
 */
export interface ContentOp {
  /** Stable id (Phase 1: `"identity"`). */
  id: string;
  /** Menu label. */
  label: string;
  /** Number of source SLOTS the op reads (1 = single image; 2 = a comparison). */
  sourceArity: 1 | 2;
  /** `direct` (inline in the display shader) or `cached` (result texture). */
  renderClass: RenderClass;
  /** k fed to the DISPLAY stage — a fixed number, or `"source"` (passthrough =
   *  source channel count). See {@link OutputArity} + {@link resolveOutputArity}. */
  outputArity: OutputArity;
  /** The op output's value range (gates the DISPLAY stage). */
  outputRange: OutputRange;
  /** The DISPLAY encoding applied by default (a display-encoding registry id):
   *  identity→`srgb` (generalizes the per-kernel defaults abs→turbo, signed→
   *  red-green, FLIP/SSIM→magma that later phases wire in). */
  defaultEncoding: string;
  /** Param MANIFEST — which named params this op reads (toolbar-row gating).
   *  Identity: none. */
  params?: ContentParamName[];
  /**
   * WGSL — for a `direct` op, an EXPRESSION over the sampled source slot(s):
   * `a` (and `b` for arity 2), each `vec4<f32>`, evaluating to the content
   * `vec4<f32>`. Assembled into `cairnContent` by `./wgsl.ts`. Identity is `a`
   * (the passthrough — the source sample enters the display pipeline here).
   * (A `cached` op's builder-shaped WGSL is Phase 2 — see {@link RenderClass}.)
   */
  wgsl: string;
  /**
   * CPU twin of `wgsl` — collapse the sampled source slot channel-vectors
   * (`sources[0]` = slot A, `sources[1]` = slot B) into the content channel
   * vector, for a `k`-channel source. Identity returns `sources[0]` unchanged
   * (the passthrough; `k` is irrelevant to it).
   */
  cpu(sources: readonly (readonly number[])[], k: number): number[];
  /** React contributions the pane shell renders (Phase 3+). Identity: none. */
  chrome?: ContentOpChrome;
}

/**
 * Resolve a content op's DYNAMIC output arity against a concrete source arity:
 * the `"source"` passthrough marker → `sourceArity`; a fixed number → itself.
 * ONE predicate so the panes + the DISPLAY-stage arity gating agree on the k the
 * content produces.
 */
export function resolveOutputArity(op: ContentOp, sourceArity: number): number {
  return op.outputArity === "source" ? sourceArity : op.outputArity;
}

const REGISTRY = new Map<string, ContentOp>();

export function registerContentOp(op: ContentOp): void {
  if (REGISTRY.has(op.id)) {
    throw new Error(`registerContentOp: duplicate content-op id "${op.id}"`);
  }
  REGISTRY.set(op.id, op);
}

export function getContentOp(id: string | undefined | null): ContentOp | undefined {
  if (!id) return undefined;
  return REGISTRY.get(id);
}

/** All registered content ops, in registration order. */
export function listContentOps(): ContentOp[] {
  return Array.from(REGISTRY.values());
}
