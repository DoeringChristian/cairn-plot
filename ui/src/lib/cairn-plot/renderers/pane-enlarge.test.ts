/**
 * Contract guard for the ENLARGE (fullscreen overlay) feature on the shared
 * `ImagePaneShell` (so every image + compare pane inherits it).
 *
 * Like `toolbar-seam.test.ts` / `pixel-overlay-stacking.test.ts`, no DOM is
 * configured here (JSX can't be imported under `--experimental-strip-types`),
 * so the runtime behaviour is proven by `__tests__/pane-enlarge.browser.ts`.
 * This asserts, at the SOURCE level, the invariants that keep the feature
 * correct and non-regressing:
 *   1. the overlay is body-portaled, fixed, high-z and its OWN stacking context
 *      (`isolate`) — "on top of everything" done right;
 *   2. it closes on Escape AND a backdrop click, with a visible ✕ button;
 *   3. the pane subtree is portaled into ONE stable host that is reparented (not
 *      remounted), so the canvas/GPU context survives enter/exit;
 *   4. the enlarge button rides the toolbar seam (absent under toolbar={false},
 *      like every other toolbar button).
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/pane-enlarge.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, ".."); // src/lib/cairn-plot
const read = (rel: string) => readFileSync(join(LIB, rel), "utf8");

const shell = read("renderers/ImagePaneShell.tsx");
const toolbar = read("primitives/PlotToolbar.tsx");

test("overlay is portaled to document.body (above all host chrome)", () => {
  assert.match(shell, /import \{ createPortal \} from "react-dom"/);
  assert.match(
    shell,
    /createPortal\(\s*[\s\S]*?document\.body,\s*\)/,
    "the enlarge overlay must be portaled into document.body",
  );
});

test("overlay backdrop is fixed, high-z and its own stacking context", () => {
  // Structural geometry is INLINE (so it beats any host CSS): the backdrop <div>
  // open (up to its marker attr) carries fixed + inset + isolate + a very high
  // z-index in its style object.
  const open = /<div\b[\s\S]*?data-cairn-plot-enlarge-backdrop=""/.exec(shell)?.[0] ?? "";
  assert.match(open, /position:\s*"fixed"/, "backdrop must be position:fixed");
  assert.match(open, /inset:\s*0/, "backdrop must cover the viewport (inset:0)");
  assert.match(open, /isolation:\s*"isolate"/, "backdrop must establish its own stacking context");
  assert.match(open, /zIndex:\s*\d{7,}/, "backdrop must use a very high z-index");
});

test("overlay closes on Escape, ✕ button, and a backdrop click", () => {
  // Escape handler (only while enlarged) sets enlarged false.
  assert.match(shell, /e\.key === "Escape"[\s\S]{0,80}setEnlarged\(false\)/);
  // Visible close button.
  assert.match(shell, /aria-label="Exit fullscreen \(Esc\)"/);
  // Backdrop click (target === currentTarget) closes.
  assert.match(shell, /e\.target === e\.currentTarget[\s\S]{0,40}setEnlarged\(false\)/);
});

test("focus is restored to the trigger on close", () => {
  assert.match(shell, /prevFocusRef\.current = /);
  assert.match(shell, /prev\.focus\?\.\(\)/);
});

test("Bug 3: page scroll-root is locked while enlarged and restored on close", () => {
  // Lock the real scroll root (document.scrollingElement) — set overflow hidden
  // while open, restore on cleanup.
  assert.match(shell, /document\.scrollingElement/);
  assert.match(shell, /scroller\.style\.overflow = "hidden"/);
  assert.match(shell, /scroller\.style\.overflow = prevOverflow/);
  // Must NOT blanket-preventDefault wheel (that swallowed in-overlay scrolling,
  // e.g. the diff-mode menu) — no wheel listener that cancels the event.
  assert.doesNotMatch(shell, /addEventListener\(\s*["']wheel["']/);
});

test("Bug 4: the ✕ close button lives in the backdrop, OUTSIDE the pane frame", () => {
  // The frame closes (`</div>` after the overlay mount) BEFORE the ✕ button —
  // i.e. the button is a child of the backdrop, not the frame.
  const closeIdx = shell.indexOf('data-cairn-plot-enlarge-close');
  const frameIdx = shell.indexOf('data-cairn-plot-enlarge-frame');
  const overlayMountIdx = shell.indexOf('ref={overlayMountRef}');
  assert.ok(closeIdx > frameIdx, "the ✕ is declared after the frame element");
  assert.ok(closeIdx > overlayMountIdx, "the ✕ is declared after the pane's overlay mount (outside the frame)");
  assert.match(shell, /data-cairn-plot-enlarge-close=""/);
});

test("the pane subtree is reparented, not remounted (canvas/context survives)", () => {
  // One stable content host created imperatively and portaled into ONCE.
  assert.match(shell, /contentHostRef\.current = el/);
  assert.match(shell, /createPortal\(shellRoot, contentHostRef\.current\)/);
  // Reparent is an appendChild MOVE between the inline slot and the overlay.
  assert.match(shell, /target\.appendChild\(host\)/);
});

test("transitions respect prefers-reduced-motion (motion-safe)", () => {
  assert.match(shell, /motion-safe:/);
});

test("enlarge button rides the toolbar seam (leading button)", () => {
  // Added to the toolbar's leadingButtons (so it is absent under toolbar={false}
  // exactly like the other buttons).
  assert.match(shell, /leadingButtons:\s*\[\s*enlargeButton,/);
  // Uses the expand/compress icons registered in the toolbar.
  assert.match(shell, /icon: enlarged \? "compress" : "expand"/);
  assert.match(toolbar, /expand:/);
  assert.match(toolbar, /compress:/);
});
