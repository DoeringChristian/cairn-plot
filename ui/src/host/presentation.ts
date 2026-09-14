const SETTINGS_PLUMBING_KEYS = new Set([
  "syncedSettings",
  "setSyncedSettings",
  "applySyncedSettings",
  "resetSettings",
]);

/** Runtime settings enter typed backends only through BackendInput. */
export function withoutSettingsPlumbing(
  presentation: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(presentation).filter(([key]) => !SETTINGS_PLUMBING_KEYS.has(key)),
  );
}

/**
 * The props a leaf's backend actually receives: the authored node `props` with
 * the RESOLVED content laid over them.
 *
 * ## Why the merge lives here and not in `resolve`
 * A leaf node is authored in two halves — `data` (the content) and `props` (how
 * to present it: colormap, bounds, labels). `resolve` is handed only `data`, and
 * that is deliberate: `resolutionKey` keys the resolution cache on CONTENT
 * identity alone, precisely so that "changing exposure/labels must not decode
 * again" (see `resources/resolution-cache.ts`). Two heatmaps over the same
 * matrix therefore share one cache entry — so if `props` were folded into the
 * resolved value, whichever node resolved FIRST would decide the colormap for
 * both. Verified: both nodes produce the identical key
 * `…|plot:heatmap:{"kind":"inline","props":{"matrix":[[1]]}}`.
 *
 * Applying `props` HERE — after the cache, on every render — keeps both
 * properties: content is decoded once, and presentation-only props still reach
 * the view and can change without re-resolving.
 *
 * The RESOLVED content wins every collision: it is the validated payload the
 * plot type produced, and an authored prop must never be able to displace it.
 * Settings plumbing is stripped from the result exactly as before, so a node
 * cannot smuggle in settings props either.
 *
 * (This restores a merge that a refactor dropped: `presentation.test.ts` still
 * guarded a `const mergedProps = useMemo` in `PlotNodeView.tsx` that no longer
 * existed, and because it located that block with a bare `indexOf`, the guard
 * silently passed against an empty string for as long as it was missing.)
 */
export function leafPresentation(
  props: Readonly<Record<string, unknown>> | undefined,
  resolved: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return withoutSettingsPlumbing({ ...(props ?? {}), ...resolved });
}
