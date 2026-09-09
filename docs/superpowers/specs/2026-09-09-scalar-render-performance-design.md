# Scalar chart rendering: pixel-bound, incremental, cheap to key

Status: v1 (2026-09-09). Owner: cairn-plot (`plots/scalar`); consumer changes in
cairn (`ScalarPlotCard`, `CairnPlotCard`).

## 1. Problem

A scalar line chart with 10 000 points per series is slow to render and to
interact with. Measured causes (static, `plots/scalar/backends/svg/ScalarPlot.tsx`
and cairn's `ScalarPlotCard.tsx`):

- Every change recomputes everything. On each live tick (2 s), settings change,
  wheel notch and drag frame the consumer rebuilds each series over its full
  history (x-mapping with a sort, EMA smoothing, percentile outlier filter),
  `ScalarPlot` merges all series into one row per x with another sort, and
  Recharts rebuilds a 157 KB path string. Caches key on array identity only.
- Every point is rendered at every zoom level. Zoom only clips the path; the
  full array is mapped through the scales. The only downsampling is a stride
  that engages past ten series.
- The report/comparison path serialises the inline series to canonical JSON
  on the main thread to compute the resolution-cache key, every time the spec
  object changes, i.e. every tick.
- Hover emphasis (`strokeWidth`) is React state, so a mouse move re-renders
  the chart.

User rulings (2026-09-09): make the CPU path as fast as possible first; a GPU
backend may come later through the existing backend seam.

## 2. Goals

- Rendering cost bounded by the plot's pixel width, not by series length: at
  most four points per pixel column per series reach the SVG.
- Live appends cost proportional to the appended points, not the history.
- No serialisation of point data for cache keys.
- Hover, wheel and drag never trigger a data recomputation; view changes are
  coalesced to one per animation frame.
- Data preparation (smoothing, outlier bounds, windowing, reduction) lives in
  cairn-plot; consumers pass raw series plus settings.
- A benchmark harness pins the budgets.

Non-goals: canvas/GPU backend; changing the chart's look; changing the
histogram/scatter/bar renderers (they share the pattern and can adopt the same
transforms later).

## 3. Design

### 3.1 Pure transforms (`plots/transforms/`)

`visible-window.ts`
```ts
/** Index range [start, end) of points whose x lies in [xMin, xMax], widened by one point on each side so lines enter and leave the plot. Points must be sorted by x. */
export function visibleWindow(xs: ArrayLike<number>, xMin: number | null, xMax: number | null): [number, number];
```
Binary search on the sorted x array; `null` bounds mean the data extent.

`pixel-reduce.ts` (the M4 reduction)
```ts
/** Reduce points[start,end) to at most 4 per pixel column over [xMin, xMax] with `columns` columns: the first, minimum, maximum and last point of each column, emitted in x order without duplicates. Points outside [lo, hi] in y are skipped (outlier bounds). NaN y is kept as a gap marker. */
export function reduceToColumns(xs: ArrayLike<number>, ys: ArrayLike<number>, start: number, end: number, xMin: number, xMax: number, columns: number, lo?: number, hi?: number): Int32Array; // indices into xs/ys
```
Returns indices so the caller can carry wall time and context of the chosen
points. When `end - start <= 2 * columns` it returns every index in the range
(nothing to gain). Log x scale: columns are laid out in the scale's domain,
so the caller passes `xMin`/`xMax` already transformed and `xs` transformed;
the transform is `Math.log10` applied once per prepared series (§3.2).

`percentile.ts`
```ts
/** Value at percentile p (0..100) of the finite values, by quickselect on a scratch copy; O(n). */
export function percentile(values: ArrayLike<number>, p: number): number;
```

### 3.2 Prepared series (`plots/scalar/prepared-series.ts`)

```ts
export interface PreparedSeries {
  key: string;
  n: number;
  xs: Float64Array;          // sorted x
  ys: Float64Array;          // smoothed y (== raw when alpha == 0)
  rawYs: Float64Array | null; // raw y when smoothing is on
  logXs: Float64Array | null; // log10(x) when an x log scale is requested (lazy)
  points: SeriesPoint[];     // the input points in sorted order (wallTime/context lookup)
  xMin: number; xMax: number; yMin: number; yMax: number; // finite extents of ys
  lo: number; hi: number;    // outlier bounds from outlierPct, ±Infinity when [0,100]
}
export interface PrepareOptions { smoothing: number; outlierPct: [number, number]; logX: boolean }
export class PreparedSeriesCache {
  prepare(series: Series, options: PrepareOptions): PreparedSeries;
  drop(key: string): void;
}
```
`prepare` keeps one entry per `series.key`. It detects an append when the new
points array is longer than the cached one, its first `n` x values equal the
cached ones (checked at three probe indices plus the last cached point) and
options are unchanged; then it maps, smooths (continuing the EMA from the last
smoothed value) and extends the extents for the appended tail only. Anything
else is a full rebuild. Unsorted input is sorted by x (stable) on a full
rebuild; appends assume x-ascending tails and fall back to a rebuild otherwise.
Outlier bounds are recomputed by `percentile` on every change when
`outlierPct !== [0, 100]` (O(n), sub-millisecond at 10k). Smoothing follows
`emaSmooth` semantics exactly (same alpha convention, same first value), pinned
by a test that compares against `emaSmooth` on random input.

### 3.3 `ScalarPlot` render data

`ScalarPlot` gains props `smoothing?: number` (default 0), `outlierPct?:
[number, number]` (default `[0, 100]`), and keeps `series` as RAW series
(consumers stop pre-smoothing; `rawPoints` on input is ignored and the faint
raw overlay is drawn from `PreparedSeries.rawYs`).

Per render:
1. `prepared = cache.prepare(s, options)` for each series (cache in a ref).
2. Effective x-domain as today (`resolveAxisDomain` over prepared extents).
3. `columns = max(64, round(plotWidthPx))`, from the `Customized` rect
   capture already present (`plotOffsetRef`), falling back to the container
   width, then 800.
4. For each visible series: `[start, end] = visibleWindow(xs, x0, x1)`,
   `idx = reduceToColumns(...)`, rows built from `idx`.
5. `mergeToRows` over the reduced points only.

The row array is memoised on `(prepared identities, x0, x1, columns,
visibility)`; hover does not enter the memo.

### 3.4 Hover without re-render

Each `<Line>` gets `className="cairn-series"` and `data-series-key`. The
hovered key is written imperatively to `data-hover` on the chart root element
from the existing `onMouseMove` handler (no React state), and a stylesheet
rule in the plot's CSS module applies the emphasised stroke width/opacity to
`[data-hover="k"] .cairn-series[data-series-key="k"] path` and dims the
others. The legend's hover uses the same attribute. The tooltip keeps its
React state (it must render content), but its state no longer touches the
line elements.

### 3.5 Coalesced view changes

`use-plot-gestures.ts` routes wheel and pointer-move view updates through a
`useFrameCoalescer(onViewChange)`: the latest state wins, one call per
animation frame (`requestAnimationFrame`, with a `setTimeout(0)` fallback when
the document is hidden). Box-zoom completion and reset call through
immediately. The reduction in §3.3 makes each frame cheap; the coalescer makes
it at most one per frame.

### 3.6 Content keys without serialisation

`resources/resolution-cache.ts` `descriptorContentId(node)` gains an escape
hatch: a plot definition may export `contentId(data: DataSpec): string | null`
(new optional field on the plot definition contract in `plots/contracts.ts`).
The scalar definition supplies one for `kind: "inline"` data: for each series
`key|n|x0|xn|yn` (first x, last x, last y) joined, plus the canonical JSON of
the remaining props with `series` removed. `resolutionKey` receives the
definition (the host already resolves it in `PlotNodeView`). Everything else
keeps the canonical JSON path.

### 3.7 Consumers (cairn)

- `ScalarPlotCard.tsx`: keep `mapToXAxis` (it needs run metadata) and drop
  `strideDownsample`, `emaSmooth`, `filterOutliers`; pass `smoothing` and
  `outlierPct` as props. The `useMemo` dependency list loses nothing.
- `CairnPlotCard.tsx`: scalar spec `props` gain `smoothing` and `outlierPct`;
  the `series` points are passed raw.
- Settings UI is unchanged (the same settings feed the new props).

### 3.8 Backend seam

`register.ts` keeps the single `scalar-react` backend. The prepared-series
cache, window and reduction are backend-independent modules so a future
canvas or GPU backend consumes the same `PreparedSeries`.

## 4. Budgets and testing

Unit (node): `visibleWindow` (bounds, nulls, empty, widening), `reduceToColumns`
(≤4 per column, first/last/min/max preserved, order, gaps, y-bounds skip,
passthrough when small), `percentile` (against a sorted reference),
`PreparedSeriesCache` (append detection incl. probe mismatch → rebuild,
EMA continuity equals `emaSmooth` on the whole array, extents, option change
rebuild, drop), scalar `contentId` (stable across identical copies, changes
on append, ignores wallTime/context), `mergeToRows` unchanged.

Browser harness `plots/scalar/__tests__/scalar-render-cost.browser.ts`
(self-driving), 10 series × 100 000 points in a 800 px-wide host:

| measure | budget |
|---|---|
| first mount to painted paths | < 400 ms |
| append 100 points to every series, re-render | < 30 ms long-task total |
| one wheel zoom step | < 30 ms |
| 20 synthetic mouse moves | no long task > 50 ms, no path `d` change |
| path point count per series | ≤ 4 × columns + 2 |

Existing tests for `emaSmooth`, `filterOutliers`, `strideDownsample` stay;
the functions remain exported for other consumers.

## 5. Compatibility

- `ScalarPlot` still accepts pre-smoothed series with `rawPoints` (renders
  them as before when `smoothing` is absent) so external users of the public
  `scalar` entry keep working; the cairn cards switch to the new props.
- `strideDownsample` stops being used by cairn; kept exported.
- Visual change: line shapes are identical at the pixel level by construction
  of the M4 reduction (every column keeps its extremes); tooltips snap to the
  nearest reduced point, which is at most one column away from the nearest
  raw point.
