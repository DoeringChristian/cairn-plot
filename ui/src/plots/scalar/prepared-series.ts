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
 *
 * The object identity is stable while nothing changes: preparing the same
 * points with the same options returns the very same `PreparedSeries`, so it
 * can be used as a memo dependency.
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
  /**
   * log10(x) with NaN for x <= 0. Built on the first `prepare` that asks for
   * `logX` and kept afterwards, so it may be present even when the current
   * options no longer request a log x scale; read it only when you asked for it.
   */
  logXs: Float64Array | null;
  /** Index of the first positive x (== n when there is none); log-scale windows start here. */
  logStart: number;
  /**
   * The input points in sorted order, for wallTime/context lookup. This may
   * alias the caller's array (it is not copied when it is already x-ascending)
   * and must never be mutated: `xs`/`ys` would silently disagree with it.
   */
  points: SeriesPoint[];
  /** Finite extents. */
  xMin: number; xMax: number; yMin: number; yMax: number;
  /**
   * Outlier bounds from `outlierPct`, ±Infinity when it is [0, 100] or when
   * no finite y exists. Exact after a rebuild; after appends they lag by up to
   * 1 % of the point count (see `PreparedSeriesCache`).
   */
  lo: number; hi: number;
}

export interface PrepareOptions {
  /** EMA weight on the previous smoothed value; <= 0 means no smoothing. */
  smoothing: number;
  outlierPct: [number, number];
  logX: boolean;
}

/** Recompute the outlier bounds on append once the series has grown by this fraction. */
const BOUNDS_GROWTH = 0.01;

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
  /** The last rebuild had to sort, so `points` is our own copy and appends are unsafe. */
  sorted: boolean;
  xMin: number; xMax: number; yMin: number; yMax: number;
  clipped: boolean;
  lo: number; hi: number;
  /** `n` at the last bounds computation. */
  boundsN: number;
  /** The last returned view, reused while nothing changes; null once invalid. */
  cached: PreparedSeries | null;
}

/** Only `smoothing` and `outlierPct` shape the stored arrays and bounds; `logX` is a lazy extra. */
function sameOptions(a: PrepareOptions, b: PrepareOptions): boolean {
  return a.smoothing === b.smoothing
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

/**
 * One entry per series key. `prepare` reuses the entry unchanged when the
 * points are unchanged, extends it in place when points were appended, and
 * rebuilds it otherwise.
 */
export class PreparedSeriesCache {
  private entries = new Map<string, Entry>();
  private appends = 0;
  private rebuilds = 0;
  private reuses = 0;
  private boundsRecomputes = 0;

  /** Counters for tests and the render-cost harness. */
  stats(): { appends: number; rebuilds: number; reuses: number; boundsRecomputes: number } {
    return {
      appends: this.appends, rebuilds: this.rebuilds,
      reuses: this.reuses, boundsRecomputes: this.boundsRecomputes,
    };
  }

  drop(key: string): void {
    this.entries.delete(key);
  }

  prepare(series: Series, options: PrepareOptions): PreparedSeries {
    const points = series.points;
    const cached = this.entries.get(series.key);
    let entry: Entry;
    if (cached && sameOptions(cached.options, options) && this.probesMatch(cached, points)) {
      if (points.length === cached.n) {
        this.reuses++;
        entry = cached;
      } else if (!cached.sorted && this.tailAscending(cached, points)) {
        this.append(cached, points);
        this.appends++;
        if (cached.clipped && cached.n > cached.boundsN * (1 + BOUNDS_GROWTH)) this.setBounds(cached);
        entry = cached;
      } else {
        entry = this.rebuild(series.key, points, options);
      }
    } else {
      entry = this.rebuild(series.key, points, options);
    }
    return this.view(series.key, entry, options);
  }

  /** The cached prefix still looks like this input at three probe indices. */
  private probesMatch(e: Entry, points: SeriesPoint[]): boolean {
    const n = e.n;
    if (points.length < n) return false;
    if (n === 0) return points.length === 0;
    const sig = e.sig;
    return points[0]!.x === sig.x0 && points[n >> 1]!.x === sig.xMid && points[n - 1]!.x === sig.xLast;
  }

  /** The points past the cached prefix are non-decreasing, starting at the cached last x. */
  private tailAscending(e: Entry, points: SeriesPoint[]): boolean {
    let prev = e.sig.xLast;
    for (let i = e.n; i < points.length; i++) {
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
    e.cached = null;
  }

  private rebuild(key: string, input: SeriesPoint[], options: PrepareOptions): Entry {
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
    }
    const [pLo, pHi] = opts.outlierPct;
    const e: Entry = {
      options: opts, sig: signatureOf(points), n, xs, ys, rawYs,
      logXs: null, logStart: firstPositive(xs, 0, n),
      points, sorted: points !== input,
      xMin, xMax, yMin, yMax,
      clipped: pLo > 0 || pHi < 100, lo: -Infinity, hi: Infinity, boundsN: n,
      cached: null,
    };
    this.setBounds(e);
    this.entries.set(key, e);
    this.rebuilds++;
    return e;
  }

  private setBounds(e: Entry): void {
    e.boundsN = e.n;
    if (!e.clipped) { e.lo = -Infinity; e.hi = Infinity; return; }
    const ys = e.ys.subarray(0, e.n);
    const lo = percentile(ys, e.options.outlierPct[0]);
    const hi = percentile(ys, e.options.outlierPct[1]);
    e.lo = Number.isNaN(lo) ? -Infinity : lo;
    e.hi = Number.isNaN(hi) ? Infinity : hi;
    this.boundsRecomputes++;
  }

  /** log10 of every x, built on the first prepare that asks for a log x scale. */
  private buildLogXs(e: Entry): void {
    const n = e.n;
    const logXs = new Float64Array(Math.max(e.xs.length, n));
    const xs = e.xs;
    for (let i = 0; i < n; i++) { const x = xs[i]!; logXs[i] = x > 0 ? Math.log10(x) : NaN; }
    e.logXs = logXs;
    e.cached = null;
  }

  private view(key: string, e: Entry, options: PrepareOptions): PreparedSeries {
    if (options.logX && e.logXs === null) this.buildLogXs(e);
    if (e.cached) return e.cached;
    const n = e.n;
    const view: PreparedSeries = {
      key, n,
      xs: e.xs.subarray(0, n),
      ys: e.ys.subarray(0, n),
      rawYs: e.rawYs ? e.rawYs.subarray(0, n) : null,
      logXs: e.logXs ? e.logXs.subarray(0, n) : null,
      logStart: e.logStart,
      points: e.points,
      xMin: e.xMin, xMax: e.xMax, yMin: e.yMin, yMax: e.yMax,
      lo: e.lo, hi: e.hi,
    };
    e.cached = view;
    return view;
  }
}
