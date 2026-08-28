/**
 * GPU HISTOGRAM parity harness (info panel M2 — `engine/histogram/compute.ts`
 * via `Device.computeTevTextureHistogram` / `computeDeepDepthHistogram`).
 *
 * Asserts, on a REAL device:
 *   1. VALUE histogram — GPU (full coverage) assembled through
 *      `tevResultFromRawHistogram` equals the CPU `computeTevHistograms`
 *      reference BIN-FOR-BIN (exact count equality) plus exact min/max stats
 *      and toleranced means — over float rgba32float data, odd sizes,
 *      separate/luma/mean series shapes, and a NaN/Inf-sprinkled case.
 *      Test data is EDGE-SAFE (every series value sits ≥1e-3 bin-fractions
 *      from a bin edge, nudged in a fix-up loop): the GPU bins in f32, the
 *      CPU in f64, so only edge-straddling values could legally disagree —
 *      the harness removes that freedom and then demands exactness.
 *   2. u8 histogram — same, over an rgba8unorm upload binned as raw 0..255
 *      code values (matching the CPU ImageData reader).
 *   3. Constant image — degenerate range: everything in bin 0 on both paths
 *      (pins the diffLog-floor ULP guard in the device method).
 *   4. DEEP depth histogram — GPU fixed-point atomic weights equal the CPU
 *      twin quantized at the same scale EXACTLY (dyadic sums), with exact
 *      zMin/zMax; an all-non-finite-Z CSR yields null.
 */
import { getSharedDevice } from "../device";
import type { Device, Texture, DeepGpuCsrSpec } from "../types";
import {
  computeTevHistograms,
  resolveHistogramSeries,
  seriesValueAt,
  seriesWeightsFor,
  tevResultFromRawHistogram,
  type HistogramSeriesSpec,
} from "../../../../lib/cairn-plot/renderers/image-histogram";
import {
  symmetricLog2,
  tevBinMapping,
  tevBinOfValue,
  TEV_HISTOGRAM_BINS,
  type TevBinMapping,
} from "../../../../lib/cairn-plot/image/histogram-binning";
import { cpuDeepDepthWeights, DEPTH_WEIGHT_FIXED_SCALE } from "../histogram/compute";
import { createHarness } from "../../../../lib/cairn-plot/testing/harness";

const { report, setOverallStatus } = createHarness({ title: "HISTOGRAM-GPU" });

const RGB = [{ name: "R" }, { name: "G" }, { name: "B" }];
const RGBA = [...RGB, { name: "A" }];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Is `v` safely INSIDE a bin (≥ `margin` bin-fractions from both edges) under
 *  `m`? Exact range endpoints are exempt — both paths clamp them identically. */
function edgeSafe(v: number, m: TevBinMapping, margin = 1e-3): boolean {
  if (v === m.min || v === m.max) return true;
  const t = (m.bins * (symmetricLog2(v) - m.minLog)) / m.diffLog;
  const frac = t - Math.floor(t);
  return frac > margin && frac < 1 - margin;
}

/**
 * Make an RGBA float field over `[-2, 4]` whose per-pixel SERIES VALUES (for
 * every series set under test) are edge-safe under the mapping each set
 * derives — the fix-up loop nudges offending pixels and re-derives until every
 * value is safely interior. Pixels 0/1 anchor the range at exactly -2 / 4.
 */
