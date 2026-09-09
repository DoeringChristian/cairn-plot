# Scalar Render Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scalar charts render at most four points per pixel column per series, prepare appended points incrementally, key caches without serialising point data, and never recompute data on hover or per gesture frame.

**Architecture:** Pure transforms (`visibleWindow`, `reduceToColumns`, `percentile`) + a `PreparedSeriesCache` under `plots/scalar/`; `ScalarPlot` builds its Recharts rows from reduced indices; hover is a DOM attribute + CSS; gestures coalesce view changes per frame; the resolution cache asks the plot definition for a content id.

**Tech Stack:** TypeScript, React 18, Recharts 2.13, `node --experimental-strip-types --test`, browser harness runner (`ui/scripts/test-harness.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-09-scalar-render-performance-design.md`

## Global Constraints

- Transforms in `ui/src/plots/transforms/`, scalar-specific code in `ui/src/plots/scalar/` (layout rule in `docs/plot-type-authoring.md`).
- `reduceToColumns` returns indices (`Int32Array`) in ascending order, ≤ 4 per column, includes each column's first, min, max and last; passthrough when `end - start <= 2 * columns`.
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
  assert.ok(idx.length <= 4 * 500 + 2);
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
test("matches a sorted reference (nearest-rank on finite values)", () => {
  const v = Float64Array.from({ length: 1001 }, (_, i) => ((i * 7919) % 1001) - 500); v[10] = NaN; v[20] = Infinity;
  const finite = [...v].filter(Number.isFinite).sort((a, b) => a - b);
  for (const p of [0, 1, 5, 50, 95, 99, 100]) { const rank = Math.min(finite.length - 1, Math.max(0, Math.ceil((p / 100) * finite.length) - 1)); assert.equal(percentile(v, p), finite[rank]); }
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
  if (end <= start) return start >= n ? [n - 1, n] : [start, start + 1];
  return [start, end];
}
```

```ts
// pixel-reduce.ts — M4 reduction
export function reduceToColumns(xs, ys, start, end, xMin, xMax, columns, lo = -Infinity, hi = Infinity): Int32Array {
  const count = end - start; if (count <= 0) return new Int32Array(0);
  if (count <= 2 * columns || !(xMax > xMin)) { const all = new Int32Array(count); for (let i = 0; i < count; i++) all[i] = start + i; return all; }
  const out = new Int32Array(4 * columns + 2); let n = 0;
  const scale = columns / (xMax - xMin);
  let col = -1, first = -1, last = -1, minI = -1, maxI = -1;
  const flush = () => { if (first < 0) return; const c = [first, minI, maxI, last].filter((v, i, a) => v >= 0 && a.indexOf(v) === i).sort((a, b) => a - b); for (const i of c) out[n++] = i; };
  for (let i = start; i < end; i++) {
    const y = ys[i]!; const x = xs[i]!;
    const c = Math.min(columns - 1, Math.max(0, Math.floor((x - xMin) * scale)));
    if (c !== col) { flush(); col = c; first = last = i; minI = maxI = -1; }
    if (Number.isNaN(y)) { last = i; if (n < out.length) { flush(); first = -1; out[n++] = i; col = -2; } continue; } // gap marker emitted alone
    if (y < lo || y > hi) continue;
    if (first < 0) first = i; last = i;
    if (minI < 0 || y < ys[minI]!) minI = i; if (maxI < 0 || y > ys[maxI]!) maxI = i;
  }
  flush();
  return out.subarray(0, n).slice();
}
```
(Types: `xs: ArrayLike<number>, ys: ArrayLike<number>, start: number, end: number, xMin: number, xMax: number, columns: number, lo?: number, hi?: number`. The NaN-gap branch must keep the output within `4*columns+2`: emit the NaN index only when a column is open or at most once per column; test 4 pins that NaN at index 42 survives.)

```ts
// percentile.ts — nearest-rank via quickselect on a scratch copy
export function percentile(values: ArrayLike<number>, p: number): number {
  const a: number[] = []; for (let i = 0; i < values.length; i++) { const v = values[i]!; if (Number.isFinite(v)) a.push(v); }
  if (a.length === 0) return NaN;
  const k = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  let lo = 0, hi = a.length - 1;
  while (lo < hi) { const pivot = a[(lo + hi) >>> 1]!; let i = lo, j = hi; while (i <= j) { while (a[i]! < pivot) i++; while (a[j]! > pivot) j--; if (i <= j) { const t = a[i]!; a[i] = a[j]!; a[j] = t; i++; j--; } } if (k <= j) hi = j; else if (k >= i) lo = i; else break; }
  return a[k]!;
}
```

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
  assert.ok(p.hi < 1e6 && p.hi >= 9); assert.ok(p.logXs && Number.isNaN(p.logXs[0]) === false || p.logXs![0] === -Infinity); assert.equal(p.logXs![10], 1);
});
test("drop forgets the entry", () => { const c = new PreparedSeriesCache(); c.prepare({ key: "a", label: "a", color: "#000", points: mk(10) }, OPTS); c.drop("a"); c.prepare({ key: "a", label: "a", color: "#000", points: mk(20) }, OPTS); assert.equal(c.stats().rebuilds, 2); });
```
(`stats()` → `{ appends: number; rebuilds: number }` is part of the produced API, for tests and the harness.)

- [ ] **Step 2: Implement** per spec §3.2. Storage per key: `{ prepared, options, sig: { n, x0, xMid, xLast } }`. Append check: `points.length > n && options equal && points[0].x === x0 && points[n>>1].x === xMid && points[n-1].x === xLast && points[n].x >= xLast` and the tail is ascending (scan). Typed arrays grow by allocating `max(n*2, needed)` capacity and keeping a `length` separately, exposing `subarray(0, n)` views in `PreparedSeries` (document that views are invalidated by the next `prepare`). EMA: read `emaSmooth`'s exact recurrence and first-value rule and reproduce them; the test compares equality. `logXs` computed lazily on first request with `logX: true` (`Math.log10`, non-positive x → NaN so the reducer treats them as skipped columns... no: keep them and let the axis clip — set to `-Infinity` and document). `lo/hi` via `percentile(ys, pLo)` / `percentile(ys, pHi)` on the smoothed values when `outlierPct` is not `[0,100]`.

- [ ] **Step 3: Run** — green; typecheck.
- [ ] **Step 4: Commit** — "Add the incremental prepared-series cache".

---

### Task 3: `ScalarPlot` renders reduced rows; hover via DOM attribute

**Files:**
- Modify: `ui/src/plots/scalar/backends/svg/ScalarPlot.tsx`
- Modify: `ui/src/plots/scalar/backends/svg/support/scalar-legend.tsx` (hover attribute), `ui/src/plots/scalar/types.ts` (`smoothing`, `outlierPct` in `ScalarPresentation`), `ui/src/plots/scalar/view.tsx` (pass them), `ui/src/public/scalar.ts` (types re-export if needed)
- Create: `ui/src/plots/scalar/backends/svg/scalar-plot.css` (or the existing CSS module location used by scalar; follow what `chart-host.tsx` does)
- Test: `ui/src/plots/scalar/render-rows.test.ts` (pure helper extracted below)

**Interfaces:**
- Consumes: Task 1 + Task 2.
- Produces: `buildRenderRows(prepared: PreparedSeries[], visible: (key) => boolean, x0: number, x1: number, columns: number, logX: boolean): Row[]` in `ui/src/plots/scalar/render-rows.ts` (pure, tested) — builds `mergeToRows`-shaped rows from reduced indices, carrying `__wall`/`__ctx` from `prepared.points[idx]` and `__raw` from `rawYs`.

- [ ] **Step 1: Test `buildRenderRows`**: two prepared series (via the cache) of 20k points, columns 300 → every row has `x` and at most one value per series key; total rows ≤ 2 × (4×300+2); hidden series contribute no keys; `__raw` present when `rawYs`.
- [ ] **Step 2: Wire `ScalarPlot`**: keep a `useRef(new PreparedSeriesCache())`; `prepared = series.map(s => cache.prepare(s, { smoothing: smoothing ?? 0, outlierPct: outlierPct ?? [0,100], logX: xScale === "log" }))` inside `useMemo([series, smoothing, outlierPct, xScale])` — but when `smoothing === undefined && s.rawPoints` (legacy pre-smoothed input) pass the series through the cache with smoothing 0 and render `rawPoints` as today. `dataXs`/`dataYs` come from prepared extents. Columns from the `Customized` rect (`plotOffsetRef.current.width`) stored in state only when it changes by ≥ 8 px (avoid re-render loops); fallback container width via `ResponsiveContainer`'s `onResize`, then 800. Rows = `useMemo(buildRenderRows(...), [prepared, visibility, x0, x1, columns])`. Remove the `mergeToRows(series)` call.
- [ ] **Step 3: Hover**: add `className="cairn-series"` + `data-series-key` (Recharts `Line` forwards `className`; verify in the rendered DOM which element carries it and target the `path` beneath) and a root `ref`; `onMouseMove` sets `root.dataset.hover = key` (and clears on leave) instead of `setHoveredKey`; CSS rules for emphasised/dimmed strokes; legend hover uses the same attribute via a callback prop. Delete the `isHovered` stroke props from `<Line>`.
- [ ] **Step 4: Run** — typecheck, unit tests, `node scripts/test-harness.mjs` for any existing scalar-touching page (none exist; run `--only compare-settings-sync` as a smoke), `npm run build:plot-inline && npm run sync:plot-assets`.
- [ ] **Step 5: Commit** — "Render scalar charts from pixel-reduced rows; hover without re-render".

---

### Task 4: Frame-coalesced view changes

**Files:**
- Create: `ui/src/plots/chart/frame-coalescer.ts` (+ test)
- Modify: `ui/src/plots/scalar/backends/svg/support/use-plot-gestures.ts`

**Interfaces:** `createFrameCoalescer<T>(emit: (v: T) => void, schedule = requestAnimationFrame-with-hidden-fallback): { push(v: T): void; flush(): void; cancel(): void }`.

- [ ] **Step 1: Test** the pure coalescer with an injected scheduler: three pushes before the scheduler fires → one emit with the last value; `flush()` emits immediately and cancels the pending frame; `cancel()` drops.
- [ ] **Step 2: Wire**: wheel (`use-plot-gestures.ts:~154`) and pointer-move pan/box (`:~253`, `:~277`) push; box-zoom end (`:~369`) and reset (`:~385`) call `flush()` then emit directly. Hidden-document fallback: `setTimeout(fn, 0)` when `document.visibilityState === "hidden"`.
- [ ] **Step 3: Run + commit** — "Coalesce scalar view changes to one per frame".

---

### Task 5: Content ids without serialisation

**Files:**
- Modify: `ui/src/plots/contracts.ts` (optional `contentId?(data: DataSpec): string | null` on the plot definition), `ui/src/resources/resolution-cache.ts` (`descriptorContentId(node, definition?)` and `resolutionKey(source, node, suffix?, definition?)`), `ui/src/host/PlotNodeView.tsx` (pass the definition it already has), `ui/src/plots/scalar/register.ts` (`contentId` for inline series)
- Test: `ui/src/resources/resolution-cache.test.ts` (extend), `ui/src/plots/scalar/register.test.ts` (extend)

- [ ] **Step 1: Tests**: scalar `contentId` is identical for two deep copies, changes when a point is appended, ignores `wallTime`/`context`, and includes the non-series props; `resolutionKey` uses `definition.contentId` when present and falls back to canonical JSON otherwise; a benchmark-style assertion that `contentId` on 10 × 100k points runs under 20 ms (node).
- [ ] **Step 2: Implement** per spec §3.6: id = `scalar:` + series.map(s => `${s.key}|${n}|${x0}|${xn}|${yn}`).join(";") + `|` + canonicalJson(props without `series`).
- [ ] **Step 3: Run + commit** — "Key scalar inline data by content summary, not serialisation".

---

### Task 6: Benchmark harness and docs

**Files:**
- Create: `ui/src/plots/scalar/__tests__/scalar-render-cost.browser.ts` + `.browser.html` (self-driving)
- Modify: `docs/architecture.md` (scalar rendering paragraph)

- [ ] **Step 1**: page mounts `ScalarPlot` directly (import from `../backends/svg/ScalarPlot.tsx` through React DOM, like other harness pages mount components — follow `compare/__tests__/compare-settings-sync.browser.ts` for the mount pattern) in an 800 px host with 10 series × 100 000 points (`y = sin + noise`, `smoothing 0.6`), and measures via `PerformanceObserver("longtask")` + `performance.now()`: mount-to-paint (poll for `path.cairn-series` with a non-empty `d`), append 100 points per series then re-render, one wheel step dispatched on the chart, 20 mouse moves; asserts spec §4 budgets and `path d` point count ≤ 4×columns+2 (count `L`/`M` commands) and that the `d` attribute of the first series is byte-identical before/after the hover sweep. Prints the numbers.
- [ ] **Step 2**: `node scripts/test-harness.mjs --only scalar-render-cost` PASS; full harness once.
- [ ] **Step 3**: `docs/architecture.md`: paragraph on prepared series, M4 reduction, content ids, coalescing.
- [ ] **Step 4: Commit** — "Add scalar render cost harness and docs".

---

### Task 7 (cairn repo): consumers pass raw series and settings; bump

**Files (in /Users/doeringc/workspace/cairn):**
- Modify: `cairn/ui/src/components/ScalarPlotCard.tsx` (drop `strideDownsample`/`emaSmooth`/`filterOutliers`; pass `smoothing={settings.smoothing}` `outlierPct={settings.outlierPct}`), `cairn/ui/src/components/CairnPlotCard.tsx` (scalar `props` gain `smoothing`, `outlierPct`; raw points), submodule bump.
- Test: `cairn/ui` `npm run test:unit`, `npm run build`; manual check on a 10k run.

- [ ] Steps: bump `vendor/cairn-plot` to the merged cairn-plot main; edit the two cards; `npm run typecheck && npm run test:unit && npm run build`; commit "Scalar cards pass raw series; bump cairn-plot".
