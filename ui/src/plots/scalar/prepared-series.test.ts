import { test } from "node:test"; import assert from "node:assert/strict";
import { PreparedSeriesCache } from "./prepared-series.ts";
import { emaSmooth } from "../transforms/smooth.ts";
const mk = (n: number, off = 0) => Array.from({ length: n }, (_, i) => ({ x: i + off, y: Math.sin((i + off) / 10) * 10, wallTime: `t${i + off}` }));
const S = (points: ReturnType<typeof mk>) => ({ key: "a", label: "a", color: "#000", points });
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
  const p1 = c.prepare(s1, opts);
  const s2 = { ...s1, points: [...s1.points, ...mk(50, 1000)] };
  const p2 = c.prepare(s2, opts);
  assert.equal(p2.n, 1050); assert.notEqual(p2, p1);
  assert.ok(p2.xs.buffer.byteLength / 8 >= 2000); // grown by doubling, not to fit
  const ref = emaSmooth(s2.points, 0.9).smoothed;
  for (let i = 0; i < 1050; i++) assert.equal(p2.ys[i], ref[i]!.y, `y[${i}]`);
  assert.ok(p2.rawYs && p2.rawYs[1049] === s2.points[1049]!.y);
  assert.equal(c.stats().appends, 1); assert.equal(c.stats().rebuilds, 1);
});
test("probe mismatch, option change or shorter input rebuilds", () => {
  const c = new PreparedSeriesCache(); const s = { key: "a", label: "a", color: "#000", points: mk(200) };
  c.prepare(s, OPTS);
  c.prepare({ ...s, points: [...mk(100), ...mk(150, 5)] }, OPTS); // the mid probe reads x=5 where 100 was cached
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

test("identical prepares return the same object, an append a new one", () => {
  const c = new PreparedSeriesCache(); const pts = mk(100);
  const a = c.prepare(S(pts), OPTS); const b = c.prepare(S(pts), OPTS);
  assert.equal(a, b); assert.equal(c.stats().rebuilds, 1); assert.equal(c.stats().reuses, 1);
  const d = c.prepare(S([...pts, ...mk(5, 100)]), OPTS);
  assert.notEqual(d, a); assert.equal(c.stats().appends, 1); assert.equal(c.stats().rebuilds, 1);
});
test("logX is built lazily without rebuilding and keeps appending", () => {
  const c = new PreparedSeriesCache(); const pts = mk(100);
  const p1 = c.prepare(S(pts), OPTS);
  assert.equal(p1.logXs, null);
  const p2 = c.prepare(S(pts), { ...OPTS, logX: true });
  assert.equal(c.stats().rebuilds, 1); assert.equal(c.stats().reuses, 1);
  assert.notEqual(p2, p1); assert.equal(p2.logXs![10], 1); assert.equal(p2.logStart, 1);
  const p3 = c.prepare(S([...pts, ...mk(20, 100)]), { ...OPTS, logX: true });
  assert.equal(c.stats().appends, 1); assert.equal(c.stats().rebuilds, 1);
  assert.equal(p3.n, 120); assert.equal(p3.logXs![110], Math.log10(110));
  const p4 = c.prepare(S([...pts, ...mk(20, 100)]), OPTS); // logX off again: no rebuild
  assert.equal(c.stats().rebuilds, 1); assert.equal(p4.n, 120);
});
test("a rebuild that had to sort refuses the next append", () => {
  const c = new PreparedSeriesCache();
  c.prepare(S(mk(100).reverse()), OPTS);
  const longer = [...mk(100), ...mk(20, 100)];
  const p2 = c.prepare(S(longer), OPTS); // probe-equal and ascending, but the prefix order is not ours
  assert.equal(c.stats().appends, 0); assert.equal(c.stats().rebuilds, 2);
  for (let i = 0; i < p2.n; i++) assert.equal(p2.points[i]!.x, p2.xs[i], `x[${i}]`);
  c.prepare(S([...longer, ...mk(5, 120)]), OPTS); // that rebuild kept sorted input, so this appends
  assert.equal(c.stats().appends, 1); assert.equal(c.stats().rebuilds, 2);
});
test("repeated appends stay bit-exact and carry a NaN tail like emaSmooth", () => {
  const c = new PreparedSeriesCache(); const opts = { ...OPTS, smoothing: 0.83 };
  let pts = mk(50);
  c.prepare(S(pts), opts);
  for (let k = 0; k < 5; k++) { pts = [...pts, ...mk(7, pts.length)]; c.prepare(S(pts), opts); }
  const withNaN = [...pts, ...mk(7, pts.length)]; withNaN[pts.length + 2]!.y = NaN;
  const p = c.prepare(S(withNaN), opts);
  assert.equal(c.stats().appends, 6); assert.equal(c.stats().rebuilds, 1);
  const ref = emaSmooth(withNaN, 0.83).smoothed;
  for (let i = 0; i < withNaN.length; i++) assert.ok(Object.is(p.ys[i], ref[i]!.y), `y[${i}]`);
  assert.ok(Number.isNaN(p.ys[p.n - 1]!)); assert.ok(Number.isFinite(p.yMax));
});
test("capacity doubles instead of reallocating on every append", () => {
  const c = new PreparedSeriesCache(); let pts = mk(1000);
  const p1 = c.prepare(S(pts), OPTS); assert.equal(p1.xs.buffer.byteLength / 8, 1000);
  pts = [...pts, ...mk(50, pts.length)];
  assert.equal(c.prepare(S(pts), OPTS).xs.buffer.byteLength / 8, 2000);
  pts = [...pts, ...mk(50, pts.length)];
  const p3 = c.prepare(S(pts), OPTS);
  assert.equal(p3.xs.buffer.byteLength / 8, 2000); assert.equal(p3.xs.length, 1100);
  pts = [...pts, ...mk(1000, pts.length)];
  assert.equal(c.prepare(S(pts), OPTS).xs.buffer.byteLength / 8, 4000);
});
test("outlier bounds are recomputed at most every 1 % of growth and exact once crossed", () => {
  const c = new PreparedSeriesCache(); const opts = { ...OPTS, outlierPct: [1, 99] as [number, number] };
  let pts = mk(10000);
  c.prepare(S(pts), opts);
  for (let k = 0; k < 100; k++) { pts = [...pts, ...mk(10, pts.length)]; c.prepare(S(pts), opts); }
  assert.equal(c.stats().appends, 100);
  assert.ok(c.stats().boundsRecomputes <= 12, `boundsRecomputes=${c.stats().boundsRecomputes}`);
  pts = [...pts, ...mk(1000, pts.length)]; // > 1 % growth: recomputed on this append
  const p = c.prepare(S(pts), opts);
  const fresh = new PreparedSeriesCache().prepare(S(pts), opts);
  assert.equal(p.lo, fresh.lo); assert.equal(p.hi, fresh.hi);
});
test("empty input, and bounds fall back to infinities when nothing is finite", () => {
  const c = new PreparedSeriesCache(); const opts = { ...OPTS, outlierPct: [1, 99] as [number, number], logX: true };
  const p = c.prepare(S([]), opts);
  assert.equal(p.n, 0); assert.equal(p.xs.length, 0); assert.equal(p.logStart, 0);
  assert.equal(p.xMin, Infinity); assert.equal(p.xMax, -Infinity);
  assert.equal(p.lo, -Infinity); assert.equal(p.hi, Infinity);
  assert.equal(c.prepare(S([]), opts), p); assert.equal(c.stats().rebuilds, 1);
  const nan = mk(5).map((q) => ({ ...q, y: NaN }));
  const q = c.prepare({ key: "b", label: "b", color: "#000", points: nan }, opts);
  assert.equal(q.lo, -Infinity); assert.equal(q.hi, Infinity);
  c.prepare(S(mk(3)), opts); assert.equal(c.stats().rebuilds, 3); assert.equal(c.stats().appends, 0);
});
