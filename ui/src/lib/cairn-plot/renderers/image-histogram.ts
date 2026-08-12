/**
 * `renderers/image-histogram.ts` — the PURE binning / grouping math behind the
 * in-pane HISTOGRAM overlay (`primitives/ImageHistogramOverlay.tsx`).
 *
 * The overlay is self-contained: it bins the DECODED source the pane already
 * holds (no server). This module is the DOM-free, unit-tested core it delegates
 * to, so the "which channels, grouped how, into how many bins over what range"
 * decisions live in ONE testable place:
 *
 *   - A {@link HistogramChannel}[] describes the source's channels (name + tint).
 *   - The user picks a SUBSET of channels and a {@link HistogramGroupMode}:
 *       · `"separate"`  — each selected channel is its OWN series (R/G/B lines);
 *       · `"luminance"` — the selected channels COMBINE into one Rec.709-luma
 *                          series (the "combined RGB luminance" case);
 *       · `"mean"`      — the selected channels COMBINE into one mean series
 *                          (an arbitrary subset grouped into one series).
 *     {@link resolveHistogramSeries} turns (channels, selection, mode) into the
 *     concrete {@link HistogramSeriesSpec}[] to bin.
 *   - {@link computeHistograms} reads pixels through a caller-supplied
 *     `readChannel(pixelIndex, channel)` accessor (the pane closes it over its
 *     own typed buffer — `ImageData` / `Float32Array` / widened f16), auto-ranges
 *     across all series (or takes an explicit range), and returns per-series bin
 *     counts. Large images are SUBSAMPLED to a bounded number of samples so the
 *     compute stays cheap and never blocks a frame.
 *
 * For DEEP-Z sources, {@link deepPixelSamples} slices one pixel's samples (Z +
 * premultiplied RGBA) out of the deep CSR the deep controller exports — the
 * per-pixel-under-cursor deep readout.
 */
import type { DeepGpuCsrData } from "../image/decoders.ts";

// The per-channel R/G/B tints + neutral fill. Kept in sync WITH (but not
// imported FROM) `primitives/PixelValueOverlay`'s `CHANNEL_COLORS` /
// `NEUTRAL_LABEL_COLOR`: that module is a `.tsx` carrying JSX, and this pure
// core is imported by the Node type-stripping test runner (which does NOT
// transform JSX), so it must stay DOM/JSX-free. The overlay component still uses
// the canonical `PixelValueOverlay` constants for its own draw.
const CHANNEL_COLORS = ["#ff5a5a", "#39d353", "#5b9bff"] as const;
const NEUTRAL_LABEL_COLOR = "#ffffff";

/** How selected channels are grouped into histogram SERIES. */
export type HistogramGroupMode = "separate" | "luminance" | "mean";

/** How ONE series aggregates its channels into a per-pixel value. */
export type HistogramCombine = "single" | "luminance" | "mean";

/** One channel of the decoded source (order === the `channel` index used by the
 *  reader). `color` is the fixed tint of the channel's series (default derived
 *  by index from {@link CHANNEL_COLORS}). */
export interface HistogramChannel {
  name: string;
  color?: string;
}

/** A concrete series to bin: which channels contribute, and how they combine. */
export interface HistogramSeriesSpec {
  id: string;
  label: string;
  /** Contributing channel indices (1 for a `"single"` series). */
  channels: number[];
  combine: HistogramCombine;
  /** Fixed line/fill tint. */
  color: string;
}

/** One binned series. `counts[i]` is the sample count in bin `i`. */
export interface HistogramSeriesResult {
  id: string;
  label: string;
  color: string;
  counts: Uint32Array;
  /** The largest single-bin count (0 when empty) — the y-scale. */
  peak: number;
  /** Total samples binned into this series. */
  total: number;
}

/** The full histogram over a shared `[min,max]` × `bins` grid. */
export interface HistogramResult {
  bins: number;
  min: number;
  max: number;
  series: HistogramSeriesResult[];
}

