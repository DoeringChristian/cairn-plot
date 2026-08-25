/**
 * Unit tests for the PURE histogram binning / grouping core
 * (`renderers/image-histogram.ts`) that the in-pane histogram overlay delegates
 * to. Runs under Node's type-stripping test runner (no DOM).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  binIndexOf,
  computeHistograms,
  deepPixelSamples,
  defaultChannelColor,
  luminance,
  mean,
  resolveHistogramSeries,
  sampleStride,
  seriesValueAt,
  type HistogramChannel,
} from "../image-histogram.ts";
import type { DeepGpuCsrData } from "../../image/decoders.ts";

const RGB: HistogramChannel[] = [{ name: "R" }, { name: "G" }, { name: "B" }];
const RGBA: HistogramChannel[] = [...RGB, { name: "A" }];

/** A reader over an interleaved [pixel*C + channel] plain array. */
function arrayReader(data: number[], channels: number) {
  return (pixelIndex: number, channel: number) => data[pixelIndex * channels + channel] ?? 0;
}

test("luminance uses Rec.709 for 3 channels, mean otherwise", () => {
  assert.ok(Math.abs(luminance([1, 0, 0]) - 0.2126) < 1e-9);
  assert.ok(Math.abs(luminance([0, 1, 0]) - 0.7152) < 1e-9);
  assert.ok(Math.abs(luminance([0, 0, 1]) - 0.0722) < 1e-9);
  // Non-3 counts fall back to the mean.
  assert.equal(luminance([2, 4]), 3);
  assert.equal(luminance([5]), 5);
  assert.equal(mean([]), 0);
});

test("defaultChannelColor gives distinct fixed tints for the first channels", () => {
  const c0 = defaultChannelColor(0);
  const c1 = defaultChannelColor(1);
  const c2 = defaultChannelColor(2);
  assert.notEqual(c0, c1);
  assert.notEqual(c1, c2);
  // A far-out index still returns a string (neutral fallback), never undefined.
  assert.equal(typeof defaultChannelColor(50), "string");
});

test("resolveHistogramSeries: separate → one single series per selected channel", () => {
  const series = resolveHistogramSeries(RGB, [0, 1, 2], "separate");
  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((s) => s.channels),
    [[0], [1], [2]],
  );
  assert.ok(series.every((s) => s.combine === "single"));
  // Labels are the channel names.
  assert.deepEqual(series.map((s) => s.label), ["R", "G", "B"]);
});

test("resolveHistogramSeries: an ARBITRARY subset groups into ONE combined series", () => {
  const lum = resolveHistogramSeries(RGBA, [0, 2], "luminance");
  assert.equal(lum.length, 1);
  assert.deepEqual(lum[0]!.channels, [0, 2]);
  assert.equal(lum[0]!.combine, "luminance");

  const mn = resolveHistogramSeries(RGBA, [0, 1, 3], "mean");
  assert.equal(mn.length, 1);
  assert.deepEqual(mn[0]!.channels, [0, 1, 3]);
  assert.equal(mn[0]!.combine, "mean");
});

test("resolveHistogramSeries: empty / out-of-range selection yields no series", () => {
  assert.equal(resolveHistogramSeries(RGB, [], "separate").length, 0);
  assert.equal(resolveHistogramSeries(RGB, [7, -1], "separate").length, 0);
});

test("seriesValueAt combines channels per the series mode", () => {
  const read = arrayReader([1, 0, 0, /*px1*/ 0.5, 0.5, 0.5], 3);
  const single = resolveHistogramSeries(RGB, [0], "separate")[0]!;
  const lum = resolveHistogramSeries(RGB, [0, 1, 2], "luminance")[0]!;
  const mn = resolveHistogramSeries(RGB, [0, 1, 2], "mean")[0]!;
  assert.equal(seriesValueAt(read, 0, single), 1);
  assert.ok(Math.abs(seriesValueAt(read, 0, lum) - 0.2126) < 1e-9);
  assert.ok(Math.abs(seriesValueAt(read, 1, mn) - 0.5) < 1e-9);
});

