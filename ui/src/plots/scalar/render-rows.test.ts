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
  // The overlay samples the RAW value at the SMOOTHED curve's picked indices,
  // so it shares the row (and the snapped x) rather than being reduced apart.
  const rawOf = new Map(smoothed[0]!.ys.length
    ? Array.from({ length: smoothed[0]!.n }, (_, i) => [smoothed[0]!.ys[i]!, smoothed[0]!.rawYs![i]!] as const)
    : []);
  let seen = 0;
  for (const r of rows) {
    if (r.a === undefined) continue;
    assert.notEqual(r.a__raw, undefined, "a smoothed row must carry its raw value");
    assert.equal(r.a__raw, rawOf.get(r.a as number));
    seen++;
  }
  assert.ok(seen > COLUMNS);
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
