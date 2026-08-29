/**
 * Contract + re-divergence guard for the unified label chip (`LabelChip`). Like
 * `ref-badge.test.ts`, this asserts the contract at the SOURCE level (no DOM /
 * JSX import is configured in this package) and fails if any compare pane
 * re-introduces its own inline label chip instead of routing through the shared
 * component.
 *
 *   node --experimental-strip-types --test \
 *     src/primitives/components/label-chip.test.ts
 *
 * Background (the reported dedup bug): THREE divergent label chips existed — the
 * shared bottom-left `LabelChip`, `compositor.tsx`'s inline bottom-right span
 * (grip always, drag gated on a modifier), and `GpuComparePane.tsx`'s inline
 * bottom-right span (no grip). All now go through this ONE component; corner +
 * drag semantics are props.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const chip = read("primitives/components/LabelChip.tsx");

test("LabelChip: both corners + draggable + accessible grip contract", () => {
  // Both corners are supported by the ONE component (unification is one
  // component, not one corner).
  assert.match(chip, /bottom-1 left-1/, "must offer the bottom-left corner");
  assert.match(chip, /bottom-1 right-1/, "must offer the bottom-right corner");

  // The grip handle + drag class live ONLY here now (see the pane guard below).
  assert.match(chip, /fa-grip-vertical/, "grip icon must live in LabelChip");
  assert.match(chip, /cairn-drag-grip/, "drag-grip class must live in LabelChip");
  // Grip icon is decorative → aria-hidden (the old compositor copy omitted it).
  assert.match(
    chip,
    /fa-grip-vertical[\s\S]*?aria-hidden="true"/,
    "grip icon must be aria-hidden",
  );

  // Draggability drives the draggable attr + grab cursor.
  assert.match(chip, /draggable=\{isDraggable\}/, "draggable attr wired to the prop");
  assert.match(chip, /cursor:\s*isDraggable\s*\?/, "grab cursor gated on isDraggable");
});

// Every compare pane must render the SHARED chip and NOT hard-code its own
// inline label chip. The grip icon + drag-grip class are the tells of the old
// inline copies, so their absence outside LabelChip is the re-divergence guard.
const CONSUMERS = ["plots/image/runtime/compare-compositor.tsx", "plots/image/webgpu/view.tsx"];

test("every compare pane routes its label through the shared LabelChip", () => {
  for (const rel of CONSUMERS) {
    const src = read(rel);
    assert.match(src, /<LabelChip\b/, `${rel} must render <LabelChip>`);
    assert.doesNotMatch(
      src,
      /fa-grip-vertical/,
      `${rel} must not hard-code an inline grip icon (route through LabelChip)`,
    );
    assert.doesNotMatch(
      src,
      /cairn-drag-grip/,
      `${rel} must not hard-code the drag-grip class (route through LabelChip)`,
    );
  }
});

// Finding 2: the metrics chip's vertical offset must derive from the SAME value
// that renders the bottom-RIGHT (foreground) caption chip, so it can't silently
// drift. Both key off `compareCaps.right`; the metrics className references the
// derived `metricsBottomClass`, never an independent `bottom-7 : bottom-1` re-test.
// (Post content-op unification, Phase 4, this rides the unified `GpuImagePane`.)
test("the unified pane folds the metrics offset into the shared caption-stack flag", () => {
  const src = read("plots/image/webgpu/view.tsx");
  // The bottom-right caption chip presence and the metrics offset both key off
  // `compareCaps.right` (the one foreground-caption value).
  assert.match(
    src,
    /const metricsBottomClass = compareCaps\.right \?/,
    "metrics offset must derive from the same compareCaps.right value that renders the chip",
  );
  assert.match(
    src,
    /compareCaps\.right \?[\s(]*<LabelChip[^>]*corner="bottom-right"/,
    "the bottom-right caption chip is gated on the SAME compareCaps.right value",
  );
  assert.match(src, /\$\{metricsBottomClass\}/, "metrics span uses the derived offset");
  // No independent re-test of `label` for the offset (the silent-break shape).
  assert.doesNotMatch(
    src,
    /\blabel\s*\?\s*"bottom-7"/,
    "metrics offset must not independently re-test `label`",
  );
});
