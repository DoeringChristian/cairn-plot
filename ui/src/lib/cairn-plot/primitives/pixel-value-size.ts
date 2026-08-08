/**
 * Pure font-size derivation for the TEV `PixelValueOverlay`.
 *
 * ONE size per view (the whole point of this module): the overlay draws every
 * per-pixel number at a SINGLE font size, a function of the on-screen
 * pixel-cell size (`scale`, CSS px per source pixel), the number of stacked
 * lines (`lineCount`, 1 for grayscale / 3 for RGB), and the longest line
 * currently IN VIEW (`refChars`). It never depends on which individual string a
 * given cell draws, so at a given zoom "0" and "0.73496" are the same height —
 * the overlay computes `refChars` once for the whole frame (the max over the
 * visible cells) and passes it to every cell.
 *
 * Two budgets bound the size:
 *  - vertical: the stacked lines must fit the cell's usable height — the hard
 *    constraint that keeps a 3-channel stack inside its pixel at the zoom where
 *    numbers first appear.
 *  - horizontal: `refChars` monospace characters must fit the cell WIDTH. The
 *    overlay passes the widest value in view, so the size shrinks just enough
 *    that even the LONGEST number sits INSIDE the pixel it describes — never
 *    spilling across pixel boundaries onto its neighbours (the regression this
 *    restores). `refChars` defaults to {@link PIXEL_VALUE_REF_CHARS} for callers
 *    that only know a cell's channel count; the overlay always supplies the
 *    measured value.
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
 * DEFAULT reference character count a cell is sized to hold, used only when a
 * caller does not pass an explicit `refChars` to {@link pixelValueFontHeight}.
 * The overlay ALWAYS passes the longest value actually in view instead (so the
 * widest number is contained inside its pixel); this constant is the fallback
 * for the visibility-coherence check (where no specific string is in hand).
 */
export const PIXEL_VALUE_REF_CHARS = 4;
/** Upper clamp on the font height (CSS px) so numbers never get comically big. */
export const PIXEL_VALUE_MAX_FONT_PX = 24;
/** Below this the text is too small to read — the overlay skips drawing. */
export const PIXEL_VALUE_MIN_FONT_PX = 6;

/**
 * The ONE font height (CSS px) the overlay uses for EVERY number in the current
 * frame: a cell of on-screen size `scale` holding `lineCount` stacked lines,
 * sized so a `refChars`-character line fits the cell WIDTH. The overlay passes
 * the widest value in view for `refChars`, so the returned height keeps even the
 * longest number inside the pixel it labels (never overflowing onto neighbours)
 * while staying uniform across the frame. `refChars` defaults to
 * {@link PIXEL_VALUE_REF_CHARS}. Returns `0` for a degenerate cell.
 */
export function pixelValueFontHeight(
  scale: number,
  lineCount: number,
  refChars: number = PIXEL_VALUE_REF_CHARS,
): number {
  if (scale <= 0 || lineCount <= 0) return 0;
  const chars = Math.max(1, refChars);
  const avail = scale * (1 - 2 * PIXEL_VALUE_PAD_FRAC);
  const byHeight = avail / (lineCount * PIXEL_VALUE_LINE_H_FRAC);
  const byWidth = avail / (chars * PIXEL_VALUE_CHAR_W_FRAC);
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
