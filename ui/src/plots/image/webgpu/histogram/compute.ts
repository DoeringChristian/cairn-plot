/**
 * GPU HISTOGRAM COMPUTE (info-panel M2) — the WGSL + host-fold core behind
 * `Device.computeTevTextureHistogram` / `Device.computeDeepDepthHistogram`
 * (`engine/webgpu/device.ts`) and, above them, `PaneHandle.computeHistogram` /
 * `PaneHandle.computeDepthHistogram` (`engine/pool.ts`).
 *
 * CORE-SAFE, exactly like `engine/reduce/registry.ts`: only WGSL strings, pure
 * fold/twin functions and metadata — no GPU imports — so it loads under Node's
 * type-stripping test runner (`compute.test.ts`) and the WebGPU backend
 * assembles its pipelines from the strings here.
 *
 * ## The two value-histogram passes (tev parity)
 * The CPU reference is `renderers/image-histogram.ts`'s `computeTevHistograms`
 * over `image/histogram-binning.ts` (the tev port). The GPU path reproduces it
 * over the pane's POOL-OWNED source texture at FULL pixel coverage (no
 * subsample budget):
 *
 *   1. STATS pass — one dispatch over all pixels; per workgroup, a
 *      shared-memory tree-reduce of {@link HIST_STATS_LANES} lanes:
 *      per-channel [min, max, sum, count] over FINITE samples (the stats row)
 *      plus the shared series-value [min, max] (the histogram's axis range).
 *      Only the tiny per-workgroup partial buffer is read back;
 *      {@link foldHistogramStatsPartials} finishes on the host in f64.
 *   2. BIN pass — the host derives the symmetric-log₂ mapping from the folded
 *      range (`tevBinMapping`, f64) and dispatches the atomic binning pass:
 *      each thread bins its pixel's series value(s) via the SAME
 *      `floor((bins * (symlog2(v) - minLog)) / diffLog)` expression as the CPU
 *      (`tevBinOfValue`), `atomicAdd`ing u32 counts. Binning math is f32 on
 *      the GPU (vs the CPU's f64) — a value landing EXACTLY on a bin edge can
 *      round to the neighboring bin; away from edges the two agree
 *      bin-for-bin (the parity harness pins this on edge-safe data).
 *
 * A SERIES is described to the GPU as a vec4 of per-component weights
 * (`renderers/image-histogram.ts`'s `seriesWeightsFor`): a `"single"` series
 * is a one-hot vector, `"luminance"`/`"mean"` carry the combine coefficients.
 * Zero-weight components are SKIPPED (not multiplied) so a NaN in an
 * unselected channel cannot poison the series value — mirroring the CPU's
 * `seriesValueAt`, which never reads non-contributing channels.
 *
 * Non-finite samples are skipped best-effort: WGSL lets implementations
 * assume float expressions don't produce NaN/Inf, so the `v == v &&
 * abs(v) < 3e38` guard is not a spec guarantee — on real backends it holds,
 * and the CPU reference (which skips exactly) remains the fallback path.
 *
 * ## The two deep-depth passes (alpha-weighted Z histogram)
 * Over the deep CSR's flat `zs` + premultiplied `colors` storage buffers
 * (already GPU-resident for the depth-composite slider): pass 1 reduces the
 * finite-Z [min, max]; pass 2 bins each sample's Z through the same symlog
 * mapping, accumulating its ALPHA as a FIXED-POINT u32
 * (`round(clamp(alpha, 0, ..) * `{@link DEPTH_WEIGHT_FIXED_SCALE}`)`) —
 * WGSL has no float atomics. The host de-quantizes (÷ scale). The pure CPU
 * twin ({@link cpuDeepDepthWeights}) is the parity reference AND the
 * production fallback for CPU panes (un-quantized there — exact).
 */
import {
  emptyChannelStats,
  symmetricLog2,
  type ChannelStats,
  type TevBinMapping,
} from "../../definition/histogram-binning.ts";

