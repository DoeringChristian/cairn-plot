// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import { adjacentStackIndices } from "./stack-preload.ts";

test("stack preload warms previous and next slots with wraparound", () => {
  assert.deepEqual(adjacentStackIndices(0, 5), [4, 1]);
  assert.deepEqual(adjacentStackIndices(4, 5), [3, 0]);
  assert.deepEqual(adjacentStackIndices(2, 5), [1, 3]);
});

test("small stacks do not schedule duplicate work", () => {
  assert.deepEqual(adjacentStackIndices(0, 0), []);
  assert.deepEqual(adjacentStackIndices(0, 1), []);
  assert.deepEqual(adjacentStackIndices(0, 2), [1]);
});

