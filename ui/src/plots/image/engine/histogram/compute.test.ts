/**
 * Unit tests for the PURE half of the GPU histogram compute
 * (`engine/histogram/compute.ts`): host folds, uniform packing, and the deep
 * CPU twin. Runs under Node's type-stripping runner (no GPU) — the GPU-vs-CPU
 * parity itself is pinned by the `histogram.browser.ts` harness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEEP_PARAMS_BYTES,
  DEPTH_WEIGHT_FIXED_SCALE,
  HIST_MAX_CHANNELS,
  HIST_PARAMS_BYTES,
  HIST_STATS_LANES,
  HIST_STATS_WORKGROUP_SIZE,
  assembleDeepDepthBinWGSL,
  assembleDeepDepthStatsWGSL,
  assembleHistogramBinWGSL,
  assembleHistogramStatsWGSL,
  cpuDeepDepthWeights,
  deepParamsData,
  foldDeepDepthStatsPartials,
  foldHistogramStatsPartials,
  histParamsData,
} from "./compute.ts";
import { tevBinMapping, tevBinOfValue } from "../../../../lib/cairn-plot/image/histogram-binning.ts";

const FLT_BIG = 3.402823e38;

/** One workgroup's identity partial (no finite sample seen). */
function identityPartial(): number[] {
  const lanes: number[] = [];
  for (let l = 0; l < HIST_STATS_LANES; l++) {
    const kind = l < HIST_MAX_CHANNELS * 4 ? Math.min(l % 4, 2) : l === HIST_MAX_CHANNELS * 4 ? 0 : 1;
    lanes.push(kind === 0 ? FLT_BIG : kind === 1 ? -FLT_BIG : 0);
  }
  return lanes;
}

test("foldHistogramStatsPartials folds mixed-op lanes across workgroups", () => {
  // Workgroup A: channel 0 saw {min 1, max 3, sum 4, count 2}; range [1, 3].
  const a = identityPartial();
  a[0] = 1; a[1] = 3; a[2] = 4; a[3] = 2;
  a[HIST_MAX_CHANNELS * 4] = 1; a[HIST_MAX_CHANNELS * 4 + 1] = 3;
  // Workgroup B: channel 0 saw {min -2, max 2, sum -1, count 1}; range [-2, 2].
  const b = identityPartial();
  b[0] = -2; b[1] = 2; b[2] = -1; b[3] = 1;
  b[HIST_MAX_CHANNELS * 4] = -2; b[HIST_MAX_CHANNELS * 4 + 1] = 2;

  const fold = foldHistogramStatsPartials([...a, ...b], 2);
  assert.equal(fold.channelStats[0]!.min, -2);
  assert.equal(fold.channelStats[0]!.max, 3);
  assert.equal(fold.channelStats[0]!.count, 3);
  assert.ok(Math.abs(fold.channelStats[0]!.mean - 1) < 1e-12);
  // Channel 1 never saw a sample → the empty-stats shape.
  assert.equal(fold.channelStats[1]!.count, 0);
  assert.equal(fold.channelStats[1]!.min, Infinity);
  assert.deepEqual(fold.range, { min: -2, max: 3 });
});

test("foldHistogramStatsPartials with no finite series sample yields a null range", () => {
  const fold = foldHistogramStatsPartials(identityPartial(), 1);
  assert.equal(fold.range, null);
  assert.equal(fold.channelStats[0]!.count, 0);
});

test("foldDeepDepthStatsPartials folds z ranges and detects the empty case", () => {
  assert.deepEqual(foldDeepDepthStatsPartials([0.5, 2, -1, 1.5], 2), { zMin: -1, zMax: 2 });
  assert.equal(foldDeepDepthStatsPartials([FLT_BIG, -FLT_BIG], 1), null);
});