test("sampleStride bounds the sample count", () => {
  assert.equal(sampleStride(100, 1000), 1); // fits under budget
  assert.equal(sampleStride(1000, 100), 10); // 10x over budget → stride 10
  assert.equal(sampleStride(0, 100), 1);
});

test("binIndexOf clamps and buckets over [min,max]", () => {
  assert.equal(binIndexOf(0, 0, 10, 10), 0);
  assert.equal(binIndexOf(10, 0, 10, 10), 9); // top edge clamps into last bin
  assert.equal(binIndexOf(5, 0, 10, 10), 5);
  assert.equal(binIndexOf(-3, 0, 10, 10), 0); // below range clamps to 0
  assert.equal(binIndexOf(99, 0, 10, 10), 9); // above range clamps to last
  assert.equal(binIndexOf(NaN, 0, 10, 10), -1); // non-finite → skip sentinel
  assert.equal(binIndexOf(4, 5, 5, 8), 0); // degenerate range → bin 0
});

test("computeHistograms: separate channels bin independently over a shared range", () => {
  // 4 pixels, RGB. R ramps 0,1,2,3; G all 3; B all 0.
  const data = [
    0, 3, 0,
    1, 3, 0,
    2, 3, 0,
    3, 3, 0,
  ];
  const series = resolveHistogramSeries(RGB, [0, 1, 2], "separate");
  const res = computeHistograms({
    readChannel: arrayReader(data, 3),
    pixelCount: 4,
    series,
    bins: 4,
  });
  // Shared auto-range is [0,3] across all channels.
  assert.equal(res.min, 0);
  assert.equal(res.max, 3);
  assert.equal(res.bins, 4);
  assert.equal(res.series.length, 3);

  const [r, g, b] = res.series;
  // R: one sample in each of the 4 bins.
  assert.deepEqual(Array.from(r!.counts), [1, 1, 1, 1]);
  assert.equal(r!.total, 4);
  assert.equal(r!.peak, 1);
  // G: all 4 at value 3 → top bin.
  assert.deepEqual(Array.from(g!.counts), [0, 0, 0, 4]);
  assert.equal(g!.peak, 4);
  // B: all 4 at value 0 → first bin.
  assert.deepEqual(Array.from(b!.counts), [4, 0, 0, 0]);
});

test("computeHistograms: combined luminance is ONE series over the group", () => {
  // Two pixels: white (1,1,1) and black (0,0,0). Luma = 1 and 0.
  const data = [1, 1, 1, 0, 0, 0];
  const series = resolveHistogramSeries(RGB, [0, 1, 2], "luminance");
  const res = computeHistograms({
    readChannel: arrayReader(data, 3),
    pixelCount: 2,
    series,
    bins: 2,
  });
  assert.equal(res.series.length, 1);
  assert.equal(res.min, 0);
  assert.equal(res.max, 1);
  assert.deepEqual(Array.from(res.series[0]!.counts), [1, 1]);
  assert.equal(res.series[0]!.total, 2);
});

test("computeHistograms: explicit range is honored; out-of-range clamps to edges", () => {
  const data = [-5, 0, 5, 100];
  const series = resolveHistogramSeries([{ name: "X" }], [0], "separate");
  const res = computeHistograms({
    readChannel: arrayReader(data, 1),
    pixelCount: 4,
    series,
    bins: 2,
    range: { min: 0, max: 10 },
  });
  // -5 clamps to bin 0, 0→bin0, 5→bin1, 100 clamps to bin1.
  assert.deepEqual(Array.from(res.series[0]!.counts), [2, 2]);
});

