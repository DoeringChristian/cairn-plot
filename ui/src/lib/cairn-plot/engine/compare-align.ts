/**
 * Compare alignment + fit mapping (pure, no GPU) — the single source of truth
 * for how two mismatched-size compare operands are laid over a common RESULT
 * grid in a diff kernel. Consumed by the diff compute path (`diff-engine.ts` /
 * the FLIP front-end passes — as integer texel offsets / normalized-uv scaling),
 * by the metrics reduction (`image-engine.ts`'s `computeMetrics`), and by the
 * pane's framing/overlay (`GpuComparePane`). Because it is one pure function,
 * the displayed diff, the TEV per-pixel numbers and the MSE/PSNR/MAE scalars are
 * guaranteed to share ONE mapping.
 *
 * ## Semantics (exact)
 * Let A = (aw, ah), B = (bw, bh) be the two source dimensions and `primary` the
 * foreground operand whose resolution drives the pane.
 *
 *   fit "crop" (default): the RESULT grid is the intersection
 *     `(min(aw,bw), min(ah,bh))`. Under the chosen `align` anchor the smaller
 *     extent sits inside the larger; the overlap is that intersection. For a
 *     RESULT pixel `q`, source S is sampled at the INTEGER texel `q + offsetS`,
 *     where `offsetS` is the top-left of the overlap within S:
 *       left/top    → 0
 *       right/bottom→ (Sdim - resultDim)
 *       center      → floor((Sdim - resultDim) / 2)
 *     (For the smaller source along an axis `Sdim == resultDim`, so its offset is
 *     0 — the smaller extent is what sits inside the larger.) `align:"top-left"`
 *     ⇒ both offsets 0 (the legacy min-crop behavior).
 *
 *   fit "fill": the RESULT grid is the PRIMARY's resolution. `align` is
 *     IRRELEVANT. Both offsets are 0; each source is instead sampled through
 *     normalized uv `(q + 0.5) / result` over its FULL extent (bilinear rescale
 *     to the common grid). The primary maps 1:1 (its uv centers land on its own
 *     texels); the non-primary is bilinearly resampled.
 *
 * Metrics + TEV run over the RESULT grid: the overlap region under crop, the
 * full common grid under fill.
 */

export type CompareAlign = "top-left" | "center" | "top-right" | "bottom-left" | "bottom-right";
export type CompareFit = "crop" | "fill";

export interface Dims {
  w: number;
  h: number;
}

export interface TexelOffset {
  x: number;
  y: number;
}

export interface CompareMapping {
  fit: CompareFit;
  /** The common RESULT/overlap grid: min(A,B) under crop, primary dims under fill. */
  result: Dims;
  /** Integer texel offset into source A for RESULT pixel (0,0). `{0,0}` under fill. */
  offsetA: TexelOffset;
  /** Integer texel offset into source B for RESULT pixel (0,0). `{0,0}` under fill. */
  offsetB: TexelOffset;
}

/** (vertical, horizontal) anchor pair for an alignment token. */
function anchors(align: CompareAlign): { v: "top" | "center" | "bottom"; h: "left" | "center" | "right" } {
  switch (align) {
    case "center":
      return { v: "center", h: "center" };
    case "top-right":
      return { v: "top", h: "right" };
    case "bottom-left":
      return { v: "bottom", h: "left" };
    case "bottom-right":
      return { v: "bottom", h: "right" };
    case "top-left":
    default:
      return { v: "top", h: "left" };
  }
}

/** Top-left offset of the `overlap` rect within a `src`-sized rect under `align`.
 *  `src.* - overlap.*` is always >= 0 under crop (overlap = min dims). */
function anchorOffset(src: Dims, overlap: Dims, align: CompareAlign): TexelOffset {
  const { v, h } = anchors(align);
  const dx = src.w - overlap.w;
  const dy = src.h - overlap.h;
  const x = h === "left" ? 0 : h === "right" ? dx : Math.floor(dx / 2);
  const y = v === "top" ? 0 : v === "bottom" ? dy : Math.floor(dy / 2);
  return { x, y };
}

/**
 * Compute the RESULT grid + per-source sample mapping for a compare pair. `a`/`b`
 * are the source dims (a = the diff `a`/reference operand, b = the `b`/foreground
 * operand, matching `computeDiff(texA, texB)`); `primary` names the foreground
 * operand ("b" in the pane) whose resolution is the common grid under fill.
 */
export function computeCompareMapping(
  a: Dims,
  b: Dims,
  align: CompareAlign,
  fit: CompareFit,
  primary: "a" | "b" = "b",
): CompareMapping {
  if (fit === "fill") {
    const result = primary === "a" ? { w: a.w, h: a.h } : { w: b.w, h: b.h };
    return { fit, result, offsetA: { x: 0, y: 0 }, offsetB: { x: 0, y: 0 } };
  }
  const result: Dims = { w: Math.min(a.w, b.w), h: Math.min(a.h, b.h) };
  return {
    fit,
    result,
    offsetA: anchorOffset(a, result, align),
    offsetB: anchorOffset(b, result, align),
  };
}

/** Stable signature for the diff cache key (align/fit change the RESULT). */
export function mappingKey(m: CompareMapping): string {
  return `${m.fit}:${m.result.w}x${m.result.h}:${m.offsetA.x},${m.offsetA.y}:${m.offsetB.x},${m.offsetB.y}`;
}
