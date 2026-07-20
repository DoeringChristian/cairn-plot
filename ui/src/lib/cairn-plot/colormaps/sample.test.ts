/**
 * Pure unit tests for `colormapColor(name, t)` — the LUT-backed scalar→CSS
 * color sampler the SVG chart renderers (Scatter, ParallelCoords) use for
 * marker/line color-by-value + their colorbar gradient. No test runner is
 * configured in this package, so this runs under Node's built-in test runner
 * with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/colormaps/sample.test.ts
 *
 * DOM-free pure math, so this is sufficient coverage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { colormapColor } from "./sample.ts";
import { getColormapLUT } from "./lut.ts";

// The endpoints/midpoint are exactly the LUT samples at i = round(t*255):
// t=0 → LUT[0] (first stop), t=1 → LUT[255] (last stop). Values derived
// straight from `COLORMAP_STOPS.plasma` run through `buildLUT`.
test("colormapColor('plasma', ...) returns the LUT endpoints + midpoint", () => {
  assert.equal(colormapColor("plasma", 0), "rgb(13,8,135)");
  assert.equal(colormapColor("plasma", 0.5), "rgb(204,72,120)");
  assert.equal(colormapColor("plasma", 1), "rgb(240,249,33)");
});

test("colormapColor('viridis', ...) returns the viridis endpoints + midpoint", () => {
  assert.equal(colormapColor("viridis", 0), "rgb(68,1,84)");
  assert.equal(colormapColor("viridis", 0.5), "rgb(33,145,140)");
  assert.equal(colormapColor("viridis", 1), "rgb(253,231,37)");
});

// Magma (matplotlib anchors) — sequential, used by the reference FLIP tools.
// Endpoints are the exact first/last stops run through `buildLUT`.
test("colormapColor('magma', ...) returns the magma endpoints", () => {
  assert.equal(colormapColor("magma", 0), "rgb(0,0,4)");
  assert.equal(colormapColor("magma", 1), "rgb(252,253,191)");
});

test("getColormapLUT('magma') has the expected endpoint texels", () => {
  const lut = getColormapLUT("magma");
  assert.equal(lut.length, 256 * 3);
  assert.deepEqual([lut[0], lut[1], lut[2]], [0, 0, 4]);
  assert.deepEqual([lut[255 * 3], lut[255 * 3 + 1], lut[255 * 3 + 2]], [252, 253, 191]);
});

test("colormapColor clamps t to [0, 1]", () => {
  assert.equal(colormapColor("plasma", -1), colormapColor("plasma", 0));
  assert.equal(colormapColor("plasma", 2), colormapColor("plasma", 1));
});

// The string is exactly the LUT triple at the sampled index, for any map.
test("colormapColor matches the underlying LUT sample", () => {
  for (const name of ["plasma", "viridis", "magma", "red-green", "red-blue"] as const) {
    const lut = getColormapLUT(name);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const i = Math.round(t * 255);
      assert.equal(
        colormapColor(name, t),
        `rgb(${lut[i * 3]},${lut[i * 3 + 1]},${lut[i * 3 + 2]})`,
      );
    }
  }
});
