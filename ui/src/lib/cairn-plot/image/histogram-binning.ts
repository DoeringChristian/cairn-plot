/**
 * `image/histogram-binning.ts` — the PURE tev-parity histogram math (the port
 * of Tom94/tev's `ImageCanvas` canvas-statistics binning; see
 * `docs/superpowers/specs/2026-08-25-image-info-panel-design.md`).
 *
 * ONE source of truth for the value→bin mapping, bin edges, display
 * normalization and per-channel stats — used by BOTH the CPU reader loop
 * (`renderers/image-histogram.ts`) and the GPU kernels (M2), so the two paths
 * agree bin-for-bin. DOM-free and dependency-free (Node test-runner safe).
 *
 * The tev semantics, exactly:
 *   - {@link TEV_HISTOGRAM_BINS} = 400 bins.
 *   - SYMMETRIC-LOG₂ x-axis with additive regularization
 *     `a = `{@link TEV_HISTOGRAM_REGULARIZATION}` = 0.001`:
 *         symlog(v) = v > 0 ?  (log2(v + a) − log2(a))
 *                           : −(log2(−v + a) − log2(a))
 *     (odd, continuous, symlog(0) = 0 — negative/signed data bins
 *     symmetrically, which matters for signed diffs).
 *   - The axis spans the data's ACTUAL `[min, max]` (shared across series).
 *   - Values are RAW channel values (never exposure/display-adjusted), so a
 *     histogram is a pure function of the SOURCE — content-keyed cacheable.
 *   - Display normalization: counts become DENSITY (÷ bin width in VALUE
 *     space), then a PERCENTILE CAP: the top `(1 + bins/128) · nSeries`
 *     density values (across all series) are excluded from the display max;
 *     the scale is `1 / (max(nextLargest, 0.1) · 1.3)` — one hot bin cannot
 *     flatten the whole plot.
 */

/** tev's bin count. */
export const TEV_HISTOGRAM_BINS = 400;
/** tev's additive regularization `a` (0.001). */
export const TEV_HISTOGRAM_REGULARIZATION = 0.001;

const LOG2_A = Math.log2(TEV_HISTOGRAM_REGULARIZATION);

/** tev's symmetric log₂: odd, continuous, `symmetricLog2(0)` is exactly `+0`
 *  (the negative branch is written as a plain subtraction — a unary negation
 *  would yield `-0` at zero, which `Object.is`-style comparisons distinguish). */
export function symmetricLog2(v: number): number {
  return v > 0
    ? Math.log2(v + TEV_HISTOGRAM_REGULARIZATION) - LOG2_A
    : LOG2_A - Math.log2(-v + TEV_HISTOGRAM_REGULARIZATION);
}

/** Inverse of {@link symmetricLog2} (exact up to float rounding). */
export function symmetricLog2Inv(t: number): number {
  return t >= 0
    ? Math.pow(2, t + LOG2_A) - TEV_HISTOGRAM_REGULARIZATION
    : -(Math.pow(2, -t + LOG2_A) - TEV_HISTOGRAM_REGULARIZATION);
}

/** The value→bin / bin→value mapping over `[min, max]` in symlog space. */
export interface TevBinMapping {
  bins: number;
  min: number;
  max: number;
  /** `symmetricLog2(min)` — the symlog-axis origin. */
  minLog: number;
  /** `symmetricLog2(max) − minLog` (≥ a tiny epsilon so division is safe). */
  diffLog: number;
}

/** Build the mapping for `[min, max]` (degenerate ranges collapse safely). */
export function tevBinMapping(
  min: number,
  max: number,
  bins: number = TEV_HISTOGRAM_BINS,
): TevBinMapping {
  const minLog = symmetricLog2(min);
  const diffLog = Math.max(symmetricLog2(max) - minLog, 1e-12);
  return { bins, min, max, minLog, diffLog };
}

/** The bin a value falls into (clamped; tev's `valToBin`). Non-finite → −1. */
export function tevBinOfValue(m: TevBinMapping, v: number): number {
  if (!Number.isFinite(v)) return -1;
  const i = Math.floor((m.bins * (symmetricLog2(v) - m.minLog)) / m.diffLog);
  return i < 0 ? 0 : i >= m.bins ? m.bins - 1 : i;
}

/** The VALUE at bin edge `i` (i ∈ [0, bins]; tev's `binToVal`). */
export function tevValueOfBinEdge(m: TevBinMapping, i: number): number {
  return symmetricLog2Inv(m.minLog + (m.diffLog * i) / m.bins);
}

/**
 * tev's display normalization over raw per-series bin COUNTS:
 *   1. counts → density (÷ the bin's width in value space);
 *   2. percentile cap: exclude the top `(1 + bins/128) · nSeries` density
 *      values across ALL series, scale everything by
 *      `1 / (max(nextLargest, 0.1) · 1.3)`.
 * Returns one `Float32Array` of display values per series (≈[0, 1], hot bins
 * may exceed 1 — the renderer clamps).
 */
export function tevNormalizeCounts(
  counts: ReadonlyArray<ArrayLike<number>>,
  m: TevBinMapping,
): Float32Array[] {
  const nSeries = counts.length;
  if (nSeries === 0) return [];
  // Bin widths in VALUE space (shared by all series).
  const widths = new Float64Array(m.bins);
  for (let i = 0; i < m.bins; i++) {
    widths[i] = Math.max(tevValueOfBinEdge(m, i + 1) - tevValueOfBinEdge(m, i), 1e-30);
  }
  const density = counts.map((c) => {
    const d = new Float64Array(m.bins);
    for (let i = 0; i < m.bins; i++) d[i] = (c[i] ?? 0) / widths[i]!;
    return d;
  });
  // Percentile cap (tev): sort ALL density values descending, skip the top
  // `(1 + bins/128) · nSeries`, cap at the next one.
  const all = new Float64Array(nSeries * m.bins);
  density.forEach((d, s) => all.set(d, s * m.bins));
  const sorted = Array.from(all).sort((a, b) => b - a);
  const skip = Math.min(sorted.length - 1, Math.floor(1 + m.bins / 128) * nSeries);
  const cap = sorted[skip] ?? 0;
  const norm = 1 / (Math.max(cap, 0.1) * 1.3);
  return density.map((d) => {
    const out = new Float32Array(m.bins);
    for (let i = 0; i < m.bins; i++) out[i] = d[i]! * norm;
    return out;
  });
}

/** Running per-channel stats (the panel's min/mean/max row). */
export interface ChannelStats {
  min: number;
  max: number;
  mean: number;
  /** Finite samples that contributed. */
  count: number;
}

/** Fold one finite sample into `s` (mutating accumulator; callers skip
 *  non-finite samples). */
export function foldChannelStat(s: ChannelStats, v: number): void {
  if (v < s.min) s.min = v;
  if (v > s.max) s.max = v;
  s.count++;
  s.mean += (v - s.mean) / s.count;
}

/** A fresh accumulator. */
export function emptyChannelStats(): ChannelStats {
  return { min: Infinity, max: -Infinity, mean: 0, count: 0 };
}
