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

test("20k points per series reduce to at most 5 columns + 2 indices each", () => {
  const prepared = prepareTwo();
  const rows = buildRenderRows(prepared, ALL, 0, N - 1, COLUMNS, false);
  assert.ok(rows.length > 0);
  assert.ok(rows.length <= 2 * CAP, `${rows.length} rows > ${2 * CAP}`);
  let a = 0, b = 0;
  for (const r of rows) { if (r.a !== undefined) a++; if (r.b !== undefined) b++; }
  assert.ok(a <= CAP && a > COLUMNS, `series a contributed ${a}`);
  assert.ok(b <= CAP && b > COLUMNS, `series b contributed ${b}`);
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

test("values match the prepared arrays at the chosen indices", () => {
  const prepared = prepareTwo();
  const rows = buildRenderRows(prepared, ALL, 0, N - 1, COLUMNS, false);
  const byX = new Map(prepared[0]!.points.map((p, i) => [p.x, prepared[0]!.ys[i]!]));
  for (const r of rows) {
    if (r.a === undefined) continue;
    assert.equal(r.a, byX.get(r.x));
  }
});

test("a hidden series contributes no keys", () => {
  const prepared = prepareTwo();
  const rows = buildRenderRows(prepared, (k) => k === "a", 0, N - 1, COLUMNS, false);
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
  assert.ok(rows.some((r) => r.a__raw !== undefined));
  assert.ok(rows.length <= 2 * CAP);
  const rawByX = new Map(smoothed[0]!.points.map((p, i) => [p.x, smoothed[0]!.rawYs![i]!]));
  for (const r of rows) if (r.a__raw !== undefined) assert.equal(r.a__raw, rawByX.get(r.x));
});

test("a narrow x window only reduces the points inside it (plus one on each side)", () => {
  const prepared = prepareTwo();
  const rows = buildRenderRows(prepared, ALL, 100, 200, COLUMNS, false);
  // 101 points in [100, 200] plus one either side, below 2*columns → no reduction.
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
  const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i, wallTime: `t${i}`, context: `c${i}` }));
  const rows = buildRenderRows(
    [cache.prepare({ key: "a", label: "a", color: "#000", points }, OPTS)], ALL, 0, 49, 100, false,
  );
  assert.equal(rows[3]!.a__wall, "t3");
  assert.equal(rows[3]!.a__ctx, "c3");
});
