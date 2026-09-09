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
 *
 * And a hold is BOUNDED. A held frame is a lie with a deadline: it shows step
 * N-1's pixels under step N's labels. A rejection ends it, but a request that
 * simply never answers does not (the scheduler's watchdog frees the task SLOT,
 * it does not fail the task), so `heldForMs` expires the hold at
 * {@link HOLD_TTL_MS} and the pane falls back to the honest loading state.
 */

/** The NEW source/pair's resolve state for the pane's current resolve key. */
export type HoldResolveStatus = "resolving" | "ready";

/**
 * How long a pane may show its previous frame while the next one resolves.
 * Past this the held frame is stale enough that "Loading…" is the more honest
 * answer — a wrong picture under the right label is worse than no picture.
 */
export const HOLD_TTL_MS = 15_000;

export interface HoldPreviousInput {
  /** This pane resolved at least once, so it has a frame to hold. */
  readonly hasResolved: boolean;
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
  /** How long this frame has been held, in ms (0 on the first held render). */
  readonly heldForMs?: number | undefined;
  /** Override for {@link HOLD_TTL_MS} (tests). */
  readonly holdTtlMs?: number | undefined;
}

/** Pure decision — see the module doc. */
export function shouldHoldPrevious(input: HoldPreviousInput): boolean {
  // Nothing resolved yet: the first mount has no frame to hold.
  if (!input.hasResolved) return false;
  // Resolved (or resolvable): the pure read of the current key wins.
  if (input.status !== "resolving") return false;
  // The error state supersedes a held frame.
  if (input.error !== undefined) return false;
  // A hold that has outlived its deadline stops pretending.
  if ((input.heldForMs ?? 0) >= (input.holdTtlMs ?? HOLD_TTL_MS)) return false;
  // Same base source (channel re-slice): hold unconditionally.
  if (input.sameSource) return true;
  // Source swap: only an authored opt-in on an unchanged slot holds.
  return input.holdFlag && input.sameSlot;
}
