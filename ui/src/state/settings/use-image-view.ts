/**
 * `useImageView` — the controlled image view state (`{zoom,pan}`) as a
 * pure projection of the cell's settings entry (view
 * transforms are settings — `PlotSettings.view` — and ride the same
 * registry + group fan-out as every display key).
 *
 * There is deliberately NO component-local mirror, no bus, no echo guard, no
 * anchor-seed effect here anymore (the pre-stack bug class): reads resolve
 * `settings.view ?? seed`, writes go through the ONE settings write path —
 * `set({ view })` — which fans out to the cell's groups (the selection,
 * the stage) exactly like a colormap change. Formation convergence of the
 * view rides the anchor's full-snapshot seed (`useSeedGroupOnFormation` — the
 * pane's snapshot includes `view`).
 *
 * STORELESS FALLBACK: a bare host mount (no settings store — `set`
 * undefined) keeps a local `useState`, preserving the standalone-embed
 * behavior of a plain controlled image view.
 */
import { useCallback, useState } from "react";
import type { ImageViewState } from "../../host/hooks/use-image-gestures";
import type { PlotSettings } from "../../settings/schema.ts";

export function useImageView(
  settings: Readonly<PlotSettings> | null | undefined,
  set: ((patch: Partial<PlotSettings>) => void) | undefined,
  seed: ImageViewState,
): [ImageViewState, (v: ImageViewState) => void] {
  // Storeless fallback only — inert (and unread) while a store is present.
  const [localView, setLocalView] = useState<ImageViewState>(seed);

  const view: ImageViewState = set
    ? (settings?.["image.view"] ?? seed)
    : localView;

  const onViewChange = useCallback(
    (v: ImageViewState) => {
      if (set) set({ "image.view": v });
      else setLocalView(v);
    },
    [set],
  );

  return [view, onViewChange];
}
