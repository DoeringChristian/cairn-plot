/**
 * `colormapColor(name, t)` — sample any registered colormap (the same
 * `COLORMAP_STOPS` LUTs the image/diff paths use) as a CSS `rgb()` string.
 * Replaces the hardcoded `viridis(t)` in the point-color/colorbar paths
 * (Scatter, ParallelCoords) so every renderer offers every colormap.
 * `t` is clamped to [0, 1].
 */
import type { ColormapName } from "../types";
import { getColormapLUT } from "./lut.ts";
import { sampleLutByte } from "./lut-sample.ts";

export function colormapColor(name: ColormapName, t: number): string {
  const [r, g, b] = sampleLutByte(getColormapLUT(name), t);
  return `rgb(${r},${g},${b})`;
}
