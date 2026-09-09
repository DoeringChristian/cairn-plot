import { test } from "node:test"; import assert from "node:assert/strict";
import { mergeToRows } from "./merge-rows.ts";
import type { Series } from "../types.ts";

const S = (key: string, points: Series["points"], rawPoints?: Series["points"]): Series =>
  ({ key, label: key, color: "#000", points, rawPoints });

test("two series on a shared x grid share one row per x", () => {
  const rows = mergeToRows([
    S("a", [{ x: 0, y: 1 }, { x: 1, y: 2 }]),
    S("b", [{ x: 0, y: 10 }, { x: 1, y: 20 }]),
  ]);
  assert.deepEqual(rows, [{ x: 0, a: 1, b: 10 }, { x: 1, a: 2, b: 20 }]);
});

test("disjoint x keeps rows sorted and leaves the other key absent", () => {
  const rows = mergeToRows([
    S("a", [{ x: 3, y: 1 }, { x: 1, y: 2 }]),
    S("b", [{ x: 2, y: 10 }]),
  ]);
  assert.deepEqual(rows.map((r) => r.x), [1, 2, 3]);
  assert.deepEqual(rows, [{ x: 1, a: 2 }, { x: 2, b: 10 }, { x: 3, a: 1 }]);
  assert.equal("b" in rows[0]!, false); // absent, not null: Recharts' connectNulls
});

test("wallTime and context ride along under __wall / __ctx", () => {
  const rows = mergeToRows([
    S("a", [{ x: 0, y: 1, wallTime: "t0", context: "c0" }, { x: 1, y: 2, context: null }]),
  ]);
  assert.equal(rows[0]!.a__wall, "t0");
  assert.equal(rows[0]!.a__ctx, "c0");
  assert.equal("a__wall" in rows[1]!, false);
  assert.equal("a__ctx" in rows[1]!, false); // null context is dropped, not carried
});

test("rawPoints land under __raw and can open rows of their own", () => {
  const rows = mergeToRows([
    S("a", [{ x: 0, y: 1 }], [{ x: 0, y: 9 }, { x: 5, y: 8 }]),
    S("b", [{ x: 0, y: 3 }]),
  ]);
  assert.deepEqual(rows, [{ x: 0, a: 1, a__raw: 9, b: 3 }, { x: 5, a__raw: 8 }]);
});

test("no series is an empty dataset", () => assert.deepEqual(mergeToRows([]), []));
