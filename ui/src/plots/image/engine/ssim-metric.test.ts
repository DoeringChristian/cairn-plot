/**
 * Node test: the pure scalar-SSIM chip helpers (`ssim-metric.ts`).
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     src/plots/image/engine/ssim-metric.test.ts
 *
 * Covers the two things that are testable without a GPU: the mean reduction of
 * an `ssim`-kernel RESULT readback (`meanSsimFromErrorMap`) and the chip
 * formatting (`formatSsim`). The GPU kernel ⇄ CPU-reference mean parity (equal
 * and mismatched-size mapped regions) lives in the browser harness
 * (`__tests__/ssim.browser.ts`); here we pin the reduction against the CPU
 * reference (`ssim-reference.ts`) directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { meanSsimFromErrorMap, formatSsim } from "./ssim-metric.ts";
import { ssim } from "./kernels/ssim-reference.ts";

/** Build an RGBA `Float32Array` (R = 1−SSIM, replicated) from a SSIM map — the
 *  exact layout the `ssim` kernel writes + `device.readback` returns. */
function errorMapRGBA(ssimMap: Float32Array): Float32Array {
  const n = ssimMap.length;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const err = 1 - ssimMap[i]!;
    out[i * 4] = err;
    out[i * 4 + 1] = err;
    out[i * 4 + 2] = err;
    out[i * 4 + 3] = 1;
  }
  return out;
}

test("formatSsim: identical images display an exact 1.0000", () => {
  assert.equal(formatSsim(1), "1.0000");
});

test("formatSsim: pending / absent / NaN render as an em-dash (never blocks)", () => {
  assert.equal(formatSsim(null), "—");
  assert.equal(formatSsim(undefined), "—");
  assert.equal(formatSsim(NaN), "—");
});

test("formatSsim: four-decimal fixed precision, rounded; negatives allowed", () => {
  assert.equal(formatSsim(0.98765), "0.9877");
  assert.equal(formatSsim(0.5), "0.5000");
  assert.equal(formatSsim(0), "0.0000");
  // Anticorrelated regions can push mean SSIM below 0 — must still format.
  assert.equal(formatSsim(-0.1234), "-0.1234");
});

test("meanSsimFromErrorMap: identical inputs (zero error) → exactly 1", () => {
  const samples = new Float32Array(16 * 4); // all zeros = 1−SSIM = 0 everywhere
  assert.equal(meanSsimFromErrorMap(samples, 4, 4), 1);
});

test("meanSsimFromErrorMap: empty region → NaN", () => {
  assert.ok(Number.isNaN(meanSsimFromErrorMap(new Float32Array(0), 0, 0)));
});

test("meanSsimFromErrorMap: 1 − mean(1−SSIM) equals mean(SSIM) over the region", () => {
  // A deterministic perturbed pair; the reduction must equal the plain mean of
  // the CPU reference's SSIM map over the SAME full region.
  const W = 20;
  const H = 18;
  const ref = new Float32Array(W * H * 3);
  const tst = new Float32Array(W * H * 3);
  let s = 12345 >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < W * H; i++) {
    const r = rnd(), g = rnd(), b = rnd();
    ref[i * 3] = r; ref[i * 3 + 1] = g; ref[i * 3 + 2] = b;
    tst[i * 3] = Math.min(1, Math.max(0, r + (rnd() - 0.5) * 0.3));
    tst[i * 3 + 1] = Math.min(1, Math.max(0, g + (rnd() - 0.5) * 0.3));
    tst[i * 3 + 2] = Math.min(1, Math.max(0, b + (rnd() - 0.5) * 0.3));
  }
  const { ssim: map } = ssim(ref, tst, W, H);
  let sum = 0;
  for (let i = 0; i < map.length; i++) sum += map[i]!;
  const expectedMean = sum / map.length;
  const got = meanSsimFromErrorMap(errorMapRGBA(map), W, H);
  assert.ok(Math.abs(got - expectedMean) < 1e-6, `got ${got} vs ${expectedMean}`);
});
