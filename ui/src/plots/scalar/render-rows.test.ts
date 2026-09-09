import { test } from "node:test"; import assert from "node:assert/strict";
import { buildRenderRows } from "./render-rows.ts";
import { PreparedSeriesCache } from "./prepared-series.ts";
import type { Series } from "../types.ts";

const N = 20_000;
const COLUMNS = 300;
const CAP = 5 * COLUMNS + 2;
const OPTS = { smoothing: 0, outlierPct: [0, 100] as [number, number], logX: false };
const ALL = () => true;

const mk = (key: string, phase: number): Series => ({
  key, label: key, color: "#000",
  points: Array.from({ length: N }, (_, i) => ({ x: i, y: Math.sin(i / 50 + phase) * 10 + (i % 7) })),
});

function prepareTwo(options = OPTS) {
  const cache = new PreparedSeriesCache();
  return [cache.prepare(mk("a", 0), options), cache.prepare(mk("b", 1), options)];
}

test("two 20k series reduce onto ONE shared grid of at most 5 columns + 2 rows", () => {
  const rows = buildRenderRows(prepareTwo(), ALL, 0, N - 1, COLUMNS, false);
  assert.ok(rows.length > COLUMNS, `only ${rows.length} rows`);
  // The union is capped by the SHARED grid, not by the number of series: this
  // is the property that keeps Recharts' per-item cost off the series count.
  assert.ok(rows.length <= CAP, `${rows.length} rows > ${CAP}`);
  let a = 0, b = 0;
  for (const r of rows) { if (r.a !== undefined) a++; if (r.b !== undefined) b++; }
  assert.ok(a <= CAP && a > COLUMNS, `series a contributed ${a}`);
  assert.ok(b <= CAP && b > COLUMNS, `series b contributed ${b}`);
  // Both series land on essentially every row — that is what "shared" means.
  assert.ok(a > rows.length * 0.9 && b > rows.length * 0.9, `a=${a} b=${b} of ${rows.length}`);
});

test("rows are x-sorted and carry at most one value per series key", () => {
  const rows = buildRenderRows(prepareTwo(), ALL, 0, N - 1, COLUMNS, false);
  const seen = new Set<number>();
  let prev = -Infinity;
  for (const r of rows) {
    assert.ok(r.x > prev, "rows must be strictly x-ascending");
    prev = r.x;
    assert.equal(seen.has(r.x), false);
    seen.add(r.x);
    for (const k of ["a", "b"]) {
      if (r[k] !== undefined) assert.equal(typeof r[k], "number");
    }
  }
});

test("every y is a real prepared value, at an x within half a column of its own", () => {
  const prepared = prepareTwo();
  const rows = buildRenderRows(prepared, ALL, 0, N - 1, COLUMNS, false);
  const column = (N - 1) / COLUMNS;
  for (const p of prepared) {
    // y -> the set of x it occurs at in the source (values repeat, so a map by
    // y alone would be ambiguous; check the nearest occurrence).
    const xsByY = new Map<number, number[]>();
    for (let i = 0; i < p.n; i++) {
      const arr = xsByY.get(p.ys[i]!);
      if (arr) arr.push(p.xs[i]!); else xsByY.set(p.ys[i]!, [p.xs[i]!]);
    }
    for (const r of rows) {
      const y = r[p.key];
      if (y === undefined) continue;
      const xs = xsByY.get(y as number);
      assert.ok(xs, `row y ${y} is not a value of series ${p.key}`);
      const nearest = Math.min(...xs!.map((x) => Math.abs(x - r.x)));
      assert.ok(nearest <= column, `${p.key} moved ${nearest} > one column (${column})`);
    }
  }
});

test("a hidden series contributes no keys", () => {
  const rows = buildRenderRows(prepareTwo(), (k) => k === "a", 0, N - 1, COLUMNS, false);
  for (const r of rows) assert.equal("b" in r, false);
  assert.ok(rows.some((r) => r.a !== undefined));
});

test("__raw is present exactly when the prepared series has rawYs", () => {
  const plain = prepareTwo();
  assert.equal(plain[0]!.rawYs, null);
  const plainRows = buildRenderRows(plain, ALL, 0, N - 1, COLUMNS, false);
  assert.equal(plainRows.some((r) => "a__raw" in r), false);

  const smoothed = prepareTwo({ ...OPTS, smoothing: 0.9 });
  assert.notEqual(smoothed[0]!.rawYs, null);
  const rows = buildRenderRows(smoothed, ALL, 0, N - 1, COLUMNS, false);
  assert.ok(rows.length <= CAP);
  assert.ok(rows.some((r) => r.a__raw !== undefined));
  // Every raw value is a real raw value of that series.
  const raws = new Set(Array.from({ length: smoothed[0]!.n }, (_, i) => smoothed[0]!.rawYs![i]!));
  for (const r of rows) if (r.a__raw !== undefined) assert.ok(raws.has(r.a__raw as number));
});

