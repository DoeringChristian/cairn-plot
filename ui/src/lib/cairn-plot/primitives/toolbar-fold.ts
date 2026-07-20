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

/**
 * The selected index of a toolbar MENU, clamped to a real row. Shared PURE
 * helper for both menu variants — the expanded-toolbar `<ToolbarMenu>` (whose
 * button face + keyboard highlight open on the selection) and the folded
 * overflow popover's inline expandable group (whose face label reflects it). A
 * `value` that matches no option (or an empty list) yields `0`, so the face
 * never renders `undefined` and keyboarding never starts at `-1`.
 *
 * @param options  the menu's options in display order.
 * @param value    the currently-selected option id.
 * @returns the index of the matching option, or `0` when none matches.
 */
export function selectedMenuIndex(
  options: ReadonlyArray<{ id: string }>,
  value: string,
): number {
  return Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
}
