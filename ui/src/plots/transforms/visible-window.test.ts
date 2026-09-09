import { test } from "node:test"; import assert from "node:assert/strict";
import { visibleWindow } from "./visible-window.ts";
const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
test("null bounds give the full range", () => assert.deepEqual(visibleWindow(xs, null, null), [0, 10]));
test("inside bounds widen by one point on each side", () => assert.deepEqual(visibleWindow(xs, 3.5, 6.2), [3, 8]));
test("exact hits are included and widened", () => assert.deepEqual(visibleWindow(xs, 3, 6), [2, 8]));
test("bounds outside the data clamp", () => { assert.deepEqual(visibleWindow(xs, -5, 100), [0, 10]); assert.deepEqual(visibleWindow(xs, 20, 30), [9, 10]); assert.deepEqual(visibleWindow(xs, -30, -20), [0, 1]); });
test("empty input", () => assert.deepEqual(visibleWindow([], 0, 1), [0, 0]));
