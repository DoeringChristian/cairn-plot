import type { Series, SeriesPoint } from "../types.ts";
import { percentile } from "../transforms/percentile.ts";

/**
 * A scalar series mapped into typed arrays once, then extended in place as
 * points are appended.
 *
 * The `xs`/`ys`/`rawYs`/`logXs` arrays are `subarray(0, n)` **views** into the
 * cache's storage buffers. They are valid only until the next `prepare` call
 * for the same key: an append writes the new tail into the same buffer (or a
 * grown one) and a rebuild replaces the buffers outright. Consumers must read
 * them within the render that obtained them and never retain them across
 * prepares.
 */
export interface PreparedSeries {
  key: string;
  /** Number of valid points; every view below has exactly this length. */
  n: number;
  /** Sorted x. */
  xs: Float64Array;
  /** Smoothed y (a copy of the raw y when smoothing is off). */
  ys: Float64Array;
  /** Raw y, only when smoothing is on. */
  rawYs: Float64Array | null;
  /** log10(x) with NaN for x <= 0, only when an x log scale was requested. */
  logXs: Float64Array | null;
  /** Index of the first positive x (== n when there is none); log-scale windows start here. */
  logStart: number;
  /** The input points in sorted order, for wallTime/context lookup. */
  points: SeriesPoint[];
  /** Finite extents. */
  xMin: number; xMax: number; yMin: number; yMax: number;
  /** Outlier bounds from `outlierPct`, ±Infinity when it is [0, 100]. */
  lo: number; hi: number;
}

export interface PrepareOptions {
  /** EMA weight on the previous smoothed value; <= 0 means no smoothing. */
  smoothing: number;
  outlierPct: [number, number];
  logX: boolean;
}

interface Signature { n: number; x0: number; xMid: number; xLast: number }

interface Entry {
  options: PrepareOptions;
  sig: Signature;
  n: number;
  /** Storage buffers, `n` valid entries, capacity >= n. */
  xs: Float64Array;
  ys: Float64Array;
  rawYs: Float64Array | null;
  logXs: Float64Array | null;
  logStart: number;
  points: SeriesPoint[];
  xMin: number; xMax: number; yMin: number; yMax: number;
}

function sameOptions(a: PrepareOptions, b: PrepareOptions): boolean {
  return a.smoothing === b.smoothing && a.logX === b.logX
    && a.outlierPct[0] === b.outlierPct[0] && a.outlierPct[1] === b.outlierPct[1];
}

function copyOptions(o: PrepareOptions): PrepareOptions {
  return { smoothing: o.smoothing, outlierPct: [o.outlierPct[0], o.outlierPct[1]], logX: o.logX };
}

/** Grow to at least `needed`, doubling, preserving the first `n` values. */
function grow(a: Float64Array, n: number, needed: number): Float64Array {
  if (a.length >= needed) return a;
  const next = new Float64Array(Math.max(a.length * 2, needed));
  next.set(a.subarray(0, n));
  return next;
}

/** The points in x-ascending order; the input array itself when already sorted (stable otherwise). */
function sortedByX(points: SeriesPoint[]): SeriesPoint[] {
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.x < points[i - 1]!.x) return points.slice().sort((a, b) => a.x - b.x);
  }
  return points;
}

function signatureOf(points: SeriesPoint[]): Signature {
  const n = points.length;
  if (n === 0) return { n: 0, x0: NaN, xMid: NaN, xLast: NaN };
  return { n, x0: points[0]!.x, xMid: points[n >> 1]!.x, xLast: points[n - 1]!.x };
}

/** Index of the first positive x at or after `from` (== n when there is none). */
function firstPositive(xs: Float64Array, from: number, n: number): number {
  let i = from;
  while (i < n && !(xs[i]! > 0)) i++;
  return i;
}

export class PreparedSeriesCache {
  private entries = new Map<string, Entry>();
  private appends = 0;
  private rebuilds = 0;

  /** Counters for tests and the render-cost harness. */
  stats(): { appends: number; rebuilds: number } {
    return { appends: this.appends, rebuilds: this.rebuilds };
  }

  drop(key: string): void {
    this.entries.delete(key);
  }

  prepare(series: Series, options: PrepareOptions): PreparedSeries {
    const cached = this.entries.get(series.key);
    let entry: Entry;
    if (cached && this.canAppend(cached, series.points, options)) {
      this.append(cached, series.points);
      this.appends++;
      entry = cached;
    } else {
      entry = this.rebuild(series.points, options);
      this.entries.set(series.key, entry);
      this.rebuilds++;
    }
    return this.view(series.key, entry, options);
  }

