/**
 * `plots/scalar/render-rows.ts` — the scalar chart's render data.
 *
 * Recharts wants one row per x with a column per series key. Building those
 * rows from every point is what made a 10 000-point chart slow, so this module
 * builds them from the pixel-reduced windows instead: per visible series, clip
 * to the x-domain ({@link visibleWindow}), pick the ≤ 5 indices per screen
 * column that a line can actually show ({@link reduceToColumns}), snap those
 * picks onto a grid SHARED by every series, materialise a reduced `Series` and
 * hand it to the unchanged {@link mergeToRows}. The row shape is therefore
 * identical to the unreduced one — tooltip, legend and the `<Line dataKey>`s
 * are untouched.
 *
 * ## Why the picks are snapped to a shared grid
 * Recharts' per-render cost is `graphical items × merged rows`, not
 * `Σ points`: for every `<Line>` it rebuilds the whole categorical tick array
 * of the x-axis (`getTicksOfAxis` inside `getFormatItems`, one call per item
 * per axis) and maps the whole row array. Unsnapped, each series' M4 picks land
 * on ITS OWN x — first/last coincide across series but the per-column min and
 * max do not — so the union is ≈ series × 4 × columns and the cost is quadratic
 * in the series count. Measured on 10 × 100 000 in 746 columns: 13 918 merged
 * rows, 320 ms per re-render, of which 235 ms was `getFormatItems`.
 *
 * Snapping every pick to one of `SLOTS` fixed positions inside its column makes
 * all series agree on the x grid, so the union collapses to ≤ SLOTS × columns
 * (≈ 3 700 here) no matter how many series there are.
 *
 * Giving each `<Line>` its own `data` array instead was measured and is WORSE:
 * Recharts then concatenates every item's array into `displayedData`, so the
 * per-item tick rebuild grows from `union` to `Σ series`, and the same window
 * cost 455 ms.
 *
 * The snap moves a point by at most half a slot — a tenth of a pixel — so the
 * drawn line is unchanged. In data units it is a fraction of one column, which
 * is the tooltip precision the design already states (§5: "tooltips snap to the
 * nearest reduced point, which is at most one column away"). It is applied ONLY
 * where the reduction is actually binning; a window small enough to be drawn
 * point-for-point keeps its exact x.
 *
 * Pure and synchronous: the caller memoises on
 * `(prepared identities, visibility, x0, x1, columns)`.
 */
import type { Series, SeriesPoint } from "../types.ts";
import { visibleWindow } from "../transforms/visible-window.ts";
import { reduceToColumns } from "../transforms/pixel-reduce.ts";
import { mergeToRows } from "../transforms/merge-rows.ts";
import type { PreparedSeries } from "./prepared-series.ts";

export type Row = { x: number } & Record<string, number | null | string>;

/** Snap positions per column — `reduceToColumns` emits at most this many picks. */
const SLOTS = 5;

/**
 * Reduced rows for `prepared`, restricted to the series `visible` accepts.
 *
 * `x0`/`x1` are the effective x-domain in DATA units (as the axis shows them,
 * log or not); `columns` is the plot width in pixels. On a log axis the
 * windowing, the column binning and the snap all run in log10(x) — screen
 * columns are uniform in log10(x), not in x — but the rows carry data-unit x so
 * the axis and the tooltip need know nothing about it.
 */
export function buildRenderRows(
  prepared: readonly PreparedSeries[],
  visible: (key: string) => boolean,
  x0: number,
  x1: number,
  columns: number,
  logX: boolean,
): Row[] {
  const lo = logX ? logBound(x0) : x0;
  const hi = logX ? logBound(x1) : x1;

  // Pass 1: window every visible series, and learn the axis span the columns
  // (and therefore the shared snap grid) are laid out over.
  const windows: Array<{ p: PreparedSeries; axis: Float64Array; start: number; end: number }> = [];
  let dataLo = Infinity;
  let dataHi = -Infinity;
  for (const p of prepared) {
    if (p.n === 0 || !visible(p.key)) continue;
    // On a log axis the first `logStart` points have x <= 0 (NaN in `logXs`)
    // and cannot be placed at all, so the window starts past them.
    const axis = logX ? p.logXs : p.xs;
    if (!axis) continue; // logX asked for without a prepared log array
    const offset = logX ? p.logStart : 0;
    if (offset >= p.n) continue;
    const [ws, we] = visibleWindow(axis.subarray(offset, p.n), lo, hi);
    const start = ws + offset;
    const end = we + offset;
    windows.push({ p, axis, start, end });
    if (axis[start]! < dataLo) dataLo = axis[start]!;
    if (axis[end - 1]! > dataHi) dataHi = axis[end - 1]!;
  }
  if (windows.length === 0) return [];

  // Column edges: the domain when it is usable, else the windows' own span (an
  // unusable domain would otherwise make `reduceToColumns` pass every point
  // through). Shared by every series — that is what makes the grid shared.
  let binLo = lo ?? NaN;
  let binHi = hi ?? NaN;
  if (!(binHi > binLo)) { binLo = dataLo; binHi = dataHi; }
  const width = (binHi - binLo) / columns;

  const picks: Array<{ p: PreparedSeries; axis: Float64Array; idx: Int32Array; binned: boolean }> = [];
  let allBinned = true;
  for (const { p, axis, start, end } of windows) {
    const idx = reduceToColumns(axis, p.ys, start, end, binLo, binHi, columns, p.lo, p.hi);
    if (idx.length === 0) continue;
    // `reduceToColumns` passes small windows through untouched; those keep
    // their exact x (and may hold more than SLOTS points in a column).
    const binned = width > 0 && end - start > 2 * columns;
    if (!binned) allBinned = false;
    picks.push({ p, axis, idx, binned });
  }
  if (picks.length === 0) return [];

  const grid: Grid = { binLo, width, columns, logX };
  if (allBinned) return mergeOnGrid(picks.map((q) => [q.p, q.axis, q.idx] as const), grid);
  // Mixed or exact windows: no shared grid to merge on, so go through the
  // general row merge. These windows are small by construction.
  return mergeToRows(picks.map(
    ({ p, axis, idx, binned }) => reduceSeries(p, axis, idx, binned ? grid : null),
  ));
}

