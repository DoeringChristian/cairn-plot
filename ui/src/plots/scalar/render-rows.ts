/**
 * `plots/scalar/render-rows.ts` — the scalar chart's render data.
 *
 * Recharts wants one row per x with a column per series key. Building those
 * rows from every point is what made a 10 000-point chart slow, so this module
 * builds them from the pixel-reduced windows instead: per visible series, clip
 * to the x-domain ({@link visibleWindow}), pick the ≤ 5 indices per screen
 * column that a line can actually show ({@link reduceToColumns}), snap those
 * picks onto a grid SHARED by every series, and fill the merged rows directly.
 * The row shape is identical to the unreduced one `transforms/merge-rows.ts`
 * produces — tooltip, legend and the `<Line dataKey>`s are untouched — plus a
 * `__x` column carrying the real x of the pick that opened each row, which the
 * tooltip shows in place of the (fractional) slot centre the point is drawn at.
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
import { columnOf, reduceToColumns } from "../transforms/pixel-reduce.ts";
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

  const grid: Grid = { binLo, binHi, width, columns, logX };
  const binnedPicks: Pick[] = [];
  const loose: Series[] = [];
  for (const { p, axis, start, end } of windows) {
    const idx = reduceToColumns(axis, p.ys, start, end, binLo, binHi, columns, p.lo, p.hi);
    if (idx.length === 0) continue;
    // `reduceToColumns` passes small windows through untouched (the exact same
    // condition), and those keep their exact x — there is no column grid to
    // snap them to, and they may hold more than SLOTS points in a column.
    if (!(width > 0 && end - start > 2 * columns)) {
      loose.push(reduceSeries(p, idx));
      continue;
    }
    // The faint raw overlay is an ENVELOPE, not a curve: two picks per column
    // (the extremes of `rawYs`) say everything a translucent band can say, and
    // cost 2 of the 4-5 points per column the smoothed curve needs. See
    // `envelopeColumns`.
    const raw = p.rawYs
      ? envelopeColumns(axis, p.rawYs, start, end, binLo, width, columns, p.lo, p.hi)
      : null;
    binnedPicks.push({ p, axis, idx, raw });
  }
  if (binnedPicks.length === 0 && loose.length === 0) return [];

  const rows = binnedPicks.length > 0 ? mergeOnGrid(binnedPicks, grid) : [];
  // A series small enough to draw point-for-point must not drag the others off
  // the shared grid: it is merged INTO the grid rows by exact x instead.
  return loose.length > 0 ? mergeLoose(rows, loose) : rows;
}

/**
 * Fold point-for-point series into rows that are already on the shared grid.
 *
 * Their x are exact and arbitrary, so this is the general merge — a map keyed by
 * x and a sort — but it only ever runs over the few series small enough to have
 * escaped the reduction, plus the grid rows they join.
 */
