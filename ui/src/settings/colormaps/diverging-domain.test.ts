/**
 * Node test: `colorDomainFor` — the pure symmetrize-about-zero rule that keeps a
 * DIVERGING colormap's neutral midpoint pinned to the value zero.
 *
 *   node --experimental-strip-types --test \
 *     src/settings/colormaps/diverging-domain.test.ts
 *
 * The bug this pins: every colormap consumer normalized `(v - lo) / (hi - lo)`
 * over the RAW data domain, so on `red-blue` / `red-green` the white midpoint
 * tracked the domain's CENTRE, not zero — data over `[-2, 8]` painted zero pink
 * and data over `[-8, 2]` painted it blue.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { colorDomainFor } from "./diverging-domain.ts";
import { getColormapLUT } from "./lut.ts";
import { lutRow, normToT } from "./lut-sample.ts";

/** The LUT color a value paints, going through the domain rule under test. */
function colorAt(value: number, lo: number, hi: number, cmap: string) {
  const d = colorDomainFor(lo, hi, cmap);
  const lut = getColormapLUT(cmap);
  const i = lutRow(normToT(value, d.min, d.max)) * 3;
  return [lut[i]!, lut[i + 1]!, lut[i + 2]!];
}

const isWhite = (rgb: number[]) => rgb.every((c) => c >= 250);

test("a diverging domain is symmetric about zero", () => {
  for (const cmap of ["red-blue", "red-green"]) {
    assert.deepEqual(colorDomainFor(-2, 8, cmap), { min: -8, max: 8 });
    assert.deepEqual(colorDomainFor(-8, 2, cmap), { min: -8, max: 8 });
    assert.deepEqual(colorDomainFor(-1, 1, cmap), { min: -1, max: 1 });
  }
});

test("zero paints the neutral midpoint for ANY asymmetric domain — the fix", () => {
  for (const cmap of ["red-blue", "red-green"]) {
    for (const [lo, hi] of [[-2, 8], [-8, 2], [-1, 1], [-0.001, 900]] as [number, number][]) {
      assert.equal(
        normToT(0, colorDomainFor(lo, hi, cmap).min, colorDomainFor(lo, hi, cmap).max),
        0.5,
        `zero must sit on the midpoint for [${lo}, ${hi}]`,
      );
      assert.ok(isWhite(colorAt(0, lo, hi, cmap)), `zero must be white for [${lo}, ${hi}]`);
    }
  }
});

test("a one-sided domain is still symmetrized (white is ALWAYS zero)", () => {
  // All-positive / all-negative data does not straddle zero, so white never
  // actually appears — but the ramp still means the same thing, and the sign of
  // the data is readable at a glance.
  assert.deepEqual(colorDomainFor(2, 8, "red-blue"), { min: -8, max: 8 });
  assert.deepEqual(colorDomainFor(-8, -2, "red-blue"), { min: -8, max: 8 });
  assert.equal(normToT(0, ...Object.values(colorDomainFor(2, 8, "red-blue")) as [number, number]), 0.5);
});

test("both sides share ONE scale — equal magnitudes are equidistant from white", () => {
  const { min, max } = colorDomainFor(-2, 8, "red-blue");
  const tPos = normToT(2, min, max);
  const tNeg = normToT(-2, min, max);
  assert.ok(
    Math.abs(tPos - 0.5 - (0.5 - tNeg)) < 1e-12,
    "+v and -v must be mirrored about the midpoint",
  );
});

test("SEQUENTIAL colormaps keep the raw domain (full ramp, unchanged)", () => {
  for (const cmap of ["turbo", "plasma", "magma"]) {
    assert.deepEqual(colorDomainFor(-2, 8, cmap), { min: -2, max: 8 });
    assert.deepEqual(colorDomainFor(0, 5, cmap), { min: 0, max: 5 });
  }
  // An unknown / absent colormap name is treated as sequential.
  assert.deepEqual(colorDomainFor(-2, 8, "nope"), { min: -2, max: 8 });
  assert.deepEqual(colorDomainFor(-2, 8, null), { min: -2, max: 8 });
  assert.deepEqual(colorDomainFor(-2, 8, undefined), { min: -2, max: 8 });
});

test("degenerate domains stay well-defined", () => {
  // All-zero data: symmetrizing gives [0, 0], which `normToT`'s zero-span guard
  // already maps to the midpoint — i.e. white. Correct: every value IS zero.
  assert.deepEqual(colorDomainFor(0, 0, "red-blue"), { min: -0, max: 0 });
  assert.equal(normToT(0, 0, 0), 0.5);
  assert.ok(isWhite(colorAt(0, 0, 0, "red-blue")));
  // Non-finite bounds must not produce NaN bounds.
  const inf = colorDomainFor(-Infinity, 5, "red-blue");
  assert.ok(Number.isFinite(inf.min) && Number.isFinite(inf.max));
  const nan = colorDomainFor(NaN, NaN, "red-blue");
  assert.ok(Number.isFinite(nan.min) && Number.isFinite(nan.max));
});

test("an inverted domain (lo > hi) is handled by magnitude, not order", () => {
  assert.deepEqual(colorDomainFor(8, -2, "red-blue"), { min: -8, max: 8 });
});
