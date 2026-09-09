import assert from "node:assert/strict";
import test from "node:test";

import {
  heldForMs,
  nextHoldClock,
  shouldHoldPrevious,
  HOLD_TTL_MS,
  type HoldClock,
  type HoldPreviousInput,
} from "./hold-previous.ts";

const base: HoldPreviousInput = {
  hasResolved: true,
  status: "resolving",
  holdFlag: true,
  sameSlot: true,
  sameSource: false,
  error: undefined,
};

test("shouldHoldPrevious: a compare pane holds its previous frame between steps", () => {
  // The step change swaps BOTH operands, so `sameSource` is false — the whole
  // point of H3': the old gate required an unchanged base key and therefore
  // dropped every compare pane to "Loading…" on every step.
  assert.equal(shouldHoldPrevious(base), true);
});

test("shouldHoldPrevious: a pane that never resolved shows the placeholder", () => {
  assert.equal(shouldHoldPrevious({ ...base, hasResolved: false }), false);
});

test("shouldHoldPrevious: a resolved key is never held back", () => {
  assert.equal(shouldHoldPrevious({ ...base, status: "ready" }), false);
});

test("shouldHoldPrevious: a resolve error replaces the held frame", () => {
  assert.equal(shouldHoldPrevious({ ...base, error: "decode failed" }), false);
  // Even the unconditional same-source hold yields to an error.
  assert.equal(
    shouldHoldPrevious({ ...base, sameSource: true, holdFlag: false, error: "decode failed" }),
    false,
  );
});

test("shouldHoldPrevious: a stacked-slot flip never holds the previous slot's frame", () => {
  // The invariant the channel-pick hold was written to protect: a cold flip
  // renders loading rather than the other slot's picture.
  assert.equal(shouldHoldPrevious({ ...base, sameSlot: false }), false);
});

test("shouldHoldPrevious: without the authored flag only a same-source re-resolve holds", () => {
  assert.equal(shouldHoldPrevious({ ...base, holdFlag: false }), false);
  assert.equal(shouldHoldPrevious({ ...base, holdFlag: false, sameSource: true }), true);
});

test("shouldHoldPrevious: a same-source re-resolve holds even across an unknown slot", () => {
  // A channel re-slice cannot be a slot flip: the flip changes the base key.
  assert.equal(shouldHoldPrevious({ ...base, holdFlag: false, sameSlot: false, sameSource: true }), true);
});

test("shouldHoldPrevious: a hold expires at the TTL and falls back to loading", () => {
  assert.equal(shouldHoldPrevious({ ...base, heldForMs: HOLD_TTL_MS - 1 }), true);
  assert.equal(shouldHoldPrevious({ ...base, heldForMs: HOLD_TTL_MS }), false);
  // The unconditional same-source hold expires too — a hung re-decode of the
  // same source is just as stale as a hung step.
  assert.equal(
    shouldHoldPrevious({ ...base, holdFlag: false, sameSource: true, heldForMs: HOLD_TTL_MS }),
    false,
  );
});

test("shouldHoldPrevious: the TTL is overridable for tests", () => {
  assert.equal(shouldHoldPrevious({ ...base, heldForMs: 5, holdTtlMs: 10 }), true);
  assert.equal(shouldHoldPrevious({ ...base, heldForMs: 10, holdTtlMs: 10 }), false);
});

// --- the hold clock --------------------------------------------------------

/** One render of a pane that is waiting on `key`, at wall-clock `now`. */
function renderHolding(clock: HoldClock | null, key: string, now: number): {
  clock: HoldClock | null;
  holding: boolean;
} {
  const holding = shouldHoldPrevious({ ...base, heldForMs: heldForMs(clock, key, now) });
  return { clock: nextHoldClock(clock, { key, resolved: false, holding, now }), holding };
}

test("the hold expiry is sticky: after the TTL the pane stays on loading", () => {
  let clock: HoldClock | null = null;
  let step = renderHolding(clock, "k1", 0);
  assert.equal(step.holding, true, "the first render holds");
  clock = step.clock;
  step = renderHolding(clock, "k1", HOLD_TTL_MS - 1);
  assert.equal(step.holding, true, "still inside the deadline");
  clock = step.clock;
  step = renderHolding(clock, "k1", HOLD_TTL_MS);
  assert.equal(step.holding, false, "the deadline passes");
  clock = step.clock;
  // The regression: a lapsed clock used to be cleared, so the very next render
  // started a fresh 15 s hold — a saw that showed the stale frame most of the
  // time. Every later render must stay on the loading state.
  for (const now of [HOLD_TTL_MS + 1, HOLD_TTL_MS + 500, HOLD_TTL_MS * 4]) {
    step = renderHolding(clock, "k1", now);
    assert.equal(step.holding, false, `still loading at ${now}`);
    clock = step.clock;
  }
});

test("the hold clock re-arms for a NEW resolve key, and a resolution clears it", () => {
  let clock: HoldClock | null = null;
  clock = nextHoldClock(clock, { key: "k1", resolved: false, holding: true, now: 0 });
  assert.deepEqual(clock, { key: "k1", at: 0 });
  // A later step holds again on its own deadline.
  clock = nextHoldClock(clock, { key: "k2", resolved: false, holding: true, now: 90_000 });
  assert.deepEqual(clock, { key: "k2", at: 90_000 });
  assert.equal(heldForMs(clock, "k2", 90_500), 500);
  assert.equal(heldForMs(clock, "k1", 90_500), 0, "another key's deadline is not this one's");
  // A resolution ends the hold outright.
  assert.equal(nextHoldClock(clock, { key: "k2", resolved: true, holding: false, now: 91_000 }), null);
});
