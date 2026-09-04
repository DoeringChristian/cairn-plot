/**
 * `renderers/render-snapshot.ts` — the ONE per-commit description of what a
 * `GpuImagePane` frame presents, and the single rule that governs whether it may
 * paint.
 *
 * ## The invariant this module owns
 *
 *   A frame is presentable only when its entire input set — both source slots,
 *   the image operation, and the display encoding — is derived from a SINGLE React
 *   commit. Otherwise hold the previous frame (WebGPU keeps the last present)
 *   until the lagging input catches up.
 *
 * Content op + display encoding are pure synchronous derivations of the props,
 * so they are coherent the instant a commit runs. The two SOURCE textures are
 * not: an SDR primary and a first-visit `b` decode asynchronously, so the pool
 * binds them one or more commits after the props flip. `primaryId`/`bId` are the
 * identities THIS frame expects; the pane's upload effects stamp the same ids
 * into `appliedPrimaryId`/`appliedBId` once the pool has actually bound them.
 * Comparing expected-vs-applied is therefore the whole present gate:
 *
 *   - `sourcesApplied` — expected == applied for both slots. The floor for any
 *     visible present; false ⇒ hold.
 *   - `resident` — the STRONGER condition a PRE-PAINT (paint-atomic) flip needs:
 *     sources applied AND framing dims known AND (for a cached diff) the result
 *     already in the per-device cache, so the flip paints on its own commit with
 *     no async gap and no multi-pass recompute on the paint critical path.
 *
 * `contentKey` is the flip detector: it folds in sources + op + mode but NOT the
 * viewport/exposure, so a pan/zoom is never mistaken for a slot flip.
 *
 * Assembling all of this in ONE place is what makes the class tractable: no
 * downstream reader re-derives its own view of "which sources / which op /
 * resident?" — the present gate, the pre-paint effect, the flip detector, and
 * the paint-phase log all read this struct.
 */
export interface RenderSnapshot {
  /** Content stage: which pipeline this frame drives. */
  mode: "image" | "diff" | "compositor";
  /** Source identity this frame expects in slot A (== the pool's `applied` stamp). */
  primaryId: string;
  /** Source identity this frame expects in slot B, or null when there is no operand. */
  bId: string | null;
  /** Resolved diff kernel id (diff mode), else "". */
  operationId: string;
  /** Compositor param (split position); 0 otherwise. */
  contentParam: number;
  /** Flip detector — sources ⊗ op ⊗ mode, excluding viewport/exposure. */
  contentKey: string;
  /** Expected sources are actually bound in the pool right now (the present floor). */
  sourcesApplied: boolean;
  /** Fully resident: `sourcesApplied` + dims + (cached) result — a pre-paint flip is legal. */
  resident: boolean;
}

export interface RenderSnapshotInput {
  diffMode: boolean;
  compositorMode: boolean;
  hasCompare: boolean;
  hdrMode: boolean;
  deepActive: boolean;
  /** The plain-image URL (single-image SDR path); "" when absent. */
  imageUrl: string;
  contentKeyA: string;
  contentKeyB: string;
  /** Whether a `compareSource.b` operand is present. */
  hasBOperand: boolean;
  /** The selected public comparison operation id (`flip`, `flip-hdr`, `ssim`, …). */
  resolvedOperationId: string;
  /** The active compositor mode ("split"), or null. */
  compareOpMode: "split" | null;
  splitPosition: number;
  paneReady: boolean;
  /** The source ids the POOL has actually applied (upload-effect stamps, ref.current). */
  appliedPrimaryId: string | undefined;
  appliedBId: string | null | undefined;
  naturalDims: { w: number; h: number } | null;
  refDims: { w: number; h: number } | null;
  /** Whether this frame's DIFF content can paint without a compute stall — the
   *  kernel-agnostic pool peek (`PaneHandle.isDiffContentResident`): a pointwise
   *  kernel streams (resident iff its op resolves); a multipass kernel is
   *  resident iff its cached result is. Consulted only in diff mode. */
  isDiffContentResident: () => boolean;
}

/** Assemble the render snapshot from one commit's props + the pool's applied stamps. */
export function buildRenderSnapshot(inp: RenderSnapshotInput): RenderSnapshot {
  const {
    diffMode,
    compositorMode,
    hasCompare,
    hdrMode,
    deepActive,
    imageUrl,
    contentKeyA,
    contentKeyB,
    hasBOperand,
    resolvedOperationId,
    compareOpMode,
    splitPosition,
    paneReady,
    appliedPrimaryId,
    appliedBId,
    naturalDims,
    refDims,
    isDiffContentResident,
  } = inp;

  const mode: RenderSnapshot["mode"] = diffMode ? "diff" : compositorMode ? "compositor" : "image";
  // The source identities this frame expects — the SAME expressions the upload
  // effects stamp into the pool's `applied*` refs, so applied and expected
  // converge the instant the pool binds the sources.
  const primaryId = hasCompare
    ? `A:${contentKeyA}`
    : hdrMode
      ? deepActive
        ? "deep"
        : "hdr"
      : `img:${imageUrl}`;
  const bId: string | null = hasCompare && hasBOperand ? `B:${contentKeyB}` : null;
  const sourcesApplied = paneReady && appliedPrimaryId === primaryId && appliedBId === bId;

  return {
    mode,
    primaryId,
    bId,
    operationId: diffMode ? resolvedOperationId : "",
    contentParam: compositorMode ? splitPosition : 0,
    contentKey: `${primaryId}|${bId}|${diffMode ? resolvedOperationId : ""}|${compositorMode ? compareOpMode : ""}`,
    sourcesApplied,
    resident:
      sourcesApplied &&
      !!naturalDims &&
      ((diffMode || compositorMode) ? !!refDims : true) &&
      (diffMode ? isDiffContentResident() : true),
  };
}