/** Max texel channels the GPU path handles (an RGBA texel) — sources with more
 *  (aux-channel EXRs) fall back to the CPU reader loop. */
export const HIST_MAX_CHANNELS = 4;
/** Max concurrent series (4 `"separate"` channels, or 1 combined). */
export const HIST_MAX_SERIES = 4;
/** Stats-pass workgroup size. 128 (not 256) keeps the 18-lane shared-memory
 *  footprint (18·128·4 B = 9 KB) under the 16 KB default workgroup limit. */
export const HIST_STATS_WORKGROUP_SIZE = 128;
/** Bin-pass workgroup size (no shared memory — atomics only). */
export const HIST_BIN_WORKGROUP_SIZE = 256;
/** Stats-pass lanes: per channel [min, max, sum, count] + series [min, max]. */
export const HIST_STATS_LANES = HIST_MAX_CHANNELS * 4 + 2;
/** Fixed-point scale for the deep pass's alpha weights (u32 atomics): 256
 *  sub-steps per unit weight ⇒ ~16.7M full-alpha samples per bin before u32
 *  overflow — far beyond any real deep image's per-bin load. */
export const DEPTH_WEIGHT_FIXED_SCALE = 256;
/** Per-sample alpha clamp for the deep pass — keeps a corrupt alpha from
 *  wrapping the fixed-point accumulator. */
export const DEPTH_WEIGHT_MAX = 65535;

/** The uniform block both value passes bind (112 bytes; see
 *  {@link histParamsData}). `minLog`/`diffLog` are only read by the bin pass. */
const HIST_PARAMS_WGSL = `
struct HistParams {
  width: u32,
  height: u32,
  count: u32,
  channelCount: u32,
  seriesCount: u32,
  u8scale: u32,
  bins: u32,
  _p0: u32,
  minLog: f32,
  diffLog: f32,
  _p1: f32,
  _p2: f32,
  weights: array<vec4<f32>, ${HIST_MAX_SERIES}>,
};
`;

/** Byte size of the {@link HIST_PARAMS_WGSL} uniform. */
export const HIST_PARAMS_BYTES = 48 + HIST_MAX_SERIES * 16;

/** Pack the value-pass uniform. `seriesWeights` is `seriesCount×4` row-major
 *  component weights; `minLog`/`diffLog` come from the bin mapping (0 for the
 *  stats pass, which never reads them). */
export function histParamsData(spec: {
  width: number;
  height: number;
  channelCount: number;
  seriesCount: number;
  u8Scale: boolean;
  bins: number;
  seriesWeights: Float32Array | ArrayLike<number>;
  minLog?: number;
  diffLog?: number;
}): ArrayBuffer {
  const buf = new ArrayBuffer(HIST_PARAMS_BYTES);
  const u32 = new Uint32Array(buf);
  const f32 = new Float32Array(buf);
  u32[0] = Math.max(1, spec.width) >>> 0;
  u32[1] = Math.max(1, spec.height) >>> 0;
  u32[2] = Math.max(0, spec.width * spec.height) >>> 0;
  u32[3] = Math.min(HIST_MAX_CHANNELS, Math.max(0, spec.channelCount)) >>> 0;
  u32[4] = Math.min(HIST_MAX_SERIES, Math.max(0, spec.seriesCount)) >>> 0;
  u32[5] = spec.u8Scale ? 1 : 0;
  u32[6] = Math.max(1, spec.bins) >>> 0;
  f32[8] = spec.minLog ?? 0;
  f32[9] = spec.diffLog ?? 1;
  for (let i = 0; i < HIST_MAX_SERIES * 4; i++) {
    f32[12 + i] = (spec.seriesWeights as ArrayLike<number>)[i] ?? 0;
  }
  return buf;
}

/** Shared WGSL helpers: finiteness guard, u8 code-value scaling, the weighted
 *  series value (zero-weight components skipped — NaN-poison-proof), and the
 *  tev symmetric-log₂ (literals injected from the SAME JS constants the CPU
 *  path uses, so both round from identical f64 values). */
