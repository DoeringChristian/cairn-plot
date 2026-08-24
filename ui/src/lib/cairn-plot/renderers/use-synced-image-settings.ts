/**
 * Settings-sync hooks over `image-settings-sync.ts` — split into the TWO halves
 * of the single-receiver model (the settings mirror of `use-synced-image-
 * viewport.ts`'s zoom/pan sync):
 *
 *   - `useReceiveImageSettings(groupId, isAnchor)` — the ONE bus SUBSCRIBER per
 *     viewport, run at the NODE level (`plot-node.tsx`'s `PaneSelectionFrame`,
 *     the enlarge `StageCell`, the live-compare `CompositeMediaPane`). It stores
 *     the COMPLETE accumulated `ImageSyncSettings` for the group and returns it;
 *     the node routes those DOWN into the pane as controlled props (display keys)
 *     and into the lowering (`compareMode`/`diffKernel`/`splitPosition`). A NON-
 *     anchor adopts the group's accumulated snapshot on JOIN (eager formation +
 *     late joiners); the ANCHOR owns the state (its pane SEEDS the group), so it
 *     never pulls the snapshot — it fills only from live patches, INCLUDING its
 *     own pane's formation seed (heard via this receiver's DISTINCT `sourceId`),
 *     which is exactly what keeps the anchor's controlled props aligned to its
 *     pane's current settings at formation (no reseed wipe).
 *
 *   - `usePublishImageSettings(groupId, isAnchor, snapshot)` — the PUBLISH half a
 *     pane keeps: a `publish(patch)` for local control changes (menu pick / slider
 *     drag) + the ANCHOR formation seed (publish the pane's full current settings
 *     when a multi-selection forms). NO subscription — the pane is NEVER a bus
 *     receiver; it is driven top-down by the node's `useReceiveImageSettings`.
 *
 * The bus stays a dumb flat blackboard (no key knowledge); both hooks are React +
 * bus only (no key knowledge) so they stay in the core bundle and unit-testable.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLastImageSettings,
  publishImageSettings,
  subscribeImageSettings,
  type ImageSyncSettings,
} from "../viewport/image-settings-sync";
import { makeImageViewportSyncSourceId } from "../viewport/image-viewport-sync";

/**
 * The ONE bus subscriber per viewport (node level). Accumulates the group's
 * complete settings and returns them (or `null` before any patch / outside a
 * group). See the module doc for the anchor-vs-joiner adoption contract.
 */
export function useReceiveImageSettings(
  groupId: string | null | undefined,
  isAnchor: boolean,
): ImageSyncSettings | null {
  const [settings, setSettings] = useState<ImageSyncSettings | null>(null);
  const sourceIdRef = useRef<string>();
  if (!sourceIdRef.current) sourceIdRef.current = makeImageViewportSyncSourceId();

  useEffect(() => {
    if (!groupId) {
      setSettings(null);
      return;
    }
    // JOIN adoption (eager formation + late joiners): a NON-anchor snaps to the
    // group's accumulated snapshot; the ANCHOR owns the state (its pane seeds it),
    // so it starts empty and fills from live patches — including its own pane's
    // formation seed (this receiver's sourceId differs from the pane's, so the
    // seed is heard here), which aligns the anchor's controlled props to its pane.
    setSettings(isAnchor ? null : (getLastImageSettings(groupId) ?? null));
    return subscribeImageSettings(groupId, sourceIdRef.current!, (patch) => {
      setSettings((prev) => ({ ...(prev ?? {}), ...patch }));
    });
  }, [groupId, isAnchor]);

  return groupId ? settings : null;
}

/**
 * The PUBLISH half a pane keeps (no subscription). `publish(patch)` broadcasts a
 * local control change; the anchor also seeds the group with its full current
 * settings on formation so every member converges to it.
 */
export function usePublishImageSettings(
  groupId: string | null | undefined,
  isAnchor: boolean,
  snapshot: () => ImageSyncSettings,
): (patch: ImageSyncSettings) => void {
  const sourceIdRef = useRef<string>();
  if (!sourceIdRef.current) sourceIdRef.current = makeImageViewportSyncSourceId();
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Anchor seeds the group with its FULL current settings when the group forms,
  // so every other member (and the anchor's own node receiver) aligns to it.
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
