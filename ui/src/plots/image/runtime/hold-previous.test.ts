import assert from "node:assert/strict";
import test from "node:test";

import { shouldHoldPrevious, HOLD_TTL_MS, type HoldPreviousInput } from "./hold-previous.ts";

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
