/**
 * Contract + re-divergence guard for the unified `PaneUnavailable` placeholder.
 * Asserted at the SOURCE level (no DOM/JSX runner — see `ref-badge.test.ts`).
 *
 *   node --experimental-strip-types --test \
 *     src/primitives/components/pane-unavailable.test.ts
 *
 * Background: three divergent stylings described the SAME concept — a pane
 * whose required capability is missing: VolumeViewer's neutral placeholder,
 * compositor's RED `CompareFloatUnsupportedError` card, and CpuImagePane's
 * console.warn-only branch. These are capability FACTS, not errors, so they now
 * share ONE neutral-muted placeholder. (CpuImagePane is owned by another
 * workstream and is intentionally out of scope here.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const pane = read("primitives/components/PaneUnavailable.tsx");

test("PaneUnavailable: neutral-muted (not an error), title + body", () => {
  // Neutral, muted palette — never a red/error look (the old compositor card).
  assert.match(pane, /bg-bg-hover/, "neutral hover background");
  assert.match(pane, /text-fg-muted/, "muted body text");
  assert.doesNotMatch(pane, /text-red/, "must NOT use error-red styling");
  // Title + body contract.
  assert.match(pane, /\{title\}/, "renders a title");
  assert.match(pane, /\{body\}/, "renders a body");
});

// Every capability-fact placeholder in scope routes through PaneUnavailable and
// no longer paints its own bespoke styling.
const CONSUMERS = ["plots/three/backends/three/VolumeViewer.tsx", "plots/image/compare/compositor.tsx"];

test("VolumeViewer + compositor render the shared PaneUnavailable (no bespoke card)", () => {
  for (const rel of CONSUMERS) {
    const src = read(rel);
    assert.match(src, /<PaneUnavailable\b/, `${rel} must render <PaneUnavailable>`);
    assert.doesNotMatch(
      src,
      /text-red-400/,
      `${rel} must not paint a red error card for a capability fact`,
    );
    assert.doesNotMatch(
      src,
      /bg-bg-hover/,
      `${rel} must not hard-code the placeholder styling inline`,
    );
  }
});
