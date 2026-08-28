/**
 * Contract guard for the unified reference badge (`RefBadge`). No test runner /
 * DOM is configured in this package (see capability-notice.test.ts) and the
 * component is JSX (can't be imported under `--experimental-strip-types`), so
 * this asserts the contract at the SOURCE level — which also makes it a
 * re-divergence guard: it fails if any compare pane re-introduces its own REF
 * chip instead of rendering the shared `RefBadge`.
 *
 *   node --experimental-strip-types --test \
 *     src/primitives/components/ref-badge.test.ts
 *
 * Background: three divergent REF markers used to exist — an accent TOP-LEFT
 * span (image split/slide, duplicated in compositor + GpuComparePane) and a
 * gray BOTTOM-LEFT `LabelChip label="REF"` (image `side` mode AND every 3D
 * compare viewport). Different corner + different look = the reported bug. All
 * now go through `RefBadge` (top-left, accent).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const badge = read("primitives/components/RefBadge.tsx");

test("RefBadge: single top-left, accent-tinted, pointer-transparent contract", () => {
  // The exported class constant is the ONE source of truth for styling+position.
  const m = badge.match(/REF_BADGE_CLASS\s*=\s*\n?\s*"([^"]+)"/);
  assert.ok(m, "REF_BADGE_CLASS string literal must be present");
  const cls = m![1];

  // TOP-LEFT — the corner every mode now shares (the slide behavior).
  assert.match(cls, /\btop-1\b/, "badge must be pinned to the top");
  assert.match(cls, /\bleft-1\b/, "badge must be pinned to the left");
  // Never bottom-anchored — that was the old `side`/3D divergence.
  assert.doesNotMatch(cls, /\bbottom-/, "badge must NOT be bottom-anchored");

  // Accent-tinted (distinct from the gray `LabelChip` — bg-bg/80 text-fg-muted).
  assert.match(cls, /bg-accent\/20/, "badge background must be accent-tinted");
  assert.match(cls, /text-accent/, "badge text must be accent-colored");

  // Passive marker: must not intercept pointer events on the pane beneath it.
  assert.match(cls, /pointer-events-none/, "badge must be pointer-transparent");

  // Label text.
  assert.match(badge, /REF_BADGE_TEXT\s*=\s*"REF"/, "badge text must be 'REF'");
});

// Every compare pane must render the SHARED component and NOT hard-code its own
// REF chip. `wants` = files that render a reference marker; each must reference
// `RefBadge` and must not contain a competing inline REF label/span.
const CONSUMERS = [
  "plots/image/compare/compositor.tsx",
  "plots/image/backends/webgpu.tsx",
  "plots/image/backends/canvas.tsx",
];

test("every compare pane renders the shared RefBadge (no divergent REF chip)", () => {
  for (const rel of CONSUMERS) {
    const src = read(rel);
    assert.match(src, /<RefBadge\s*\/>/, `${rel} must render <RefBadge />`);
    // No `LabelChip label="REF"` — the old gray bottom-left marker.
    assert.doesNotMatch(
      src,
      /label\s*=\s*"REF"/,
      `${rel} must not hard-code a "REF" label chip`,
    );
    // No bespoke `>REF<` span text (the old accent inline copy).
    assert.doesNotMatch(
      src,
      />\s*REF\s*</,
      `${rel} must not hard-code an inline REF span`,
    );
  }
});