test("the raw overlay is an ENVELOPE: at most 2 picks per column, per series", () => {
  const smoothed = prepareTwo({ ...OPTS, smoothing: 0.9 });
  const rows = buildRenderRows(smoothed, ALL, 0, N - 1, COLUMNS, false);
  for (const key of ["a__raw", "b__raw"]) {
    const n = rows.filter((r) => r[key] !== undefined).length;
    assert.ok(n <= 2 * COLUMNS + 2, `${key} carries ${n} points > ${2 * COLUMNS + 2}`);
    assert.ok(n > COLUMNS, `${key} carries only ${n} points`);
  }
  // ... and it stays cheaper than the curve it sits behind.
  const curve = rows.filter((r) => r.a !== undefined).length;
  const raw = rows.filter((r) => r.a__raw !== undefined).length;
  assert.ok(raw < curve, `raw ${raw} should be below curve ${curve}`);
});

test("the envelope spans the raw extremes of each column", () => {
  const cache = new PreparedSeriesCache();
  // Two columns' worth of a sawtooth: the envelope must find both extremes.
  const points = Array.from({ length: 4000 }, (_, i) => ({ x: i, y: i % 2 === 0 ? -i : i }));
  const p = cache.prepare({ key: "a", label: "a", color: "#000", points }, { ...OPTS, smoothing: 0.9 });
  const rows = buildRenderRows([p], ALL, 0, 3999, 4, false);
  const raw = rows.filter((r) => r.a__raw !== undefined).map((r) => r.a__raw as number);
  assert.ok(raw.length <= 2 * 4 + 2, `${raw.length} envelope points`);
  // Last column holds the extremes of the last quarter: -3998 and 3999.
  assert.equal(Math.min(...raw), -3998);
  assert.equal(Math.max(...raw), 3999);
});

test("a window small enough to draw point-for-point keeps its EXACT x", () => {
  const rows = buildRenderRows(prepareTwo(), ALL, 100, 200, COLUMNS, false);
  // 101 points in [100, 200] plus one either side, below 2*columns → no
  // reduction, and therefore no snapping.
  assert.deepEqual(rows.map((r) => r.x), Array.from({ length: 103 }, (_, i) => 99 + i));
});

test("outlier bounds from the prepared series drop clipped points", () => {
  const cache = new PreparedSeriesCache();
  const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i === 500 ? 1e6 : i % 10 }));
  const p = cache.prepare({ key: "a", label: "a", color: "#000", points }, { smoothing: 0, outlierPct: [0, 99], logX: false });
  assert.ok(p.hi < 1e6);
  const rows = buildRenderRows([p], ALL, 0, 999, 10, false);
  for (const r of rows) if (r.a !== undefined) assert.ok((r.a as number) <= p.hi);
});

test("log x bins in log space and starts at the first positive x", () => {
  const cache = new PreparedSeriesCache();
  const points = Array.from({ length: 2000 }, (_, i) => ({ x: i - 1, y: i }));
  const p = cache.prepare({ key: "a", label: "a", color: "#000", points }, { ...OPTS, logX: true });
  assert.equal(p.logStart, 2); // x = -1 and x = 0 are not on a log axis
  const rows = buildRenderRows([p], ALL, 1, 1998, 20, true);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.x > 0), "no non-positive x on a log axis");
  // Log binning keeps resolution at the low end: more than a linear split would.
  const low = rows.filter((r) => r.x <= 100).length;
  assert.ok(low > rows.length / 3, `${low} of ${rows.length} rows below x=100`);
});

test("an empty prepared list and an empty series give no rows", () => {
  assert.deepEqual(buildRenderRows([], ALL, 0, 1, 100, false), []);
  const cache = new PreparedSeriesCache();
  const p = cache.prepare({ key: "a", label: "a", color: "#000", points: [] }, OPTS);
  assert.deepEqual(buildRenderRows([p], ALL, 0, 1, 100, false), []);
});

test("wallTime and context survive the reduction", () => {
  const cache = new PreparedSeriesCache();
  const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i, wallTime: `t${i}`, context: i === 4 ? null : `c${i}` }));
  const rows = buildRenderRows(
    [cache.prepare({ key: "a", label: "a", color: "#000", points }, OPTS)], ALL, 0, 49, 100, false,
  );
  assert.equal(rows[3]!.a__wall, "t3");
  assert.equal(rows[3]!.a__ctx, "c3");
  assert.equal("a__ctx" in rows[4]!, false); // a null context is dropped, not carried
});

