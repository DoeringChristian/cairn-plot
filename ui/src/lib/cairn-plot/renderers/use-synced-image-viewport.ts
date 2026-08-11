/**
 * `useSyncedImageViewport` — the shared hook that links a controlled image
 * viewport (`{zoom,pan}`) to a selection-driven sync group via
 * `image-viewport-sync.ts`. The viewport counterpart of
 * `use-synced-image-settings.ts`'s `useSyncedImageSettings`, extracted here (out
 * of `plot-renderers.tsx`) so BOTH consumers drive it from ONE definition — no
 * duplicated sync logic:
 *   - `plot-renderers.tsx`'s `ImageStandalone` (single image leaves), and
 *   - `plot-node.tsx`'s `CompareView` (compare panes),
 * so an image leaf and a compare pane in the same selection zoom/pan in
 * lock-step.
 *
 * Behaviour (unchanged from its former home):
 *   - Joining a group adopts the last-published viewport immediately, so a pane
 *     that mounts after peers have zoomed/panned doesn't snap them back to home.
 *   - A LOCAL gesture (the returned `onViewportChange`) updates local state AND
 *     publishes to the group.
 *   - A REMOTE update (a peer's publish) only updates local state and is never
 *     re-published (the echo guard keyed on a per-pane `sourceId`), so there is
 *     no feedback loop — see `image-viewport-sync.ts`'s module doc.
 *   - The group ANCHOR (first-selected) seeds the group with its current
 *     viewport when the group forms, so newly-added members adopt the anchor's
 *     view (design req 5) rather than a stale last-published state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Viewport as ImageViewport } from "../hooks/use-image-viewport";
import {
  getLastImageViewportState,
  makeImageViewportSyncSourceId,
  publishImageViewportState,
  subscribeImageViewportState,
} from "../viewport/image-viewport-sync";

export function useSyncedImageViewport(
  groupId: string | null | undefined,
  seed: ImageViewport,
  isAnchor = false,
): [ImageViewport, (v: ImageViewport) => void] {
  const [viewport, setViewport] = useState<ImageViewport>(seed);
  const sourceIdRef = useRef<string>();
  if (!sourceIdRef.current) sourceIdRef.current = makeImageViewportSyncSourceId();
  // Current viewport in a ref so the anchor-seed effect can publish it without
  // itself re-running on every viewport change.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  useEffect(() => {
    if (!groupId) return;
    // A NON-anchor adopts the group's last-published viewport on join; the
    // anchor never adopts (it seeds the group below), so a stale viewport from a
    // prior selection session can't snap the anchor back.
    if (!isAnchor) {
      const last = getLastImageViewportState(groupId);
      if (last) setViewport(last);
    }
    return subscribeImageViewportState(groupId, sourceIdRef.current!, (state) => {
      setViewport(state);
    });
  }, [groupId, isAnchor]);

  // When THIS pane becomes the anchor of a freshly-formed selection group, seed
  // the group with its current viewport so newly-added members adopt the
  // anchor's view (design req 5) instead of a stale last-published state.
  useEffect(() => {
    if (groupId && isAnchor) {
      publishImageViewportState(groupId, sourceIdRef.current!, viewportRef.current);
    }
  }, [groupId, isAnchor]);

  const onViewportChange = useCallback(
    (v: ImageViewport) => {
      setViewport(v);
      if (groupId) publishImageViewportState(groupId, sourceIdRef.current!, v);
    },
    [groupId],
  );

  return [viewport, onViewportChange];
}
