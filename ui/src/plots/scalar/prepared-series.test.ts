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
