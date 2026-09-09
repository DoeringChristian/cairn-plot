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
