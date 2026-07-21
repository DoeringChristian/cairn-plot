/**
 * Pure unit tests for the toolbar sliders' manual-entry parse/commit helpers.
 * Runs under Node's built-in test runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/primitives/slider-entry.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSliderEntry, commitSliderEntry, sliderEntryDraft } from "./slider-entry.ts";

test("parseSliderEntry: plain integers and decimals", () => {
  assert.equal(parseSliderEntry("0"), 0);
  assert.equal(parseSliderEntry("3"), 3);
  assert.equal(parseSliderEntry("0.5"), 0.5);
  assert.equal(parseSliderEntry("-2.25"), -2.25);
});

test("parseSliderEntry: lenient — trims whitespace", () => {
  assert.equal(parseSliderEntry("  4.2  "), 4.2);
  assert.equal(parseSliderEntry("\t-1\n"), -1);
});

test("parseSliderEntry: lenient — comma decimal separator → dot", () => {
  assert.equal(parseSliderEntry("1,5"), 1.5);
  assert.equal(parseSliderEntry("-0,25"), -0.25);
});

test("parseSliderEntry: lenient — Unicode minus and leading plus", () => {
  // U+2212 is what the read-out formats negatives with.
  assert.equal(parseSliderEntry("−3"), -3);
  assert.equal(parseSliderEntry("+7"), 7);
});

test("parseSliderEntry: OUT-OF-RANGE values pass through verbatim (no clamp)", () => {
  // The whole point: EV 12, offset -3 are legal.
  assert.equal(parseSliderEntry("12"), 12);
  assert.equal(parseSliderEntry("-3"), -3);
  assert.equal(parseSliderEntry("999.5"), 999.5);
});

test("parseSliderEntry: invalid input → null (never a NaN)", () => {
  assert.equal(parseSliderEntry(""), null);
  assert.equal(parseSliderEntry("   "), null);
  assert.equal(parseSliderEntry("abc"), null);
  assert.equal(parseSliderEntry("1.2.3"), null);
  assert.equal(parseSliderEntry("NaN"), null);
  assert.equal(parseSliderEntry("Infinity"), null);
  assert.equal(parseSliderEntry("--5"), null);
});

test("commitSliderEntry: valid input commits the parsed value", () => {
  assert.equal(commitSliderEntry("5.5", 0), 5.5);
  assert.equal(commitSliderEntry("12", 0), 12); // out-of-range still commits
  assert.equal(commitSliderEntry("1,25", 9), 1.25);
});

test("commitSliderEntry: invalid input REVERTS to the current value", () => {
  assert.equal(commitSliderEntry("", 3), 3);
  assert.equal(commitSliderEntry("abc", -2), -2);
  assert.equal(commitSliderEntry("   ", 0.5), 0.5);
});

test("commitSliderEntry: never yields a NaN", () => {
  assert.equal(Number.isNaN(commitSliderEntry("not-a-number", 0)), false);
  assert.equal(Number.isNaN(commitSliderEntry("", 0)), false);
});

test("sliderEntryDraft: pre-fills the raw ASCII value (re-parseable)", () => {
  assert.equal(sliderEntryDraft(0), "0");
  assert.equal(sliderEntryDraft(-2.5), "-2.5");
  // Round-trips through the parser.
  assert.equal(parseSliderEntry(sliderEntryDraft(1.25)), 1.25);
  assert.equal(parseSliderEntry(sliderEntryDraft(-7)), -7);
});
