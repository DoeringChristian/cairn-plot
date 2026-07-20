/**
 * Node test: `resolveDiffCmapMode` — the pure decision for how a diff RESULT
 * value indexes the colormap LUT, from BOTH the kernel display range AND the
 * colormap's divergence.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/engine/diff-cmap-mode.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDiffCmapMode, resolveColormapMode } from "./diff-cmap-mode.ts";

test("signed/relative ranges are always 'signed' (zero on the LUT midpoint)", () => {
  for (const cmap of ["viridis", "plasma", "magma", "red-blue", "red-green", null]) {
    assert.equal(resolveDiffCmapMode("signed", cmap), "signed");
    assert.equal(resolveDiffCmapMode("relative", cmap), "signed");
  }
});

test("unit range + SEQUENTIAL colormap uses the FULL LUT ('linear') — the fix", () => {
  // The reported bug: a sequential map (plasma/magma) was pushed into its upper
  // half ('positive'), using only half the ramp and mismatching the reference.
  assert.equal(resolveDiffCmapMode("unit", "viridis"), "linear");
  assert.equal(resolveDiffCmapMode("unit", "plasma"), "linear");
  assert.equal(resolveDiffCmapMode("unit", "magma"), "linear");
});

test("unit range + DIVERGING colormap keeps the upper-half midpoint ('positive')", () => {
  assert.equal(resolveDiffCmapMode("unit", "red-blue"), "positive");
  assert.equal(resolveDiffCmapMode("unit", "red-green"), "positive");
});

test("unit range + no colormap defaults to 'linear' (moot: no LUT applied)", () => {
  assert.equal(resolveDiffCmapMode("unit", null), "linear");
  assert.equal(resolveDiffCmapMode("unit", undefined), "linear");
  assert.equal(resolveDiffCmapMode("unit", "none"), "linear");
});

test("resolveColormapMode: the shared sequential-vs-diverging rule", () => {
  // DIVERGING → 'positive'; SEQUENTIAL / unknown / empty → 'linear'.
  assert.equal(resolveColormapMode("red-blue"), "positive");
  assert.equal(resolveColormapMode("red-green"), "positive");
  assert.equal(resolveColormapMode("viridis"), "linear");
  assert.equal(resolveColormapMode("plasma"), "linear");
  assert.equal(resolveColormapMode(null), "linear");
  assert.equal(resolveColormapMode(undefined), "linear");
  assert.equal(resolveColormapMode("none"), "linear");
});

test("resolveDiffCmapMode's unit branch matches resolveColormapMode", () => {
  for (const cmap of ["viridis", "plasma", "magma", "red-blue", "red-green", "none", null]) {
    assert.equal(resolveDiffCmapMode("unit", cmap), resolveColormapMode(cmap));
  }
});
