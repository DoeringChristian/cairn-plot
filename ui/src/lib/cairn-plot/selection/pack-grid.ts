/**
 * Pure CONTENT-ASPECT packing geometry — framework-free (no DOM/React) so it is
 * unit-testable under Node's test runner. Two decisions live here, both driven by
 * the CONTENT (image) aspect ratio rather than blindly filling the available box:
 *
 *   - {@link fitContentBox}: the largest box of a given aspect that fits inside an
 *     available WxH — the single-pane "size the drawable viewport to the content,
 *     minimise the empty margins" rule (Part 1).
 *   - {@link packContentGrid}: from N cells + a representative content aspect +
 *     the stage size, the per-cell rects for the compare/enlarge stage — cells are
 *     sized to the content aspect and CLUSTERED centrally with small gaps, rather
 *     than stretched to fill the grid quadrants (Part 2). A SINGLE cell COVERS the
 *     whole stage (no wasted bands).
 *
 * The column count reuses {@link gridColumns} (`ceil(sqrt(N))`) from
 * `compare-grid.ts` so BOTH stages agree on the grid shape. A single
 * REPRESENTATIVE aspect sizes every cell uniformly (see {@link representativeAspect})
 * — that keeps synced panes framed identically, so a synced zoom/pan lines up
 * pixel-for-pixel across cells (the viewport-sync contract).
 */
import { gridColumns } from "./compare-grid.ts";

/** Default inter-cell gap (px) — matches the stage grid's historical `gap: 8`. */
export const DEFAULT_STAGE_GAP = 8;

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The largest box of aspect `aspect` (width / height) that fits within an
 * available `availW` x `availH`, i.e. object-fit: contain applied to the BOX.
 * Degenerate inputs (non-positive available size, non-finite/≤0 aspect) fall
 * back gracefully (empty box, or the available box's own aspect).
 */
export function fitContentBox(
  availW: number,
  availH: number,
  aspect: number,
): { width: number; height: number } {
  if (!(availW > 0) || !(availH > 0)) return { width: 0, height: 0 };
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : availW / availH;
  // available box wider than the content → height is the binding constraint.
  if (availW / availH > a) return { width: availH * a, height: availH };
  // available box narrower/taller than the content → width binds.
  return { width: availW, height: availW / a };
}

/** The median of a list of finite positive numbers, or `fallback` if none. */
export function representativeAspect(aspects: readonly number[], fallback = 1): number {
  const xs = aspects.filter((a) => Number.isFinite(a) && a > 0).sort((a, b) => a - b);
  if (xs.length === 0) return fallback;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export interface PackOptions {
  /** Number of cells to place. */
  readonly count: number;
  /** Stage inner width (content box, padding already removed). */
  readonly width: number;
  /** Stage inner height (content box, padding already removed). */
  readonly height: number;
  /** Representative content aspect (width / height) for every cell. Default 1. */
  readonly aspect?: number;
  /** Inter-cell gap in px. Default {@link DEFAULT_STAGE_GAP}. */
  readonly gap?: number;
}

export interface PackResult {
  readonly cols: number;
  readonly rows: number;
  /** Uniform cell size — every cell is this size (content-aspect). */
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly gap: number;
  /** The centred cluster's bounding box within the stage. */
  readonly cluster: Rect;
  /** One rect per cell, row-major; a partial final row is centred horizontally. */
  readonly rects: Rect[];
}

/**
 * Pack `count` content-aspect cells into a `width` x `height` stage.
 *
 * A SINGLE cell COVERS the whole stage. For N > 1 the grid is `ceil(sqrt(N))`
 * columns (via {@link gridColumns}); every cell is sized to the largest box of
 * the representative `aspect` that fits its grid slot ({@link fitContentBox}),
 * and the whole cluster is CENTRED in the stage with `gap`-px gutters — so e.g.
 * four square images become four squares clustered in the middle, not four cells
 * stretched into the quadrants leaving an empty cross.
 */
export function packContentGrid(opts: PackOptions): PackResult {
  const count = Math.max(0, Math.floor(opts.count));
  const width = Math.max(0, opts.width);
  const height = Math.max(0, opts.height);
  const aspect = Number.isFinite(opts.aspect) && (opts.aspect ?? 0) > 0 ? (opts.aspect as number) : 1;
  const gap = opts.gap ?? DEFAULT_STAGE_GAP;

  if (count === 0) {
    return { cols: 0, rows: 0, cellWidth: 0, cellHeight: 0, gap, cluster: { left: 0, top: 0, width: 0, height: 0 }, rects: [] };
  }

  // A single pane COVERS the stage — the whole box, no content-aspect letterbox
  // (the task's "single image → cover the whole stage, no wasted bands").
  if (count === 1) {
    const rect: Rect = { left: 0, top: 0, width, height };
    return { cols: 1, rows: 1, cellWidth: width, cellHeight: height, gap, cluster: rect, rects: [rect] };
  }

  const cols = Math.min(gridColumns(count), count);
  const rows = Math.ceil(count / cols);

  const availCellW = (width - (cols - 1) * gap) / cols;
  const availCellH = (height - (rows - 1) * gap) / rows;
  const { width: cellWidth, height: cellHeight } = fitContentBox(
    Math.max(0, availCellW),
    Math.max(0, availCellH),
    aspect,
  );

  const clusterW = cols * cellWidth + (cols - 1) * gap;
  const clusterH = rows * cellHeight + (rows - 1) * gap;
  const originY = (height - clusterH) / 2;

  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // Centre a partial final row on its own (fewer items than `cols`).
    const itemsInRow = Math.min(cols, count - r * cols);
    const rowW = itemsInRow * cellWidth + (itemsInRow - 1) * gap;
    const rowLeft = (width - rowW) / 2;
    rects.push({
      left: rowLeft + c * (cellWidth + gap),
      top: originY + r * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
    });
  }

  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    gap,
    cluster: { left: (width - clusterW) / 2, top: originY, width: clusterW, height: clusterH },
    rects,
  };
}
