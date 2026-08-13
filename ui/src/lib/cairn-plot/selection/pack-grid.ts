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
  /** Representative content aspect (width / height) — used for the single-cell
   *  fit and as the fallback for any cell missing a per-cell `aspects` entry.
   *  Default 1. */
  readonly aspect?: number;
  /** PER-CELL content aspects (width / height), one per cell in order. Each cell
   *  is then sized to ITS OWN content aspect within its grid slot, so every
   *  viewport matches its image — no letterbox for a differently-shaped image.
   *  Missing / non-finite entries fall back to {@link PackOptions.aspect}. */
  readonly aspects?: readonly number[];
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

  // A single pane fills the stage AT ITS CONTENT ASPECT — the largest content-
  // aspect box that fits, centred. "Cover everything" means as large as possible
  // WITHOUT an object-contain letterbox (the viewport aspect must equal the
  // content aspect, not the stage aspect — else a wide image in a tall stage
  // shows checkerboard bands top and bottom).
  if (count === 1) {
    const fit = fitContentBox(width, height, aspect);
    const rect: Rect = {
      left: (width - fit.width) / 2,
      top: (height - fit.height) / 2,
      width: fit.width,
      height: fit.height,
    };
    return { cols: 1, rows: 1, cellWidth: fit.width, cellHeight: fit.height, gap, cluster: rect, rects: [rect] };
  }

  const cols = Math.min(gridColumns(count), count);
  const rows = Math.ceil(count / cols);

  // The uniform SLOT is the largest representative-aspect box that fits a grid
  // cell — this determines the TIGHT layout (slots gap-px apart, cluster centred),
  // exactly like a uniform grid so equal-aspect images pack with no empty cross.
  const availCellW = (width - (cols - 1) * gap) / cols;
  const availCellH = (height - (rows - 1) * gap) / rows;
  const { width: slotW, height: slotH } = fitContentBox(Math.max(0, availCellW), Math.max(0, availCellH), aspect);

  // Each cell is then the largest box of ITS OWN content aspect that fits its
  // slot, centred in it: an image with the representative aspect fills the slot
  // (tight, no gap); a differently-shaped image shrinks to content aspect within
  // its own slot only — so its viewport still equals its content aspect (no
  // letterbox), without pushing the other cells apart.
  const perCell = (i: number): number => {
    const a = opts.aspects?.[i];
    return Number.isFinite(a) && (a ?? 0) > 0 ? (a as number) : aspect;
  };

  const clusterW = cols * slotW + (cols - 1) * gap;
  const clusterH = rows * slotH + (rows - 1) * gap;
  const originY = (height - clusterH) / 2;

  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const itemsInRow = Math.min(cols, count - r * cols);
    // Centre a partial final row (fewer items than `cols`) on its own.
    const rowLeft = (width - (itemsInRow * slotW + (itemsInRow - 1) * gap)) / 2;
    const slotLeft = rowLeft + c * (slotW + gap);
    const slotTop = originY + r * (slotH + gap);
    const size = fitContentBox(slotW, slotH, perCell(i));
    rects.push({
      left: slotLeft + (slotW - size.width) / 2, // content-aspect cell, centred in its tight slot
      top: slotTop + (slotH - size.height) / 2,
      width: size.width,
      height: size.height,
    });
  }

  return {
    cols,
    rows,
    cellWidth: slotW,
    cellHeight: slotH,
    gap,
    cluster: { left: (width - clusterW) / 2, top: originY, width: clusterW, height: clusterH },
    rects,
  };
}