const HIST_COMMON_WGSL = `
fn histFinite(v: f32) -> bool {
  return v == v && abs(v) < 3.0e38;
}

fn histTexel(x: i32, y: i32, u8scale: u32) -> vec4<f32> {
  var t = textureLoad(t0, vec2<i32>(x, y), 0);
  if (u8scale == 1u) {
    t = round(t * 255.0);
  }
  return t;
}

fn histSeriesValue(t: vec4<f32>, w: vec4<f32>) -> f32 {
  var v = 0.0;
  for (var c = 0u; c < 4u; c = c + 1u) {
    let wc = w[c];
    if (wc != 0.0) {
      v = v + wc * t[c];
    }
  }
  return v;
}

fn histSymlog2(v: f32) -> f32 {
  let a = ${0.001};
  let log2a = f32(${Math.log2(0.001)});
  if (v > 0.0) {
    return log2(v + a) - log2a;
  }
  return log2a - log2(-v + a);
}
`;

/**
 * Assemble the STATS pass. Bindings: 0 = source texture, 1 = per-workgroup
 * partial storage (`numWorkgroups × `{@link HIST_STATS_LANES}` f32`,
 * lane-interleaved), 2 = the {@link HIST_PARAMS_WGSL} uniform.
 */
export function assembleHistogramStatsWGSL(): string {
  const wg = HIST_STATS_WORKGROUP_SIZE;
  const lanes = HIST_STATS_LANES;
  return `
${HIST_PARAMS_WGSL}
@group(0) @binding(0) var t0: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> partial: array<f32>;
@group(0) @binding(2) var<uniform> P: HistParams;
${HIST_COMMON_WGSL}

const FLT_BIG: f32 = 3.402823e38;

var<workgroup> sh: array<array<f32, ${wg}u>, ${lanes}u>;

// Lane combine kind: channels are [min, max, sum, count] blocks; the last two
// lanes are the series-range [min, max]. 0 = min, 1 = max, 2 = additive.
fn laneKind(l: u32) -> u32 {
  if (l < ${HIST_MAX_CHANNELS * 4}u) {
    return min(l % 4u, 2u);
  }
  if (l == ${HIST_MAX_CHANNELS * 4}u) {
    return 0u;
  }
  return 1u;
}

fn laneIdentity(k: u32) -> f32 {
  if (k == 0u) { return FLT_BIG; }
  if (k == 1u) { return -FLT_BIG; }
  return 0.0;
}

fn laneCombine(k: u32, a: f32, b: f32) -> f32 {
  if (k == 0u) { return min(a, b); }
  if (k == 1u) { return max(a, b); }
  return a + b;
}

@compute @workgroup_size(${wg})
fn cs_main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wgid: vec3<u32>,
) {
  var vals: array<f32, ${lanes}u>;
  for (var l = 0u; l < ${lanes}u; l = l + 1u) {
    vals[l] = laneIdentity(laneKind(l));
  }
  let idx = gid.x;
  if (idx < P.count) {
    let x = i32(idx % P.width);
    let y = i32(idx / P.width);
    let t = histTexel(x, y, P.u8scale);
    for (var c = 0u; c < P.channelCount; c = c + 1u) {
      let v = t[c];
      if (histFinite(v)) {
        let b = c * 4u;
        vals[b] = v;
        vals[b + 1u] = v;
        vals[b + 2u] = v;
        vals[b + 3u] = 1.0;
      }
    }
    for (var s = 0u; s < P.seriesCount; s = s + 1u) {
      let v = histSeriesValue(t, P.weights[s]);
      if (histFinite(v)) {
        vals[${HIST_MAX_CHANNELS * 4}u] = min(vals[${HIST_MAX_CHANNELS * 4}u], v);
        vals[${HIST_MAX_CHANNELS * 4 + 1}u] = max(vals[${HIST_MAX_CHANNELS * 4 + 1}u], v);
      }
    }
  }
  for (var l = 0u; l < ${lanes}u; l = l + 1u) {
    sh[l][lid.x] = vals[l];
  }
  workgroupBarrier();

  var stride = ${wg}u / 2u;
  loop {
    if (stride == 0u) {
      break;
    }
    if (lid.x < stride) {
      for (var l = 0u; l < ${lanes}u; l = l + 1u) {
        sh[l][lid.x] = laneCombine(laneKind(l), sh[l][lid.x], sh[l][lid.x + stride]);
      }
    }
    workgroupBarrier();
    stride = stride / 2u;
  }

  if (lid.x == 0u) {
    for (var l = 0u; l < ${lanes}u; l = l + 1u) {
      partial[wgid.x * ${lanes}u + l] = sh[l][0];
    }
  }
}
`;
}