export const DEFAULT_HISTOGRAM_BINS = 96;
/** Bounded sample budget — larger images are strided down to this many pixels so
 *  the (2-pass) compute stays sub-millisecond and never blocks a frame. */
export const DEFAULT_HISTOGRAM_MAX_SAMPLES = 200_000;

/** Extra tints for channels beyond R/G/B (alpha + any EXR aux channels), so a
 *  4+-channel source still gets distinct, fixed per-series colors. */
const EXTRA_CHANNEL_COLORS = ["#c9c9c9", "#f0a83a", "#a06bff", "#3ad1c9", "#ff7ac2"] as const;

/** The fixed tint for channel `i` (Rec.709 R/G/B first, then a small aux ramp,
 *  else the neutral fill). */
export function defaultChannelColor(i: number): string {
  return (
    CHANNEL_COLORS[i] ??
    EXTRA_CHANNEL_COLORS[i - CHANNEL_COLORS.length] ??
    NEUTRAL_LABEL_COLOR
  );
}

/**
 * Rec.709 luminance of `values` (the channels' contributions). Exactly-3
 * channels use the canonical `0.2126 R + 0.7152 G + 0.0722 B`; any other count
 * falls back to the mean (there is no meaningful luma weighting for it).
 */
export function luminance(values: readonly number[]): number {
  if (values.length === 3) {
    return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
  }
  return mean(values);
}

/** Arithmetic mean of `values` (0 for an empty list). */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/**
 * Resolve (channels, selected-indices, group-mode) into the concrete series to
 * bin. `selected` is the ordered subset of channel indices the user enabled.
 *  - `"separate"` → one `"single"` series per selected channel (channel-tinted).
 *  - `"luminance"`/`"mean"` → ONE combined series over ALL selected channels.
 * An empty selection yields no series (the overlay then bins nothing).
 */
export function resolveHistogramSeries(
  channels: readonly HistogramChannel[],
  selected: readonly number[],
  mode: HistogramGroupMode,
): HistogramSeriesSpec[] {
  const valid = selected.filter((c) => c >= 0 && c < channels.length);
  if (valid.length === 0) return [];
  if (mode === "separate") {
    return valid.map((c) => ({
      id: `ch-${c}`,
      label: channels[c]!.name,
      channels: [c],
      combine: "single",
      color: channels[c]!.color ?? defaultChannelColor(c),
    }));
  }
  const label = mode === "luminance" ? "Luma" : "Mean";
  return [
    {
      id: `combined-${mode}`,
      label: `${label} (${valid.map((c) => channels[c]!.name).join("")})`,
      channels: valid,
      combine: mode,
      color: NEUTRAL_LABEL_COLOR,
    },
  ];
}

/** The per-pixel value a series contributes: the lone channel for `"single"`,
 *  else the Rec.709 luma / mean of its channels. */
export function seriesValueAt(
  readChannel: (pixelIndex: number, channel: number) => number,
  pixelIndex: number,
  spec: HistogramSeriesSpec,
): number {
  if (spec.combine === "single") return readChannel(pixelIndex, spec.channels[0]!);
  const vals = spec.channels.map((c) => readChannel(pixelIndex, c));
  return spec.combine === "luminance" ? luminance(vals) : mean(vals);
}

/** Stride that keeps the binned sample count at or under `maxSamples` (≥1). */
export function sampleStride(pixelCount: number, maxSamples: number): number {
  if (pixelCount <= 0 || maxSamples <= 0) return 1;
  return Math.max(1, Math.ceil(pixelCount / maxSamples));
}

/** The bin index a `value` falls into over `[min,max]` split into `bins`
 *  buckets, clamped to `[0, bins-1]`. A degenerate range (`max<=min`) is all
 *  bin 0. Non-finite values return `-1` (caller skips them). */
export function binIndexOf(value: number, min: number, max: number, bins: number): number {
  if (!Number.isFinite(value) || bins <= 0) return -1;
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  const i = Math.floor(t * bins);
  return i < 0 ? 0 : i >= bins ? bins - 1 : i;
}

