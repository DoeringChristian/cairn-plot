/**
 * Shared auto-interpolation threshold rule — the CPU image pane's `pixelated`
 * switch flips at the SAME texel size the GPU pane's `nearest` switch (and
 * `PixelValueOverlay`) use. The rule is parameterized on the threshold so
 * `CpuImagePane` can pass the ONE `PIXEL_VALUE_MIN_SCREEN_PX` constant
 * `GpuImagePane` reads (no duplicated literal); this pins the flip semantics.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/interp-auto.test.ts
 *
 * DOM-free / framework-free: the constant lives in a `.tsx` Node can't strip,
 * so the rule takes the threshold as an argument and the test exercises it with
 * the same value (`30`) the pane imports.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoImageRendering, containScreenPxPerTexel } from "./interp-auto.ts";

// The production threshold (`PIXEL_VALUE_MIN_SCREEN_PX`, primitives/
// PixelValueOverlay.tsx) — mirrored here as a value because Node's `.ts`-only
// runner can't import the `.tsx`. `CpuImagePane` passes the real imported
// constant, so this only fixes the number the flip is verified against.
const THRESHOLD = 30;

test("autoImageRendering flips to pixelated exactly at the threshold", () => {
  assert.equal(autoImageRendering(THRESHOLD - 0.001, THRESHOLD), undefined);
  assert.equal(autoImageRendering(THRESHOLD, THRESHOLD), "pixelated");
  assert.equal(autoImageRendering(THRESHOLD + 10, THRESHOLD), "pixelated");
  // A degenerate (zero) texel size never pixelates.
  assert.equal(autoImageRendering(0, THRESHOLD), undefined);
});

test("containScreenPxPerTexel uses the object-contain min-axis fit", () => {
  // A 100px box over a 10-texel-wide, 20-texel-tall source: width gives 10
  // px/texel, height gives 5 px/texel; contain picks the smaller (5).
  assert.equal(containScreenPxPerTexel({ width: 100, height: 100 }, 10, 20), 5);
  // Square source, square box → box/natural directly.
  assert.equal(containScreenPxPerTexel({ width: 64, height: 64 }, 8, 8), 8);
  // Degenerate inputs → 0 (caller leaves rendering at the browser default).
  assert.equal(containScreenPxPerTexel({ width: 0, height: 100 }, 10, 10), 0);
  assert.equal(containScreenPxPerTexel({ width: 100, height: 100 }, 0, 10), 0);
});

test("zoom pushes a source texel past the threshold (CPU pane magnification)", () => {
  // Unscaled: a 300px box over a 64x48 EXR fits ~4.7 px/texel → smooth.
  const box = { width: 300, height: 300 };
  assert.equal(autoImageRendering(containScreenPxPerTexel(box, 64, 48), THRESHOLD), undefined);
  // Zoom 8× → the on-screen box is 8× larger → ~37.5 px/texel → pixelated.
  const zoomed = { width: box.width * 8, height: box.height * 8 };
  assert.equal(autoImageRendering(containScreenPxPerTexel(zoomed, 64, 48), THRESHOLD), "pixelated");
});
