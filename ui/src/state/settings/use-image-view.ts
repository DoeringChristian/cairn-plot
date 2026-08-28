/**
 * `useImageView` — the controlled image viewport (`{zoom,pan}`) as a
 * PURE PROJECTION of the viewport's settings entry (NOSTACK model: view
 * transforms are settings — `ViewportSettings.view` — and ride the same
 * registry + group fan-out as every display key).
 *
 * There is deliberately NO component-local mirror, no bus, no echo guard, no
 * anchor-seed effect here anymore (the pre-stack bug class): reads resolve
 * `settings.view ?? seed`, writes go through the ONE settings write path —
 * `set({ view })` — which fans out to the viewport's groups (the selection,
 * the stage) exactly like a colormap change. Formation convergence of the
 * view rides the anchor's full-snapshot seed (`useSeedGroupOnFormation` — the
 * pane's snapshot includes `view`).
 *
 * STORELESS FALLBACK: a bare host mount (no settings store — `set`
 * undefined) keeps a local `useState`, preserving the standalone-embed
 * behavior of a plain controlled viewport.
 */
import { useCallback, useState } from "react";
import type { Viewport as ImageViewport } from "../../host/hooks/use-image-viewport";
import type { ViewportSettings } from "./viewport-settings";

export function useImageView(
  settings: Readonly<ViewportSettings> | null | undefined,
  set: ((patch: Partial<ViewportSettings>) => void) | undefined,
  seed: ImageViewport,
): [ImageViewport, (v: ImageViewport) => void] {
  // Storeless fallback only — inert (and unread) while a store is present.
  const [localViewport, setLocalViewport] = useState<ImageViewport>(seed);

  const viewport: ImageViewport = set
    ? (settings?.["image.view"] ?? seed)
    : localViewport;

  const onViewportChange = useCallback(
    (v: ImageViewport) => {
      if (set) set({ "image.view": v });
      else setLocalViewport(v);
    },
    [set],
  );

  return [viewport, onViewportChange];
}
