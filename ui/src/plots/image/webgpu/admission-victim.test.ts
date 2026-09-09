import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseAdmissionVictim,
  type AdmissionCandidate,
  type ChooseAdmissionVictimOptions,
} from "./admission-victim.ts";

function candidate(id: number, over: Partial<AdmissionCandidate> = {}): AdmissionCandidate {
  return {
    id,
    sameDevice: true,
    visible: true,
    needsPresentation: false,
    presenting: false,
    lastPresentedAt: 0,
    ...over,
  };
}

const opts = (over: Partial<ChooseAdmissionVictimOptions> = {}): ChooseAdmissionVictimOptions => ({
  requesterId: 99,
  allowPresentationRotation: true,
  requesterLastPresentedAt: 0,
  ...over,
});

test("chooseAdmissionVictim: an off-screen pane is taken before any visible one", () => {
  const victim = chooseAdmissionVictim(
    [candidate(1), candidate(2, { visible: false }), candidate(3)],
    opts(),
  );
  assert.equal(victim?.id, 2);
});

test("chooseAdmissionVictim: an off-screen pane is free even without rotation rights", () => {
  const victim = chooseAdmissionVictim(
    [candidate(1), candidate(2, { visible: false })],
    opts({ allowPresentationRotation: false }),
  );
  assert.equal(victim?.id, 2);
});

test("chooseAdmissionVictim: no victim when every pane is visible and nothing may rotate", () => {
  const victim = chooseAdmissionVictim(
    [candidate(1), candidate(2)],
    opts({ allowPresentationRotation: false }),
  );
  assert.equal(victim, null);
});

test("chooseAdmissionVictim: a visible pane that already presented is rotated first", () => {
  const victim = chooseAdmissionVictim(
    [candidate(1, { needsPresentation: true }), candidate(2), candidate(3, { needsPresentation: true })],
    opts(),
  );
  assert.equal(victim?.id, 2);
});

test("chooseAdmissionVictim: all panes needing presentation rotates the least recently presented", () => {
  // The step-change state: every visible pane owes a frame. Before H7 this
  // returned null and the requester waited forever.
  const victim = chooseAdmissionVictim(
    [
      candidate(1, { needsPresentation: true, lastPresentedAt: 7 }),
      candidate(2, { needsPresentation: true, lastPresentedAt: 3 }),
      candidate(3, { needsPresentation: true, lastPresentedAt: 5 }),
    ],
    opts({ requesterLastPresentedAt: 9 }),
  );
  assert.equal(victim?.id, 2);
});

test("chooseAdmissionVictim: rotation never displaces a pane served more recently than the requester", () => {
  const victim = chooseAdmissionVictim(
    [
      candidate(1, { needsPresentation: true, lastPresentedAt: 8 }),
      candidate(2, { needsPresentation: true, lastPresentedAt: 6 }),
    ],
    opts({ requesterLastPresentedAt: 4 }),
  );
  assert.equal(victim, null);
});

test("chooseAdmissionVictim: panes that never presented do not rotate each other", () => {
  // The first-frame storm: nothing has painted yet, so no slot is "stuck" and
  // the existing present-then-hand-on path must be left alone.
  const victim = chooseAdmissionVictim(
    [
      candidate(1, { needsPresentation: true, lastPresentedAt: 0 }),
      candidate(2, { needsPresentation: true, lastPresentedAt: 0 }),
    ],
    opts({ requesterLastPresentedAt: 0 }),
  );
  assert.equal(victim, null);
});

test("chooseAdmissionVictim: ties keep the LRU-earliest candidate", () => {
  const victim = chooseAdmissionVictim(
    [
      candidate(1, { needsPresentation: true, lastPresentedAt: 2 }),
      candidate(2, { needsPresentation: true, lastPresentedAt: 2 }),
    ],
    opts({ requesterLastPresentedAt: 5 }),
  );
  assert.equal(victim?.id, 1);
});

test("chooseAdmissionVictim: never the requester", () => {
  const victim = chooseAdmissionVictim([candidate(99, { visible: false })], opts());
  assert.equal(victim, null);
});

test("chooseAdmissionVictim: never a pane that is presenting right now", () => {
  const victim = chooseAdmissionVictim(
    [
      candidate(1, { visible: false, presenting: true }),
      candidate(2, { needsPresentation: true, presenting: true }),
    ],
    opts(),
  );
  assert.equal(victim, null);
});

test("chooseAdmissionVictim: a same-device victim wins over an equally eligible foreign one", () => {
  const victim = chooseAdmissionVictim(
    [candidate(1, { visible: false, sameDevice: false }), candidate(2, { visible: false })],
    opts(),
  );
  assert.equal(victim?.id, 2);
  // …but a foreign pane is still better than no victim at all.
  const foreign = chooseAdmissionVictim(
    [candidate(1, { visible: false, sameDevice: false })],
    opts(),
  );
  assert.equal(foreign?.id, 1);
});

test("chooseAdmissionVictim: sameDeviceOnly never leaves the requester's device", () => {
  const victim = chooseAdmissionVictim(
    [candidate(1, { visible: false, sameDevice: false })],
    opts({ sameDeviceOnly: true }),
  );
  assert.equal(victim, null);
});

test("chooseAdmissionVictim: an empty pool has no victim", () => {
  assert.equal(chooseAdmissionVictim([], opts()), null);
});