function mergeLoose(rows: Row[], loose: readonly Series[]): Row[] {
  const byX = new Map<number, Row>();
  for (const row of rows) byX.set(row.x, row);
  for (const s of loose) {
    const overlay = isOverlayKey(s.key);
    for (const pt of s.points) {
      let row = byX.get(pt.x);
      if (row === undefined) { row = { x: pt.x, __x: pt.x }; byX.set(pt.x, row); }
      row[s.key] = pt.y;
      if (overlay) continue;
      if (pt.wallTime != null) row[`${s.key}__wall`] = pt.wallTime;
      if (pt.context != null) row[`${s.key}__ctx`] = pt.context;
    }
    if (!s.rawPoints) continue;
    for (const pt of s.rawPoints) {
      let row = byX.get(pt.x);
      if (row === undefined) { row = { x: pt.x, __x: pt.x }; byX.set(pt.x, row); }
      row[`${s.key}__raw`] = pt.y;
    }
  }
  return Array.from(byX.values()).sort((a, b) => a.x - b.x);
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
    const c = columnOf(axis[i]!, binLo, width, columns);
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
 * and no final sort, which is what a general merge by x has to do. On the
 * measured fixture this is the difference between ~10 ms and ~2 ms per rebuild.
 */
function mergeOnGrid(picks: readonly Pick[], grid: Grid): Row[] {
  const cells: Array<Row | undefined> = new Array(grid.columns * SLOTS);
  // Points the window-widening step reached for — one either side of the
  // domain — sit OUTSIDE the columns. Clamping them into column 0 / the last
  // column would draw them inside the frame, which on a non-uniform x looks
  // like a spike; they keep their exact x and their own rows instead.
  const outside = new Map<number, Row>();

  const cellAt = (column: number, slot: number, exactX: number): Row => {
    const at = column * SLOTS + slot;
    let row = cells[at];
    if (row === undefined) {
      // `x` positions the point (the shared slot centre, which is what makes
      // the grid shared); `__x` is the real x of the pick that opened the cell,
      // for the tooltip to show instead of a fractional slot centre.
      row = { x: xOfSlot(column, slot, grid), __x: exactX };
      cells[at] = row;
    }
    return row;
  };
  const outsideAt = (exactX: number): Row => {
    let row = outside.get(exactX);
    if (row === undefined) { row = { x: exactX, __x: exactX }; outside.set(exactX, row); }
    return row;
  };
  const isOutside = (pos: number) => pos < grid.binLo || pos > grid.binHi;

  // Curves first, for EVERY series, so the envelopes below can settle into
  // cells any series' curve has opened rather than opening their own.
  for (const { p, axis, idx, raw } of picks) {
    const { key, xs, ys, rawYs, points } = p;
    const overlay = isOverlayKey(key);
    // Without its own envelope (no `rawYs`) the overlay rides the curve's picks.
    const rawOnCurve = rawYs !== null && raw === null;
    const rawKey = `${key}__raw`;
    const wallKey = `${key}__wall`;
    const ctxKey = `${key}__ctx`;
    let col = -1;
    let slot = 0;
    for (let i = 0; i < idx.length; i++) {
      const j = idx[i]!;
      const pos = axis[j]!;
      let row: Row;
      if (isOutside(pos)) {
        row = outsideAt(xs[j]!);
      } else {
        const c = columnOf(pos, grid.binLo, grid.width, grid.columns);
        if (c !== col) { col = c; slot = 0; } else slot++;
        // For a CONTIGUOUS run of picks in one column the cap is unreachable:
        // `reduceToColumns` emits at most SLOTS per column and shares
        // `columnOf` with this loop, so the runs agree exactly. But the run is
        // only reset when the column CHANGES, so a non-monotonic axis (or a
        // NaN position, which `columnOf` puts in column 0) can return to a
        // column and push past the cap. That degrades to overwriting the last
        // slot — this is the render path, and losing one pick of a broken
        // series is always better than throwing the chart away.
        if (slot >= SLOTS) slot = SLOTS - 1;
        row = cellAt(c, slot, xs[j]!);
      }
      row[key] = ys[j]!;
      if (rawOnCurve) row[rawKey] = rawYs![j]!;
      if (overlay) continue; // a `${key}__raw` series is an overlay, not a series
      const src = points[j]!;
      if (src.wallTime != null) row[wallKey] = src.wallTime;
      if (src.context != null) row[ctxKey] = src.context;
    }
  }

  // Envelopes second. Each column's two picks go into cells the curves already
  // opened — nearest to the middle of the column — so the band adds ink without
  // adding rows that would show a series' label with no value under the cursor.
  for (const { p, axis, raw } of picks) {
    const { key, xs, rawYs } = p;
    if (!raw || !rawYs) continue;
    const rawKey = `${key}__raw`;
    let rawCol = -1;
    let nth = 0;
    // The slot the column's FIRST envelope pick took. The second must not land
    // on it: both picks searching outwards from their own `want` can otherwise
    // converge on the same row, and the band — whose whole content is the
    // spread between the two — collapses to a point. This bites exactly where
    // the band matters least visually but most often: a column with only one
    // or two open curve slots, which is most columns once the point count is
    // near 2 per column.
    let firstSlot = -1;
    for (let i = 0; i < raw.length; i++) {
      const j = raw[i]!;
      const pos = axis[j]!;
      if (isOutside(pos)) { outsideAt(xs[j]!)[rawKey] = rawYs[j]!; continue; }
      const c = columnOf(pos, grid.binLo, grid.width, grid.columns);
      nth = c === rawCol ? nth + 1 : 0;
      rawCol = c;
      const first = nth === 0;
      const slot = openSlotNear(cells, c, first ? 1 : 3, first ? -1 : firstSlot);
      if (first) firstSlot = slot;
      cellAt(c, slot, xs[j]!)[rawKey] = rawYs[j]!;
    }
  }

  // Built by `push`: a hole (an `undefined` row inside the array) would reach
  // Recharts as a row with no `x` at all, so the length is never assumed.
  const grid_: Row[] = [];
  for (let i = 0; i < cells.length; i++) {
    const row = cells[i];
    if (row !== undefined) grid_.push(row);
  }
  if (outside.size === 0) return grid_;
  // Grid rows are ascending by construction and every outside row is beyond one
  // end of the grid, so one sort of the few strays and a three-way splice is
  // enough — no re-sort of the whole array.
  const strays = Array.from(outside.values()).sort((a, b) => a.x - b.x);
  const before = strays.filter((r) => grid_.length === 0 || r.x < grid_[0]!.x);
  const after = strays.filter((r) => grid_.length > 0 && r.x >= grid_[0]!.x);
  return [...before, ...grid_, ...after];
}

/**
 * The slot in `column` nearest `want` that a curve has already opened, or
 * `want` itself when the column is empty.
 *
 * `exclude` (-1 for none) is a slot the caller has already used for this
 * column's other envelope pick: reusing it would write the second value over
 * the first in the same row and flatten the band. When it is the only open
 * slot, a NEW cell is opened instead — one extra row is a far smaller cost
 * than a band that says nothing.
 *
 * SLOTS is 5, so this is a handful of array reads — cheaper than the row it
 * saves allocating, and much cheaper than the blank tooltip entry that row
 * would produce.
 */
function openSlotNear(
  cells: ReadonlyArray<Row | undefined>, column: number, want: number, exclude = -1,
): number {
  const base = column * SLOTS;
  for (let d = 0; d < SLOTS; d++) {
    const lo = want - d;
    if (lo >= 0 && lo !== exclude && cells[base + lo] !== undefined) return lo;
    const hi = want + d;
    if (hi < SLOTS && hi !== exclude && cells[base + hi] !== undefined) return hi;
  }
  if (want !== exclude) return want;
  return want + 1 < SLOTS ? want + 1 : want - 1;
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

interface Grid { binLo: number; binHi: number; width: number; columns: number; logX: boolean }

/** One series' selected indices: the curve's M4 picks, and the overlay's envelope. */
interface Pick {
  p: PreparedSeries;
  axis: Float64Array;
  /** Curve picks, ≤ 5 per column. */
  idx: Int32Array;
  /** Overlay picks, ≤ 2 per column; null when the overlay rides `idx` instead. */
  raw: Int32Array | null;
}

/**
 * A `${key}__raw` series is the faint overlay of `key`, not a series of its own:
 * it contributes only its value column. (This is the dataKey convention the row
 * merge has always used — a real series key ending in `__raw` would already
 * collide with its own overlay's column.)
 */
function isOverlayKey(key: string): boolean {
  return key.endsWith("__raw");
}

/**
 * A `Series` over the selected indices only, at their EXACT x — this is the
 * point-for-point path, where `reduceToColumns` passed the window through and
 * there is no column grid to snap to. `y` is the smoothed value from `ys`;
 * `wallTime`/`context` ride along on the original point, which is reused as-is
 * when nothing changed, so an unsmoothed window allocates no points at all.
 */
function reduceSeries(p: PreparedSeries, idx: Int32Array): Series {
  const { xs, ys, rawYs, points } = p;
  const n = idx.length;
  const out: SeriesPoint[] = new Array(n);
  const raw: SeriesPoint[] | null = rawYs ? new Array(n) : null;
  for (let i = 0; i < n; i++) {
    const j = idx[i]!;
    const src = points[j]!;
    const y = ys[j]!;
    out[i] = src.y === y ? src : { ...src, y };
    if (raw) raw[i] = { x: xs[j]!, y: rawYs![j]! };
  }
  return { key: p.key, label: p.key, color: "", points: out, rawPoints: raw };
}
