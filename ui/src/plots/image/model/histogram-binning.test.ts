/**
 * Pins the tev-parity histogram math (`image/histogram-binning.ts`) to the
 * formulas ported from Tom94/tev `ImageCanvas.cpp` (see the module doc): the
 * symmetric-log₂ mapping (odd, continuous, regularized by a=0.001), the
 * clamped value→bin mapping over [min,max], bin-edge inversion, and the
 * density + percentile-cap display normalization. The GPU kernels (M2) must
 * reproduce these numbers bit-for-near-bit — this file is the referee.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/model/histogram-binning.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyChannelStats,
  foldChannelStat,
  symmetricLog2,
  symmetricLog2Inv,
  tevBinMapping,
  tevBinOfValue,
  tevNormalizeCounts,
  tevValueOfBinEdge,
  TEV_HISTOGRAM_BINS,
  TEV_HISTOGRAM_REGULARIZATION,
} from "./histogram-binning.ts";

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

test("tev constants: 400 bins, a = 0.001", () => {
  assert.equal(TEV_HISTOGRAM_BINS, 400);
  assert.equal(TEV_HISTOGRAM_REGULARIZATION, 0.001);
});

test("symmetricLog2: tev's formula — sign(v)·(log2(|v|+a) − log2(a))", () => {
  const a = TEV_HISTOGRAM_REGULARIZATION;
  // Positive branch matches the formula verbatim.
  approx(symmetricLog2(1), Math.log2(1 + a) - Math.log2(a));
  approx(symmetricLog2(0.5), Math.log2(0.5 + a) - Math.log2(a));
  // Odd + continuous through zero.
  assert.equal(symmetricLog2(0), 0);
  approx(symmetricLog2(-2), -symmetricLog2(2));
  // Monotonic.
  assert.ok(symmetricLog2(0.1) < symmetricLog2(0.2));
  assert.ok(symmetricLog2(-0.2) < symmetricLog2(-0.1));
});

test("symmetricLog2Inv is the exact inverse (both signs, zero, HDR range)", () => {
  for (const v of [0, 1e-4, 0.001, 0.1, 1, 4, 1000, -1e-4, -0.5, -256]) {
    approx(symmetricLog2Inv(symmetricLog2(v)), v, Math.max(1e-9, Math.abs(v) * 1e-12));
  }
});

test("tevBinOfValue: clamped floor of bins·(symlog(v)−minLog)/diffLog", () => {
  const m = tevBinMapping(-1, 8);
  // Endpoints clamp into range.
  assert.equal(tevBinOfValue(m, -1), 0);
  assert.equal(tevBinOfValue(m, 8), m.bins - 1);
  assert.equal(tevBinOfValue(m, -999), 0);
  assert.equal(tevBinOfValue(m, 999), m.bins - 1);
  // The formula, spot-checked mid-range.
  const v = 0.25;
  const expect = Math.floor((m.bins * (symmetricLog2(v) - m.minLog)) / m.diffLog);
  assert.equal(tevBinOfValue(m, v), expect);
  // Non-finite samples are skipped by callers.
  assert.equal(tevBinOfValue(m, NaN), -1);
  assert.equal(tevBinOfValue(m, Infinity), -1);
});

test("bin edges invert the mapping: edge(i) → bin i (interior)", () => {
  const m = tevBinMapping(0, 16);
  for (const i of [1, 7, 100, 250, 399]) {
    const v = tevValueOfBinEdge(m, i);
    // A value just above edge i lands in bin i.
    assert.equal(tevBinOfValue(m, v + Math.abs(v + 1) * 1e-9 + 1e-12), i);
  }
  approx(tevValueOfBinEdge(m, 0), 0, 1e-12);
  approx(tevValueOfBinEdge(m, m.bins), 16, 1e-6);
});

test("degenerate range (max ≤ min) stays finite and collapses to bin 0", () => {
  const m = tevBinMapping(3, 3);
  assert.ok(Number.isFinite(m.diffLog) && m.diffLog > 0);
  assert.equal(tevBinOfValue(m, 3), 0); // symlog(v) − minLog = 0 → bin 0, no NaN/throw
});

test("tevNormalizeCounts: density (÷ bin width) then percentile cap", () => {
  const m = tevBinMapping(0, 1, 8); // tiny grid to reason about
  const counts = [new Uint32Array(m.bins).fill(10)];
  const [flat] = tevNormalizeCounts(counts, m);
  // Equal counts over a LOG-spaced grid → wider (higher-value) bins get LOWER
  // density: strictly decreasing display values.
  for (let i = 1; i < m.bins; i++) assert.ok(flat![i]! < flat![i - 1]!);

  // A single hot bin is excluded from the display max by the percentile cap:
  // with skip = (1 + bins/128)·1 = 1, the spike itself is skipped and the cap
  // comes from the next-largest density → the spike's display value EXCEEDS 1
  // while typical bins stay ≈ 1/(1.3·relative density).
  const spiky = new Uint32Array(m.bins).fill(10);
  spiky[0] = 1_000_000;
  const [disp] = tevNormalizeCounts([spiky], m);
  assert.ok(disp![0]! > 1, "the spike overflows the display range");
  const second = Math.max(...Array.from(disp!).slice(1));
  approx(second, 1 / 1.3, 1e-6); // the cap bin normalizes to exactly 1/1.3
});

test("foldChannelStat accumulates min/mean/max (Welford-style mean)", () => {
  const s = emptyChannelStats();
  for (const v of [2, 4, 6]) foldChannelStat(s, v);
  assert.equal(s.min, 2);
  assert.equal(s.max, 6);
  approx(s.mean, 4);
  assert.equal(s.count, 3);
});
