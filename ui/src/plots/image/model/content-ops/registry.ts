/**
 * CONTENT-OP REGISTRY — the single source of truth for the CONTENT stage of a
 * pane's frame `display_encode(operation(uv))`. An ImageOperation produces the k-channel
 * value at each texel from 1–2 source SLOTS; the DISPLAY stage (the
 * display-encoding registry — curves / LUTs / reduce / gray-none / output-encode)
 * then maps that content → RGB, UNCHANGED downstream. See
 * `docs/plans/2026-08-20-content-op-unification.md` (the authoritative design)
 * and `docs/plans/2026-08-18-display-encoding-registry.md` (the house pattern
 * this registry mirrors).
 *
 * ## The house pattern (mirrors `image/encodings` + `engine/kernels`)
 * This is the content twin of `image/encodings/registry.ts`: a CORE-SAFE
 * registry that holds, per op, the metadata + (for a `direct` op) a WGSL snippet
 * (a string) + a CPU twin (pure). It pulls NO GPU code — exactly like the
 * encoding registry holds WGSL curve strings without importing the device. The
 * GPU-side consumer (`engine/shaders/image.wgsl.ts`) ASSEMBLES its content
 * function from this registry's WGSL (`./wgsl.ts`); the CPU pane
 * (`renderers/CpuImagePane.tsx`) consumes the `cpu` twin. So the CONTENT stage is
 * declared in exactly one place.
 *
 * ## Phase 2 — the diff ops (this file's discriminated union)
 * The registry now holds three shapes of op:
 *  - IDENTITY — the single-source passthrough (source arity 1, `direct`).
 *  - the six POINTWISE diffs (signed/absolute/squared + their relative variants)
 *    — arity-2 `direct` ops whose WGSL is the raw per-channel diff expression over
 *    the two sampled slots `a`,`b` (migrated from the pointwise `engine/kernels`),
 *    with a pure CPU twin (the single source of truth for the diff pixel-value
 *    readout).
 *  - the three CACHED metrics (FLIP / HDR-FLIP / SSIM) — arity-2 `cached` ops that
 *    DELEGATE to the matching multi-pass `engine/kernels` kernel: its pass graph
 *    builds a result texture through the diff-engine's content-keyed cache, which
 *    the unified pane then binds as a single source + identity display. A
 *    neighborhood metric like FLIP/SSIM has no pure per-texel `(a,b)→value` twin,
 *    so a `cached` op carries `kernelId` (+ the kernel's own CPU reference drives
 *    readout via the result readback) instead of `wgsl`/`cpu`.
 *
 * Every implementation uses one ImageOperation interface. Inline operations
 * contribute CPU/WGSL twins; multipass operations prepare an intermediate field.
 * Cache policy is independent metadata on the operation.
 */

/**
 * Render class of a content op:
 *  - `direct`: inlined into the display shader — a few ALU ops on 1–2 sampled
 *    texels, per frame (no cache; divider drag is free). Its
 *    an inline implementation's WGSL is an expression over the sampled slots.
 *  - `cached`: a multi-pass compute into a result texture keyed by (source keys,
 *    op id, params) the display shader samples (zoom/encoding never recompute).
 *    A `cached` op DELEGATES to a multi-pass `engine/kernels` kernel
 *    (its multipass implementation); the diff-engine's content-keyed cache
 *    owns the result texture.
 */
export type RenderClass = "direct" | "cached";

/**
 * The value range the op's output carries, gating the DISPLAY stage exactly as
 * the source arity used to: `R+` (a magnitude — sequential colormaps), `R` (a
 * signed error — diverging colormaps), `light` (ordinary scene light — curves).
 * Identity is `light` (an identity image is displayed as light); the perceptual
 * metrics (FLIP/SSIM) are `R+` (a non-negative error → sequential magma).
 */
export type OutputRange = "R+" | "R" | "light";

/**
 * DYNAMIC OUTPUT ARITY (the identity decision, documented). The k the DISPLAY
 * stage's arity-GATING sees is either a FIXED number (a scalar error gates as
 * k=1 — colormaps offered, defaultEncoding applied; split gates as k=3 —
 * curves) OR the marker `"source"` — a PASSTHROUGH whose output arity equals the
 * source channel count. Identity is `"source"`: an RGB source stays k=3, a scalar
 * source stays k=1. Resolve it against a concrete source arity with
 * {@link resolveOutputArity}. NOTE this gates which display encodings are OFFERED;
 * a pointwise diff still physically carries a per-channel error vec4 (the raw
 * channels drive the TEV readout), which the display stage REDUCES to the scalar
 * the colormap indexes — outputArity 1 is the diff's DISPLAY-GATING arity.
 */
export type OutputArity = number | "source";

/**
 * Named parameters a content op may DECLARE it reads (its toolbar-row manifest,
 * UI-gating only). Phase 1/2 diff ops declare NONE. The Phase-3 COMPOSITOR op
 * declares `split` (the divider position) — the single per-frame scalar it reads
 * from the compositor param uniform (`u_bind13.x`), driven live (divider drag)
 * with NO shader recompile.
 */
