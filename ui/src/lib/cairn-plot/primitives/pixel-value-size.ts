/**
 * Pure font-size derivation for the TEV `PixelValueOverlay`.
 *
 * TEV convention (the whole point of this module): at a given zoom every
 * per-pixel number renders at the SAME font size — the size is a function of
 * the on-screen pixel-cell size (`scale`, CSS px per source pixel) and the
 * number of stacked lines (`lineCount`, 1 for grayscale / 3 for RGB) ALONE.
 * It never depends on the string being drawn, so "0" and "0.73496" are the
 * same height, and toggling the 0–255 ⇄ 0–1 notation (which changes the digit
 * count) never changes the size.
 *
 * Two budgets bound the size; both are string-INDEPENDENT:
 *  - vertical: the stacked lines must fit the cell's usable height — this is
 *    the hard constraint that keeps a 3-channel stack inside its pixel at the
 *    zoom where numbers first appear.
 *  - horizontal: a FIXED reference width of {@link PIXEL_VALUE_REF_CHARS}
 *    monospace characters must fit the cell. Because the reference is a
 *    constant (not the actual string length), the size is uniform; a value
 *    LONGER than the reference simply overflows the cell, centred and
 *    symmetric — exactly how TEV draws long HDR floats. We deliberately do NOT
 *    clip or ellipsize per cell: the digits ARE the content, and hiding them
 *    would be worse than a slight, symmetric spill (which only shows up at
 *    zooms where neighbouring cells are large anyway). The overlay's existing
 *    image-rect clip still stops any spill from bleeding onto the checkerboard.
 */

/**
 * A source pixel covering at least this many screen px is the SINGLE global
 * zoom threshold at which the per-pixel numbers appear — see
 * {@link pixelValueNumbersVisible}. It is a screen-px-per-texel figure ALONE:
 * it does not depend on the string, the notation, or the channel count, so at a
 * given zoom either every cell in view draws its number or none does (numbers
 * pop in ALL AT ONCE, never shorter values first). Shared contract: the GPU
 * panes gate their nearest/linear sampling on this exact same constant so the
 * image and its numbers switch to crisp per-texel rendering in lockstep.
 */
export const PIXEL_VALUE_MIN_SCREEN_PX = 30;

/** Inset on each side of the cell, as a fraction of the cell size. */
export const PIXEL_VALUE_PAD_FRAC = 0.14;
/** Line-box height as a multiple of the font height (stacked-line pitch). */
export const PIXEL_VALUE_LINE_H_FRAC = 1.15;
/** Monospace glyph advance as a fraction of the font height (width estimate). */
export const PIXEL_VALUE_CHAR_W_FRAC = 0.62;
/**
 * FIXED reference character count the cell is sized to hold. A constant — NOT
 * the drawn string's length — so every number at a given zoom is identical in
 * size (the exact user complaint being fixed). Typical values (≤ this many
 * chars, e.g. "255", "0.50", "12.3") sit inside their cell; genuinely long
 * outliers (e.g. "1.23e+02") overflow slightly, centred, TEV-style.
 */
export const PIXEL_VALUE_REF_CHARS = 4;
/** Upper clamp on the font height (CSS px) so numbers never get comically big. */
export const PIXEL_VALUE_MAX_FONT_PX = 24;
/** Below this the text is too small to read — the overlay skips drawing. */
export const PIXEL_VALUE_MIN_FONT_PX = 6;

/**
 * The ONE font height (CSS px) for every number in a cell of on-screen size
 * `scale`, holding `lineCount` stacked lines. Depends only on `scale` and
 * `lineCount` — never on the string — so all numbers at a given zoom (and a
 * given channel count) render identically. Returns `0` for a degenerate cell.
 */
export function pixelValueFontHeight(scale: number, lineCount: number): number {
  if (scale <= 0 || lineCount <= 0) return 0;
  const avail = scale * (1 - 2 * PIXEL_VALUE_PAD_FRAC);
  const byHeight = avail / (lineCount * PIXEL_VALUE_LINE_H_FRAC);
  const byWidth = avail / (PIXEL_VALUE_REF_CHARS * PIXEL_VALUE_CHAR_W_FRAC);
  return Math.min(byHeight, byWidth, PIXEL_VALUE_MAX_FONT_PX);
}

/**
 * The SINGLE global visibility rule: the per-pixel numbers are drawn iff the
 * on-screen cell is at least {@link PIXEL_VALUE_MIN_SCREEN_PX} px. Keyed on the
 * cell size (`scale`) ALONE — never a string's measured width and never the
 * channel count — so numbers appear/disappear ALL AT ONCE at one zoom level for
 * both the single-value (grayscale) and 3-channel (RGB) layouts. This replaces
 * the old per-string behaviour where a short "0" fit its cell (and drew) at a
 * lower zoom than a long "0.73496", making numbers pop in piecemeal.
 *
 * The threshold is coherent with {@link pixelValueFontHeight}: at exactly
 * `PIXEL_VALUE_MIN_SCREEN_PX` the font height for the TALLEST supported stack
 * (3 lines) is still ≥ {@link PIXEL_VALUE_MIN_FONT_PX} (see the unit test), so
 * the per-cell "too small to read" guard in the overlay never fires for a
 * supported layout at or above this threshold — the one scale test governs both
 * layouts, and neither is gated a fraction of a zoom later than the other.
 */
export function pixelValueNumbersVisible(scale: number): boolean {
  return scale >= PIXEL_VALUE_MIN_SCREEN_PX;
}
