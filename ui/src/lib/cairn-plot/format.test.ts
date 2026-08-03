/**
 * Goldens for `formatNum` — the shared chart number formatter now also used by
 * the image colorbar (`primitives/Colorbar`) and the TEV per-pixel overlay
 * (`primitives/PixelValueOverlay`). Locks that: (a) the no-argument default is
 * byte-for-byte the historical behaviour, (b) `precision` scales both the
 * fixed and exponential digit counts, (c) `minus` swaps in the U+2212 glyph.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/format.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNum } from "./format.ts";

test("formatNum default (no options) is unchanged", () => {
  assert.equal(formatNum(0), "0");
  assert.equal(formatNum(123.456), "123.46"); // toPrecision(5)
  assert.equal(formatNum(-42.5), "-42.5");
  assert.equal(formatNum(0.0001234), "1.234e-4"); // <1e-3 → toExponential(3)
  assert.equal(formatNum(12345.678), "1.235e+4"); // >=1000 → toExponential(3)
  assert.equal(formatNum(1000), "1.000e+3");
  assert.equal(formatNum(999.9), "999.9");
});

test("formatNum passes non-finite through as String(n)", () => {
  assert.equal(formatNum(NaN), "NaN");
  assert.equal(formatNum(Infinity), "Infinity");
  assert.equal(formatNum(-Infinity), "-Infinity");
});

test("precision scales toPrecision AND the exponential digits (precision-2)", () => {
  // precision 3 → toPrecision(3) on the fixed path, toExponential(1) on the exp path.
  assert.equal(formatNum(123.456, { precision: 3 }), "123");
  assert.equal(formatNum(0.0001234, { precision: 3 }), "1.2e-4");
  assert.equal(formatNum(12345.678, { precision: 3 }), "1.2e+4");
  assert.equal(formatNum(1000, { precision: 3 }), "1.0e+3");
});

test("minus swaps the ASCII hyphen for the typographic MINUS SIGN (U+2212)", () => {
  assert.equal(formatNum(-42.5, { minus: true }), "−42.5");
  assert.equal(formatNum(0.0001234, { minus: true }), "1.234e−4");
  // A positive value is untouched by `minus`.
  assert.equal(formatNum(42.5, { minus: true }), "42.5");
  // `minus` composes with `precision`.
  assert.equal(formatNum(-42.5, { precision: 3, minus: true }), "−42.5");
});