test("computeHistograms: subsampling caps the binned total", () => {
  const N = 1000;
  const data = new Array(N).fill(0).map((_, i) => (i % 2 === 0 ? 0 : 1));
  const series = resolveHistogramSeries([{ name: "X" }], [0], "separate");
  const res = computeHistograms({
    readChannel: (p, _c) => data[p]!,
    pixelCount: N,
    series,
    bins: 2,
    maxSamples: 100, // stride 10 → 100 samples binned
  });
  assert.equal(res.series[0]!.total, 100);
});

test("computeHistograms: non-finite samples are skipped, not binned", () => {
  const data = [0, NaN, Infinity, 1];
  const series = resolveHistogramSeries([{ name: "X" }], [0], "separate");
  const res = computeHistograms({
    readChannel: arrayReader(data, 1),
    pixelCount: 4,
    series,
    bins: 2,
  });
  // Only 0 and 1 are finite → total 2, range [0,1].
  assert.equal(res.series[0]!.total, 2);
  assert.equal(res.min, 0);
  assert.equal(res.max, 1);
});

test("computeHistograms: no series → empty result", () => {
  const res = computeHistograms({
    readChannel: () => 0,
    pixelCount: 10,
    series: [],
    bins: 4,
  });
  assert.equal(res.series.length, 0);
});

test("deepPixelSamples slices one pixel's samples (Z + rgba) from the CSR", () => {
  // 2x1 image. Pixel 0 → 2 samples (z 1,3), pixel 1 → 1 sample (z 2).
  const csr: DeepGpuCsrData = {
    width: 2,
    height: 1,
    total: 3,
    offsets: new Uint32Array([0, 2, 3]),
    // 3 samples × 4 (premultiplied rgba)
    colors: new Float32Array([
      0.1, 0.2, 0.3, 1, // s0
      0.4, 0.5, 0.6, 1, // s1
      0.7, 0.8, 0.9, 1, // s2
    ]),
    zs: new Float32Array([1, 3, 2]),
  };
  const p0 = deepPixelSamples(csr, 0, 0);
  assert.equal(p0.length, 2);
  assert.deepEqual(p0[0]!.z, 1);
  assert.deepEqual(p0[1]!.z, 3);
  // colors come from a Float32Array — compare with a float32-rounding tolerance.
  const expected = [0.1, 0.2, 0.3, 1];
  p0[0]!.rgba.forEach((v, i) => assert.ok(Math.abs(v - expected[i]!) < 1e-6));

  const p1 = deepPixelSamples(csr, 1, 0);
  assert.equal(p1.length, 1);
  assert.equal(p1[0]!.z, 2);

  // Out-of-range pixel → empty.
  assert.deepEqual(deepPixelSamples(csr, 5, 5), []);
});

// ---------------------------------------------------------------------------
// M2 GPU-path glue: series→weights translation, the raw-fold→TevHistogramsResult
// assembly (must be BIN-FOR-BIN what computeTevHistograms produces when fed the
// same folds), and the deep depth-histogram CPU twin.
// ---------------------------------------------------------------------------

