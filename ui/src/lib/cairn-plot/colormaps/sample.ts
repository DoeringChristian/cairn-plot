/**
 * `colormapColor(name, t)` — sample any registered colormap (the same
 * `COLORMAP_STOPS` LUTs the image/diff paths use) as a CSS `rgb()` string.
 * Replaces the hardcoded `viridis(t)` in the point-color/colorbar paths
 * (Scatter, ParallelCoords) so every renderer offers every colormap.
 * `t` is clamped to [0, 1].
 */
import type { ColormapName } from "../types";
import { getColormapLUT } from "./lut.ts";

export function colormapColor(name: ColormapName, t: number): string {
  const lut = getColormapLUT(name);
  const i = Math.max(0, Math.min(255, Math.round(t * 255)));
  return `rgb(${lut[i * 3]},${lut[i * 3 + 1]},${lut[i * 3 + 2]})`;
}