function makeEdgeSafeRGBA(
  w: number,
  h: number,
  seed: number,
  seriesSets: HistogramSeriesSpec[][],
): Float32Array {
  const rnd = lcg(seed);
  const n = w * h;
  const data = new Float32Array(n * 4);
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.round(rnd() * 384 - 128) / 64;
    data[p * 4 + 3] = 1;
  }
  if (n >= 2) {
    data.set([-2, -2, -2, 1], 0);
    data.set([4, 4, 4, 1], 4);
  }
  const read = (p: number, c: number) => data[p * 4 + c]!;
  for (let iter = 0; iter < 200; iter++) {
    let dirty = false;
    for (const series of seriesSets) {
      let min = Infinity;
      let max = -Infinity;
      for (let p = 0; p < n; p++) {
        for (const spec of series) {
          const v = seriesValueAt(read, p, spec);
          if (!Number.isFinite(v)) continue;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      const mapping = tevBinMapping(min, max, TEV_HISTOGRAM_BINS);
      for (let p = 2; p < n; p++) {
        for (const spec of series) {
          if (!edgeSafe(seriesValueAt(read, p, spec), mapping)) {
            for (const c of spec.channels) data[p * 4 + c] = data[p * 4 + c]! + 1 / 512;
            dirty = true;
          }
        }
      }
    }
    if (!dirty) return data;
  }
  throw new Error("makeEdgeSafeRGBA: fix-up loop did not converge");
}

function uploadRGBA(device: Device, data: Float32Array, w: number, h: number): Texture {
  const tex = device.createTexture(w, h, "rgba32float");
  tex.write(data);
  return tex;
}

/** Run one value-histogram parity case and report per-series exactness. */
async function runValueCase(
  device: Device,
  label: string,
  data: Float32Array,
  w: number,
  h: number,
  channelCount: number,
  series: HistogramSeriesSpec[],
  u8Scale: boolean,
  tex: Texture,
): Promise<boolean> {
  const read = u8Scale
    ? (p: number, c: number) => (data as unknown as Uint8Array)[p * 4 + c] ?? 0
    : (p: number, c: number) => data[p * 4 + c] ?? 0;
  const cpu = computeTevHistograms({
    readChannel: read,
    pixelCount: w * h,
    series,
    bins: TEV_HISTOGRAM_BINS,
    channelCount,
    maxSamples: Number.MAX_SAFE_INTEGER, // full coverage — the GPU's contract
  });
  const weights = seriesWeightsFor(series)!;
  const raw = await device.computeTevTextureHistogram!(tex, w, h, {
    channelCount,
    seriesCount: series.length,
    seriesWeights: weights,
    bins: TEV_HISTOGRAM_BINS,
    u8Scale,
  });
  const gpu = tevResultFromRawHistogram(raw, series, TEV_HISTOGRAM_BINS);

  let ok = true;
  const rangeOk = gpu.mapping.min === cpu.mapping.min && gpu.mapping.max === cpu.mapping.max;
  ok = ok && rangeOk;
  if (!rangeOk) {
    report(false, `[${label}] range GPU [${gpu.mapping.min}, ${gpu.mapping.max}] != CPU [${cpu.mapping.min}, ${cpu.mapping.max}]`);
  }
  for (let s = 0; s < series.length; s++) {
    const g = gpu.series[s]!;
    const c = cpu.series[s]!;
    let diffBins = 0;
    for (let i = 0; i < TEV_HISTOGRAM_BINS; i++) {
      if (g.values[i] !== c.values[i]) diffBins++;
    }
    const same = diffBins === 0 && g.total === c.total;
    ok = ok && same;
    if (!same) {
      report(false, `[${label}] series ${g.label}: ${diffBins} bins differ, total GPU=${g.total} CPU=${c.total}`);
    }
  }
  for (let c = 0; c < channelCount; c++) {
    const g = gpu.channelStats[c]!;
    const r = cpu.channelStats[c]!;
    const statOk =
      g.count === r.count &&
      g.min === r.min &&
      g.max === r.max &&
      (r.count === 0 || Math.abs(g.mean - r.mean) <= Math.max(1e-5, Math.abs(r.mean) * 1e-4));
    ok = ok && statOk;
    if (!statOk) {
      report(false, `[${label}] channel ${c} stats differ: GPU ${JSON.stringify(g)} vs CPU ${JSON.stringify(r)}`);
    }
  }
  report(ok, `[${label}] ${w}x${h} ×${series.length} series — GPU == CPU bin-for-bin`);
  return ok;
}

async function runFloatCases(device: Device): Promise<boolean> {
  let ok = true;
  const sets = (chs: typeof RGB) => [
    resolveHistogramSeries(chs, [0, 1, 2], "separate"),
    resolveHistogramSeries(chs, [0, 1, 2], "luminance"),
    resolveHistogramSeries(chs, [0, 1], "mean"),
  ];
  for (const [w, h, seed] of [
    [37, 11, 7],
    [256, 63, 21],
    [3, 3, 5],
  ] as const) {
    const seriesSets = sets(RGB);
    const data = makeEdgeSafeRGBA(w, h, seed, seriesSets);
    const tex = uploadRGBA(device, data, w, h);
    for (const series of seriesSets) {
      ok = (await runValueCase(device, `float:${series.length === 1 ? series[0]!.combine : "rgb"}`, data, w, h, 3, series, false, tex)) && ok;
    }
    tex.destroy();
  }
  return ok;
}

async function runNaNCase(device: Device): Promise<boolean> {
  const w = 41;
  const h = 9;
  const series = resolveHistogramSeries(RGB, [0, 1, 2], "separate");
  const data = makeEdgeSafeRGBA(w, h, 13, [series]);
  // Sprinkle non-finite samples into pixels ≥ 2 (the anchors stay finite).
  data[2 * 4] = NaN;
  data[3 * 4 + 1] = Infinity;
  data[5 * 4 + 2] = -Infinity;
  const tex = uploadRGBA(device, data, w, h);
  const ok = await runValueCase(device, "float:nan", data, w, h, 3, series, false, tex);
  tex.destroy();
  return ok;
}

async function runConstantCase(device: Device): Promise<boolean> {
  const w = 16;
  const h = 16;
  const data = new Float32Array(w * h * 4);
  for (let p = 0; p < w * h; p++) data.set([0.75, 0.75, 0.75, 1], p * 4);
  const series = resolveHistogramSeries(RGB, [0, 1, 2], "separate");
  const tex = uploadRGBA(device, data, w, h);
  const ok = await runValueCase(device, "float:constant", data, w, h, 3, series, false, tex);
  tex.destroy();
  return ok;
}

async function runU8Case(device: Device): Promise<boolean> {
  const w = 33;
  const h = 17;
  const rnd = lcg(3);
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(rnd() * 256);
  // Anchor the range at exactly 0 / 255, then nudge edge-unsafe byte VALUES
  // (a value-level remap keeps CPU and GPU consuming identical bytes).
  bytes[0] = 0;
  bytes[4] = 255;
  const series = resolveHistogramSeries(RGBA, [0, 1, 2, 3], "separate");
  for (let iter = 0; iter < 50; iter++) {
    let min = Infinity;
    let max = -Infinity;
    for (const b of bytes) {
      if (b < min) min = b;
      if (b > max) max = b;
    }
    const mapping = tevBinMapping(min, max, TEV_HISTOGRAM_BINS);
    const unsafe = new Set<number>();
    for (const b of new Set(bytes)) if (!edgeSafe(b, mapping)) unsafe.add(b);
    if (unsafe.size === 0) break;
    for (let i = 0; i < bytes.length; i++) {
      if (unsafe.has(bytes[i]!) && bytes[i]! > 0 && bytes[i]! < 255) bytes[i] = bytes[i]! + 1;
    }
  }
  const tex = device.createTexture(w, h, "rgba8unorm");
  tex.write(bytes);
  const ok = await runValueCase(
    device,
    "u8:rgba",
    bytes as unknown as Float32Array,
    w,
    h,
    4,
    series,
    true,
    tex,
  );
  tex.destroy();
  return ok;
}

async function runDeepCases(device: Device): Promise<boolean> {
  const rnd = lcg(11);
  const width = 24;
  const height = 8;
  const pixels = width * height;
  const perPixel = 4;
  const total = pixels * perPixel;
  const offsets = new Uint32Array(pixels + 1);
  for (let p = 0; p <= pixels; p++) offsets[p] = p * perPixel;
  const zs = new Float32Array(total);
  const colors = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    zs[i] = Math.fround(0.01 * Math.pow(5000, rnd()));
    let a = rnd();
    // Avoid round-half fixed-point ties between JS Math.round and WGSL round.
    while (Math.abs(((a * DEPTH_WEIGHT_FIXED_SCALE) % 1) - 0.5) < 1e-4) a = rnd();
    colors[i * 4 + 3] = Math.fround(a);
  }
  zs[0] = Math.fround(0.01);
  zs[1] = Math.fround(50);
  // Edge-safety fix-up for the z values under the mapping they define.
  for (let iter = 0; iter < 100; iter++) {
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const z of zs) {
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
    const mapping = tevBinMapping(zMin, zMax, TEV_HISTOGRAM_BINS);
    let dirty = false;
    for (let i = 2; i < total; i++) {
      if (!edgeSafe(zs[i]!, mapping)) {
        zs[i] = Math.fround(zs[i]! * 1.002);
        dirty = true;
      }
    }
    if (!dirty) break;
  }

  const spec: DeepGpuCsrSpec = { width, height, offsets, colors, zs };
  const buffers = device.createDeepSampleBuffers!(spec);
  const gpu = await device.computeDeepDepthHistogram!(buffers, TEV_HISTOGRAM_BINS);
  buffers.destroy();
  let ok = !!gpu;
  if (!gpu) {
    report(false, "[deep] GPU returned null for a populated CSR");
    return false;
  }
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const z of zs) {
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const rangeOk = gpu.zMin === zMin && gpu.zMax === zMax;
  ok = ok && rangeOk;
  report(rangeOk, `[deep] z-range GPU [${gpu.zMin}, ${gpu.zMax}] == CPU [${zMin}, ${zMax}]`);
  const mapping = tevBinMapping(zMin, zMax, TEV_HISTOGRAM_BINS);
  const cpuW = cpuDeepDepthWeights(zs, colors, mapping, tevBinOfValue, DEPTH_WEIGHT_FIXED_SCALE);
  let diffBins = 0;
  let maxDelta = 0;
  for (let i = 0; i < TEV_HISTOGRAM_BINS; i++) {
    const d = Math.abs(gpu.weights[i]! - cpuW[i]!);
    if (d > 0) diffBins++;
    if (d > maxDelta) maxDelta = d;
  }
  const weightsOk = diffBins === 0;
  ok = ok && weightsOk;
  report(
    weightsOk,
    `[deep] ${total} samples: GPU fixed-point weights == CPU quantized twin (diffBins=${diffBins}, maxΔ=${maxDelta})`,
  );

  // All-non-finite-Z CSR → null.
  const badSpec: DeepGpuCsrSpec = {
    width: 1,
    height: 1,
    offsets: new Uint32Array([0, 2]),
    colors: new Float32Array(8),
    zs: new Float32Array([NaN, Infinity]),
  };
  const badBuffers = device.createDeepSampleBuffers!(badSpec);
  const bad = await device.computeDeepDepthHistogram!(badBuffers, TEV_HISTOGRAM_BINS);
  badBuffers.destroy();
  report(bad === null, "[deep] an all-non-finite-Z CSR yields null");
  return ok && bad === null;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    report(true, `device.backend = ${device.backend}`);
    if (!device.computeTevTextureHistogram || !device.computeDeepDepthHistogram) {
      report(false, "device is missing the histogram compute methods");
      setOverallStatus(false);
      return;
    }
    let ok = true;
    ok = (await runFloatCases(device)) && ok;
    ok = (await runNaNCase(device)) && ok;
    ok = (await runConstantCase(device)) && ok;
    ok = (await runU8Case(device)) && ok;
    ok = (await runDeepCases(device)) && ok;
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
