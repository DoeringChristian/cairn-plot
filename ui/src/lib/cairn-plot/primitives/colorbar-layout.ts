/**
 * Shared vertical-colorbar geometry for the 2D renderers (ScatterPlot,
 * Heatmap). ONE contract for where the gradient bar, its numeric tick labels
 * and the (optional) rotated caption sit inside the plot's RIGHT pad — so a
 * renderer reserves exactly the space the colorbar needs and nothing overlaps.
 *
 * Before this module each renderer hand-placed the bar + labels against a
 * MAGIC `pad.right` constant (Scatter 70, Heatmap 64) that didn't account for
 * how wide `formatNum` makes a tick label. Full-precision numbers (e.g.
 * "-0.98999", "0.52846") then overflowed the reserved band and, in Scatter,
 * collided with the rotated caption. `colorbarReservedRight` derives the band
 * width from the ACTUAL formatted label strings + whether a caption renders, so
 * the reserve always fits the content.
 *
 * Coordinate convention: the caller passes the plot's right edge (`plotRight`,
 * container-local px), the bar's top (`top`) and pixel `height`. `frac` on a
 * label is 0 at the bar's BOTTOM, 1 at its TOP.
 */
import { AXIS } from "../theme.ts";

/** Layout constants. All px. `CHAR_W` is the measured advance width of a mono
 *  digit at `AXIS.tickFontSize` (10px → ~6px/char, tabular figures). */
export const CBAR = {
  /** Gap from the plot's right edge to the gradient bar's left edge. */
  gap: 10,
  /** Gradient bar width. */
  barW: 12,
  /** Gap from the bar's right edge to the number labels (anchor="start"). */
  numGap: 4,
  /** Mono char advance at `AXIS.tickFontSize`. */
  charW: 6,
  /** A touch of slack past the widest number so it never kisses the caption. */
  numPad: 2,
  /** Horizontal band a rotated caption occupies (≈ its font size + slack). */
  titleW: 16,
  /** Gap between the widest number and the caption band. */
  titleGap: 6,
  /** Reserve when there is NO caption (small right margin past the numbers). */
  noTitlePad: 4,
  /** Baseline nudge so a label reads centred on its `frac` position. */
  baseline: AXIS.tickFontSize / 3,
} as const;

/** Width of the widest formatted label, in px (0 for an empty list). */
function maxLabelWidth(labels: readonly string[]): number {
  const maxChars = labels.reduce((m, s) => Math.max(m, s.length), 0);
  return maxChars > 0 ? maxChars * CBAR.charW + CBAR.numPad : 0;
}

/**
 * Right-pad (px) a renderer must reserve for a colorbar carrying `labels`
 * (already `formatNum`-formatted) and, when `hasTitle`, a rotated caption.
 *
 * Layout of the reserved band, left→right:
 *   gap | bar | numGap | widest-number | (titleGap | caption) OR noTitlePad
 * The number band and caption band never overlap by construction — the caption
 * starts `titleGap` past where the widest number ends.
 */
export function colorbarReservedRight(
  labels: readonly string[],
  hasTitle: boolean,
): number {
  const numW = maxLabelWidth(labels);
  const tail = hasTitle ? CBAR.titleGap + CBAR.titleW : CBAR.noTitlePad;
  return CBAR.gap + CBAR.barW + CBAR.numGap + numW + tail;
}

export interface ColorbarLabel {
  text: string;
  /** 0 = bar bottom, 1 = bar top. */
  frac: number;
}

export interface ColorbarPlacement {
  bar: { x: number; y: number; width: number; height: number };
  /** Number labels, each with an absolute (x, y) and `anchor: "start"`. */
  numbers: { text: string; x: number; y: number }[];
  /** Rotated caption center (when a title is present), else null. */
  title: { x: number; y: number } | null;
  /** The right-most px any colorbar element reaches (for overflow asserts). */
  rightExtent: number;
}

/**
 * Resolve every colorbar element's px position from the plot geometry + the
 * SAME `reservedRight` the renderer reserved (via `colorbarReservedRight`).
 * Keeping both derived from one call guarantees the drawn bar/labels/caption
 * land inside the reserved band — the property the geometry tests assert.
 */
export function colorbarPlacement(opts: {
  plotRight: number;
  top: number;
  height: number;
  reservedRight: number;
  labels: readonly ColorbarLabel[];
  title?: string | null;
}): ColorbarPlacement {
  const { plotRight, top, height, reservedRight, labels, title } = opts;
  const barX = plotRight + CBAR.gap;
  const numX = barX + CBAR.barW + CBAR.numGap;
  const numW = maxLabelWidth(labels.map((l) => l.text));
  const numbers = labels.map((l) => ({
    text: l.text,
    x: numX,
    y: top + (1 - l.frac) * height + CBAR.baseline,
  }));
  const hasTitle = !!title;
  const titleX = hasTitle
    ? plotRight + reservedRight - CBAR.titleW / 2
    : 0;
  const numbersRight = numX + numW;
  return {
    bar: { x: barX, y: top, width: CBAR.barW, height },
    numbers,
    title: hasTitle ? { x: titleX, y: top + height / 2 } : null,
    rightExtent: Math.max(
      numbersRight,
      hasTitle ? titleX + CBAR.titleW / 2 : numbersRight,
    ),
  };
}