/**
 * Assemble the atomic BIN pass. Bindings: 0 = source texture, 1 = the
 * `seriesCount × bins` u32 count storage (series-major, zero-initialized),
 * 2 = the {@link HIST_PARAMS_WGSL} uniform (with `minLog`/`diffLog` filled in
 * from the host-derived `tevBinMapping`).
 */
export function assembleHistogramBinWGSL(): string {
  return `
${HIST_PARAMS_WGSL}
@group(0) @binding(0) var t0: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> P: HistParams;
${HIST_COMMON_WGSL}

@compute @workgroup_size(${HIST_BIN_WORKGROUP_SIZE})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= P.count) {
    return;
  }
  let x = i32(idx % P.width);
  let y = i32(idx / P.width);
  let t = histTexel(x, y, P.u8scale);
  let binsF = f32(P.bins);
  for (var s = 0u; s < P.seriesCount; s = s + 1u) {
    let v = histSeriesValue(t, P.weights[s]);
    if (!histFinite(v)) {
      continue;
    }
    // The CPU expression (tevBinOfValue) verbatim, in f32.
    let i = i32(floor((binsF * (histSymlog2(v) - P.minLog)) / P.diffLog));
    let bi = u32(clamp(i, 0, i32(P.bins) - 1));
    atomicAdd(&counts[s * P.bins + bi], 1u);
  }
}
`;
}

/** The deep passes' uniform block (32 bytes; see {@link deepParamsData}). */
const DEEP_PARAMS_WGSL = `
struct DeepHistParams {
  count: u32,
  bins: u32,
  _p0: u32,
  _p1: u32,
  minLog: f32,
  diffLog: f32,
  scale: f32,
  _p2: f32,
};
`;

/** Byte size of the {@link DEEP_PARAMS_WGSL} uniform. */
export const DEEP_PARAMS_BYTES = 32;

/** Pack the deep-pass uniform (`count` = total sample count). */
export function deepParamsData(spec: {
  count: number;
  bins: number;
  minLog?: number;
  diffLog?: number;
  scale?: number;
}): ArrayBuffer {
  const buf = new ArrayBuffer(DEEP_PARAMS_BYTES);
  const u32 = new Uint32Array(buf);
  const f32 = new Float32Array(buf);
  u32[0] = Math.max(0, spec.count) >>> 0;
  u32[1] = Math.max(1, spec.bins) >>> 0;
  f32[4] = spec.minLog ?? 0;
  f32[5] = spec.diffLog ?? 1;
  f32[6] = spec.scale ?? DEPTH_WEIGHT_FIXED_SCALE;
  return buf;
}

/**
 * Assemble the deep Z-RANGE pass. Bindings: 0 = the CSR `zs` storage buffer,
 * 1 = per-workgroup partials (`numWorkgroups × 2` f32: [zmin, zmax]), 2 = the
 * {@link DEEP_PARAMS_WGSL} uniform.
 */