  /**
   * An append is a longer points array with unchanged options whose cached
   * prefix still matches at three probe indices plus the last cached x, and
   * whose new tail is x-ascending. Everything else is a full rebuild.
   */
  private canAppend(e: Entry, points: SeriesPoint[], options: PrepareOptions): boolean {
    const n = e.n;
    if (n === 0 || points.length <= n) return false;
    if (!sameOptions(e.options, options)) return false;
    const sig = e.sig;
    if (points[0]!.x !== sig.x0) return false;
    if (points[n >> 1]!.x !== sig.xMid) return false;
    if (points[n - 1]!.x !== sig.xLast) return false;
    let prev = sig.xLast;
    for (let i = n; i < points.length; i++) {
      const x = points[i]!.x;
      if (!(x >= prev)) return false;
      prev = x;
    }
    return true;
  }

  private append(e: Entry, points: SeriesPoint[]): void {
    const from = e.n;
    const n = points.length;
    e.xs = grow(e.xs, from, n);
    e.ys = grow(e.ys, from, n);
    if (e.rawYs) e.rawYs = grow(e.rawYs, from, n);
    if (e.logXs) e.logXs = grow(e.logXs, from, n);
    const { xs, ys, rawYs, logXs } = e;
    const alpha = e.options.smoothing;
    let prev = ys[from - 1]!;
    let xMin = e.xMin, xMax = e.xMax, yMin = e.yMin, yMax = e.yMax;
    for (let i = from; i < n; i++) {
      const p = points[i]!;
      const x = p.x;
      xs[i] = x;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      let y = p.y;
      if (rawYs) {
        rawYs[i] = y;
        y = alpha * prev + (1 - alpha) * y;
        prev = y;
      }
      ys[i] = y;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
      if (logXs) logXs[i] = x > 0 ? Math.log10(x) : NaN;
    }
    e.n = n;
    e.points = points;
    e.sig = signatureOf(points);
    e.xMin = xMin; e.xMax = xMax; e.yMin = yMin; e.yMax = yMax;
    if (e.logStart >= from) e.logStart = firstPositive(xs, from, n);
  }

  private rebuild(input: SeriesPoint[], options: PrepareOptions): Entry {
    const points = sortedByX(input);
    const n = points.length;
    const opts = copyOptions(options);
    const alpha = opts.smoothing;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    // `emaSmooth` seeds with points[0].y and runs the recurrence from index 0,
    // so ys[0] === alpha * y0 + (1 - alpha) * y0. Reproduced literally, guards
    // included (none): a non-finite y poisons the tail exactly as it does there.
    const rawYs = alpha > 0 && n > 0 ? new Float64Array(n) : null;
    const logXs = opts.logX ? new Float64Array(n) : null;
    let prev = n > 0 ? points[0]!.y : 0;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = points[i]!;
      const x = p.x;
      xs[i] = x;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      let y = p.y;
      if (rawYs) {
        rawYs[i] = y;
        y = alpha * prev + (1 - alpha) * y;
        prev = y;
      }
      ys[i] = y;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
      if (logXs) logXs[i] = x > 0 ? Math.log10(x) : NaN;
    }
    return {
      options: opts, sig: signatureOf(points), n, xs, ys, rawYs, logXs,
      logStart: firstPositive(xs, 0, n), points, xMin, xMax, yMin, yMax,
    };
  }

  private view(key: string, e: Entry, options: PrepareOptions): PreparedSeries {
    const n = e.n;
    const ys = e.ys.subarray(0, n);
    const [pLo, pHi] = options.outlierPct;
    const clipped = pLo > 0 || pHi < 100;
    return {
      key, n,
      xs: e.xs.subarray(0, n),
      ys,
      rawYs: e.rawYs ? e.rawYs.subarray(0, n) : null,
      logXs: e.logXs ? e.logXs.subarray(0, n) : null,
      logStart: e.logStart,
      points: e.points,
      xMin: e.xMin, xMax: e.xMax, yMin: e.yMin, yMax: e.yMax,
      lo: clipped ? percentile(ys, pLo) : -Infinity,
      hi: clipped ? percentile(ys, pHi) : Infinity,
    };
  }
}
