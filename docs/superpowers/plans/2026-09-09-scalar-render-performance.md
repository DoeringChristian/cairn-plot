# Scalar Render Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scalar charts render at most four points per pixel column per series, prepare appended points incrementally, key caches without serialising point data, and never recompute data on hover or per gesture frame.

**Architecture:** Pure transforms (`visibleWindow`, `reduceToColumns`, `percentile`) + a `PreparedSeriesCache` under `plots/scalar/`; `ScalarPlot` builds its Recharts rows from reduced indices; hover is a DOM attribute + CSS; gestures coalesce view changes per frame; the resolution cache asks the plot definition for a content id.

**Tech Stack:** TypeScript, React 18, Recharts 2.15 (declared `^2.13.0`), `node --experimental-strip-types --test`, browser harness runner (`ui/scripts/test-harness.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-09-scalar-render-performance-design.md`

## Global Constraints

- Transforms in `ui/src/plots/transforms/`, scalar-specific code in `ui/src/plots/scalar/` (layout rule in `docs/plot-type-authoring.md`).
- `reduceToColumns` returns indices (`Int32Array`) in strictly ascending order: per column at most 4 data picks (first, min, max, last) plus at most 1 gap marker (the first NaN of the column), i.e. `≤ 5 * columns + 2` total; out-of-bound y never enters a column (including as the column's first point); passthrough when `end - start <= 2 * columns`.
- `PreparedSeriesCache.prepare` is incremental for appends (same options, same first `n` xs at probe indices 0, n/2, n-1, longer input, ascending tail); otherwise a full rebuild. Smoothing equals `emaSmooth` bit-for-bit on the same input.
- `ScalarPlot` keeps its public props and adds `smoothing?: number`, `outlierPct?: [number, number]`; pre-smoothed input with `rawPoints` keeps rendering as before when `smoothing` is undefined.
- Hover never sets React state that reaches `<Line>`; view changes from wheel/pointer-move are coalesced to one per animation frame.
- `descriptorContentId` never canonical-JSONs `series` for scalar inline data.
- `npm run typecheck`, `node --experimental-strip-types --test "src/**/*.test.ts"`, and `node scripts/test-harness.mjs --only scalar-render-cost` pass; `npm run build:plot-inline && npm run sync:plot-assets` after code changes (CI `check:plot-assets`).
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.
- Never `git add -A`; named files only; leave `.pi/` alone.

---

### Task 1: Pure transforms

**Files:**
- Create: `ui/src/plots/transforms/visible-window.ts`, `pixel-reduce.ts`, `percentile.ts`
- Test: `ui/src/plots/transforms/visible-window.test.ts`, `pixel-reduce.test.ts`, `percentile.test.ts`

**Interfaces (Produces):**
```ts
export function visibleWindow(xs: ArrayLike<number>, xMin: number | null, xMax: number | null): [number, number];
export function reduceToColumns(xs: ArrayLike<number>, ys: ArrayLike<number>, start: number, end: number, xMin: number, xMax: number, columns: number, lo?: number, hi?: number): Int32Array;
export function percentile(values: ArrayLike<number>, p: number): number;
```
`percentile` reproduces `filterOutliers`' definition exactly (`transforms/outlier.ts`: `rank = (p/100)*(n-1)`, linear interpolation between `sorted[floor]` and `sorted[ceil]`, `p <= 0` → min, `p >= 100` → max, on finite values) so the reducer skips exactly the points `filterOutliers` used to drop. Implementation: sort a `Float64Array` copy of the finite values (O(n log n), ~1 ms at 10k) — parity beats quickselect here.

- [ ] **Step 1: Tests** (write all three files; run → fail)

```ts
// visible-window.test.ts
import { test } from "node:test"; import assert from "node:assert/strict";
import { visibleWindow } from "./visible-window.ts";
const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
test("null bounds give the full range", () => assert.deepEqual(visibleWindow(xs, null, null), [0, 10]));
test("inside bounds widen by one point on each side", () => assert.deepEqual(visibleWindow(xs, 3.5, 6.2), [3, 8]));
test("exact hits are included and widened", () => assert.deepEqual(visibleWindow(xs, 3, 6), [2, 8]));
test("bounds outside the data clamp", () => { assert.deepEqual(visibleWindow(xs, -5, 100), [0, 10]); assert.deepEqual(visibleWindow(xs, 20, 30), [9, 10]); assert.deepEqual(visibleWindow(xs, -30, -20), [0, 1]); });
test("empty input", () => assert.deepEqual(visibleWindow([], 0, 1), [0, 0]));
```

```ts
// pixel-reduce.test.ts
import { test } from "node:test"; import assert from "node:assert/strict";
import { reduceToColumns } from "./pixel-reduce.ts";
const xs = Float64Array.from({ length: 10_000 }, (_, i) => i);
const ys = Float64Array.from({ length: 10_000 }, (_, i) => Math.sin(i / 50) + (i % 997 === 0 ? 5 : 0));
test("at most four indices per column, ascending, extremes kept", () => {
  const idx = reduceToColumns(xs, ys, 0, xs.length, 0, 9_999, 500);
  assert.ok(idx.length <= 5 * 500 + 2);
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i]! > idx[i - 1]!);
  const chosen = new Set(idx);
  for (let i = 0; i < ys.length; i += 997) assert.ok(chosen.has(i), `spike at ${i} kept`); // column maxima
  assert.equal(idx[0], 0); assert.equal(idx[idx.length - 1], 9_999);
});
test("per-column first/min/max/last are the true ones", () => {
  const cols = 100; const idx = reduceToColumns(xs, ys, 0, xs.length, 0, 9_999, cols);
  const width = 9_999 / cols;
  for (let c = 0; c < cols; c++) {
    const inCol = (i: number) => Math.min(cols - 1, Math.floor((xs[i]! - 0) / width)) === c;
    const all = [...xs.keys()].filter(inCol); const picked = [...idx].filter(inCol);
    const min = all.reduce((a, b) => (ys[b]! < ys[a]! ? b : a)); const max = all.reduce((a, b) => (ys[b]! > ys[a]! ? b : a));
    assert.ok(picked.includes(all[0]!) && picked.includes(all[all.length - 1]!) && picked.includes(min) && picked.includes(max), `column ${c}`);
  }
});
test("passthrough when the range is small", () => { const idx = reduceToColumns(xs, ys, 100, 300, 100, 299, 500); assert.deepEqual([...idx], [...Array(200).keys()].map((i) => i + 100)); });
test("y bounds skip outliers and NaN survives as a gap", () => {
  const y2 = Float64Array.from(ys); y2[42] = NaN; y2[1000] = 1e9;
  const idx = reduceToColumns(xs, y2, 0, xs.length, 0, 9_999, 200, -10, 10);
  assert.ok([...idx].includes(42)); assert.ok(![...idx].includes(1000));
});
```

```ts
// percentile.test.ts
import { test } from "node:test"; import assert from "node:assert/strict";
import { percentile } from "./percentile.ts";
test("matches filterOutliers' interpolated definition on finite values", () => {
  const v = Float64Array.from({ length: 1001 }, (_, i) => ((i * 7919) % 1001) - 500); v[10] = NaN; v[20] = Infinity;
  const finite = [...v].filter(Number.isFinite).sort((a, b) => a - b);
  const ref = (p: number) => { if (p <= 0) return finite[0]!; if (p >= 100) return finite[finite.length - 1]!; const r = (p / 100) * (finite.length - 1); const lo = Math.floor(r), hi = Math.ceil(r), f = r - lo; return finite[lo]! * (1 - f) + finite[hi]! * f; };
  for (const p of [0, 1, 5, 50, 95, 99, 100]) assert.equal(percentile(v, p), ref(p));
});
test("agrees with filterOutliers on random data", async () => {
  const { filterOutliers } = await import("./outlier.ts");
  const pts = Array.from({ length: 999 }, (_, i) => ({ x: i, y: Math.sin(i * 12.9898) * 43758.5453 % 17 }));
  const kept = filterOutliers(pts, 2, 98); const lo = percentile(pts.map((q) => q.y), 2), hi = percentile(pts.map((q) => q.y), 98);
  assert.deepEqual(kept.map((q) => q.x), pts.filter((q) => q.y >= lo && q.y <= hi).map((q) => q.x));
});
test("empty or all non-finite", () => { assert.ok(Number.isNaN(percentile([], 50))); assert.ok(Number.isNaN(percentile([NaN, Infinity], 50))); });
```

- [ ] **Step 2: Implement**

```ts
// visible-window.ts
export function visibleWindow(xs: ArrayLike<number>, xMin: number | null, xMax: number | null): [number, number] {
  const n = xs.length; if (n === 0) return [0, 0];
  let start = 0, end = n;
  if (xMin !== null) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >>> 1; if (xs[m]! < xMin) lo = m + 1; else hi = m; } start = Math.max(0, lo - 1); }
  if (xMax !== null) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >>> 1; if (xs[m]! <= xMax) lo = m + 1; else hi = m; } end = Math.min(n, lo + 1); }
  if (end <= start) return [start, start + 1]; // start <= n-1 always holds here
  return [start, end];
}
```

```ts
// pixel-reduce.ts — M4 reduction with one gap marker per column
export function reduceToColumns(
  xs: ArrayLike<number>, ys: ArrayLike<number>, start: number, end: number,
  xMin: number, xMax: number, columns: number, lo = -Infinity, hi = Infinity,
): Int32Array {
  const count = end - start; if (count <= 0) return new Int32Array(0);
  if (count <= 2 * columns || !(xMax > xMin)) { const all = new Int32Array(count); for (let i = 0; i < count; i++) all[i] = start + i; return all; }
  const cap = 5 * columns + 2;
  const out = new Int32Array(cap); let n = 0;
  const scale = columns / (xMax - xMin);
  let col = -1, first = -1, last = -1, minI = -1, maxI = -1, gap = -1;
  const flush = () => {
    const c: number[] = [];
    for (const v of [first, minI, maxI, last, gap]) if (v >= 0 && !c.includes(v)) c.push(v);
    c.sort((a, b) => a - b);
    for (const i of c) if (n < cap) out[n++] = i;
    first = last = minI = maxI = gap = -1;
  };
  for (let i = start; i < end; i++) {
    const c = Math.min(columns - 1, Math.max(0, Math.floor((xs[i]! - xMin) * scale)));
    if (c !== col) { flush(); col = c; }
    const y = ys[i]!;
    if (Number.isNaN(y)) { if (gap < 0) gap = i; continue; } // one gap marker per column
    if (y < lo || y > hi) continue;                           // never opens a column
    if (first < 0) first = i;
    last = i;
    if (minI < 0 || y < ys[minI]!) minI = i;
    if (maxI < 0 || y > ys[maxI]!) maxI = i;
  }
  flush();
  return out.slice(0, n);
}
```
(This version was run by the plan checker: all four tests pass, and a NaN-every-3rd-point stress at columns 50/200/500 stays strictly ascending within `5*columns+2`.)

```ts
// percentile.ts — filterOutliers' interpolated percentile on a sorted copy of the finite values
export function percentile(values: ArrayLike<number>, p: number): number {
  let n = 0; const a = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) { const v = values[i]!; if (Number.isFinite(v)) a[n++] = v; }
  if (n === 0) return NaN;
  const sorted = a.subarray(0, n).sort();
  if (p <= 0) return sorted[0]!; if (p >= 100) return sorted[n - 1]!;
  const r = (p / 100) * (n - 1); const lo = Math.floor(r), hi = Math.ceil(r), f = r - lo;
  return sorted[lo]! * (1 - f) + sorted[hi]! * f;
}
```
(Read `transforms/outlier.ts` first and copy its exact arithmetic if it differs from the above; the second test pins the parity.)

- [ ] **Step 3: Run** — the three test files green; `npm run typecheck` clean.
- [ ] **Step 4: Commit** — `git add` the six files; "Add visible-window, M4 pixel reduction and percentile transforms".

---

### Task 2: `PreparedSeriesCache`

**Files:**
- Create: `ui/src/plots/scalar/prepared-series.ts`
- Test: `ui/src/plots/scalar/prepared-series.test.ts`

**Interfaces:**
- Consumes: `percentile` (Task 1); `emaSmooth` (`transforms/smooth.ts`) as the reference in tests; `Series`, `SeriesPoint` (`plots/types.ts`).
- Produces: `PreparedSeries`, `PrepareOptions`, `PreparedSeriesCache` exactly as spec §3.2.

- [ ] **Step 1: Tests**

```ts
import { test } from "node:test"; import assert from "node:assert/strict";
import { PreparedSeriesCache } from "./prepared-series.ts";
import { emaSmooth } from "../transforms/smooth.ts";
const mk = (n: number, off = 0) => Array.from({ length: n }, (_, i) => ({ x: i + off, y: Math.sin((i + off) / 10) * 10, wallTime: `t${i + off}` }));
const OPTS = { smoothing: 0, outlierPct: [0, 100] as [number, number], logX: false };
test("full prepare sorts, copies and computes extents", () => {
  const c = new PreparedSeriesCache(); const pts = mk(100).reverse();
  const p = c.prepare({ key: "a", label: "a", color: "#000", points: pts }, OPTS);
  assert.equal(p.n, 100); assert.equal(p.xs[0], 0); assert.equal(p.xs[99], 99); assert.equal(p.points[0]!.wallTime, "t0");
  assert.equal(p.xMin, 0); assert.equal(p.xMax, 99); assert.ok(p.yMax <= 10 && p.yMin >= -10); assert.equal(p.lo, -Infinity); assert.equal(p.hi, Infinity);
});
test("append extends incrementally and keeps EMA equal to emaSmooth on the whole array", () => {
  const c = new PreparedSeriesCache(); const opts = { ...OPTS, smoothing: 0.9 };
  const s1 = { key: "a", label: "a", color: "#000", points: mk(1000) };
  const p1 = c.prepare(s1, opts); const xs1 = p1.xs;
  const s2 = { ...s1, points: [...s1.points, ...mk(50, 1000)] };
  const p2 = c.prepare(s2, opts);
  assert.equal(p2.n, 1050); assert.notEqual(p2, p1);
  assert.ok(p2.xs.buffer !== xs1.buffer || p2.xs.length === 1050); // grown
  const ref = emaSmooth(s2.points, 0.9).smoothed;
  for (let i = 0; i < 1050; i++) assert.equal(p2.ys[i], ref[i]!.y, `y[${i}]`);
  assert.ok(p2.rawYs && p2.rawYs[1049] === s2.points[1049]!.y);
  assert.equal(c.stats().appends, 1); assert.equal(c.stats().rebuilds, 1);
});
test("probe mismatch, option change or shorter input rebuilds", () => {
  const c = new PreparedSeriesCache(); const s = { key: "a", label: "a", color: "#000", points: mk(200) };
  c.prepare(s, OPTS);
  c.prepare({ ...s, points: [...mk(100), ...mk(150, 5)] }, OPTS); // first 100 equal, x jumps back → not ascending tail
  c.prepare({ ...s, points: mk(300) }, { ...OPTS, smoothing: 0.5 });
  c.prepare({ ...s, points: mk(50) }, OPTS);
  assert.equal(c.stats().appends, 0); assert.equal(c.stats().rebuilds, 4);
});
test("outlier bounds from percentiles and logX", () => {
  const c = new PreparedSeriesCache(); const pts = mk(1000); pts[500]!.y = 1e6;
  const p = c.prepare({ key: "a", label: "a", color: "#000", points: pts }, { ...OPTS, outlierPct: [1, 99], logX: true });
  assert.ok(p.hi < 1e6 && p.hi >= 9);
  assert.ok(Number.isNaN(p.logXs![0])); assert.equal(p.logXs![10], 1); assert.equal(p.logXs![100], 2); assert.equal(p.logStart, 1);
});
test("drop forgets the entry", () => { const c = new PreparedSeriesCache(); c.prepare({ key: "a", label: "a", color: "#000", points: mk(10) }, OPTS); c.drop("a"); c.prepare({ key: "a", label: "a", color: "#000", points: mk(20) }, OPTS); assert.equal(c.stats().rebuilds, 2); });
```
(`stats()` → `{ appends: number; rebuilds: number }` is part of the produced API, for tests and the harness.)

- [ ] **Step 2: Implement** per spec §3.2. Storage per key: `{ prepared, options, sig: { n, x0, xMid, xLast } }`. Append check: `points.length > n && options equal && points[0].x === x0 && points[n>>1].x === xMid && points[n-1].x === xLast && points[n].x >= xLast` and the tail is ascending (scan). Typed arrays grow by allocating `max(n*2, needed)` capacity and keeping a `length` separately, exposing `subarray(0, n)` views in `PreparedSeries` (document that views are invalidated by the next `prepare`). EMA: read `emaSmooth`'s exact recurrence and first-value rule and reproduce them; the test compares equality. `logXs` computed lazily on first request with `logX: true`: `Math.log10(x)` for `x > 0`, `NaN` for `x <= 0`; `PreparedSeries.logStart` = index of the first positive x (xs are sorted, so every later x is positive too). `ScalarPlot` windows a log-scale series from `logStart` and derives the log domain from positive x only, never from `logXs[0]`. EMA: reproduce `emaSmooth` literally — seed `prev = points[0].y` and run the recurrence from `i = 0` (so `sm[0] = alpha*y0 + (1-alpha)*y0`, not an assignment); `alpha <= 0` means no smoothing (`ys` = raw copy, `rawYs = null`); no non-finite guard, so a NaN y poisons later values exactly as `emaSmooth` does (the bit-for-bit test relies on it). `lo/hi` via `percentile(ys, pLo)` / `percentile(ys, pHi)` on the smoothed values when `outlierPct` is not `[0,100]`.

- [ ] **Step 3: Run** — green; typecheck.
- [ ] **Step 4: Commit** — "Add the incremental prepared-series cache".

---

### Task 3: `ScalarPlot` renders reduced rows; hover via DOM attribute

**Files:**
- Modify: `ui/src/plots/scalar/backends/svg/ScalarPlot.tsx`
- Modify: `ui/src/plots/scalar/backends/svg/support/scalar-legend.tsx` (hover attribute), `ui/src/plots/scalar/types.ts` (`smoothing`, `outlierPct` in `ScalarPresentation`), `ui/src/plots/scalar/view.tsx` (pass them), `ui/src/public/scalar.ts` (types re-export if needed)
- Modify: `ui/src/public/theme/plot.css` (hover rules)
- Test: `ui/src/plots/scalar/render-rows.test.ts` (pure helper extracted below)

**Interfaces:**
- Consumes: Task 1 + Task 2.
- Produces: `buildRenderRows(prepared: PreparedSeries[], visible: (key) => boolean, x0: number, x1: number, columns: number, logX: boolean): Row[]` in `ui/src/plots/scalar/render-rows.ts` (pure, tested) — for each visible series computes the window and reduced indices, materialises a reduced `Series` (`points[idx]` with smoothed `y`, plus `rawPoints` from `rawYs` when present) and calls the existing `mergeToRows` on the reduced series, so the row shape is unchanged. Add the missing `ui/src/plots/transforms/merge-rows.test.ts` (two series, shared and disjoint x, `__wall`/`__ctx`/`__raw` keys) in this task.

- [ ] **Step 1: Test `buildRenderRows`**: two prepared series (via the cache) of 20k points, columns 300 → every row has `x` and at most one value per series key; total rows ≤ 2 × (4×300+2); hidden series contribute no keys; `__raw` present when `rawYs`.
- [ ] **Step 2: Wire `ScalarPlot`**: keep a `useRef(new PreparedSeriesCache())`; `prepared = series.map(s => cache.prepare(s, { smoothing: smoothing ?? 0, outlierPct: outlierPct ?? [0,100], logX: xScale === "log" }))` inside `useMemo([series, smoothing, outlierPct, xScale])` — but when `smoothing === undefined && s.rawPoints` (legacy pre-smoothed input) pass the series through the cache with smoothing 0 and render `rawPoints` as today. `dataXs`/`dataYs` come from prepared extents. Columns: primary source is `ResponsiveContainer`'s `onResize(width, height)` (fires before the chart renders; store in state when it changes by ≥ 8 px), corrected by the `Customized` plot-rect width (`plotOffsetRef.current.width`, captured during the chart's own render, so it lands one render late) when the two differ by ≥ 8 px; fallback 800. Rows = `useMemo(buildRenderRows(...), [prepared, visibility, x0, x1, columns])`. Remove the `mergeToRows(series)` call.
- [ ] **Step 3: Hover**: Recharts 2.15 puts `className` on the `<g class="recharts-line">` wrapper but forwards `data-*` props to the `<path>` (`util/ReactUtils.js` keeps `data-` keys). So: give each `<Line>` `data-series-key={s.key}` and the faint raw overlay additionally `data-series-role="raw"`. Keep a root `ref`; in `onMouseMove`/`onMouseLeave`, instead of `setHoveredKey`, iterate `root.querySelectorAll("path[data-series-key]")` and set `el.dataset.emph = key === hovered ? "on" : hovered ? "dim" : ""`. Delete the `isHovered` stroke props from `<Line>` and every other hover-state read in `ScalarPlot.tsx` (seven sites; the legend and tooltip never received hover state — legend hover emphasis is NEW wiring: a callback prop that calls the same DOM updater). CSS: append to `ui/src/public/theme/plot.css` (the only stylesheet; there are no CSS modules in this repo):
```css
.recharts-line path[data-emph="on"] { stroke-width: 2.5; stroke-opacity: 1; }
.recharts-line path[data-emph="dim"] { stroke-opacity: 0.15; }
```
(CSS beats the SVG presentation attributes Recharts sets.) Then `npm run build:plot-inline && npm run sync:plot-assets`.
- [ ] **Step 4: Run** — typecheck, unit tests, `node scripts/test-harness.mjs` for any existing scalar-touching page (none exist; run `--only compare-settings-sync` as a smoke), `npm run build:plot-inline && npm run sync:plot-assets`.
- [ ] **Step 5: Commit** — "Render scalar charts from pixel-reduced rows; hover without re-render".

---

### Task 4: Frame-coalesced view changes

**Files:**
- Create: `ui/src/plots/chart/frame-coalescer.ts` (+ test)
- Modify: `ui/src/plots/scalar/backends/svg/support/use-plot-gestures.ts`

**Interfaces:** `createFrameCoalescer<T>(emit: (v: T) => void, schedule = requestAnimationFrame-with-hidden-fallback): { push(v: T): void; flush(): void; cancel(): void }`.

- [ ] **Step 1: Test** the pure coalescer with an injected scheduler: three pushes before the scheduler fires → one emit with the last value; `flush()` emits immediately and cancels the pending frame; `cancel()` drops.
- [ ] **Step 2: Wire**: the five `onViewChange(` sites in `use-plot-gestures.ts` are `:154` wheel, `:253` two-finger pinch (inside `onChartPointerMove`), `:277` pan pointer-move, `:369` box-zoom commit on pointer-up, `:385` double-click reset. Box-zoom DRAG never calls `onViewChange` (it only `setSelection`s). Coalesce the three high-frequency sites (`:154`, `:253`, `:277`) through `push`; `:369` and `:385` call `flush()` then emit directly. Hidden-document fallback: `setTimeout(fn, 0)` when `document.visibilityState === "hidden"`.
- [ ] **Step 3: Run + commit** — "Coalesce scalar view changes to one per frame".

---

### Task 5: Content ids without serialisation

**Files:**
- Modify: `ui/src/plots/contracts.ts` (optional `contentId?(data: DataSpec): string | null` on BOTH `PlotDefinition` (`:80-94`) and the type-erased `RegisteredPlotDefinition` (`:97-108`), forwarded in `definePlot` with the conditional-spread pattern used for `migrateSettings` at `:125-127`), `ui/src/resources/resolution-cache.ts` (the module-private `descriptorContentId(node)` looks the definition up itself via `getReactPlotType(node.type)?.definition.contentId` — ONE code path; when the type is not registered yet it falls back to canonical JSON and must NOT memoise that fallback in `contentIdMap`, so the key becomes the content-id form as soon as the type registers and stays stable from then on — test both orders), `ui/src/plots/scalar/register.ts` (`contentId` for inline series). `PlotNodeView.tsx` needs no change (it computes `resolutionKey` at `:199`, `:427`, `:489` BEFORE looking up the type, which is why the lookup belongs inside the cache). `resolutionKey(source, node, suffix = "")` keeps its signature (callers pass `suffix` at `PlotNodeView.tsx:214,219,489` and `image/runtime/host-adapter.tsx:177,274`). Watch for an import cycle: `resolution-cache.ts` → `react-registry.ts`; if one appears, inject the lookup via a setter registered by `register-core.tsx`.
- Test: `ui/src/resources/resolution-cache.test.ts` (extend), `ui/src/plots/scalar/register.test.ts` (extend)

- [ ] **Step 1: Tests**: scalar `contentId` is identical for two deep copies, changes when a point is appended, ignores `wallTime`/`context`, and includes the non-series props; `resolutionKey` uses the registered definition's `contentId` when present and falls back to canonical JSON otherwise (a node keyed before its type registered is re-keyed by content id afterwards); a benchmark-style assertion that `contentId` on 10 × 100k points runs under 20 ms (node).
- [ ] **Step 2: Implement** per spec §3.6: id = `scalar:` + series.map(s => `${s.key}|${n}|${x0}|${xn}|${yn}`).join(";") + `|` + canonicalJson(props without `series`).
- [ ] **Step 3: Run + commit** — "Key scalar inline data by content summary, not serialisation".

---

### Task 6: Benchmark harness and docs

**Files:**
- Create: `ui/src/plots/scalar/__tests__/scalar-render-cost.browser.ts` + `.browser.html` (self-driving)
- Modify: `docs/architecture.md` (scalar rendering paragraph)

- [ ] **Step 1**: page mounts `ScalarPlot` directly with `createRoot(host).render(h(ScalarPlot, {...}))` — template: `ui/src/primitives/components/__tests__/toolbar-menu-portal.browser.{ts,html}` (direct component mount, self-driving, links `harness-style.css`). The HTML MUST carry `data-cairn-harness="self-driving"` on `<html>` (otherwise `--only` selects it and the filter then rejects it and the runner dies). The harness injects the two hover CSS rules itself via a `<style>` element (the runner's esbuild has no CSS loader; the real rules live in `plot.css`). Mount in an 800 px host with 10 series × 100 000 points (`y = sin + noise`, `smoothing 0.6`), and measures via `PerformanceObserver("longtask")` + `performance.now()`: mount-to-paint (poll for `path[data-series-key]` with a non-empty `d`), append 100 points per series then re-render, one wheel step dispatched on the chart, 20 mouse moves; asserts spec §4 budgets and `path d` point count ≤ 5×columns+2 (count `L`/`M` commands) and that the `d` attribute of the first series is byte-identical before/after the hover sweep. Prints the numbers.
- [ ] **Step 2**: `node scripts/test-harness.mjs --only scalar-render-cost` PASS; full harness once.
- [ ] **Step 3**: `docs/architecture.md`: paragraph on prepared series, M4 reduction, content ids, coalescing.
- [ ] **Step 4: Commit** — "Add scalar render cost harness and docs".

---

### Task 7 (cairn repo): consumers pass raw series and settings; bump

**Files (in /Users/doeringc/workspace/cairn):**
- Modify: `cairn/ui/src/components/ScalarPlotCard.tsx` (`useMemo` at `:180-215`, imports `:36-38`: drop `strideDownsample`/`emaSmooth`/`filterOutliers` and the now-unused deps `settings.smoothing`, `settings.outlierPct[0]`, `settings.outlierPct[1]` from the dependency list at `:210-212`; pass `smoothing={settings.smoothing}` `outlierPct={settings.outlierPct}` to `<ScalarPlot>`; types are `number` / `[number, number]` at `:57-58`), `cairn/ui/src/components/CairnPlotCard.tsx` (scalar branch `:339-368` already passes raw points; add `smoothing` and `outlierPct` to the inline `props` at `:361`), submodule bump.
- Test: `cairn/ui` `npm run test:unit`, `npm run build`; manual check on a 10k run.

- [ ] Steps: bump `vendor/cairn-plot` to the merged cairn-plot main; edit the two cards; `npm run typecheck && npm run test:unit && npm run build`; commit "Scalar cards pass raw series; bump cairn-plot".
