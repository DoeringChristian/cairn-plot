// node --experimental-strip-types --test src/layout/grid-cell-key.test.ts
//
// H6 — grid cells must be keyed by node IDENTITY. The regression these guard:
// with index keys, reordering a run set leaves every mounted pane in place and
// silently re-points it at a different run's node.
import assert from "node:assert/strict";
import { test } from "node:test";

import { gridCellKey, gridCellKeys, positionalCellKey } from "./grid-cell-key.ts";

test("gridCellKey prefers id, then key, then position", () => {
  assert.equal(gridCellKey({ id: "run-a", key: "k" }, 3), "run-a");
  assert.equal(gridCellKey({ key: "k" }, 3), "k");
  assert.equal(gridCellKey({}, 3), positionalCellKey(3));
  assert.equal(gridCellKey(undefined, 0), "i0");
  assert.equal(gridCellKey(null, 7), "i7");
});

test("gridCellKey treats an empty identity as absent", () => {
  assert.equal(gridCellKey({ id: "" }, 2), "i2");
  assert.equal(gridCellKey({ id: "", key: "" }, 2), "i2");
  assert.equal(gridCellKey({ id: "", key: "k" }, 2), "k");
});

test("gridCellKeys: reordering children carries each key with its node", () => {
  const a = { id: "run-a" };
  const b = { id: "run-b" };
  const c = { id: "run-c" };
  const before = gridCellKeys([a, b, c]);
  const after = gridCellKeys([c, a, b]);
  assert.deepEqual(before, ["run-a", "run-b", "run-c"]);
  assert.deepEqual(after, ["run-c", "run-a", "run-b"]);
  // The identity React uses for a given node is position-independent: that is
  // exactly what keeps the pane instance attached to its run across a reorder.
  for (const node of [a, b, c]) {
    assert.equal(
      before[[a, b, c].indexOf(node)],
      after[[c, a, b].indexOf(node)],
      `key for ${node.id} must not depend on its position`,
    );
  }
  // Index keys would have been identical before and after — the bug.
  assert.notDeepEqual(before, after);
});

test("gridCellKeys: removing a child does not shift the survivors' keys", () => {
  const rows = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
  assert.deepEqual(gridCellKeys(rows), ["r1", "r2", "r3"]);
  assert.deepEqual(gridCellKeys([rows[0]!, rows[2]!]), ["r1", "r3"]);
});

test("gridCellKeys: duplicate ids are disambiguated, never repeated", () => {
  const keys = gridCellKeys([{ id: "dup" }, { id: "dup" }, { id: "dup" }]);
  assert.equal(new Set(keys).size, 3, "keys must be unique");
  assert.equal(keys[0], "dup");
  assert.deepEqual(keys.slice(1), ["i1", "i2"]);
});

test("gridCellKeys: an id that collides with a positional key still resolves", () => {
  // `i1` as an authored id would otherwise collide with cell 1's fallback.
  const keys = gridCellKeys([{ id: "i1" }, {}]);
  assert.equal(new Set(keys).size, 2);
  assert.equal(keys[0], "i1");
  assert.equal(keys[1], "i1#2");
});

test("gridCellKeys: an empty child list yields no keys", () => {
  assert.deepEqual(gridCellKeys([]), []);
});
