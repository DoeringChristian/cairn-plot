/**
 * ADMISSION VICTIM CHOICE (H7) — the pure half of the GPU pane pool's admission
 * policy, extracted so it can be tested without a device.
 *
 * A pane asking for a live slot may have to displace another one. The COUNT cap
 * calls this with `allowPresentationRotation: false`, so it only ever takes
 * rule-1 (off-screen) victims and otherwise lets the requester in over the cap:
 * a visible pane is never parked for a count. Rules 2 and 3 serve the BYTE
 * budget. The order of preference is:
 *
 *  1. An OFF-SCREEN pane. It is not showing anything, so taking its slot costs
 *     the user nothing.
 *  2. A visible pane that has ALREADY presented its current content generation —
 *     only while the requester still owes the user a presentation of its own
 *     (`allowPresentationRotation`). Its canvas keeps the frame it last painted,
 *     so the rotation is invisible.
 *  3. H7: every visible pane still OWES a presentation — the state a grid falls
 *     into the instant an iteration step invalidates all of them at once. Rule 2
 *     finds no victim there, so admission used to fail for the whole grid and
 *     the panes that happened to be off the LRU end never got a slot again (they
 *     stayed blank until something else freed one). Rotate instead: the victim is
 *     the LEAST-RECENTLY-PRESENTED pane, i.e. the one whose slot has produced
 *     nothing for the longest — the pane most likely to be stuck.
 *
 * Rule 3 is fenced so it cannot thrash: a requester may only displace a pane
 * whose last present is STRICTLY older than its own. Two consequences, both
 * load-bearing:
 *
 *  - It is a strict order, so a rotation can never be reversed: the pane just
 *    evicted cannot evict its evictor back. Rotation terminates.
 *  - Panes that have NEVER presented (stamp 0) cannot rotate each other at all,
 *    which leaves the first-frame storm — a whole grid mounting at once — on the
 *    existing, already-fair path: each live pane presents, becomes rule-2
 *    evictable, and hands its slot on. Rule 3 exists for the pane that is holding
 *    a slot while producing nothing, not for panes that simply have not had their
 *    turn yet.
 *
 * A pane that is CURRENTLY presenting is never a victim, and neither is the
 * requester itself.
 *
 * EQUIVALENCE with the inline `isAdmissionVictim` this replaced: rules 1 and 2
 * are that predicate exactly — "not the requester; an invisible candidate always;
 * a visible one only while the requester owes a presentation and the candidate
 * does not" — and the same-device-first / LRU-order tie-breaks reproduce the two
 * call sites' `live.find(...)` and `candidates.find(sameDevice) ?? candidates[0]`.
 * Rule 3 and the `presenting` exclusion are the only new behaviour; everything a
 * pane could evict before, it can still evict, in the same order.
 */

export interface AdmissionCandidate {
  /** Pool-unique pane id (the caller maps it back to its entry). */
  readonly id: number;
  /** The candidate lives on the requester's device. */
  readonly sameDevice: boolean;
  /** Last-reported viewport visibility. */
  readonly visible: boolean;
  /** The candidate still owes a presentation of its current content generation. */
  readonly needsPresentation: boolean;
  /** A render/present is running for this candidate right now. */
  readonly presenting: boolean;
  /** Monotonic stamp of the candidate's last successful present (0 = never). */
  readonly lastPresentedAt: number;
}

export interface ChooseAdmissionVictimOptions {
  /** The pane asking for a slot; never its own victim. */
  readonly requesterId: number;
  /** The requester owes a presentation, so it may rotate a visible peer. */
  readonly allowPresentationRotation: boolean;
  /** The requester's own last-present stamp — the anti-thrash fence for rule 3:
   *  only a STRICTLY older slot may be rotated out. */
  readonly requesterLastPresentedAt: number;
  /** Byte-budget loops may only take victims from the requester's own device. */
  readonly sameDeviceOnly?: boolean;
}

/** Prefer a same-device victim, else the first (least-recently-used) one. */
function preferSameDevice(list: readonly AdmissionCandidate[]): AdmissionCandidate | null {
  return list.find((candidate) => candidate.sameDevice) ?? list[0] ?? null;
}

/**
 * Choose the pane to evict so `requesterId` can be admitted, or `null` when
 * nothing may be displaced (the requester then waits).
 *
 * `candidates` is the pool's LIVE list in LRU order (least-recently-used first),
 * which is what breaks ties.
 */
export function chooseAdmissionVictim(
  candidates: readonly AdmissionCandidate[],
  opts: ChooseAdmissionVictimOptions,
): AdmissionCandidate | null {
  const eligible = candidates.filter((candidate) =>
    candidate.id !== opts.requesterId &&
    !candidate.presenting &&
    (opts.sameDeviceOnly !== true || candidate.sameDevice));
  // 1. Off-screen panes are free.
  const offscreen = eligible.filter((candidate) => !candidate.visible);
  if (offscreen.length > 0) return preferSameDevice(offscreen);
  if (!opts.allowPresentationRotation) return null;
  // 2. A visible pane that already showed its current generation.
  const presented = eligible.filter((candidate) => !candidate.needsPresentation);
  if (presented.length > 0) return preferSameDevice(presented);
  // 3. Everyone still owes a presentation — rotate the slot that has produced
  //    nothing for the longest, and only one strictly staler than our own.
  const rotatable = eligible.filter(
    (candidate) => candidate.lastPresentedAt < opts.requesterLastPresentedAt,
  );
  if (rotatable.length === 0) return null;
  const sameDevice = rotatable.filter((candidate) => candidate.sameDevice);
  const pool = sameDevice.length > 0 ? sameDevice : rotatable;
  let victim = pool[0]!;
  for (const candidate of pool) {
    // Strictly older wins, so an LRU-earlier candidate keeps a tie.
    if (candidate.lastPresentedAt < victim.lastPresentedAt) victim = candidate;
  }
  return victim;
}
