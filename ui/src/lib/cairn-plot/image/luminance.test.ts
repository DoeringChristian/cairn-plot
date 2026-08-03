/**
 * Pure unit tests for the shared label-luminance helper. Runs under Node's
 * built-in test runner with TypeScript type-stripping (no DOM needed):
 *
 *   node --experimental-strip-types --test src/lib/cairn-plot/image/luminance.test.ts
 *
 * Pins the exact Rec.601 formula the image/compare pane samplers used to
 * hand-inline, so the extraction is behaviour-identical, and documents the
 * Rec.709 metric weights re-exported for the engine kernels.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  labelLuminance,
  LABEL_LUMINANCE_DARK_THRESHOLD,
  REC709_LUMINANCE_WEIGHTS,
} from "./luminance.ts";

// The verbatim expression the panes inlined, for a byte-exact equivalence check.
const inlined = (r: number, g: number, b: number) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255;

test("labelLuminance matches the previously-inlined Rec.601 expression", () => {
  const samples: [number, number, number][] = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [128, 128, 128],
    [10, 200, 55],
    [37, 99, 211],
  ];
  for (const [r, g, b] of samples) {
    assert.equal(labelLuminance(r, g, b), inlined(r, g, b));
  }
});

test("labelLuminance normalizes to [0,1] at the extremes", () => {
  assert.equal(labelLuminance(0, 0, 0), 0);
  assert.equal(labelLuminance(255, 255, 255), 1);
});

test("labelLuminance is monotonic in overall brightness", () => {
  assert.ok(labelLuminance(10, 10, 10) < labelLuminance(200, 200, 200));
});

test("green weighted heaviest, blue lightest (Rec.601 ordering)", () => {
  const r = labelLuminance(255, 0, 0);
  const g = labelLuminance(0, 255, 0);
  const b = labelLuminance(0, 0, 255);
  assert.ok(g > r && r > b);
});

test("dark threshold sits mid-range for the black/light-label pick", () => {
  assert.equal(LABEL_LUMINANCE_DARK_THRESHOLD, 0.55);
  // A near-black pixel is "dark" (→ light label); a bright pixel is not.
  assert.ok(labelLuminance(20, 20, 20) <= LABEL_LUMINANCE_DARK_THRESHOLD);
  assert.ok(labelLuminance(240, 240, 240) > LABEL_LUMINANCE_DARK_THRESHOLD);
});

test("Rec.709 metric weights are the FLIP/SSIM triple and sum to 1", () => {
  assert.deepEqual([...REC709_LUMINANCE_WEIGHTS], [0.2126, 0.7152, 0.0722]);
  const sum = REC709_LUMINANCE_WEIGHTS.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});
