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
 * ## The raw overlay is an envelope
 * The faint unsmoothed line behind each curve is drawn at 0.2 opacity, and the
 * only thing it can communicate at one point per pixel is how far the raw values
 * spread. So it gets its own reduction — the min and the max of `rawYs` per
 * column, ≤ 2 picks instead of the curve's 4-5 — on the same shared grid, which
 * takes roughly a quarter of the drawn points out of a ten-series chart without
 * changing what the band shows.
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

  const picks: Pick[] = [];
  let allBinned = true;
  for (const { p, axis, start, end } of windows) {
    const idx = reduceToColumns(axis, p.ys, start, end, binLo, binHi, columns, p.lo, p.hi);
    if (idx.length === 0) continue;
    // `reduceToColumns` passes small windows through untouched; those keep
    // their exact x (and may hold more than SLOTS points in a column).
    const binned = width > 0 && end - start > 2 * columns;
    if (!binned) allBinned = false;
    // The faint raw overlay is an ENVELOPE, not a curve: two picks per column
    // (the extremes of `rawYs`) say everything a translucent band can say, and
    // cost 2 of the 4-5 points per column the smoothed curve needs. See
    // `envelopeColumns`.
    const raw = binned && p.rawYs
      ? envelopeColumns(axis, p.rawYs, start, end, binLo, width, columns, p.lo, p.hi)
      : null;
    picks.push({ p, axis, idx, raw, binned });
  }
  if (picks.length === 0) return [];

  const grid: Grid = { binLo, width, columns, logX };
  if (allBinned) return mergeOnGrid(picks, grid);
  // Mixed or exact windows: no shared grid to merge on, so go through the
  // general row merge. These windows are small by construction, so the overlay
  // simply rides the curve's picks there.
  return mergeToRows(picks.map(
    ({ p, axis, idx, binned }) => reduceSeries(p, axis, idx, binned ? grid : null),
  ));
}

/**
 * The indices of the smallest and largest `ys` in each column, in index order.
 *
 * This is the raw overlay's whole reduction: at most `2 * columns` indices for a
 * band that is drawn at 0.2 opacity behind the smoothed line, where the only
 * readable information is how far the unsmoothed values spread. One tight pass
 * with no per-column allocation, unlike {@link reduceToColumns} (which also has
 * to keep the first/last of every column to preserve a LINE's shape).
 *
 * `lo`/`hi` clip exactly as they do there: an out-of-band value never opens a
 * column. NaN gaps are skipped — the envelope is not the series' gap record,
 * the curve above it is.
 */
function envelopeColumns(
  axis: Float64Array, ys: Float64Array, start: number, end: number,
  binLo: number, width: number, columns: number, lo: number, hi: number,
): Int32Array {
  const out = new Int32Array(2 * columns);
  let n = 0;
  let col = -1;
  let minI = -1;
  let maxI = -1;
  const flush = () => {
    if (minI < 0) return;
    if (minI <= maxI) { out[n++] = minI; if (maxI !== minI) out[n++] = maxI; }
    else { out[n++] = maxI; out[n++] = minI; }
    minI = maxI = -1;
  };
  for (let i = start; i < end; i++) {
    const c = Math.min(columns - 1, Math.max(0, Math.floor((axis[i]! - binLo) / width)));
    if (c !== col) { flush(); col = c; }
    const y = ys[i]!;
    if (Number.isNaN(y) || y < lo || y > hi) continue;
    if (minI < 0 || y < ys[minI]!) minI = i;
    if (maxI < 0 || y > ys[maxI]!) maxI = i;
  }
  flush();
  return out.subarray(0, n);
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
function mergeOnGrid(picks: readonly Pick[], grid: Grid): Row[] {
  const cells: Array<Row | undefined> = new Array(grid.columns * SLOTS);
  let used = 0;
  const cellAt = (column: number, slot: number): Row => {
    const at = column * SLOTS + slot;
    let row = cells[at];
    if (row === undefined) {
      row = { x: xOfSlot(column, slot, grid) };
      cells[at] = row;
      used++;
    }
    return row;
  };
  for (const { p, axis, idx, raw } of picks) {
    const { key, ys, rawYs, points } = p;
    const wallKey = `${key}__wall`;
    const ctxKey = `${key}__ctx`;
    let col = -1;
    let slot = 0;
    for (let i = 0; i < idx.length; i++) {
      const j = idx[i]!;
      const c = columnOf(axis[j]!, grid);
      if (c !== col) { col = c; slot = 0; } else if (slot < SLOTS - 1) slot++;
      const row = cellAt(c, slot);
      row[key] = ys[j]!;
      // Without its own envelope (no `rawYs`, or an unbinned window) the
      // overlay rides the curve's picks, as it always has.
      if (rawYs && !raw) row[`${key}__raw`] = rawYs[j]!;
      const src = points[j]!;
      if (src.wallTime != null) row[wallKey] = src.wallTime;
      if (src.context != null) row[ctxKey] = src.context;
    }
    if (!raw || !rawYs) continue;
    // The envelope's two picks go in the SAME columns, at fixed slots, so they
    // land on rows the curve has usually already opened and the union stays
    // capped at SLOTS × columns. Slots 1 and 3 keep them inside the column and
    // in the drawn order the pass emitted them (lower index first).
    const rawKey = `${key}__raw`;
    let rawCol = -1;
    for (let i = 0; i < raw.length; i++) {
      const j = raw[i]!;
      const c = columnOf(axis[j]!, grid);
      const first = c !== rawCol;
      rawCol = c;
      cellAt(c, first ? 1 : 3)[rawKey] = rawYs[j]!;
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

/** One series' selected indices: the curve's M4 picks, and the overlay's envelope. */
interface Pick {
  p: PreparedSeries;
  axis: Float64Array;
  /** Curve picks, ≤ 5 per column. */
  idx: Int32Array;
  /** Overlay picks, ≤ 2 per column; null when the overlay rides `idx` instead. */
  raw: Int32Array | null;
  binned: boolean;
}

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
