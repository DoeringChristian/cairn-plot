/**
 * Shared SVG vertical colorbar for the 2D CHART renderers (ScatterPlot,
 * Heatmap). Distinct from the DOM/canvas `Colorbar` (used by the image panes):
 * this one renders inside a chart's `<svg>` as a `<g>` of primitives.
 *
 * Draws a gradient bar (sampled from the colormap LUT), its numeric tick
 * labels and an optional rotated caption — all placed by `colorbarPlacement`
 * so the whole assembly lands inside the right-pad the renderer reserved via
 * `colorbarReservedRight`. Renderers no longer hand-place these SVG nodes, and
 * both share ONE look + ONE non-overlapping layout contract.
 */
import { useId, useMemo } from "react";
import type { ColormapName } from "../types";
import { getColormapLUT } from "../colormaps/lut";
import { AXIS } from "../theme";
import { colorbarPlacement, type ColorbarLabel } from "./colorbar-layout";

export interface PlotColorbarProps {
  colormap: ColormapName;
  /** Plot right edge (container-local px) — the bar sits `CBAR.gap` past it. */
  plotRight: number;
  top: number;
  height: number;
  /** The right-pad reserved for this colorbar (`colorbarReservedRight`). */
  reservedRight: number;
  /** Tick labels, `frac` 0=bottom … 1=top (already `formatNum`-formatted). */
  labels: ColorbarLabel[];
  /** Optional rotated caption at the far-right of the reserved band. */
  title?: string | null;
}

/** ~9 evenly-spaced LUT stops → a faithful gradient (matches Heatmap's old
 *  inline gradient; better than the 3-stop approximation Scatter used). */
function useGradientStops(colormap: ColormapName): string[] {
  return useMemo(() => {
    const lut = getColormapLUT(colormap);
    const stops: string[] = [];
    for (let i = 0; i <= 256; i += 32) {
      const idx = Math.min(255, i);
      stops.push(`rgb(${lut[idx * 3]},${lut[idx * 3 + 1]},${lut[idx * 3 + 2]})`);
    }
    return stops;
  }, [colormap]);
}

export default function PlotColorbar({
  colormap,
  plotRight,
  top,
  height,
  reservedRight,
  labels,
  title,
}: PlotColorbarProps) {
  const rawId = useId();
  const gradientId = `cbar-${rawId.replace(/:/g, "")}`;
  const stops = useGradientStops(colormap);
  const place = colorbarPlacement({
    plotRight,
    top,
    height,
    reservedRight,
    labels,
    title,
  });

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          {stops.map((c, i) => (
            <stop
              key={i}
              offset={`${(i / (stops.length - 1)) * 100}%`}
              stopColor={c}
            />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={place.bar.x}
        y={place.bar.y}
        width={place.bar.width}
        height={place.bar.height}
        fill={`url(#${gradientId})`}
        stroke={AXIS.lineColor}
      />
      {place.numbers.map((n, i) => (
        <text
          key={i}
          x={n.x}
          y={n.y}
          textAnchor="start"
          className="mono fill-fg-subtle"
          style={{ fontSize: AXIS.tickFontSize }}
        >
          {n.text}
        </text>
      ))}
      {place.title && title && (
        <text
          x={place.title.x}
          y={place.title.y}
          textAnchor="middle"
          className="fill-fg-muted"
          style={{ fontSize: AXIS.titleFontSize }}
          transform={`rotate(90, ${place.title.x}, ${place.title.y})`}
        >
          {title}
        </text>
      )}
    </g>
  );
}
