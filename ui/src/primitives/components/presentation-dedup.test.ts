/**
 * Contract + re-divergence guard for the two shared 3D-viewport chrome
 * primitives — `ContentCaption` (the per-pane metadata caption) and
 * `PanePlaceholder` (the empty/loading/error non-content states). No test
 * runner / DOM is configured in this package (see capability-notice.test.ts)
 * and the components are JSX (can't be imported under
 * `--experimental-strip-types`), so this asserts the contract at the SOURCE
 * level — which also makes it a re-divergence guard: it fails if any viewport
 * re-introduces its own inline caption/placeholder markup instead of rendering
 * the shared primitive.
 *
 *   node --experimental-strip-types --test \
 *     src/primitives/components/viewport-dedup.test.ts
 *
 * Background: the caption chip was copied byte-for-byte 3× (mesh/boxes/volume)
 * and MISSING entirely from pointcloud (a user-visible gap); the three
 * placeholder states were copy-pasted ~20× across the four files, with a real
 * inconsistency (the reference-side "empty" state dropped `w-full`, so it
 * centered differently). Both are now single-owner primitives.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const VIEWPORTS = [
  "plots/three/presentations/mesh.tsx",
  "plots/three/presentations/pointcloud.tsx",
  "plots/three/presentations/boxes.tsx",
  "plots/three/presentations/volume.tsx",
];

test("ContentCaption: single-owner caption class contract", () => {
  const src = read("primitives/components/ContentCaption.tsx");
  const m = src.match(/VIEWPORT_CAPTION_CLASS\s*=\s*\n?\s*"([^"]+)"/);
  assert.ok(m, "VIEWPORT_CAPTION_CLASS string literal must be present");
  const cls = m![1];
  // Top-left passive overlay (never bottom — that corner is the LabelChip's).
  assert.match(cls, /\btop-1\b/, "caption must be pinned to the top");
  assert.match(cls, /\bleft-1\b/, "caption must be pinned to the left");
  assert.doesNotMatch(cls, /\bbottom-/, "caption must NOT be bottom-anchored");
  // Gray monospace chip, pointer-transparent so it never blocks orbit/drag.
  assert.match(cls, /\bmono\b/, "caption must be monospace");
  assert.match(cls, /text-fg-subtle/, "caption text must be fg-subtle");
  assert.match(cls, /pointer-events-none/, "caption must be pointer-transparent");
});

test("PanePlaceholder: single-owner placeholder classes, w-full always", () => {
  const src = read("primitives/components/PanePlaceholder.tsx");
  // Every variant must be full-width — the centering-inconsistency fix (the
  // old reference-side "empty" dropped w-full).
  const classLits = src.match(/`\$\{BASE\}[^`]*`/g) ?? [];
  assert.ok(classLits.length >= 3, "all three variant classes must be present");
  const base = src.match(/BASE\s*=\s*"([^"]+)"/);
  assert.ok(base, "shared BASE class must be present");
  assert.match(base![1], /\bw-full\b/, "BASE must include w-full (centering fix)");
  assert.match(base![1], /\bh-full\b/, "BASE must include h-full");
  assert.match(base![1], /items-center/, "BASE must center vertically");
  assert.match(base![1], /justify-center/, "BASE must center horizontally");
  // The three named variants exist.
  for (const v of ["empty", "loading", "error"]) {
    assert.match(src, new RegExp(`\\b${v}:`), `variant "${v}" must be declared`);
  }
  // Loading pulses; error is the boxed/padded/centered-text state.
  assert.match(src, /motion-safe:animate-pulse/, "loading variant must pulse");
  assert.match(src, /p-4 text-center/, "error variant must be padded + centered");
});

test("every 3D viewport renders ContentCaption (closes the pointcloud gap)", () => {
  for (const rel of VIEWPORTS) {
    const src = read(rel);
    assert.match(src, /<ContentCaption\b/, `${rel} must render <ContentCaption />`);
  }
});

test("every 3D viewport renders PanePlaceholder (no inline placeholders)", () => {
  for (const rel of VIEWPORTS) {
    const src = read(rel);
    assert.match(src, /<PanePlaceholder\b/, `${rel} must render <PanePlaceholder />`);
  }
});

test("no 3D viewport re-declares the caption class inline", () => {
  // The caption chip's unmistakable class signature — the gray monospace
  // backdrop-blurred chip. If it appears verbatim in a viewport, someone
  // re-inlined it instead of using ContentCaption.
  for (const rel of VIEWPORTS) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /text-fg-subtle backdrop-blur-sm/,
      `${rel} must not re-declare the caption class inline (use ContentCaption)`,
    );
  }
});

test("no 3D viewport re-declares the placeholder classes inline", () => {
  for (const rel of VIEWPORTS) {
    const src = read(rel);
    // The loading-pulse and boxed-error signatures.
    assert.doesNotMatch(
      src,
      /motion-safe:animate-pulse/,
      `${rel} must not re-declare the loading placeholder inline (use PanePlaceholder)`,
    );
    assert.doesNotMatch(
      src,
      /bg-bg p-4 text-center text-sm text-fg-muted/,
      `${rel} must not re-declare the error placeholder inline (use PanePlaceholder)`,
    );
    // The bare empty-state signature (centered gray sm text with no viewer).
    assert.doesNotMatch(
      src,
      /items-center justify-center text-sm text-fg-muted/,
      `${rel} must not re-declare the empty placeholder inline (use PanePlaceholder)`,
    );
  }
});
