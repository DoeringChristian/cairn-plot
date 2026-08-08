/**
 * Unit tests for the pure TEV pixel-value font-size derivation.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/primitives/pixel-value-size.test.ts
 *
 * Two invariants: (1) within a frame the font height is uniform — a function of
 * the cell size, the channel count, and the ONE widest value in view (`refChars`),
 * never a given cell's own string, so "0" and "0.73496" render at the SAME size;
 * and (2) that size fits the widest value INSIDE its pixel (bug-1 regression:
 * long HDR floats used to overflow onto neighbouring pixels).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pixelValueFontHeight,
  pixelValueNumbersVisible,
  PIXEL_VALUE_CHAR_W_FRAC,
  PIXEL_VALUE_MAX_FONT_PX,
  PIXEL_VALUE_MIN_FONT_PX,
  PIXEL_VALUE_MIN_SCREEN_PX,
  PIXEL_VALUE_PAD_FRAC,
} from "./pixel-value-size.ts";

test("font height ignores the string — same size regardless of decimals", () => {
  // The signature literally has no string parameter, so the size is
  // string-independent by construction. Assert the size at a given cell size /
  // channel count is a single deterministic value (what "0" and "0.73496"
  // would both receive).
  const single = pixelValueFontHeight(40, 1);
  assert.equal(pixelValueFontHeight(40, 1), single); // "0"
  assert.equal(pixelValueFontHeight(40, 1), single); // "0.73496"
  assert.ok(single > 0);
});

test("scales monotonically with cell size, then clamps at the max", () => {
  assert.ok(pixelValueFontHeight(60, 1) > pixelValueFontHeight(30, 1));
  // Far past the clamp point the size saturates at the cap.
  assert.equal(pixelValueFontHeight(10000, 1), PIXEL_VALUE_MAX_FONT_PX);
  assert.ok(pixelValueFontHeight(40, 1) <= PIXEL_VALUE_MAX_FONT_PX);
});

test("a 3-line stack fits its vertical budget (line boxes ≤ cell height)", () => {
  // The stacked-line pitch is fontH * LINE_H_FRAC; three of them must not
  // exceed the cell's usable height — the constraint that keeps an RGB stack
  // inside its pixel at the zoom where numbers first appear.
  for (const scale of [30, 45, 80, 200]) {
    const fontH = pixelValueFontHeight(scale, 3);
    const stack = 3 * fontH * 1.15; // LINE_H_FRAC
    const usable = scale * (1 - 2 * 0.14); // PAD_FRAC
    assert.ok(stack <= usable + 1e-9, `stack ${stack} > usable ${usable} @${scale}`);
  }
});

test("more lines never yields a taller per-line font than fewer lines", () => {
  for (const scale of [30, 50, 120]) {
    assert.ok(pixelValueFontHeight(scale, 3) <= pixelValueFontHeight(scale, 1));
  }
});

// ── containment: the drawn value fits INSIDE its pixel (bug-1 regression) ────

/** Monospace width of an `n`-char line at font height `fontH`, the overlay's
 *  own width model (canvas lays out ui-monospace at ~CHAR_W_FRAC advance). */
const lineWidth = (fontH: number, n: number) => n * PIXEL_VALUE_CHAR_W_FRAC * fontH;

test("width sized to `refChars` keeps that many chars inside the cell", () => {
  // The whole point of the alignment fix: a value `refChars` chars wide, sized
  // by this function, must fit within the cell's usable width — never spill past
  // the pixel boundary onto a neighbour (which is what a fixed under-count did to
  // long HDR floats like "1.23e+2").
  for (const scale of [30, 40, 60, 120]) {
    for (const refChars of [1, 4, 5, 7, 9]) {
      for (const lc of [1, 3]) {
        const fontH = pixelValueFontHeight(scale, lc, refChars);
        const usable = scale * (1 - 2 * PIXEL_VALUE_PAD_FRAC);
        assert.ok(
          lineWidth(fontH, refChars) <= usable + 1e-9,
          `${refChars} chars width ${lineWidth(fontH, refChars)} > usable ${usable} @scale=${scale},lc=${lc}`,
        );
      }
    }
  }
});

test("longer values shrink the uniform font (so they stay contained)", () => {
  // Widening the reference can only REDUCE (never grow) the font — the guarantee
  // that a long value never overflows where a short one fit.
  assert.ok(pixelValueFontHeight(60, 1, 7) < pixelValueFontHeight(60, 1, 4));
  assert.ok(pixelValueFontHeight(60, 1, 4) <= pixelValueFontHeight(60, 1, 1));
});

test("`refChars` defaults to the reference count when omitted", () => {
  // Callers that only know a cell's channel count still get the documented
  // fallback (used by the visibility-coherence check), unchanged by the fix.
  assert.equal(pixelValueFontHeight(40, 1), pixelValueFontHeight(40, 1, 4));
});

test("degenerate cells return 0 (nothing drawn)", () => {
  assert.equal(pixelValueFontHeight(0, 1), 0);
  assert.equal(pixelValueFontHeight(-5, 1), 0);
  assert.equal(pixelValueFontHeight(40, 0), 0);
});

// ── visibility: ONE global threshold, never per-string ──────────────────────

test("visibility is a single scale threshold — string- AND channel-independent", () => {
  // The predicate's signature takes only `scale`: no string, no channel count.
  // So numbers appear/disappear all at once at one zoom level — the fix for
  // "short numbers pop in before long ones".
  const t = PIXEL_VALUE_MIN_SCREEN_PX;
  assert.equal(pixelValueNumbersVisible(t - 0.001), false); // threshold − ε: none
  assert.equal(pixelValueNumbersVisible(t), true); //           threshold: all
  assert.equal(pixelValueNumbersVisible(t + 0.001), true); //   threshold + ε: all
});

test("the single threshold governs BOTH single-value and 3-channel layouts", () => {
  // At exactly the visibility threshold the font height for the tallest
  // supported stack (3 lines) still clears the legibility minimum, so the
  // overlay's per-cell guard never fires for a supported layout — the ONE scale
  // test above is the whole story for both 1-line and 3-line panes; neither
  // appears a fraction of a zoom before the other.
  assert.ok(pixelValueFontHeight(PIXEL_VALUE_MIN_SCREEN_PX, 1) >= PIXEL_VALUE_MIN_FONT_PX);
  assert.ok(pixelValueFontHeight(PIXEL_VALUE_MIN_SCREEN_PX, 3) >= PIXEL_VALUE_MIN_FONT_PX);
});