export function assembleDeepDepthStatsWGSL(): string {
  const wg = HIST_BIN_WORKGROUP_SIZE;
  return `
${DEEP_PARAMS_WGSL}
@group(0) @binding(0) var<storage, read> zs: array<f32>;
@group(0) @binding(1) var<storage, read_write> partial: array<f32>;
@group(0) @binding(2) var<uniform> P: DeepHistParams;

const FLT_BIG: f32 = 3.402823e38;

var<workgroup> shMin: array<f32, ${wg}u>;
var<workgroup> shMax: array<f32, ${wg}u>;

@compute @workgroup_size(${wg})
fn cs_main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(workgroup_id) wgid: vec3<u32>,
) {
  var zmin = FLT_BIG;
  var zmax = -FLT_BIG;
  let idx = gid.x;
  if (idx < P.count) {
    let z = zs[idx];
    if (z == z && abs(z) < 3.0e38) {
      zmin = z;
      zmax = z;
    }
  }
  shMin[lid.x] = zmin;
  shMax[lid.x] = zmax;
  workgroupBarrier();
  var stride = ${wg}u / 2u;
  loop {
    if (stride == 0u) {
      break;
    }
    if (lid.x < stride) {
      shMin[lid.x] = min(shMin[lid.x], shMin[lid.x + stride]);
      shMax[lid.x] = max(shMax[lid.x], shMax[lid.x + stride]);
    }
    workgroupBarrier();
    stride = stride / 2u;
  }
  if (lid.x == 0u) {
    partial[wgid.x * 2u] = shMin[0];
    partial[wgid.x * 2u + 1u] = shMax[0];
  }
}
`;
}

/**
 * Assemble the deep alpha-weighted BIN pass. Bindings: 0 = `zs`, 1 = the flat
 * premultiplied `colors` (RGBA-interleaved f32 — alpha at `4i+3`), 2 = the
 * `bins` u32 fixed-point weight storage (zero-initialized), 3 = the uniform.
 */
export function assembleDeepDepthBinWGSL(): string {
  return `
${DEEP_PARAMS_WGSL}
@group(0) @binding(0) var<storage, read> zs: array<f32>;
@group(0) @binding(1) var<storage, read> colors: array<f32>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> P: DeepHistParams;

fn histSymlog2(v: f32) -> f32 {
  let a = ${0.001};
  let log2a = f32(${Math.log2(0.001)});
  if (v > 0.0) {
    return log2(v + a) - log2a;
  }
  return log2a - log2(-v + a);
}

@compute @workgroup_size(${HIST_BIN_WORKGROUP_SIZE})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= P.count) {
    return;
  }
  let z = zs[idx];
  if (!(z == z && abs(z) < 3.0e38)) {
    return;
  }
  var w = colors[idx * 4u + 3u];
  if (!(w == w)) {
    return;
  }
  w = clamp(w, 0.0, ${DEPTH_WEIGHT_MAX}.0);
  let fixed = u32(round(w * P.scale));
  if (fixed == 0u) {
    return;
  }
  let binsF = f32(P.bins);
  let i = i32(floor((binsF * (histSymlog2(z) - P.minLog)) / P.diffLog));
  let bi = u32(clamp(i, 0, i32(P.bins) - 1));
  atomicAdd(&counts[bi], fixed);
}
`;
}

// ---------------------------------------------------------------------------
// Host folds + CPU twins (pure; unit-tested under Node).
// ---------------------------------------------------------------------------

/** The folded stats-pass output. `range` is `null` when NO finite series
 *  sample exists (the caller then renders an empty histogram over [0,1]). */
export interface HistogramStatsFold {
  /** Per texel channel (length {@link HIST_MAX_CHANNELS}; trim to the source's
   *  real channel count). Empty channels fold to `emptyChannelStats()`. */
  channelStats: ChannelStats[];
  range: { min: number; max: number } | null;
}

const FLT_BIG = 3.402823e38;

/** Fold the stats pass's per-workgroup partial buffer (f64 host combine —
 *  the same tail discipline as `foldReducePartials`). */
