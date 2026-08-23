/**
 * `renderers/use-render-scheduler.ts` — the ONE owner of WHEN a `GpuImagePane`
 * submits a render, and in WHICH paint phase; plus the pane's named
 * re-derivation revisions the scheduler (and the histogram/overlay) key off.
 *
 * ## The two paint phases (why both hook slots exist)
 *
 * A `GpuImagePane` frame can present in one of two phases:
 *   - PRE-PAINT (`useLayoutEffect`) — a RESIDENT slot flip (image↔diff, or an
 *     image→image URL swap whose target is already uploaded) must paint the new
 *     slot in its OWN commit, before the browser paints, or the first painted
 *     frame shows the HELD previous slot for one frame (the reported flash).
 *   - POST-PAINT (`useEffect`) — everything else: pan/zoom/exposure/param
 *     changes, resize, park/restore, and NON-resident flips whose async source
 *     load legitimately holds the previous frame until it lands.
 *
 * React cannot pick an effect type at runtime, so BOTH hook slots exist. But the
 * DECISION of which slot owns a given commit's render is computed ONCE per commit
 * here — `phase = snapshot.resident && isFlip ? "layout" : "post"` — and a single
 * `renderKey` dedupe (owned by this hook) guarantees a resident flip submits
 * EXACTLY once even though both slots fire. This replaces the two inline effects
 * that each RE-DERIVED the flip/residency decision and hand-synced a shared
 * `lastRenderedRef`/`lastContentIdentityRef` across module-level component refs.
 *
 * ## The render key (dedupe)
 *
 * `renderKey` = the render callback's identity (`renderId`, a fresh object each
 * time `renderPass` is recreated — i.e. whenever any pixel-affecting dep changed)
 * paired with the two async-landing revisions that force a re-render WITHOUT
 * changing the callback: `source` (a source texture (re)uploaded) and `container`
 * (a resize or park→restore). `renderPass` returns whether it actually SUBMITTED
 * (a held/guarded frame returns false), so a hold never marks the key done and a
 * later retry still fires; the pre-paint and post-paint slots consult the one key
 * so a resident flip renders once pre-paint and the post slot skips the duplicate.
 *
 * ## Named revision sources (one mechanism)
 *
 * The pane's async side-effects announce "something landed" through {@link
 * useRevisions}: ONE state cell holding five monotonically-bumped counters, each a
 * distinct NAMED source with its own consumers — folded here from the five
 * separate `*Version` `useState`s so the triggers stay semantically distinct while
 * living on one mechanism:
 *   - `source`     — a primary/deep source texture (re)uploaded  → render + metrics
 *   - `container`  — the container resized OR restored from park  → render
 *   - `pixels`     — the retained CPU pixel bytes changed         → histogram/overlay
 *   - `reference`  — the diff `b` operand (re)uploaded            → render(diff) + metrics/overlay
 *   - `diffOverlay`— a cached-diff RESULT readback landed         → overlay
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RenderSnapshot } from "./render-snapshot";
import { isPaintPhaseLogActive, recordPaintPhase } from "../engine/test-hooks";

/** The pane's async-landing revision sources — a distinct named counter each. */
export type RevisionSource = "source" | "container" | "pixels" | "reference" | "diffOverlay";
export type Revisions = Record<RevisionSource, number>;

/**
 * ONE mechanism for the pane's five re-derivation triggers. Returns the current
 * counters (read the specific field in an effect's dep array to re-run on exactly
 * that source) and a stable `bump(source)` the async effects call when their work
 * lands. Bumps compose (functional update), so two in one effect both land.
 */
export function useRevisions(): [Revisions, (source: RevisionSource) => void] {
  const [revisions, setRevisions] = useState<Revisions>({
    source: 0,
    container: 0,
    pixels: 0,
    reference: 0,
    diffOverlay: 0,
  });
  const bump = useCallback((source: RevisionSource): void => {
    setRevisions((prev) => ({ ...prev, [source]: prev[source] + 1 }));
  }, []);
  return [revisions, bump];
}

interface RenderKey {
  id: object;
  source: number;
  container: number;
}

export interface RenderSchedulerParams {
  /** The per-commit render description (mode / flip detector / residency). */
  snapshot: RenderSnapshot;
  /** The render callback — returns whether it actually SUBMITTED a frame. Its
   *  identity changes whenever any pixel-affecting dep changes (the pane wraps it
   *  in a `useCallback`), the primary re-render trigger. */
  renderPass: () => boolean;
  /** `revisions.source` — a source texture (re)uploaded; forces a render without
   *  changing `renderPass`'s identity. */
  sourceRev: number;
  /** `revisions.container` — the container resized OR restored from park. */
  containerRev: number;
}

