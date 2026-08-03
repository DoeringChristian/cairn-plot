/**
 * `util/clamp.ts` — the ONE numeric clamp used across cairn-plot.
 *
 * Every renderer/primitive had re-inlined `Math.max(lo, Math.min(hi, v))` or
 * `Math.max(0, Math.min(1, v))`; those are collected here so there is a single
 * definition (identical NaN behaviour, identical branch order) instead of a
 * scatter of look-alikes that can silently drift.
 *
 * NaN note (shared by all three): the comparison form `v < lo ? lo : v > hi ?
 * hi : v` returns `v` (NaN) when `v` is NaN — the callers that must map NaN to a
 * concrete value guard it themselves (e.g. the colormap `lutRow`).
 */

/** Clamp `v` to the inclusive range `[lo, hi]`. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp `v` to `[0, 1]` (the ubiquitous normalized-coordinate clamp). */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Floor then clamp to the inclusive integer range `[lo, hi]`. */
export function clampInt(v: number, lo: number, hi: number): number {
  return clamp(Math.floor(v), lo, hi);
}
