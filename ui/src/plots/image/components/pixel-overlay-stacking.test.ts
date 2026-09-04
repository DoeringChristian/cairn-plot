/**
 * Regression guard: the TEV pixel-value overlay must not paint over the
 * embedding host's chrome (the reported "numbers on top of the sticky header"
 * bug). The overlay is a `z-10` <canvas> absolutely positioned inside the pane;
 * for that z-index to stay LOCAL — unable to compete with a host sticky header —
 * the pane root must establish its OWN stacking context (`isolation: isolate`).
 *
 * No DOM/renderer is configured in this package (JSX can't be imported under
 * `--experimental-strip-types` — see toolbar-seam.test.ts), so this asserts the
 * contract at the SOURCE level: every pane root that hosts the overlay carries
 * `isolate`, and the overlay's own z-index stays small (never a huge value that
 * would defeat isolation or leak in a host that itself only isolates loosely).
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/components/pixel-overlay-stacking.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const shell = read("plots/image/components/ImagePaneShell.tsx");
const compositor = read("plots/image/runtime/compare-compositor.tsx");
const overlay = read("primitives/components/PixelValueOverlay.tsx");

// There is now exactly ONE pane root: `ImagePaneShell`. Every single-image AND
// every compare pane (split included) renders through it, on both image
// backends; `compare-compositor.tsx` is a backend ADAPTER that emits no DOM of
// its own. The shell opens with `relative … flex flex-col h-full` on its
// outermost <div>; the guard is that `isolate` sits in that same class list.
test("ImagePaneShell root establishes a stacking context (isolate)", () => {
  assert.match(
    shell,
    /className=\{`relative isolate flex flex-col h-full/,
    "ImagePaneShell's pane root must carry `isolate` so the z-10 overlay canvas cannot paint over host chrome",
  );
});

test("the compare compositor renders no pane root of its own", () => {
  // Re-divergence guard: if the compositor ever grows its own pane markup again
  // it would need its own `isolate` — and a second split implementation with it.
  assert.doesNotMatch(
    compositor,
    /className="relative/,
    "compare-compositor.tsx must stay a backend adapter (no pane root markup)",
  );
});

test("the overlay canvas keeps a SMALL, local z-index (<= 20)", () => {
  // A large z-index (z-50, z-[999], inline zIndex) would defeat the point of
  // isolating the pane and could still leak in a host that isolates loosely.
  const canvasClass = /<canvas[^>]*className="([^"]*)"/s.exec(overlay)?.[1] ?? "";
  assert.ok(canvasClass.includes("z-10"), `overlay canvas should stay z-10, got: ${canvasClass}`);
  // No z-30/z-40/z-50 or arbitrary z-[…] on the overlay canvas.
  assert.doesNotMatch(canvasClass, /z-(30|40|50)\b|z-\[/);
  // And no inline zIndex escape hatch anywhere in the overlay component.
  assert.doesNotMatch(overlay, /zIndex/);
});
