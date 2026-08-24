/**
 * THE viewport settings store hook — the single access point to display
 * settings (`image-settings-sync.ts` is the underlying registry + transport).
 *
 * THE CONTRACT (user ruling, 2026-08-24). Every viewport resolves each display
 * setting at RENDER time through one lookup:
 *
 *     group store  >  local store  >  descriptor default
 *
 * - Every viewport owns a LOCAL store (a group of one, keyed by a stable
 *   per-viewport id). A user gesture on the viewport writes the local store —
 *   AND the group store while selected — so *your own picks stick*.
 * - Selection adds the GROUP store in front: group values SHADOW local values,
 *   they never overwrite them. Peer patches land only in the group store, so
 *   leaving a selection unmasks exactly the settings you had before joining —
 *   borrowed values evaporate, your gestures survive.
 * - Application is pure downward propagation: no consumer adopts values into
 *   its own state (no adoption effects); applicability (does a LUT apply at
 *   this arity?) is decided at render, never at sync (ruling 5).
 *
 * ONE hook, run at the NODE level (`plot-node.tsx`'s `PaneSelectionFrame`, the
 * enlarge `StageCell`): the single bus subscriber per viewport. `settings` and
 * `set` are handed DOWN to the panes as props (the core/addon bundle split
 * rules out context). Panes never subscribe; they render `settings` and call
 * `set(patch)` from genuine user gestures. The anchor still seeds a forming
 * group with its full current settings (the pane-side formation effect — the
 * pane owns the snapshot of its effective values).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  clearImageSettings,
  getLastImageSettings,
  publishImageSettings,
  subscribeImageSettings,
  type ImageSyncSettings,
} from "../viewport/image-settings-sync";
import { makeImageViewportSyncSourceId } from "../viewport/image-viewport-sync";

/** What a viewport gets from its settings store. */
export interface ViewportSettings {
  /** The merged effective settings (`{...local, ...group}`), or `null` while
   *  both stores are empty. Group keys shadow local keys. */
  settings: ImageSyncSettings | null;
  /** Merge a patch: always into the LOCAL store (gestures stick), and into the
   *  GROUP store while selected (peers follow). The one write path. */
  set: (patch: ImageSyncSettings) => void;
}

/**
 * The viewport's settings store. `viewportId` is the viewport's own stable
 * store id (its "group of one"); `groupId` is the selection group while one
 * exists. Both stores live in the shared registry (`lastStates`), so local
 * settings survive re-lowers/remounts of the React tree.
 */
export function useViewportSettings(
  viewportId: string,
  groupId: string | null | undefined,
  isAnchor: boolean,
): ViewportSettings {
  const sourceIdRef = useRef<string>();
  if (!sourceIdRef.current) sourceIdRef.current = makeImageViewportSyncSourceId();
  // The registry is the state; React just needs a re-render signal on writes.
  const [version, bump] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    const sid = sourceIdRef.current!;
    const unLocal = subscribeImageSettings(viewportId, sid, () => bump());
    const unGroup = groupId ? subscribeImageSettings(groupId, sid, () => bump()) : undefined;
    // Joining / leaving a group changes the lookup — re-render to apply it.
    bump();
    return () => {
      unLocal();
      unGroup?.();
    };
  }, [viewportId, groupId, isAnchor]);

  const set = useCallback(
    (patch: ImageSyncSettings) => {
      const sid = sourceIdRef.current!;
      publishImageSettings(viewportId, sid, patch); // gestures stick locally
      if (groupId) publishImageSettings(groupId, sid, patch); // peers follow
      bump(); // own writes are echo-filtered by the bus — re-render explicitly
    },
    [viewportId, groupId],
  );

  // Stable identity per write (children memo on it): re-merged only on a store
  // write (`version`) or a lookup change (join/leave).
  const settings = useMemo(() => {
    const local = getLastImageSettings(viewportId);
    const group = groupId ? getLastImageSettings(groupId) : undefined;
    return local || group ? { ...local, ...group } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportId, groupId, version]);
  return { settings, set };
}

/** Anchor formation seed, run by the PANE (it owns the snapshot of its
 *  effective values): when a group forms around this viewport as the anchor,
 *  the group store starts EMPTY (cleared — the static selection group id would
 *  otherwise leak stale keys from past selections into every member) and is
 *  seeded with the anchor's full current settings, so the group converges to
 *  exactly the clicked viewport's state and nothing else. */
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
    if (groupId && isAnchor) {
      clearImageSettings(groupId);
      setRef.current?.(snapshotRef.current());
    }
  }, [groupId, isAnchor]);
}