/** Input to {@link computeHistograms}. */
export interface HistogramComputeInput {
  /** Raw sample accessor over the pane's own buffer (0..255 for uint8, scene
   *  value for float). */
  readChannel: (pixelIndex: number, channel: number) => number;
  /** Total pixel count (`width*height`). */
  pixelCount: number;
  /** The series to bin (from {@link resolveHistogramSeries}). */
  series: HistogramSeriesSpec[];
  /** Bin count (default {@link DEFAULT_HISTOGRAM_BINS}). */
  bins?: number;
  /** Explicit shared value range; omitted → auto min/max across all series. */
  range?: { min: number; max: number };
  /** Subsample budget (default {@link DEFAULT_HISTOGRAM_MAX_SAMPLES}). */
  maxSamples?: number;
}

/**
 * Bin the requested series over a SHARED value range (so they are directly
 * comparable). Two strided passes: pass 1 auto-ranges (finite min/max across
 * every series, when no explicit `range`), pass 2 accumulates per-series bin
 * counts. Non-finite samples (NaN/±Inf) are skipped. Pure + DOM-free.
 */
export function computeHistograms(input: HistogramComputeInput): HistogramResult {
  const bins = Math.max(1, Math.floor(input.bins ?? DEFAULT_HISTOGRAM_BINS));
  const maxSamples = input.maxSamples ?? DEFAULT_HISTOGRAM_MAX_SAMPLES;
  const { readChannel, pixelCount, series } = input;
  const stride = sampleStride(pixelCount, maxSamples);

  if (series.length === 0 || pixelCount <= 0) {
    return { bins, min: 0, max: 1, series: [] };
  }

  // Pass 1 — shared range (auto unless supplied).
  let min: number;
  let max: number;
  if (input.range) {
    min = input.range.min;
    max = input.range.max;
  } else {
    min = Infinity;
    max = -Infinity;
    for (let p = 0; p < pixelCount; p += stride) {
      for (const spec of series) {
        const v = seriesValueAt(readChannel, p, spec);
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      // No finite samples at all — return an empty grid over a unit range.
      min = 0;
      max = 1;
    }
  }

  // Pass 2 — accumulate.
  const results: HistogramSeriesResult[] = series.map((spec) => ({
    id: spec.id,
    label: spec.label,
    color: spec.color,
    counts: new Uint32Array(bins),
    peak: 0,
    total: 0,
  }));
  for (let p = 0; p < pixelCount; p += stride) {
    for (let s = 0; s < series.length; s++) {
      const v = seriesValueAt(readChannel, p, series[s]!);
      const bi = binIndexOf(v, min, max, bins);
      if (bi < 0) continue;
      const r = results[s]!;
      const c = ++r.counts[bi]!;
      if (c > r.peak) r.peak = c;
      r.total++;
    }
  }

  return { bins, min, max, series: results };
}

/** One deep sample of a pixel: its Z (depth) and premultiplied RGBA color. */
export interface DeepPixelSample {
  z: number;
  rgba: [number, number, number, number];
}

/**
 * Slice ONE pixel's deep samples out of the deep CSR the {@link
 * DeepGpuCsrData} export carries (offsets prefix-sums + flat colors + per-sample
 * Z, ascending in Z within each pixel). Returns the samples for `(px,py)` (front
 * to back), or `[]` when the pixel is out of range or holds no samples. Pure.
 */
export function deepPixelSamples(
  csr: DeepGpuCsrData,
  px: number,
  py: number,
): DeepPixelSample[] {
  if (px < 0 || py < 0 || px >= csr.width || py >= csr.height) return [];
  const pixel = py * csr.width + px;
  const start = csr.offsets[pixel] ?? 0;
  const end = csr.offsets[pixel + 1] ?? start;
  const out: DeepPixelSample[] = [];
  for (let s = start; s < end; s++) {
    const c = s * 4;
    out.push({
      z: csr.zs[s] ?? 0,
      rgba: [csr.colors[c] ?? 0, csr.colors[c + 1] ?? 0, csr.colors[c + 2] ?? 0, csr.colors[c + 3] ?? 0],
    });
  }
  return out;
}
