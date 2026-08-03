/**
 * Contract + re-divergence guard for the unified label chip (`LabelChip`). Like
 * `ref-badge.test.ts`, this asserts the contract at the SOURCE level (no DOM /
 * JSX import is configured in this package) and fails if any compare pane
 * re-introduces its own inline label chip instead of routing through the shared
 * component.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/primitives/label-chip.test.ts
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
const LIB = join(HERE, ".."); // src/lib/cairn-plot
const read = (rel: string) => readFileSync(join(LIB, rel), "utf8");

const chip = read("primitives/LabelChip.tsx");

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
const CONSUMERS = ["media-compare/compositor.tsx", "media-compare/GpuComparePane.tsx"];

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

// Finding 2: the metrics chip's vertical offset must derive from the SAME flag
// that renders the bottom-right label chip, so it can't silently drift. The
// label presence and the offset both key off `labelChipPresent`; the metrics
// className must reference the derived `metricsBottomClass`, never an
// independent `label ? "bottom-7" : "bottom-1"` re-test.
test("GpuComparePane folds the metrics offset into the shared chip-stack flag", () => {
  const src = read("media-compare/GpuComparePane.tsx");
  assert.match(
    src,
    /const labelChipPresent = !!label;/,
    "one source of truth for the label chip's presence",
  );
  assert.match(
    src,
    /const metricsBottomClass = labelChipPresent \?/,
    "metrics offset must derive from labelChipPresent",
  );
  assert.match(src, /\$\{metricsBottomClass\}/, "metrics span uses the derived offset");
  // No independent re-test of `label` for the offset (the silent-break shape).
  assert.doesNotMatch(
    src,
    /label\s*\?\s*"bottom-7"/,
    "metrics offset must not independently re-test `label`",
  );
});