export function foldHistogramStatsPartials(
  partial: Float32Array | number[],
  numWorkgroups: number,
): HistogramStatsFold {
  const lanes = HIST_STATS_LANES;
  const acc = new Array<number>(lanes);
  for (let l = 0; l < lanes; l++) {
    const kind = l < HIST_MAX_CHANNELS * 4 ? Math.min(l % 4, 2) : l === HIST_MAX_CHANNELS * 4 ? 0 : 1;
    acc[l] = kind === 0 ? Infinity : kind === 1 ? -Infinity : 0;
  }
  for (let wg = 0; wg < numWorkgroups; wg++) {
    for (let l = 0; l < lanes; l++) {
      const v = partial[wg * lanes + l] ?? 0;
      const kind = l < HIST_MAX_CHANNELS * 4 ? Math.min(l % 4, 2) : l === HIST_MAX_CHANNELS * 4 ? 0 : 1;
      if (kind === 0) acc[l] = Math.min(acc[l]!, v);
      else if (kind === 1) acc[l] = Math.max(acc[l]!, v);
      else acc[l] = acc[l]! + v;
    }
  }
  const channelStats: ChannelStats[] = [];
  for (let c = 0; c < HIST_MAX_CHANNELS; c++) {
    const b = c * 4;
    const count = Math.round(acc[b + 3]!);
    if (count <= 0) {
      channelStats.push(emptyChannelStats());
    } else {
      channelStats.push({ min: acc[b]!, max: acc[b + 1]!, mean: acc[b + 2]! / count, count });
    }
  }
  const smin = acc[HIST_MAX_CHANNELS * 4]!;
  const smax = acc[HIST_MAX_CHANNELS * 4 + 1]!;
  // The GPU identities are ±FLT_BIG — a min still ≥ FLT_BIG (or min > max)
  // means no workgroup saw a finite series sample.
  const range = smin > smax || smin >= FLT_BIG ? null : { min: smin, max: smax };
  return { channelStats, range };
}

/** Fold the deep Z-range pass's partials → `[zMin, zMax]`, or `null` when no
 *  finite Z exists. */
export function foldDeepDepthStatsPartials(
  partial: Float32Array | number[],
  numWorkgroups: number,
): { zMin: number; zMax: number } | null {
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let wg = 0; wg < numWorkgroups; wg++) {
    zMin = Math.min(zMin, partial[wg * 2] ?? Infinity);
    zMax = Math.max(zMax, partial[wg * 2 + 1] ?? -Infinity);
  }
  if (zMin > zMax || zMin >= FLT_BIG) return null;
  return { zMin, zMax };
}

/**
 * Pure CPU twin of the deep BIN pass: alpha-weighted Z bin weights over a
 * mapping. `quantize` mirrors the GPU's fixed-point accumulation exactly
 * (`round(w·scale)` per sample, summed, ÷ scale) — the parity harness uses
 * it; the production CPU fallback omits it (exact float weights). Skips
 * non-finite Z / NaN alpha; clamps alpha to `[0, `{@link DEPTH_WEIGHT_MAX}`]`
 * like the GPU. Binning through `binOf` (the caller passes `tevBinOfValue`
 * over its mapping) so the CPU/GPU bin expression stays single-sourced.
 */
export function cpuDeepDepthWeights(
  zs: ArrayLike<number>,
  colors: ArrayLike<number>,
  mapping: TevBinMapping,
  binOf: (m: TevBinMapping, v: number) => number,
  quantize?: number,
): Float64Array {
  const weights = new Float64Array(mapping.bins);
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i]!;
    if (!Number.isFinite(z)) continue;
    let w = colors[i * 4 + 3] ?? 0;
    if (Number.isNaN(w)) continue;
    w = Math.min(Math.max(w, 0), DEPTH_WEIGHT_MAX);
    if (quantize) {
      const fixed = Math.round(w * quantize);
      if (fixed === 0) continue;
      w = fixed / quantize;
    }
    if (w <= 0) continue;
    const bi = binOf(mapping, z);
    if (bi >= 0) weights[bi]! += w;
  }
  return weights;
}

/** Re-export the symlog the WGSL literals are generated from — the compile-time
 *  coupling the parity tests assert against. */
export { symmetricLog2 };
