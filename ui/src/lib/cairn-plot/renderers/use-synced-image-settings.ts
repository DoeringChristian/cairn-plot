/**
 * `useSyncedImageSettings` — the pane-side hook that links an image pane's
 * view-local DISPLAY-SETTING overrides (colormap / tonemap / gamma / peak /
 * exposure / offset) to a selection sync group via `image-settings-sync.ts`.
 * The settings mirror of `plot-renderers.tsx`'s `useSyncedImageViewport`:
 *
 *   - `publish(patch)` — call from a control's onChange (a menu pick / slider
 *     drag) to broadcast that single change to every other selected pane.
 *   - `onRemotePatch` — invoked with a peer's patch (and, on JOIN, with the
 *     group's accumulated snapshot) so the pane applies the group's settings to
 *     its own override state.
 *   - the group ANCHOR seeds the group with its full current settings when a
 *     multi-selection forms, so newly-added members adopt a complete state
 *     rather than a stale/partial one (design req 5).
 *
 * Both panes (`GpuImagePane`, `CpuImagePane`) own their override state locally
 * and are otherwise sync-agnostic; this hook is the ONLY sync-aware code they
 * carry, exactly as the adapter's `useSyncedImageViewport` keeps viewport sync
 * out of the pane bodies.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  getLastImageSettings,
  publishImageSettings,
  subscribeImageSettings,
  type ImageSyncSettings,
} from "../viewport/image-settings-sync";
import { makeImageViewportSyncSourceId } from "../viewport/image-viewport-sync";

export function useSyncedImageSettings(
  groupId: string | null | undefined,
  isAnchor: boolean,
  snapshot: () => ImageSyncSettings,
  onRemotePatch: (patch: ImageSyncSettings) => void,
): (patch: ImageSyncSettings) => void {
  const sourceIdRef = useRef<string>();
  if (!sourceIdRef.current) sourceIdRef.current = makeImageViewportSyncSourceId();
  // Latest snapshot/apply fns held in refs so the effects below can stay keyed
  // on just `[groupId, isAnchor]` without resubscribing on every render.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const remoteRef = useRef(onRemotePatch);
  remoteRef.current = onRemotePatch;

  // Subscribe to the group. A NON-anchor adopts the group's accumulated
  // settings on join (getLast); the anchor never adopts (it OWNS the group
  // state — see the seed effect below), so a stale snapshot from a prior
  // selection session can't snap the anchor.
  useEffect(() => {
    if (!groupId) return;
    if (!isAnchor) {
      const last = getLastImageSettings(groupId);
      if (last) remoteRef.current(last);
    }
    return subscribeImageSettings(groupId, sourceIdRef.current!, (patch) => {
      remoteRef.current(patch);
    });
  }, [groupId, isAnchor]);

  // Anchor seeds the group with its FULL current settings when the group forms,
  // so every other member aligns to the anchor.
  useEffect(() => {
    if (groupId && isAnchor) {
      publishImageSettings(groupId, sourceIdRef.current!, snapshotRef.current());
    }
  }, [groupId, isAnchor]);

  return useCallback(
    (patch: ImageSyncSettings) => {
      if (groupId) publishImageSettings(groupId, sourceIdRef.current!, patch);
    },
    [groupId],
  );
}
