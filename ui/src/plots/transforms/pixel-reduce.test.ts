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
