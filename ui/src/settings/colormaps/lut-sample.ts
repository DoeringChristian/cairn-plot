/**
 * `colormaps/lut-sample.ts` — the ONE value→colormap-byte mapping.
 *
 * Every colormap consumer (the SVG charts' per-point colors, the pointcloud
 * `valuesToColors`, the `Heatmap` canvas, `colormapColor`) had re-inlined
 * "normalize a value, round to a LUT row, read the RGB bytes" with subtly
 * DIVERGENT degenerate handling (`span || 1` vs `hi - lo` zero-guards, missing
 * NaN guards, `+Inf` landing on either end). This module makes that mapping
 * identical everywhere:
 *
 *   value ──normToT──▶ t ──lutRow──▶ row 0..255 ──▶ LUT[row*3 .. +2]
 *
 * `lutRow` is the single clamp+round+degenerate point, so ALL sites agree on
 * zero-span / NaN / ±Inf domains. Both `lutRow` and `normToT` are allocation-free
 * (scalars in, scalar out) so the hot per-element loops keep their
 * no-per-point-allocation property; `sampleLutByte` is the convenience triple
 * reader for the handful of non-hot callers.
 */
import { normalizeScalar } from "../../resources/transforms/normalize.ts";

/**
 * Map a normalized position `t` to a colormap LUT row in `[0, 255]`.
 *
 * The single canonical clamp+round: `t` is clamped to `[0, 1]` then rounded to
 * the nearest of the 256 rows. Degenerate `t` is handled by the plain numeric
 * comparisons (no separate NaN branch needed):
 *   - `NaN`  → row 0   (`NaN > 0` is false)
 *   - `-Inf` → row 0
 *   - `+Inf` → row 255 (`> 0` and not `< 1`)
 * Allocation-free (a plain number in/out) so it is safe in per-point loops.
 */
export function lutRow(t: number): number {
  const c = t > 0 ? (t < 1 ? t : 1) : 0;
  return Math.round(c * 255);
}

/**
 * Read a flat RGB colormap LUT (`Uint8Array(256*3)`) at normalized `t`, as an
 * `[r, g, b]` byte triple. Convenience for the NON-hot callers (e.g.
 * `colormapColor`, colorbar gradient stops). Hot loops that write straight into
 * a typed array should call {@link lutRow} and index the LUT inline to avoid the
 * per-element tuple allocation.
 */
export function sampleLutByte(
  lut: ArrayLike<number>,
  t: number,
): [number, number, number] {
  const i = lutRow(t) * 3;
  return [lut[i]!, lut[i + 1]!, lut[i + 2]!];
}

/**
 * Map a raw value to a normalized `t` over `[min, max]` (optionally log-scaled),
 * with the canonical degenerate handling shared by every colormap site:
 *   - non-finite `value` (`NaN`/`±Inf`) → `0` (colormap start)
 *   - zero-span domain (`min === max`)  → `0.5` (via {@link normalizeScalar})
 *
 * The result is NOT clamped to `[0, 1]` (an in-range value past the domain
 * yields `t < 0` / `t > 1`); feed it to {@link lutRow}/{@link sampleLutByte},
 * which clamp. Allocation-free when no `opts` object is passed (the hot path).
 */
export function normToT(
  value: number,
  min: number,
  max: number,
  opts?: { log?: boolean; invert?: boolean },
): number {
  if (!Number.isFinite(value)) return 0;
  return normalizeScalar(value, min, max, opts);
}