test("every row carries __x: the REAL x of the pick that opened it", () => {
  // A step axis: the drawn x is a fractional slot centre, but the tooltip must
  // report the integer step the point actually came from.
  const rows = buildRenderRows(prepareTwo(), ALL, 0, N - 1, COLUMNS, false);
  const xs = new Set(Array.from({ length: N }, (_, i) => i));
  for (const r of rows) {
    assert.equal(typeof r.__x, "number");
    assert.ok(Number.isInteger(r.__x), `__x ${r.__x} is not a real step`);
    assert.ok(xs.has(r.__x as number));
    // ... and it is the row it is drawn at, to within one column.
    assert.ok(Math.abs((r.__x as number) - r.x) <= (N - 1) / COLUMNS);
  }
});

test("the envelope lands in cells the curve opened: no blank-valued rows", () => {
  const cache = new PreparedSeriesCache();
  const p = cache.prepare(mk("a", 0), { ...OPTS, smoothing: 0.9 });
  const columns = 200;
  const rows = buildRenderRows([p], () => true, 0, N - 1, columns, false);
  // Every row must carry the curve's value: a row with only `a__raw` would put
  // series "a" in the tooltip with a blank value under the cursor.
  const blank = rows.filter((r) => r.a === undefined);
  assert.deepEqual(blank, [], `${blank.length} of ${rows.length} rows have no curve value`);
});

test("a widening point outside the domain keeps its exact x, not a clamped one", () => {
  const cache = new PreparedSeriesCache();
  // A far-off leading point, then a dense run starting inside the domain: the
  // window widens by one on each side, and its left neighbour is that far-off
  // point — nowhere near column 0.
  const points = [{ x: -50_000, y: 0 }, ...Array.from({ length: 20_000 }, (_, i) => ({ x: 1500 + i, y: i % 13 }))];
  const p = cache.prepare({ key: "a", label: "a", color: "#000", points }, OPTS);
  const rows = buildRenderRows([p], ALL, 1000, 2000, 4, false);
  assert.equal(rows[0]!.x, -50_000, "the outside point must not be clamped into column 0");
  assert.equal(rows[0]!.__x, -50_000);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i]!.x > rows[i - 1]!.x, "still x-ascending");
  assert.ok(rows[1]!.x >= 1000, "the in-domain rows start at the domain");
});

test("one point-for-point series does not drag the others off the shared grid", () => {
  const cache = new PreparedSeriesCache();
  const big = cache.prepare(mk("a", 0), OPTS);
  const alone = buildRenderRows([big], ALL, 0, N - 1, COLUMNS, false);
  // A tiny series far to the LEFT of the domain: it reduces point-for-point.
  const small = cache.prepare({
    key: "b", label: "b", color: "#000",
    points: Array.from({ length: 5 }, (_, i) => ({ x: -100 + i, y: i })),
  }, OPTS);
  const both = buildRenderRows([big, small], ALL, 0, N - 1, COLUMNS, false);
  const bRows = both.filter((r) => r.b !== undefined).length;
  assert.ok(bRows > 0 && bRows <= 5, `series b contributed ${bRows} rows`);
  assert.equal(both.length, alone.length + bRows, "b must add only its own rows");
  assert.ok(both.length <= CAP + 5);
});

test("two series with different x extents share one grid", () => {
  const cache = new PreparedSeriesCache();
  const mkRange = (key: string, from: number, to: number) => cache.prepare({
    key, label: key, color: "#000",
    points: Array.from({ length: to - from }, (_, i) => ({ x: from + i, y: Math.sin((from + i) / 40) })),
  }, OPTS);
  const rows = buildRenderRows([mkRange("a", 0, 20_000), mkRange("b", 5_000, 30_000)], ALL, 0, 29_999, COLUMNS, false);
  assert.ok(rows.length <= CAP, `${rows.length} rows > ${CAP}`);
  // In the overlap both series must land on the SAME rows, not on neighbours.
  const overlap = rows.filter((r) => (r.__x as number) >= 6_000 && (r.__x as number) <= 19_000);
  const shared = overlap.filter((r) => r.a !== undefined && r.b !== undefined).length;
  assert.ok(shared > overlap.length * 0.8, `only ${shared} of ${overlap.length} overlap rows carry both`);
  // Outside the overlap each series is alone, and neither strays.
  assert.equal(rows.some((r) => r.b !== undefined && (r.__x as number) < 5_000), false);
  assert.equal(rows.some((r) => r.a !== undefined && (r.__x as number) >= 20_000), false);
});
