/**
 * Pure planning helpers for the page-level SELECTION STAGE (the fullscreen
 * multi-pane grid). Framework-free and descriptor-free (they work on tiny
 * structural {@link SelEntry} records, not `PlotNode`s) so they are
 * unit-testable under Node's test runner with zero DOM/React — the App layer
 * (`src/selection-stage.tsx`) maps the planned ids back to concrete
 * `GridNode`/`CompareNode` descriptors it feeds to `PlotNodeView`.
 *
 * Two decisions live here:
 *   - {@link gridColumns}: the smart column count for N cells (~√N, so the grid
 *     stays roughly square) — the shared rule BOTH stages use.
 *   - {@link planCompareGrid}: from the ordered selection + the reference id,
 *     the ordered list of {foreground, reference} pairs the compare stage shows
 *     — one per NON-reference IMAGE-COMPATIBLE pane (3D/chart panes are ignored;
 *     N image panes → N−1 comparisons). Also resolves the EFFECTIVE reference
 *     when the requested one isn't image-compatible.
 */

/** A selected pane as the planner sees it: its stable id, its position in the
 *  ordered selection (implicit in array order), and whether it can take part in
 *  an image comparison (image / imagehdr / compare panes — NOT 3D or charts). */
export interface SelEntry {
  readonly paneId: string;
  readonly imageCompatible: boolean;
}

/** One comparison cell: the NON-reference foreground vs the shared reference. */
export interface ComparePair {
  readonly foregroundId: string;
  readonly referenceId: string;
}

export interface CompareGridPlan {
  /** The reference actually used (the requested one when image-compatible, else
   *  the last image-compatible entry; `null` when fewer than one exists). */
  readonly referenceId: string | null;
  /** Ordered comparison pairs (empty when fewer than 2 image-compatible panes). */
  readonly pairs: readonly ComparePair[];
}

/**
 * Column count for an N-cell grid: `ceil(sqrt(N))`, so the grid is as square as
 * possible (4 → 2 cols, 5 → 3, 9 → 3, 10 → 4). Clamped to at least 1 so an empty
 * grid still yields a valid template.
 */
export function gridColumns(count: number): number {
  if (count <= 1) return 1;
  return Math.ceil(Math.sqrt(count));
}

/**
 * Plan the compare grid from the ordered selection and the requested reference.
 *
 * Only IMAGE-COMPATIBLE entries participate; 3D/chart panes are dropped. The
 * effective reference is the requested `referenceId` when it is itself an
 * image-compatible selected pane, otherwise the LAST image-compatible entry (so
 * "last-selected = reference" still holds after filtering). Each remaining
 * image-compatible entry becomes one `{foreground, reference}` pair in selection
 * order. Fewer than two image-compatible panes ⇒ no pairs (Compare is disabled).
 */
export function planCompareGrid(
  entries: readonly SelEntry[],
  referenceId: string | null,
): CompareGridPlan {
  const images = entries.filter((e) => e.imageCompatible);
  if (images.length < 2) return { referenceId: null, pairs: [] };

  const requested = images.find((e) => e.paneId === referenceId);
  const ref = requested ?? images[images.length - 1];
  const pairs: ComparePair[] = images
    .filter((e) => e.paneId !== ref.paneId)
    .map((e) => ({ foregroundId: e.paneId, referenceId: ref.paneId }));
  return { referenceId: ref.paneId, pairs };
}

/** How many selected panes can take part in a comparison — Compare needs ≥2. */
export function imageCompatibleCount(entries: readonly SelEntry[]): number {
  let n = 0;
  for (const e of entries) if (e.imageCompatible) n++;
  return n;
}
