/**
 * `colorDomainFor` — the ONE rule that keeps a DIVERGING colormap's neutral
 * midpoint pinned to the value ZERO.
 *
 * ## The contract
 * `red-blue` and `red-green` are three-stop maps whose MIDDLE stop is white
 * (`red → white → blue` / `red → white → green`), so LUT row 128 (`t = 0.5`)
 * carries meaning: it is the zero point, not merely "the middle of the data".
 * Honouring that requires the color domain to be SYMMETRIC about zero —
 * `[-m, +m]` with `m = max(|lo|, |hi|)` — so that:
 *
 *   - zero always paints white, whatever the data range, and
 *   - both sides share ONE scale: `+v` and `-v` sit mirrored about the midpoint,
 *     so equal colour distance means equal value distance in either direction.
 *
 * This holds UNCONDITIONALLY, including for one-sided data: `[2, 8]` widens to
 * `[-8, 8]`, where white never actually appears but the ramp still means the
 * same thing and the sign of the data reads at a glance. It also applies to
 * bounds the caller passed explicitly (a `min=`/`max=` on `cp.Heatmap`): the
 * magnitude is respected, the asymmetry is not.
 *
 * SEQUENTIAL maps (turbo/plasma/magma) have no distinguished midpoint, so their
 * domain is returned untouched and they keep using the full ramp over the raw
 * data range.
 *
 * ## Why the DOMAIN and not the sampler
 * Every consumer normalizes through `normToT(value, min, max)` and ALSO renders
 * a colorbar from the same `min`/`max` (`Heatmap`, `ScatterPlot`,
 * `ParallelCoords`, the pointcloud `valuesToColors`). Re-centering inside the
 * sampler would leave each colorbar advertising the raw range while the pixels
 * used another — the legend would lie. Symmetrizing the DOMAIN keeps the one
 * source of truth: `normToT` stays the pure linear `[min,max] → [0,1]` map, and
 * the colorbar's end labels stay honest about what the ramp shows.
 *
 * ## Relation to the 3D diff path
 * `plots/three/model/diff.ts`'s `diffDomain` has always done this for the 3D
 * viewers (`red-green → [-maxAbs, +maxAbs]`); it is the precedent this
 * generalizes, and the reason the pointcloud needs no change here — its callers
 * pass a domain that already encodes the rule. The CHART renderers (`Heatmap`,
 * `ScatterPlot`, `ParallelCoords`) were the ones normalizing over the raw data
 * extent, which is the bug this closes.
 *
 * Pure and dependency-light (only the `DIVERGING_COLORMAPS` set), so it unit
 * tests without any renderer imports — same shape as `resolveColormapMode`,
 * which owns the neighbouring diverging-vs-sequential decision for diff blits.
 */
import { DIVERGING_COLORMAPS } from "./lut.ts";

/** A closed colour domain: the `[min, max]` a colormap ramp spans. */
export interface ColorDomain {
  min: number;
  max: number;
}

/**
 * The colour domain to normalize against, given the raw data bounds and the
 * active colormap.
 *
 * DIVERGING (`red-blue` / `red-green`) → `[-m, +m]`, `m = max(|lo|, |hi|)`, so
 * zero lands on the white midpoint. SEQUENTIAL / unknown / `null` → `{lo, hi}`
 * unchanged.
 *
 * Bound order does not matter (`colorDomainFor(8, -2, …)` === `colorDomainFor(-2, 8, …)`)
 * because only magnitudes feed `m`. Degenerate inputs stay well-defined: a
 * non-finite bound is ignored when taking the magnitude, an all-zero domain
 * yields `[-0, 0]` (whose zero span `normToT` already maps to the midpoint —
 * white, which is correct when every value IS zero), and a domain with no finite
 * bound at all falls back to `[-1, 1]`.
 */
export function colorDomainFor(
  lo: number,
  hi: number,
  colormapName: string | null | undefined,
): ColorDomain {
  if (!DIVERGING_COLORMAPS.has(colormapName ?? "")) return { min: lo, max: hi };
  const a = Number.isFinite(lo) ? Math.abs(lo) : -Infinity;
  const b = Number.isFinite(hi) ? Math.abs(hi) : -Infinity;
  const m = Math.max(a, b);
  if (!Number.isFinite(m)) return { min: -1, max: 1 };
  return { min: -m, max: m };
}
