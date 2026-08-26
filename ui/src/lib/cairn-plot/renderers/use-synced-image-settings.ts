/**
 * THE viewport settings hook — the single access point to display settings
 * (`viewport/image-settings-sync.ts` is the underlying registry + fan-out).
 *
 * THE CONTRACT (NOSTACK model, user rulings 2026-08-26). Every viewport owns
 * ONE flat settings entry, keyed by its stable viewport id; resolution at
 * render is one lookup:
 *
 *     explicit entry value  >  descriptor default (derived, never stored)
 *
 * - GROUPS are memberships, not layers: while this viewport belongs to a
 *   group (the selection, the stage, an authored grid sync), a write on ANY
 *   member fans out into every member's own entry — PERSISTENTLY (leaving a
 *   group changes nothing; the reversal of the former transient ruling).
 * - `set(patch)` is THE write path (gestures, HOME, formation seeds — all of
 *   it). `setLocal(patch)` writes only this viewport's entry (per-pane
 *   geometry adaptations that must not propagate, e.g. reframe-on-resize).
 * - No adoption effects, no echo guards: subscribers are told "your entry
 *   changed" and re-read it. Publish path == apply path (the writer's own
 *   entry is written by the same fan-out code).
 * - Application stays pure downward propagation: panes render `settings` and
 *   call `set` from genuine user gestures; applicability (does a LUT apply at
 *   this arity?) is decided at render, never at sync (ruling 5).
 *
 * ONE hook per viewport, run at the NODE level (`plot-node.tsx`'s
 * `PaneSelectionFrame`, the enlarge `StageCell`, the compositor). `settings`
 * and `set` are handed DOWN to the panes as props (the core/addon bundle
 * split rules out context).
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  getViewportSettings,
  joinSettingsGroup,
  publishViewportSettings,
  subscribeViewportSettings,
  type ImageSyncSettings,
  type SettingsKey,
} from "../viewport/image-settings-sync";

/** A group this viewport belongs to. `keys` scopes what fans through it (an
 *  authored `sync.viewport` grid group passes `["view"]`; the selection/stage
 *  groups pass nothing = all keys). */
export interface SettingsGroupSpec {
  id: string;
  keys?: readonly SettingsKey[];
}

/** What a viewport gets from its settings entry. */
export interface ViewportSettings {
  /** The viewport's explicitly-set settings, or `null` if none yet.
   *  Identity-stable until the entry is next written. */
  settings: ImageSyncSettings | null;
  /** THE write path: merge a patch into this viewport's entry and fan it out
   *  to its groups (persistent). */
  set: (patch: ImageSyncSettings) => void;
  /** Local-only write (no fan-out) — per-pane geometry adaptations. */
  setLocal: (patch: ImageSyncSettings) => void;
}

/**
 * Subscribe a viewport to its settings entry and keep its group memberships
 * (join on mount / spec change, leave on cleanup). `viewportId` is the
 * viewport's STABLE id (`vp-st-…`); `groups` the memberships this render
 * wants. Joining a group with existing members adopts their current values
 * (converge-on-join, scoped by the group's keys).
 */
export function useViewportSettings(
  viewportId: string,
  groups?: readonly SettingsGroupSpec[],
): ViewportSettings {
  // The registry is the state; React just needs a re-render signal on writes.
  const [, bump] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    const unsub = subscribeViewportSettings(viewportId, () => bump());
    bump(); // the id changed → re-read the (possibly pre-existing) entry
    return unsub;
  }, [viewportId]);

  // Content-keyed dep: memberships re-join only when the actual specs change,
  // not on every render's fresh array value.
  const groupsKey = (groups ?? [])
    .map((g) => `${g.id}:${(g.keys ?? []).join(",")}`)
    .join(" ");
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  useEffect(() => {
    const leaves = (groupsRef.current ?? []).map((g) =>
      joinSettingsGroup(g.id, viewportId, g.keys),
    );
    bump(); // converge-on-join may have written this entry
    return () => leaves.forEach((l) => l());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportId, groupsKey]);

  const set = useCallback(
    (patch: ImageSyncSettings) => publishViewportSettings(viewportId, patch),
    [viewportId],
  );
  const setLocal = useCallback(
    (patch: ImageSyncSettings) => publishViewportSettings(viewportId, patch, { fanOut: false }),
    [viewportId],
  );

  return { settings: getViewportSettings(viewportId), set, setLocal };
}

/** Membership-only variant: join `viewportId` to `groupId` (scoped to `keys`)
 *  for the effect's lifetime, without subscribing to the entry. Null-safe on
 *  both ids — the AUTHORED grid `sync.viewport` join (`LeafView` calls this
 *  with `keys: ["view"]`, preserving today's transforms-only grid sync). */
export function useJoinSettingsGroup(
  viewportId: string | null | undefined,
  groupId: string | null | undefined,
  keys?: readonly SettingsKey[],
): void {
  const keysKey = (keys ?? []).join(",");
  const keysRef = useRef(keys);
  keysRef.current = keys;
  useEffect(() => {
    if (!viewportId || !groupId) return;
    return joinSettingsGroup(groupId, viewportId, keysRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportId, groupId, keysKey]);
}

/** Anchor formation seed, run by the PANE (it owns the snapshot of its
 *  effective values, incl. derived defaults and the current `view`): when a
 *  group forms around this viewport as the anchor, it publishes its FULL
 *  current settings, converging every member to exactly the clicked
 *  viewport's state (formation-converges ruling). The publish is an ordinary
 *  fan-out — persistent, like any edit.
 *
 *  DEFERRED one microtask: React flushes a commit's effects in TREE order,
 *  and the pane-level seed (deep) fires before the NODE-level group joins —
 *  including, when the anchor sits later in the tree, before the anchor's
 *  OWN join, so a synchronous publish would fan out to nobody and earlier-
 *  joined members would never converge (the diff-anchor adoption bug). A
 *  microtask runs after the whole passive-effect flush, when every member of
 *  the formation commit has joined. */
export function useSeedGroupOnFormation(
  groupId: string | null | undefined,
  isAnchor: boolean,
  set: ((patch: ImageSyncSettings) => void) | undefined,
  snapshot: () => ImageSyncSettings,
): void {
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!groupId || !isAnchor) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setRef.current?.(snapshotRef.current());
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, isAnchor]);
}
