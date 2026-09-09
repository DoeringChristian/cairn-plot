/**
 * The HOLD-PREVIOUS decision (H3'): whether a pane keeps rendering its last
 * ready presentation while the NEXT one resolves, instead of dropping to the
 * "Loading…" placeholder.
 *
 * Two independent reasons hold a frame, and they are deliberately separate
 * inputs rather than one boolean:
 *
 *  - `sameSource` — the SAME base source is being re-resolved (a channel pick
 *    only changes the selection suffix of the resolve key). The pane must never
 *    swap the viewport for a placeholder there: a channel pick is a display
 *    setting, and the new decode swaps IN PLACE when it lands. This hold needs
 *    no authored opt-in.
 *
 *  - `holdFlag` + `sameSlot` — the source itself changed (an iteration-slider
 *    step swaps both compare operands), and the author asked for the previous
 *    frame to be held (`props.holdPreviousWhileLoading`). Cairn sets it on every
 *    compare node so a grid of runs never blinks between steps.
 *
 * `sameSlot` is the guard that keeps the stacked-slot invariant intact: a
 * STACKED flip reuses the same component instance with a different node, and
 * holding there would paint the PREVIOUS slot's frame under the new slot's
 * labels (the stale-diff / reference-flash artefact). The caller keys the slot
 * on the pane's stable node identity + comparison operation — never on the
 * resolve key, which changes on every step — and reports `sameSlot: false`
 * whenever it cannot prove the slot is unchanged.
 *
 * A resolve ERROR always replaces the held frame with the error state: a held
 * frame must never outlive the evidence that the next one failed.
 */

/** The NEW source/pair's resolve state for the pane's current resolve key. */
export type HoldResolveStatus = "resolving" | "ready";

export interface HoldPreviousInput {
  /** This pane already has a ready presentation to hold (it painted once). */
  readonly hasPainted: boolean;
  /** Where the CURRENT resolve key stands. */
  readonly status: HoldResolveStatus;
  /** The node's authored `holdPreviousWhileLoading`. */
  readonly holdFlag: boolean;
  /** The pane's own slot identity (node identity + operation) is unchanged. */
  readonly sameSlot: boolean;
  /** The held frame resolved from the SAME base source (a channel re-slice). */
  readonly sameSource: boolean;
  /** A cached resolve error for the current key, when one is live. */
  readonly error?: string | undefined;
}

/** Pure decision — see the module doc. */
export function shouldHoldPrevious(input: HoldPreviousInput): boolean {
  // Nothing painted yet: the first mount has no frame to hold.
  if (!input.hasPainted) return false;
  // Resolved (or resolvable): the pure read of the current key wins.
  if (input.status !== "resolving") return false;
  // The error state supersedes a held frame.
  if (input.error !== undefined) return false;
  // Same base source (channel re-slice): hold unconditionally.
  if (input.sameSource) return true;
  // Source swap: only an authored opt-in on an unchanged slot holds.
  return input.holdFlag && input.sameSlot;
}
