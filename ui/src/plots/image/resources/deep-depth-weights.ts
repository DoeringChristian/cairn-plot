import type { TevBinMapping } from "../definition/histogram-binning.ts";

const DEPTH_WEIGHT_MAX = 65535;

/**
 * Backend-neutral alpha-weighted deep-Z histogram. `quantize` can mirror a
 * fixed-point GPU accumulator for parity tests; ordinary CPU callers omit it.
 */
export function deepDepthWeights(
  zs: ArrayLike<number>,
  colors: ArrayLike<number>,
  mapping: TevBinMapping,
  binOf: (mapping: TevBinMapping, value: number) => number,
  quantize?: number,
): Float64Array {
  const weights = new Float64Array(mapping.bins);
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i]!;
    if (!Number.isFinite(z)) continue;
    let weight = colors[i * 4 + 3] ?? 0;
    if (Number.isNaN(weight)) continue;
    weight = Math.min(Math.max(weight, 0), DEPTH_WEIGHT_MAX);
    if (quantize) {
      const fixed = Math.round(weight * quantize);
      if (fixed === 0) continue;
      weight = fixed / quantize;
    }
    if (weight <= 0) continue;
    const bin = binOf(mapping, z);
    if (bin >= 0) weights[bin]! += weight;
  }
  return weights;
}
