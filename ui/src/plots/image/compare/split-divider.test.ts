/**
 * Contract + re-divergence guard for the extracted `SplitDivider`. Asserted at
 * the SOURCE level (no DOM/JSX runner in this package — see `ref-badge.test.ts`).
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/compare/split-divider.test.ts
 *
 * Background: the compare panes carried a byte-for-byte copy of the divider
 * element AND its ~20-line pointer-capture drag handler, and the copies had
 * begun to diverge. They now consume this one component; the correct dbl-click
 * behavior (`stopPropagation`, so it never also triggers the pane's own view
 * reset) lives here once. Post content-op unification (Phase 4) the split-mode
 * panes are the unified GPU pane (`../../plots/image/webgpu/view.tsx`) and the CPU
 * split/blend fallback (`media-runtime/compare-compositor.tsx`'s `MediaComparePane`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), "utf8");

const divider = read("SplitDivider.tsx");

test("SplitDivider owns the element, the drag handler and the correct dbl-click", () => {
  // The divider element (its CSS class) lives here.
  assert.match(divider, /cairn-plot-split-divider/, "must render the divider element");
  // The pointer-capture drag handler lives here (moved out of both panes).
  assert.match(divider, /setPointerCapture/, "must own the pointer-capture drag");
  assert.match(divider, /addEventListener\("pointermove"/, "must own the drag move wiring");
  // Correct dbl-click behavior: reset ONLY the split — stopPropagation so it
  // doesn't ALSO fire the pane's own dbl-click view reset beneath it.
  assert.match(
    divider,
    /onDoubleClick=\{\(e\) => \{[\s\S]*?e\.stopPropagation\(\);[\s\S]*?onReset\?\.\(\)/,
    "dbl-click must stopPropagation then onReset (the unified, correct behavior)",
  );
  // Props contract: splitPosition / onChange / onReset.
  assert.match(divider, /splitPosition/, "prop: splitPosition");
  assert.match(divider, /onChange\?/, "prop: onChange");
  assert.match(divider, /onReset\?/, "prop: onReset");
});

// One SplitDivider consumer contract: every split-mode pane renders <SplitDivider>
// and NO pane keeps its own inline divider. The `cairn-plot-split-divider` class
// now appears ONLY in SplitDivider.tsx across the whole media-compare surface.
const CONSUMERS = ["../runtime/compare-compositor.tsx", "../webgpu/view.tsx"];

test("both compare panes consume the shared SplitDivider (no inline copy)", () => {
  for (const rel of CONSUMERS) {
    const src = read(rel);
    assert.match(src, /<SplitDivider\b/, `${rel} must render <SplitDivider>`);
    assert.doesNotMatch(
      src,
      /cairn-plot-split-divider/,
      `${rel} must not hard-code an inline split divider`,
    );
    assert.doesNotMatch(
      src,
      /setPointerCapture/,
      `${rel} must not re-implement the divider drag handler`,
    );
  }
});
