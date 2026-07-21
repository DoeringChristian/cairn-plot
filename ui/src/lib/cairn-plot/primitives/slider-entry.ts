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
 * Returns the finite number, or `null` when the text is empty or does not parse
 * to a finite number (so the caller can REVERT — a `NaN`/`Infinity` is NEVER
 * committed). There is intentionally NO clamping: an out-of-range value is
 * returned verbatim (out-of-range is legal for these display-adjust sliders).
 */
export function parseSliderEntry(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Normalize display glyphs to ASCII: Unicode minus → '-', first comma → '.'.
  // (A single scalar value — no thousands grouping — so only the first comma is
  // treated as the decimal point.)
  const normalized = trimmed.replace(/−/g, "-").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
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