test("seriesWeightsFor translates single/luma/mean specs into component weights", async () => {
  const { seriesWeightsFor } = await import("../image-histogram.ts");
  const single = resolveHistogramSeries(RGB, [0, 1, 2], "separate");
  const w = seriesWeightsFor(single)!;
  assert.deepEqual([...w], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const luma = seriesWeightsFor(resolveHistogramSeries(RGB, [0, 1, 2], "luminance"))!;
  assert.ok(Math.abs(luma[0]! - 0.2126) < 1e-6 && Math.abs(luma[1]! - 0.7152) < 1e-6);
  // Luma over ≠3 channels falls back to the mean (matching seriesValueAt).
  const luma2 = seriesWeightsFor(resolveHistogramSeries(RGB, [0, 2], "luminance"))!;
  assert.deepEqual([...luma2], [0.5, 0, 0.5, 0]);
  const mean4 = seriesWeightsFor(resolveHistogramSeries(RGBA, [0, 1, 2, 3], "mean"))!;
  assert.deepEqual([...mean4], [0.25, 0.25, 0.25, 0.25]);
  // A channel beyond the 4-component texel → null (CPU fallback).
  const aux = resolveHistogramSeries([...RGBA, { name: "C4" }], [4], "separate");
  assert.equal(seriesWeightsFor(aux), null);
});

test("tevResultFromRawHistogram assembles GPU folds bin-for-bin like computeTevHistograms", async () => {
  const { computeTevHistograms: computeTev, seriesValueAt: sVal, tevResultFromRawHistogram } =
    await import("../image-histogram.ts");
  const { tevBinMapping, tevBinOfValue, foldChannelStat, emptyChannelStats } =
    await import("../../image/histogram-binning.ts");
  // A deterministic 3-channel image (values well inside bins, incl. negatives).
  const w = 37;
  const h = 11;
  const channels = 3;
  const data: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < w * h * channels; i++) data.push(Math.round(rnd() * 512 - 128) / 64);
  const readChannel = arrayReader(data, channels);
  const series = resolveHistogramSeries(RGB, [0, 1, 2], "separate");
  const bins = 400;

  // CPU reference (full coverage — no stride).
  const cpu = computeTev({ readChannel, pixelCount: w * h, series, bins, channelCount: channels });

  // Simulate the GPU's RAW folds in f64: per-channel stats, series range, counts.
  const channelStats = Array.from({ length: channels }, emptyChannelStats);
  let min = Infinity;
  let max = -Infinity;
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < channels; c++) foldChannelStat(channelStats[c]!, readChannel(p, c));
    for (const spec of series) {
      const v = sVal(readChannel, p, spec);
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const mapping = tevBinMapping(min, max, bins);
  const counts = new Uint32Array(series.length * bins);
  for (let p = 0; p < w * h; p++) {
    for (let s = 0; s < series.length; s++) {
      const bi = tevBinOfValue(mapping, sVal(readChannel, p, series[s]!));
      if (bi >= 0) counts[s * bins + bi]!++;
    }
  }
  const gpu = tevResultFromRawHistogram({ channelStats, range: { min, max }, counts }, series, bins);

  assert.equal(gpu.mapping.min, cpu.mapping.min);
  assert.equal(gpu.mapping.max, cpu.mapping.max);
  for (let s = 0; s < series.length; s++) {
    assert.equal(gpu.series[s]!.total, cpu.series[s]!.total);
    assert.deepEqual([...gpu.series[s]!.values], [...cpu.series[s]!.values]);
  }
  for (let c = 0; c < channels; c++) {
    assert.equal(gpu.channelStats[c]!.min, cpu.channelStats[c]!.min);
    assert.equal(gpu.channelStats[c]!.max, cpu.channelStats[c]!.max);
    assert.ok(Math.abs(gpu.channelStats[c]!.mean - cpu.channelStats[c]!.mean) < 1e-9);
  }
});

test("computeDepthHistogramCpu bins alpha over the finite-z symlog range", async () => {
  const { computeDepthHistogramCpu } = await import("../image-histogram.ts");
  // 2 pixels: pixel 0 has samples at z=1 (a=1) and z=100 (a=0.5); pixel 1 empty.
  const csr: DeepGpuCsrData = {
    width: 2,
    height: 1,
    offsets: new Uint32Array([0, 2, 2]),
    colors: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0.5]),
    zs: new Float32Array([1, 100]),
  };
  const depth = computeDepthHistogramCpu(csr, 400)!;
  assert.equal(depth.mapping.min, 1);
  assert.equal(depth.mapping.max, 100);
  assert.ok(Math.abs(depth.totalWeight - 1.5) < 1e-12);
  // An empty CSR (no finite z) → null.
  assert.equal(
    computeDepthHistogramCpu({ ...csr, zs: new Float32Array([NaN, Infinity]) }),
    null,
  );
});
