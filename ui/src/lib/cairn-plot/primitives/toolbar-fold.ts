/**
 * `primitives/toolbar-fold.ts` — the PURE decision behind `<PlotToolbar>`'s
 * responsive fold (requirement A). Kept DOM-free so it's unit-testable on its
 * own (see `toolbar-fold.test.ts`); the toolbar supplies the measured widths
 * from a `ResizeObserver` on the pane root and toggles its rendered form on the
 * boolean this returns.
 *
 * ## Why a cached expanded width + hysteresis
 * The toolbar collapses to a single "⋯" button when its full button row would
 * overflow the pane. But once folded, its live DOM width is just that one
 * button — measuring THAT would say "plenty of room" and immediately un-fold,
 * giving an infinite fold/unfold oscillation at the boundary. So the caller
 * measures and caches the width of the EXPANDED toolbar (only while it is
 * actually expanded) and passes that stable number here; this function compares
 * the pane's width against it (plus a small safety gap) with no re-measurement
 * while folded.
 */

/** A little breathing room so the toolbar never sits pixel-flush with the pane
 *  edge before folding (also absorbs sub-pixel rounding in the measurements). */
export const TOOLBAR_FOLD_SAFETY_PX = 8;

/**
 * Decide whether the toolbar should render folded.
 *
 * @param containerWidth  the pane root's current width (px).
 * @param expandedWidth   the last-measured width of the EXPANDED toolbar (px);
 *                        `0`/unknown means "not measured yet".
 * @param currentlyFolded the toolbar's current folded state (for the
 *                        not-yet-measured hold below).
 * @param safety          extra gap required beyond `expandedWidth`.
 * @returns `true` when the pane is too narrow to hold the expanded toolbar.
 */
export function computeToolbarFold(
  containerWidth: number,
  expandedWidth: number,
  currentlyFolded: boolean,
  safety: number = TOOLBAR_FOLD_SAFETY_PX,
): boolean {
  // No usable measurement yet (first paint / detached node): don't flip the
  // current state — flipping on a bogus 0 would flash the wrong form.
  if (!(expandedWidth > 0) || !(containerWidth > 0)) return currentlyFolded;
  return containerWidth < expandedWidth + safety;
}