/**
 * Drive the pane's two render hook slots from one owner. Computes `(renderKey,
 * phase)` once per commit and dedupes internally; both slots fire every commit,
 * but only one submits a given key (pre-paint for a resident flip, else post).
 */
export function useRenderScheduler({ snapshot, renderPass, sourceRev, containerRev }: RenderSchedulerParams): void {
  // A fresh identity each time `renderPass` is recreated (any pixel-affecting dep
  // changed). Paired with the two revisions it forms the dedupe `renderKey`. Kept
  // as a live ref too so the callback slots read the current one without listing
  // it beyond the dep arrays below.
  const renderId = useMemo(() => ({}), [renderPass]);

  // Flip detector — the `contentKey` most recently ACTED ON. A viewport/exposure
  // change keeps the same key (not a flip); a slot/source/op change bumps it.
  const flipKeyRef = useRef<string | undefined>(undefined);
  // Dedupe — the last renderKey actually SUBMITTED, so the two slots submit a
  // resident flip exactly once.
  const doneRef = useRef<RenderKey | null>(null);
  // Paint-phase oracle (harness-only): a monotonic content EPOCH bumped on each
  // flip, and the epoch whose pre-paint COMMIT marker has already been emitted.
  const epochRef = useRef(0);
  const epochKeyRef = useRef<string | undefined>(undefined);
  const committedEpochRef = useRef(-1);

  // Content epoch — a pure derivation of `contentKey` (bumps on each flip); a
  // harness groups submits by epoch to find each flip's FIRST render's phase.
  if (epochKeyRef.current !== snapshot.contentKey) {
    epochKeyRef.current = snapshot.contentKey;
    epochRef.current += 1;
  }
  const epoch = epochRef.current;

  // (renderKey, phase) — computed ONCE per commit; both slots read them. `isFlip`
  // reads the flip detector at render time — nothing mutates it between render and
  // the layout slot (the upload effects don't touch it, and this hook's slots are
  // where it first could change this commit), so this equals the previous
  // in-effect flip check.
  const isFlip = snapshot.contentKey !== flipKeyRef.current;
  const phase: "layout" | "post" = snapshot.resident && isFlip ? "layout" : "post";

  const alreadyDone = (): boolean => {
    const r = doneRef.current;
    return !!r && r.id === renderId && r.source === sourceRev && r.container === containerRev;
  };
  const runPass = (): boolean => {
    const submitted = renderPass();
    if (submitted) doneRef.current = { id: renderId, source: sourceRev, container: containerRev };
    return submitted;
  };

  // PRE-PAINT slot — emits the flip's commit marker (harness), then renders the
  // new slot IN THIS COMMIT when the target is a resident flip (`phase ===
  // "layout"`). Deps include `snapshot.resident`/`contentKey` so the slot re-fires
  // the instant residency is satisfied (the upload layout effects run first this
  // commit, bind the sources, and flush a pre-paint re-render).
  useLayoutEffect(() => {
    if (isPaintPhaseLogActive() && committedEpochRef.current !== epoch) {
      committedEpochRef.current = epoch;
      recordPaintPhase({
        phase: "commit",
        kind: snapshot.mode,
        submitted: false,
        resident: snapshot.resident,
        epoch,
        t: performance.now(),
      });
    }
    if (phase !== "layout") return; // non-resident or not-a-flip → the post slot owns it
    if (alreadyDone()) return;
    flipKeyRef.current = snapshot.contentKey;
    const submitted = runPass();
    if (isPaintPhaseLogActive())
      recordPaintPhase({
        phase: "layout",
        kind: snapshot.mode,
        submitted,
        resident: snapshot.resident,
        epoch,
        t: performance.now(),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderId, sourceRev, containerRev, snapshot.resident, snapshot.contentKey]);

  // POST-PAINT slot — the general path (pan/zoom/exposure/param, resize,
  // park/restore, and NON-resident flips whose async load resolves later). Keeps
  // the flip detector current for non-flip renders, and dedupes against a
  // pre-paint submit for this exact key.
  useEffect(() => {
    flipKeyRef.current = snapshot.contentKey;
    if (alreadyDone()) return;
    const submitted = runPass();
    if (submitted && isPaintPhaseLogActive())
      recordPaintPhase({
        phase: "post",
        kind: snapshot.mode,
        submitted,
        resident: snapshot.resident,
        epoch,
        t: performance.now(),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderId, sourceRev, containerRev]);
}
