/**
 * Content-sized pads for the horizontal BarChart. The vertical bands are
 * derived from the shared `AXIS` tokens and the `Axis` primitive's own text
 * placement, so a pad reserves exactly what actually renders — no fixed band
 * for an element that isn't there:
 *
 *   - TOP:    a legend band ONLY when the legend renders, else a bare gutter.
 *   - BOTTOM: tick-label clearance always, PLUS a caption band ONLY when a
 *             `valueLabel` renders.
 *
 * (Before: a flat 34px bottom reserved caption space even with no caption, and
 * a 26px top reserved more than the legend chips use.)
 */
import { AXIS } from "../theme.ts";

/** Glyph descent slack so tails ("g", "-") aren't clipped at the pad edge. */
const TEXT_DESCENT = 3;

/** Bottom clearance for the tick labels alone. Mirrors the `Axis` bottom-tick
 *  baseline: `tickLength + tickFontSize` below the plot, + descent. */
export const BAR_TICK_BAND = AXIS.tickLength + AXIS.tickFontSize + TEXT_DESCENT;

/** Extra bottom band the `Axis` caption needs below the tick labels. */
export const BAR_TITLE_BAND = AXIS.titleFontSize + 4;

/** Legend chip geometry (kept in sync with BarChart's chip rects). */
export const BAR_LEGEND_CHIP_TOP = 4;
export const BAR_LEGEND_CHIP_H = 10;
/** Top band when the legend renders: chip box + a little clearance. */
export const BAR_LEGEND_BAND = BAR_LEGEND_CHIP_TOP + BAR_LEGEND_CHIP_H + 4;

/** Bare top gutter when there is no legend (keeps bars off the frame). */
export const BAR_TOP_MARGIN = 8;

export interface BarPads {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function barChartPads(opts: {
  showLegend: boolean;
  hasValueLabel: boolean;
  /** Left pad (row-label gutter) — already content-derived by the caller. */
  left: number;
  /** Right pad for end-of-bar value labels. */
  right: number;
}): BarPads {
  return {
    top: opts.showLegend ? BAR_LEGEND_BAND : BAR_TOP_MARGIN,
    bottom: BAR_TICK_BAND + (opts.hasValueLabel ? BAR_TITLE_BAND : 0),
    left: opts.left,
    right: opts.right,
  };
}
