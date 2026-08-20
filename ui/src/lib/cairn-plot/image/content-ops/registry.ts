/**
 * CONTENT-OP REGISTRY — the single source of truth for the CONTENT stage of a
 * pane's frame `display_encode(content(uv))`. A ContentOp produces the k-channel
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
 * The discriminated union (`DirectContentOp` | `CachedContentOp`) is the shape the
 * Phase-1 note deferred ("cached op = pass builder → a discriminated union, like
 * `engine/kernels`' Pointwise/Multipass"). `direct` ops are inlined into the
 * display shader (an opId dispatch, mirroring `buildApplyOperatorWGSL`); `cached`
 * ops render into a result texture the display shader samples.
 */

/**
 * Render class of a content op:
 *  - `direct`: inlined into the display shader — a few ALU ops on 1–2 sampled
 *    texels, per frame (no cache; divider drag / blend slider are free). Its
 *    {@link DirectContentOp.wgsl} is a WGSL EXPRESSION over the sampled slots.
 *  - `cached`: a multi-pass compute into a result texture keyed by (source keys,
 *    op id, params) the display shader samples (zoom/encoding never recompute).
 *    A `cached` op DELEGATES to a multi-pass `engine/kernels` kernel
 *    ({@link CachedContentOp.kernelId}); the diff-engine's content-keyed cache
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
 * k=1 — colormaps offered, defaultEncoding applied; split/blend gate as k=3 —
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
 * UI-gating only). Phase 1/2 ops declare NONE. Future compositor ops add
 * `split`/`blend` — declared here when they land, not before.
 */
export type ContentParamName = "split" | "blend";

/**
 * React contributions the ONE pane shell renders for an op (Phase 3+). Kept in
 * the interface so the shape is fixed (metrics chips / per-side captions / a
 * divider gesture controller are the known future members).
 */
export interface ContentOpChrome {
  metrics?: unknown;
  captions?: unknown;
  gesture?: unknown;
}

/** The shared metadata every content op declares (both render classes). */
interface ContentOpBase {
  /** Stable id (`"identity"` | `"signed"` | … | `"flip"` | `"ssim"`). */
  id: string;
  /** Menu label. */
  label: string;
  /** Number of source SLOTS the op reads (1 = single image; 2 = a comparison). */
  sourceArity: 1 | 2;
  /** k fed to the DISPLAY stage's arity gating — a fixed number, or `"source"`
   *  (passthrough = source channel count). See {@link OutputArity} +
   *  {@link resolveOutputArity}. */
  outputArity: OutputArity;
  /** The op output's value range (gates the DISPLAY stage). */
  outputRange: OutputRange;
  /** The DISPLAY encoding applied by default (a display-encoding registry id):
   *  identity→`srgb`; abs/squared/relative→`turbo`; signed/relative-signed→
   *  `red-green`; FLIP/HDR-FLIP/SSIM→`magma`. Generalizes the per-kernel default
   *  colormaps (`engine/kernels`' `defaultColormap`). */
  defaultEncoding: string;
  /** Param MANIFEST — which named params this op reads (toolbar-row gating). */
  params?: ContentParamName[];
  /** React contributions the pane shell renders (Phase 3+). */
  chrome?: ContentOpChrome;
}

/**
 * A `direct` content op — the CPU twin (`cpu`) and its WGSL twin (`wgsl`) live on
 * ONE object so the seam is mechanical (assemble the shader dispatch from `wgsl`,
 * run the CPU pane through `cpu`).
 */
export interface DirectContentOp extends ContentOpBase {
  renderClass: "direct";
  /**
   * WGSL — an EXPRESSION over the sampled source slot(s): `a` (and `b` for arity
   * 2), each `vec4<f32>`, evaluating to the content `vec4<f32>`. Assembled into
   * `cairnContent`'s opId dispatch by `./wgsl.ts`. Identity is `a` (the
   * passthrough); a pointwise diff is e.g. `vec4<f32>(a.rgb - b.rgb, 1.0)`.
   */
  wgsl: string;
  /**
   * CPU twin of `wgsl` — collapse the sampled source slot channel-vectors
   * (`sources[0]` = slot A, `sources[1]` = slot B) into the content channel
   * vector, for a `k`-channel source. Identity returns `sources[0]` unchanged; a
   * pointwise diff returns the per-channel raw error (the diff pixel-value
   * readout's single source of truth).
   */
  cpu(sources: readonly (readonly number[])[], k: number): number[];
}

/**
 * A `cached` content op — a neighborhood metric (FLIP/SSIM) with no pure
 * per-texel twin. It DELEGATES to a multi-pass `engine/kernels` kernel: the
 * diff-engine's `ensureDiff` runs {@link kernelId}'s pass graph into a
 * content-keyed result texture the unified pane binds as a single source +
 * identity display. Per-pixel readout reads that result texture back (the
 * kernel's own CPU reference is the parity twin), not an inline `cpu`.
 */
export interface CachedContentOp extends ContentOpBase {
  renderClass: "cached";
  /** The `engine/kernels` multipass kernel id this op delegates to
   *  (`flip` | `hdr-flip` | `ssim`). The diff-engine cache owns the result. */
  kernelId: string;
}

/** A content op — a `direct` (inline-WGSL) or `cached` (result-texture) op. */
export type ContentOp = DirectContentOp | CachedContentOp;

/** Type guard: narrows a {@link ContentOp} to its `direct` shape (has `wgsl`/`cpu`). */
export function isDirectContentOp(op: ContentOp): op is DirectContentOp {
  return op.renderClass === "direct";
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

/** The `direct` content ops only, in registration order — the set the display
 *  shader assembles into `cairnContent`'s opId dispatch (`./wgsl.ts`). */
export function listDirectContentOps(): DirectContentOp[] {
  return listContentOps().filter(isDirectContentOp);
}
