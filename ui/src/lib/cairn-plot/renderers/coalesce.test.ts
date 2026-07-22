/**
 * Unit tests for the pure latest-wins / one-in-flight coalescer (coalesce.ts),
 * the state machine behind the deep depth slider's debounce-free real-time drag.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/coalesce.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE_COALESCE, requestCoalesce, resolveCoalesce } from "./coalesce.ts";

test("first request launches immediately and goes in-flight", () => {
  const step = requestCoalesce(IDLE_COALESCE, 5);
  assert.equal(step.launch, 5);
  assert.deepEqual(step.state, { inFlight: true, pending: null });
});

test("a request while in flight does NOT launch — it parks as pending", () => {
  const step = requestCoalesce({ inFlight: true, pending: null }, 7);
  assert.equal(step.launch, null);
  assert.deepEqual(step.state, { inFlight: true, pending: 7 });
});

test("latest wins: a newer pending overwrites the older one", () => {
  let s = { inFlight: true, pending: null } as const;
  const a = requestCoalesce(s, 1);
  const b = requestCoalesce(a.state, 2);
  const c = requestCoalesce(b.state, 3);
  assert.equal(a.launch, null);
  assert.equal(b.launch, null);
  assert.equal(c.launch, null);
  assert.equal(c.state.pending, 3); // only the last survives
});

test("resolve with a pending value launches it and stays in flight", () => {
  const step = resolveCoalesce({ inFlight: true, pending: 9 });
  assert.equal(step.launch, 9);
  assert.deepEqual(step.state, { inFlight: true, pending: null });
});

test("resolve with no pending goes idle", () => {
  const step = resolveCoalesce({ inFlight: true, pending: null });
  assert.equal(step.launch, null);
  assert.deepEqual(step.state, IDLE_COALESCE);
});

test("full fast-drag sequence collapses to first + last, never more than one in flight", () => {
  // Simulate: request(10) launches; drag posts 11,12,13 while in flight;
  // resolve → launches 13 (the latest); resolve → idle. Two launches total.
  const launched: number[] = [];
  let state = IDLE_COALESCE;
  const request = (v: number) => {
    const step = requestCoalesce(state, v);
    state = step.state;
    if (step.launch != null) launched.push(step.launch);
    // Invariant: never more than one in flight (inFlight is a boolean, and a
    // launch only happens from idle or on resolve).
    assert.equal(state.inFlight, true);
  };
  const resolve = () => {
    const step = resolveCoalesce(state);
    state = step.state;
    if (step.launch != null) launched.push(step.launch);
  };

  request(10); // launches 10
  request(11); // parks
  request(12); // parks (overwrites)
  request(13); // parks (overwrites)
  resolve(); // launches 13
  resolve(); // idle

  assert.deepEqual(launched, [10, 13]);
  assert.deepEqual(state, IDLE_COALESCE);
});
