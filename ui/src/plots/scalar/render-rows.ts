/**
 * `plots/scalar/render-rows.ts` — the scalar chart's render data.
 *
 * Recharts wants one row per x with a column per series key. Building those
 * rows from every point is what made a 10 000-point chart slow, so this module
 * builds them from the pixel-reduced windows instead: per visible series, clip
 * to the x-domain ({@link visibleWindow}), pick the ≤ 5 indices per screen
 * column that a line can actually show ({@link reduceToColumns}), materialise
 * a reduced {@link Series} from the prepared typed arrays, and hand those to
 * the unchanged {@link mergeToRows}. The row SHAPE is therefore identical to
 * the unreduced one — tooltip, legend and the `<Line dataKey>`s are untouched.
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

/**
 * Reduced rows for `prepared`, restricted to the series `visible` accepts.
 *
 * `x0`/`x1` are the effective x-domain in DATA units (as the axis shows them,
 * log or not); `columns` is the plot width in pixels. On a log axis the
 * windowing and the column binning run on `logXs` — screen columns are uniform
 * in log10(x), not in x — and points at x <= 0 are skipped, but the rows still
 * carry the original x so the axis and the tooltip see data units.
 */
export function buildRenderRows(
  prepared: readonly PreparedSeries[],
  visible: (key: string) => boolean,
  x0: number,
  x1: number,
  columns: number,
  logX: boolean,
): Row[] {
  const reduced: Series[] = [];
  for (const p of prepared) {
    if (!visible(p.key)) continue;
    if (p.n === 0) continue;
    // On a log axis the first `logStart` points have x <= 0 (NaN in `logXs`)
    // and cannot be placed at all, so the window starts past them.
    const axis = logX ? p.logXs : p.xs;
    if (!axis) continue; // logX asked for without a prepared log array
    const offset = logX ? p.logStart : 0;
    if (offset >= p.n) continue;
    const lo = logX ? logBound(x0) : x0;
    const hi = logX ? logBound(x1) : x1;
    const [ws, we] = visibleWindow(axis.subarray(offset, p.n), lo, hi);
    const start = ws + offset;
    const end = we + offset;
    if (end <= start) continue;
    // Column edges: the domain when it is usable, else the window's own span
    // (an unusable domain would otherwise make `reduceToColumns` pass every
    // point through).
    let binLo = lo ?? NaN;
    let binHi = hi ?? NaN;
    if (!(binHi > binLo)) { binLo = axis[start]!; binHi = axis[end - 1]!; }
    const idx = reduceToColumns(axis, p.ys, start, end, binLo, binHi, columns, p.lo, p.hi);
    if (idx.length === 0) continue;
    reduced.push(reduceSeries(p, idx));
  }
  return mergeToRows(reduced);
}

/** log10 for a positive bound; null (unbounded) for anything a log axis cannot place. */
function logBound(x: number): number | null {
  return x > 0 && Number.isFinite(x) ? Math.log10(x) : null;
}

/**
 * A `Series` over the selected indices only. `y` is the smoothed value from
 * `ys`; `wallTime`/`context` ride along on the original point (reused as-is
 * when nothing changed, so the common unsmoothed case allocates no points).
 */
function reduceSeries(p: PreparedSeries, idx: Int32Array): Series {
  const { xs, ys, rawYs, points } = p;
  const n = idx.length;
  const out: SeriesPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const j = idx[i]!;
    const src = points[j]!;
    const y = ys[j]!;
    out[i] = src.y === y ? src : { ...src, y };
  }
  let raw: SeriesPoint[] | null = null;
  if (rawYs) {
    raw = new Array(n);
    for (let i = 0; i < n; i++) { const j = idx[i]!; raw[i] = { x: xs[j]!, y: rawYs[j]! }; }
  }
  return { key: p.key, label: p.key, color: "", points: out, rawPoints: raw };
}
