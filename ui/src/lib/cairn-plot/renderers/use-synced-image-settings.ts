/**
 * THE viewport settings store hook — the single access point to display
 * settings (`image-settings-sync.ts` is the underlying registry + transport).
 *
 * THE CONTRACT (user rulings, 2026-08-24/25). Every viewport owns an EXPLICIT
 * SETTINGS STACK — an ordered list of layer ids into the shared registry,
 * bottom → top (see `image-settings-sync.ts`'s stack primitives):
 *
 *     [viewport-local, selection-group?, stage-layer?, …]
 *
 * and resolves each display setting at RENDER time through one lookup:
 *
 *     top layer  >  …  >  viewport-local  >  descriptor default
 *
 * - The STACK is per-viewport; the LAYERS it references are shared. Sync is
 *   nothing but two stacks containing the same layer id (the selection group);
 *   adoption is nothing but reading through a shared layer (the stage).
 * - A gesture writes the TOP layer only. EDITS ARE TRANSIENT PER LAYER (user
 *   ruling): dropping a layer (unselect, stage close) reverts every viewport
 *   below it — values changed while the layer was on top evaporate with it.
 *   Only changes made with no scope layer write the viewport-local layer and
 *   stick.
 * - Scopes push: selection formation pushes the per-episode group layer onto
 *   members' stacks; the stage pushes its per-open layer onto its cells'.
 *   Pushes are PURE (new stack values, `pushSettingsLayer`) — layer lifetime
 *   is the pushing scope's lifetime, so pops can never be unbalanced.
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
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  clearImageSettings,
  publishToSettingsStack,
  resolveSettingsStack,
  subscribeImageSettings,
  type ImageSyncSettings,
  type SettingsLayerStack,
} from "../viewport/image-settings-sync";
import { makeImageViewportSyncSourceId } from "../viewport/image-viewport-sync";

/** What a viewport gets from its settings stack. */
export interface ViewportSettings {
  /** The stack's effective settings — every layer merged bottom → top (top
   *  shadows), or `null` while all layers are empty. Identity-stable: the same
   *  object is returned until one of the stack's layers is written (the
   *  registry's cached merge), so memoized consumers across viewports sharing
   *  a stack see one value. */
  settings: ImageSyncSettings | null;
  /** Merge a patch into the stack's TOP layer — the one write path. Transient
   *  per layer: dropping the top layer reverts everything it shadowed. */
  set: (patch: ImageSyncSettings) => void;
}

/**
 * Subscribe a viewport to its SETTINGS STACK (see the module doc + the stack
 * primitives in `image-settings-sync.ts`). `stack` is the full ordered list of
 * layer ids, bottom → top — `[viewportLocalId]` for a lone viewport, with
 * scope layers pushed on top by the callers that own them (the selection
 * group, the stage layer) via `pushSettingsLayer`. Reads resolve through the
 * registry's cached merge; writes go to the top layer; the hook re-renders
 * when any layer in the stack is written.
 */
export function useViewportSettings(stack: SettingsLayerStack): ViewportSettings {
  const sourceIdRef = useRef<string>();
  if (!sourceIdRef.current) sourceIdRef.current = makeImageViewportSyncSourceId();
  // The registry is the state; React just needs a re-render signal on writes.
  const [, bump] = useReducer((c: number) => c + 1, 0);
  // Content-keyed dep: re-subscribe only when the actual id stack changes, not
  // on every render's fresh array value.
  const stackKey = stack.join(" ");
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    const sid = sourceIdRef.current!;
    const unsubs = stackRef.current.map((id) => subscribeImageSettings(id, sid, () => bump()));
    // A layer joining / leaving changes the lookup — re-render to apply it.
    bump();
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackKey]);

  const set = useCallback(
    (patch: ImageSyncSettings) => {
      publishToSettingsStack(stackRef.current, sourceIdRef.current!, patch);
      bump(); // own writes are echo-filtered by the bus — re-render explicitly
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stackKey],
  );

  // The registry's cached merge: identity-stable until a member layer is
  // written (no per-hook memo needed — the shared cache IS the memo).
  return { settings: resolveSettingsStack(stack), set };
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
