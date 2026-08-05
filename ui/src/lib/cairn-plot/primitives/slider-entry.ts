/**
 * `primitives/slider-entry.ts` — pure parse/commit helpers for the toolbar
 * sliders' MANUAL NUMERIC ENTRY (double-click a slider to type a value that may
 * legally EXCEED the slider's min/max — e.g. EXPOSURE 12, OFFSET −3).
 *
 * Kept dependency-free (no React, no DOM) so it unit-tests under Node's built-in
 * runner with type-stripping, and so the single commit rule ("invalid → revert,
 * never commit NaN; out-of-range → pass through verbatim") lives in ONE place
 * the shared `<ToolbarSlider>` renderer calls.
 */

/**
 * Leniently parse a user-typed slider value:
 *  - trims surrounding whitespace,
 *  - accepts a comma as the decimal separator (European keyboards): `1,5` → 1.5,
 *  - accepts a Unicode minus sign `−` (U+2212, what the read-out formats with),
 *  - accepts a leading `+`.
 *
 * Returns the number, or `null` when the text is empty or does not parse to a
 * real number (so the caller can REVERT — a `NaN` is NEVER committed). There is
 * intentionally NO clamping: an out-of-range value is returned verbatim
 * (out-of-range is legal for these display-adjust sliders).
 *
 * INFINITY is accepted (`inf` / `infinity` / `∞`, any sign): the image pane's
 * PEAK slider treats `P = ∞` as "no ceiling" (raw browser-clipped extended),
 * which is a legal, meaningful entry. Only `NaN` / unparseable text reverts.
 */
export function parseSliderEntry(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Normalize display glyphs to ASCII: Unicode minus → '-', first comma → '.'.
  // (A single scalar value — no thousands grouping — so only the first comma is
  // treated as the decimal point.)
  const normalized = trimmed.replace(/−/g, "-").replace(",", ".");
  // Infinity tokens (case-insensitive): `inf`/`infinity`/`∞`, optional sign.
  const infMatch = /^([+-]?)(inf(?:inity)?|∞)$/i.exec(normalized);
  if (infMatch) return infMatch[1] === "-" ? -Infinity : Infinity;
  const n = Number(normalized);
  // Reject NaN (unparseable); ±Infinity from `Number("Infinity")` is allowed.
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * The commit rule the slider renderer applies when the user finishes editing
 * (Enter / blur): parse leniently and, on invalid input, REVERT to the current
 * value (never commit a `NaN`). Out-of-range input passes straight through.
 */
export function commitSliderEntry(raw: string, current: number): number {
  const parsed = parseSliderEntry(raw);
  return parsed === null ? current : parsed;
}

/**
 * The initial text to pre-fill the entry field with when editing begins — the
 * raw numeric value (ASCII), re-parseable by {@link parseSliderEntry}. NOT the
 * decorated read-out (which may carry a `+`/Unicode-minus and fixed decimals).
 */
export function sliderEntryDraft(value: number): string {
  return String(value);
}
