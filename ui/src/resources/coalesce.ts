/**
 * `renderers/coalesce.ts` — the PURE latest-wins / one-in-flight state machine
 * behind the DEEP depth slider's real-time drag (`useDeepFlatten`).
 *
 * The re-flatten is async, but we NEVER want a debounce (that adds visible lag)
 * and NEVER want a queue of stale re-flattens piling up. The rule is:
 *
 *   - at most ONE flatten in flight at a time;
 *   - while one is running, remember ONLY the LATEST requested value;
 *   - when it resolves, immediately launch the latest pending value (if the
 *     value moved) — otherwise go idle.
 *
 * So a fast drag collapses to: launch(first) → [drag…] → on resolve launch(last
 * seen) → on resolve idle. Bounded work, always converges to the final value.
 *
 * This module is the PURE decision logic (no React, no timers, no async), unit-
 * tested directly; `useDeepFlatten` wires it to `deep.flatten` + a rAF upload.
 */

/** Coalescer state: whether a run is in flight, and the latest pending value. */
export interface CoalesceState {
  readonly inFlight: boolean;
  /** The newest value requested WHILE a run was in flight (else null). */
  readonly pending: number | null;
}

/** Idle: nothing in flight, nothing pending. */
export const IDLE_COALESCE: CoalesceState = { inFlight: false, pending: null };

/** A transition result: the next state + the value to LAUNCH now (`null` = none). */
export interface CoalesceStep {
  readonly state: CoalesceState;
  readonly launch: number | null;
}

/**
 * A new value was requested. If nothing is in flight, launch it immediately;
 * otherwise record it as the latest pending value (overwriting any older one —
 * latest wins).
 */
export function requestCoalesce(state: CoalesceState, value: number): CoalesceStep {
  if (state.inFlight) {
    return { state: { inFlight: true, pending: value }, launch: null };
  }
  return { state: { inFlight: true, pending: null }, launch: value };
}

/**
 * The in-flight run resolved. If a newer value came in meanwhile, launch it next
 * (stay in flight); otherwise go idle.
 */
export function resolveCoalesce(state: CoalesceState): CoalesceStep {
  if (state.pending != null) {
    return { state: { inFlight: true, pending: null }, launch: state.pending };
  }
  return { state: IDLE_COALESCE, launch: null };
}