export type ContentParamName = "split";

/**
 * The per-frame context an inline operation's CPU twin reads
 * beyond the sampled slots — the CPU mirror of the extra shader inputs
 * `cairnContent(a, b, uv, param, opId)` passes. Only the Phase-3 COMPOSITOR op
 * (split) reads it; the identity + diff twins ignore it (so their twins keep
 * the plain `(sources, k)` shape). `uv` is the fragment's SCREEN-space uv (the
 * split divider is a dest-space cut, exactly like the GPU `uv.x < param`); `param`
 * is the compositor scalar (divider position for split).
 */
export interface ImageOperationCpuContext {
  /** Fragment SCREEN-space uv (dest space) — the divider test reads `uv[0]`. */
  readonly uv: readonly [number, number];
  /** The compositor scalar (`u_bind13.x`): the split divider position. */
  readonly param: number;
}

/**
 * React contributions the ONE pane shell renders for an op (Phase 3+). Kept in
 * the interface so the shape is fixed (metrics chips / per-side captions / a
 * divider gesture controller are the known future members).
 */
export interface ImageOperationChrome {
  metrics?: unknown;
  captions?: unknown;
  gesture?: unknown;
}

/** One source-to-field operation. The operation owns its implementation and
 * cache policy; callers never select a separate kernel registry. */
export interface ImageOperation {
  /** Stable id (`"identity"` | `"signed"` | … | `"flip"` | `"ssim"`). */
  id: string;
  /** Menu label. */
  label: string;
  /** Optional short public selector used by descriptor builders. */
  publicName?: string;
  /** Number of source SLOTS the op reads (1 = single image; 2 = a comparison). */
  inputCount: 1 | 2;
  /** Expensive field operations opt into the global result cache. Cheap
   * pointwise operations use the same pipeline with no cached intermediate. */
  cachePolicy: import("../../pipeline/contracts.ts").FieldCachePolicy;
  /** k fed to the DISPLAY stage's arity gating — a fixed number, or `"source"`
   *  (passthrough = source channel count). See {@link OutputArity} +
   *  {@link resolveOutputArity}. */
  outputArity: OutputArity;
  /** The op output's value range (gates the DISPLAY stage). */
  outputRange: OutputRange;
  /** Param MANIFEST — which named params this op reads (toolbar-row gating). */
  params?: ContentParamName[];
  /** React contributions the pane shell renders (Phase 3+). */
  chrome?: ImageOperationChrome;
  implementation:
    | {
        kind: "inline";
        wgsl: string;
        cpu(sources: readonly (readonly number[])[], k: number, ctx?: ImageOperationCpuContext): number[];
      }
    | {
        kind: "multipass";
      } & import("../../engine/operation-pass.ts").MultipassImageOperationProgram;
}

export type InlineImageOperation = ImageOperation & {
  implementation: Extract<ImageOperation["implementation"], { kind: "inline" }>;
};
export type MultipassImageOperation = ImageOperation & {
  implementation: Extract<ImageOperation["implementation"], { kind: "multipass" }>;
};

export function isInlineImageOperation(op: ImageOperation): op is InlineImageOperation {
  return op.implementation.kind === "inline";
}

export function isMultipassImageOperation(op: ImageOperation): op is MultipassImageOperation {
  return op.implementation.kind === "multipass";
}

/**
 * Resolve a content op's DYNAMIC output arity against a concrete source arity:
 * the `"source"` passthrough marker → `sourceArity`; a fixed number → itself.
 * ONE predicate so the panes + the DISPLAY-stage arity gating agree on the k the
 * content produces.
 */
export function resolveOutputArity(op: ImageOperation, sourceArity: number): number {
  return op.outputArity === "source" ? sourceArity : op.outputArity;
}

const REGISTRY = new Map<string, ImageOperation>();

export function registerImageOperation(op: ImageOperation): void {
  if (REGISTRY.has(op.id)) {
    throw new Error(`registerImageOperation: duplicate operation id "${op.id}"`);
  }
  REGISTRY.set(op.id, op);
}

export function getImageOperation(id: string | undefined | null): ImageOperation | undefined {
  if (!id) return undefined;
  return REGISTRY.get(id);
}

/** All registered content ops, in registration order. */
export function listImageOperations(): ImageOperation[] {
  return Array.from(REGISTRY.values());
}

/** The `direct` content ops only, in registration order — the set the display
 *  shader assembles into `cairnContent`'s opId dispatch (`./wgsl.ts`). */
export function listInlineImageOperations(): InlineImageOperation[] {
  return listImageOperations().filter(isInlineImageOperation);
}

export function listMultipassImageOperations(): MultipassImageOperation[] {
  return listImageOperations().filter(isMultipassImageOperation);
}

export function getMultipassImageOperation(id: string): MultipassImageOperation | undefined {
  const operation = getImageOperation(id);
  return operation && isMultipassImageOperation(operation) ? operation : undefined;
}

export function resolveImageOperationParams(
  operation: MultipassImageOperation,
  params?: Record<string, number>,
): Record<string, number> {
  return { ...(operation.implementation.params ?? {}), ...(params ?? {}) };
}