/**
 * Merge series that all snapped to the same grid, straight into rows.
 *
 * Every point's row is addressed by `column * SLOTS + slot`, so the rows can be
 * filled in a flat array and read back already x-ascending: no hash of float x
 * and no final sort, which is what the general {@link mergeToRows} would have
 * to do. On the measured fixture this is the difference between ~10 ms and
 * ~2 ms per rebuild.
 */
function mergeOnGrid(
  picks: ReadonlyArray<readonly [PreparedSeries, Float64Array, Int32Array]>,
  grid: Grid,
): Row[] {
  const cells: Array<Row | undefined> = new Array(grid.columns * SLOTS);
  let used = 0;
  for (const [p, axis, idx] of picks) {
    const { key, ys, rawYs, points } = p;
    const rawKey = `${key}__raw`;
    const wallKey = `${key}__wall`;
    const ctxKey = `${key}__ctx`;
    let col = -1;
    let slot = 0;
    for (let i = 0; i < idx.length; i++) {
      const j = idx[i]!;
      const c = columnOf(axis[j]!, grid);
      if (c !== col) { col = c; slot = 0; } else if (slot < SLOTS - 1) slot++;
      const cell = c * SLOTS + slot;
      let row = cells[cell];
      if (row === undefined) {
        row = { x: xOfSlot(c, slot, grid) };
        cells[cell] = row;
        used++;
      }
      row[key] = ys[j]!;
      if (rawYs) row[rawKey] = rawYs[j]!;
      const src = points[j]!;
      if (src.wallTime != null) row[wallKey] = src.wallTime;
      if (src.context != null) row[ctxKey] = src.context;
    }
  }
  const out: Row[] = new Array(used);
  let n = 0;
  for (let i = 0; i < cells.length; i++) {
    const row = cells[i];
    if (row !== undefined) out[n++] = row;
  }
  return out;
}

/** The column a point at axis position `pos` falls in — as `reduceToColumns` counts it. */
function columnOf(pos: number, grid: Grid): number {
  return Math.min(grid.columns - 1, Math.max(0, Math.floor((pos - grid.binLo) / grid.width)));
}

/** The shared x of one slot, in DATA units. */
function xOfSlot(column: number, slot: number, grid: Grid): number {
  const pos = grid.binLo + (column + (slot + 0.5) / SLOTS) * grid.width;
  return grid.logX ? 10 ** pos : pos;
}

/** log10 for a positive bound; null (unbounded) for anything a log axis cannot place. */
function logBound(x: number): number | null {
  return x > 0 && Number.isFinite(x) ? Math.log10(x) : null;
}

interface Grid { binLo: number; width: number; columns: number; logX: boolean }

/**
 * A `Series` over the selected indices only. `y` is the smoothed value from
 * `ys`; `wallTime`/`context` ride along on the original point (reused as-is
 * when nothing changed, so an unsmoothed, unsnapped window allocates no
 * points). With a `grid`, x is the centre of the pick's slot in its column —
 * the same value for every series, which is what collapses the merged union.
 */
function reduceSeries(p: PreparedSeries, axis: Float64Array, idx: Int32Array, grid: Grid | null): Series {
  const { xs, ys, rawYs, points } = p;
  const n = idx.length;
  const out: SeriesPoint[] = new Array(n);
  const raw: SeriesPoint[] | null = rawYs ? new Array(n) : null;
  let col = -1;
  let slot = 0;
  for (let i = 0; i < n; i++) {
    const j = idx[i]!;
    const src = points[j]!;
    const y = ys[j]!;
    let x = xs[j]!;
    if (grid) {
      // Same column arithmetic as `reduceToColumns`, so the picks of a column
      // are exactly the picks this counts; they arrive in ascending index
      // order, which is the order the slots are handed out in.
      const c = columnOf(axis[j]!, grid);
      if (c !== col) { col = c; slot = 0; } else if (slot < SLOTS - 1) slot++;
      x = xOfSlot(c, slot, grid);
    }
    out[i] = src.x === x && src.y === y ? src : { ...src, x, y };
    if (raw) raw[i] = { x, y: rawYs![j]! };
  }
  return { key: p.key, label: p.key, color: "", points: out, rawPoints: raw };
}
