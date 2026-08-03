/**
 * Normalize a value to [0, 1] within a domain, with optional log scale and invert.
 */
export function normalizeValue(
  value: number | null,
  domain: { min: number; max: number },
  opts?: { log?: boolean; invert?: boolean },
): number | null {
  if (value == null) return null;
  return normalizeScalar(value, domain.min, domain.max, opts);
}

/**
 * Scalar core of {@link normalizeValue}: map a (non-null) `value` to `[0, 1]`
 * over `[min, max]` with the SAME degenerate handling — a zero-span domain
 * (`min === max`) maps to the midpoint `0.5` rather than dividing by zero.
 *
 * Takes `min`/`max` as scalars (not a `{min,max}` object) so hot per-element
 * loops (colormap sampling) can call it without allocating a domain object per
 * element; `normalizeValue` is the object-domain, null-tolerant wrapper.
 */
export function normalizeScalar(
  value: number,
  min: number,
  max: number,
  opts?: { log?: boolean; invert?: boolean },
): number {
  let val = value;
  let lo = min;
  let hi = max;
  if (opts?.log) {
    const offset = lo > 0 ? 0 : 1 - lo;
    val = Math.log10(val + offset);
    lo = Math.log10(lo + offset);
    hi = Math.log10(hi + offset);
  }
  let t = hi - lo === 0 ? 0.5 : (val - lo) / (hi - lo);
  if (opts?.invert) t = 1 - t;
  return t;
}
