/**
 * Tests for `normalizeValue` / `normalizeScalar`. `normalizeScalar` was
 * extracted as the allocation-free scalar core (so the colormap `normToT` can
 * reuse the SAME zero-span/log/invert math without a per-element domain object);
 * `normalizeValue` is the null-tolerant `{min,max}` wrapper. These lock that the
 * extraction left `normalizeValue`'s behaviour unchanged.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/transforms/normalize.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeValue, normalizeScalar } from "./normalize.ts";

test("normalizeValue maps a value into [0,1] over the domain", () => {
  assert.equal(normalizeValue(5, { min: 0, max: 10 }), 0.5);
  assert.equal(normalizeValue(0, { min: 0, max: 10 }), 0);
  assert.equal(normalizeValue(10, { min: 0, max: 10 }), 1);
});

test("normalizeValue returns null only for a null value", () => {
  assert.equal(normalizeValue(null, { min: 0, max: 10 }), null);
});

test("normalizeValue maps a zero-span domain to 0.5", () => {
  assert.equal(normalizeValue(7, { min: 7, max: 7 }), 0.5);
});

test("invert flips the normalized position", () => {
  assert.equal(normalizeValue(2.5, { min: 0, max: 10 }, { invert: true }), 0.75);
});

test("normalizeScalar equals normalizeValue's core for non-null values", () => {
  for (const [v, min, max] of [
    [5, 0, 10],
    [7, 7, 7],
    [2.5, 0, 10],
  ] as const) {
    assert.equal(normalizeScalar(v, min, max), normalizeValue(v, { min, max }));
  }
  // log path parity
  assert.equal(
    normalizeScalar(10, 1, 100, { log: true }),
    normalizeValue(10, { min: 1, max: 100 }, { log: true }),
  );
});