test("histParamsData packs the mixed u32/f32 uniform at the WGSL offsets", () => {
  const buf = histParamsData({
    width: 7,
    height: 5,
    channelCount: 3,
    seriesCount: 2,
    u8Scale: true,
    bins: 400,
    seriesWeights: new Float32Array([1, 0, 0, 0, 0.5, 0.5, 0, 0]),
    minLog: -1.25,
    diffLog: 4.5,
  });
  assert.equal(buf.byteLength, HIST_PARAMS_BYTES);
  const u32 = new Uint32Array(buf);
  const f32 = new Float32Array(buf);
  assert.deepEqual([...u32.slice(0, 7)], [7, 5, 35, 3, 2, 1, 400]);
  assert.equal(f32[8], -1.25);
  assert.equal(f32[9], 4.5);
  assert.equal(f32[12], 1); // series 0 weights start at byte 48
  assert.equal(f32[16], 0.5); // series 1
});

test("deepParamsData packs count/bins + mapping/scale", () => {
  const buf = deepParamsData({ count: 9, bins: 400, minLog: -2, diffLog: 3, scale: 256 });
  assert.equal(buf.byteLength, DEEP_PARAMS_BYTES);
  const u32 = new Uint32Array(buf);
  const f32 = new Float32Array(buf);
  assert.deepEqual([...u32.slice(0, 2)], [9, 400]);
  assert.deepEqual([...f32.slice(4, 7)], [-2, 3, 256]);
});

test("cpuDeepDepthWeights bins alpha weights, skipping/clamping bad samples", () => {
  const mapping = tevBinMapping(0, 10, 4);
  const zs = [0, 10, NaN, 5, 5];
  //           a=1  a=0.5 a=1   a=-3(clamp→0)  a=0.25
  const colors = [
    0, 0, 0, 1,
    0, 0, 0, 0.5,
    0, 0, 0, 1,
    0, 0, 0, -3,
    0, 0, 0, 0.25,
  ];
  const w = cpuDeepDepthWeights(zs, colors, mapping, tevBinOfValue);
  const total = [...w].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1.75) < 1e-12); // 1 + 0.5 + 0.25 (NaN z + clamped alpha dropped)
  assert.equal(w[tevBinOfValue(mapping, 0)]! >= 1, true);
  // z=5 and z=10 share the top symlog bin: 0.5 + 0.25.
  assert.equal(w[tevBinOfValue(mapping, 10)]!, 0.75);
});

test("cpuDeepDepthWeights quantize mirrors the GPU fixed-point accumulation", () => {
  const mapping = tevBinMapping(0, 1, 2);
  // 0.001 sits in the bottom symlog bin, 0.9 in the top one.
  const zs = [0.001, 0.001, 0.9];
  const colors = [0, 0, 0, 0.001, 0, 0, 0, 0.4, 0, 0, 0, 0.7];
  const q = cpuDeepDepthWeights(zs, colors, mapping, tevBinOfValue, DEPTH_WEIGHT_FIXED_SCALE);
  // 0.001·256 rounds to 0 → dropped; 0.4·256 = 102.4 → 102/256; 0.7·256 = 179.2 → 179/256.
  const bin0 = tevBinOfValue(mapping, 0.001);
  const bin1 = tevBinOfValue(mapping, 0.9);
  assert.notEqual(bin0, bin1);
  assert.equal(q[bin0], 102 / 256);
  assert.equal(q[bin1], 179 / 256);
});

test("WGSL assembly smoke: entry points, lane budget, and shared constants", () => {
  for (const wgsl of [
    assembleHistogramStatsWGSL(),
    assembleHistogramBinWGSL(),
    assembleDeepDepthStatsWGSL(),
    assembleDeepDepthBinWGSL(),
  ]) {
    assert.ok(wgsl.includes("fn cs_main"), "has the compute entry point");
  }
  // The stats pass's shared memory must fit the default 16 KB workgroup limit.
  assert.ok(HIST_STATS_LANES * HIST_STATS_WORKGROUP_SIZE * 4 <= 16384);
  // Both bin passes embed the SAME symlog literals the CPU uses.
  const log2a = String(Math.log2(0.001));
  assert.ok(assembleHistogramBinWGSL().includes(log2a));
  assert.ok(assembleDeepDepthBinWGSL().includes(log2a));
});
