/**
 * `ImagePaneShell` ENLARGE (fullscreen overlay) — LIVE browser harness.
 *
 * The enlarge button promotes a pane to a `document.body`-portaled, fixed,
 * full-viewport overlay so a single image can be inspected in detail; ✕ /
 * Escape / a backdrop click return it inline. The pane's DOM (its `<canvas>`)
 * is MOVED into the overlay via an `appendChild` reparent — never remounted —
 * so a WebGPU/2D canvas keeps its GL/GPU context + backing store (no blank/
 * black pane, no context-loss). This harness proves that at runtime.
 *
 * jsdom has no layout (getComputedStyle position/isolation, real rects), so —
 * like every `*.browser.ts` here — this is a Chromium page, not a unit test.
 * It is SELF-DRIVING (it dispatches its own click + Escape), so unlike the
 * gesture-dependent interaction harnesses it completes headless; run it with:
 *
 *   npm run test:harness -- --all --only pane-enlarge
 *
 * It mounts an HDR `CpuImagePane` (a real 2D `<canvas>`, no WebGPU/wasm) — the
 * enlarge path is entirely in the SHARED `ImagePaneShell`, so this exercises the
 * exact same code every pane (CPU/GPU image + GPU compare) inherits, against a
 * real, non-blank canvas. The WebGPU pane's identical behaviour (canvas context
 * surviving the reparent) is verified interactively in a foreground browser.
 *
 * CASES:
 *   1. The enlarge toolbar button mounts; the pane canvas renders non-blank.
 *   2. Clicking enlarge creates a body-level FIXED overlay with a high z-index
 *      and its own `isolation: isolate` stacking context, sized to ~the
 *      viewport, CONTAINING the very same pane canvas (moved, not recreated),
 *      still non-blank (⇒ no context loss).
 *   3. Escape removes the overlay; the pane resumes inline with a non-blank
 *      canvas. A backdrop click also closes (re-open, click backdrop).
 *   4. No console.error during the whole run.
 *
 * The generated `.browser.bundle.js` is NOT committed (gitignored) — the
 * runner regenerates it via esbuild (`--jsx=automatic`, same gotcha as the
 * sibling harnesses).
 */
import { floatValues } from "../../../plots/image/runtime/pixel-buffer.ts";
import React from "react";
import { createRoot } from "react-dom/client";
// The enlarge feature lives entirely in the SHARED `ImagePaneShell` (every image
// + compare pane renders through it), so it is exercised faithfully via the
// lightweight `CpuImagePane` — no WebGPU/wasm/worker imports, so the module
// graph evaluates cleanly under the runner's headless, cross-origin-isolated
// context (unlike the heavy `GpuImagePane` graph, which is human-run). A 2D
// canvas ALSO loses its backing store if remounted, so the "canvas survives the
// reparent" proof is just as meaningful here; the WebGPU pane is verified
// interactively in a foreground browser.
import CpuImagePane from "../../../plots/image/cpu/view";
import { hdrSource, type FloatImageData } from "../../../plots/image/runtime/contracts";
import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
import { reframeViewForResize } from "../../../plots/image/runtime/reframe-view";
import { createHarness, sleep, waitFor } from "../../harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({ title: "PANE ENLARGE" });

const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};

// A small 4x4 grayscale HDR gradient (scene-linear), includes values >1.0.
function buildHdr(): FloatImageData {
  const values = [0.0, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 0.05, 0.3, 0.6, 0.9, 1.2, 1.8, 2.5, 3.0];
  return { pixels: floatValues(new Float32Array(values)), shape: [4, 4], dtype: "<f4" };
}

/** Read back a canvas's CURRENT bitmap via createImageBitmap (works for a
 *  webgpu- OR 2d-context canvas, unlike calling getContext("2d") on it). */
async function readbackCanvas(canvas: HTMLCanvasElement): Promise<ImageData | null> {
  if (canvas.width === 0 || canvas.height === 0) return null;
  const bitmap = await createImageBitmap(canvas);
  const tmp = document.createElement("canvas");
  tmp.width = bitmap.width;
  tmp.height = bitmap.height;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, tmp.width, tmp.height);
}

function isNonBlank(img: ImageData | null): boolean {
  if (!img) return false;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] !== 0 || img.data[i + 1] !== 0 || img.data[i + 2] !== 0) return true;
  }
  return false;
}

async function waitNonBlank(canvas: HTMLCanvasElement, timeoutMs = 6000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isNonBlank(await readbackCanvas(canvas))) return true;
    await sleep(50);
  }
  return false;
}

function paneCanvas(scope: ParentNode): HTMLCanvasElement | null {
  // The pane's surface canvas (GPU: [data-gpu-image-canvas]; CPU HDR fallback:
  // a plain <canvas>). Prefer the marked GPU canvas, else the first canvas that
  // is NOT the TEV pixel-value overlay canvas.
  const gpu = scope.querySelector("canvas[data-gpu-image-canvas]") as HTMLCanvasElement | null;
  if (gpu) return gpu;
  return scope.querySelector("canvas") as HTMLCanvasElement | null;
}

async function run(): Promise<boolean> {
  let ok = true;
  // Wide enough that the toolbar stays EXPANDED (not folded into the "⋯"
  // overflow), so the enlarge button is directly present — representative of a
  // real pane one would enlarge.
  const container = document.createElement("div");
  container.id = "harness-enlarge";
  container.style.width = "1000px";
  container.style.height = "680px";
  container.style.background = "#222";
  // EMBEDDER theme scope on a CONTAINER (not <html>): the theme cannot be
  // inherited by the body-portaled enlarge overlay, so it must be carried over
  // by the shared themed-portal helper. Define DARK tokens here and assert the
  // enlarged frame follows them (below).
  container.classList.add("cairn-plot-doc");
  container.setAttribute("data-theme", "dark");
  container.style.colorScheme = "dark";
  for (const [k, v] of Object.entries({
    "--color-bg": "#0d1117", "--color-bg-rgb": "13 17 23",
    "--color-bg-elevated": "#161b22", "--color-bg-elevated-rgb": "22 27 34",
    "--color-fg": "#e6edf3", "--color-fg-rgb": "230 237 243",
    "--color-border": "#30363d", "--color-border-rgb": "48 54 61",
  })) container.style.setProperty(k, v);
  document.body.appendChild(container);
  // A tall spacer so the document is genuinely scrollable — makes the Bug 3
  // page-scroll-lock assertion meaningful (a wheel COULD move the page if the
  // overlay did not lock it).
  const spacer = document.createElement("div");
  spacer.style.height = "3000px";
  document.body.appendChild(spacer);
  const scroller = (document.scrollingElement as HTMLElement | null) ?? document.body;
  const prevScrollerOverflow = scroller.style.overflow;

  let latestViewport: ImageViewState = { zoom: 1, pan: { x: 0, y: 0 } };
  // Externally-driven viewport setter (registered by the Harness) so the Bug 5
  // resize test can put the pane into a KNOWN zoomed/panned state. Seeded with a
  // no-op so it is always callable.
  const vpControl: { set: (v: ImageViewState) => void } = { set: () => {} };
  const hdr = buildHdr();
  const root = createRoot(container);

  function Harness() {
    const [viewport, setView] = React.useState<ImageViewState>(latestViewport);
    vpControl.set = (v: ImageViewState) => {
      latestViewport = v;
      setView(v);
    };
    return h(CpuImagePane, {
      source: hdrSource(hdr),
      tonemap: "srgb",
      exposure: 0.5,
      zoom: viewport.zoom,
      pan: viewport.pan,
      onViewChange: (v: ImageViewState) => {
        latestViewport = v;
        setView(v);
      },
      label: "enlarge-test",
    });
  }
  root.render(h(Harness));

  // --- Case 1: enlarge button + a non-blank inline canvas ------------------
  const btnFound = await waitFor(
    () => !!container.querySelector('button[aria-label="Enlarge (fullscreen)"]'), 6000, 20);
  report(btnFound, "enlarge toolbar button mounts");
  ok = ok && btnFound;
  if (!btnFound) {
    root.unmount();
    container.remove();
    return false;
  }

  const canvasFound = await waitFor(() => !!paneCanvas(container), 6000, 20);
  report(canvasFound, "pane canvas mounts inline");
  ok = ok && canvasFound;
  const inlineCanvas = paneCanvas(container)!;

  const inlineNonBlank = await waitNonBlank(inlineCanvas);
  report(inlineNonBlank, "inline pane canvas renders non-blank");
  ok = ok && inlineNonBlank;

  // --- Bug 5: the world texel at the viewport CENTER (and its on-screen size)
  // is preserved when the pane's container box changes. Drive the pane to a
  // KNOWN zoomed/panned state, then grow + shrink the container and assert the
  // shell's emitted viewport equals the center-preserving reframe, with the
  // on-screen texel size `zoom * homeScale(box)` unchanged. Deterministic math,
  // driven by a REAL layout change + the pane's own ResizeObserver. ----------
  {
    const NW = 4, NH = 4; // buildHdr() is a 4×4 source
    const homeScale = (w: number, hgt: number) => Math.min(w / NW, hgt / NH);
    const vpBox = () =>
      (container.querySelector("[data-cpu-image-surface]") as HTMLElement).getBoundingClientRect();
    const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

    // Put the pane into a zoomed + panned state and let React commit.
    vpControl.set({ zoom: 2.5, pan: { x: -40, y: 30 } });
    await sleep(120);
    const oldBox = vpBox();
    const oldVp = { zoom: latestViewport.zoom, pan: { ...latestViewport.pan } };
    const oldP = oldVp.zoom * homeScale(oldBox.width, oldBox.height);

    // GROW the container (both axes, different aspect) and wait for the RO-driven
    // reframe to emit a new viewport.
    container.style.width = "1400px";
    container.style.height = "560px";
    const grew = await waitFor(
      () => latestViewport.zoom !== oldVp.zoom || latestViewport.pan.x !== oldVp.pan.x,
      3000,
    );
    await sleep(60);
    const newBox = vpBox();
    const expect = reframeViewForResize(oldVp, { width: oldBox.width, height: oldBox.height }, { width: newBox.width, height: newBox.height }, NW, NH);
    const newP = latestViewport.zoom * homeScale(newBox.width, newBox.height);
    const centerHeld =
      grew &&
      near(latestViewport.zoom, expect.zoom, 1e-3) &&
      near(latestViewport.pan.x, expect.pan.x, 0.75) &&
      near(latestViewport.pan.y, expect.pan.y, 0.75);
    report(
      centerHeld,
      `grow: center-preserving reframe (pan ${latestViewport.pan.x.toFixed(1)},${latestViewport.pan.y.toFixed(1)} ` +
        `vs expected ${expect.pan.x.toFixed(1)},${expect.pan.y.toFixed(1)})`,
    );
    const scaleHeld = near(newP, oldP, 1e-3);
    report(scaleHeld, `grow: on-screen texel size preserved (${oldP.toFixed(4)} -> ${newP.toFixed(4)} px/texel)`);
    ok = ok && centerHeld && scaleHeld;

    // SHRINK back and assert the same invariants (round-trip on both axes).
    const midVp = { zoom: latestViewport.zoom, pan: { ...latestViewport.pan } };
    const midBox = vpBox();
    container.style.width = "1000px";
    container.style.height = "680px";
    const shrank = await waitFor(
      () => latestViewport.zoom !== midVp.zoom || latestViewport.pan.x !== midVp.pan.x,
      3000,
    );
    await sleep(60);
    const backBox = vpBox();
    const expectBack = reframeViewForResize(midVp, { width: midBox.width, height: midBox.height }, { width: backBox.width, height: backBox.height }, NW, NH);
    const backP = latestViewport.zoom * homeScale(backBox.width, backBox.height);
    const centerHeld2 =
      shrank &&
      near(latestViewport.zoom, expectBack.zoom, 1e-3) &&
      near(latestViewport.pan.x, expectBack.pan.x, 0.75) &&
      near(latestViewport.pan.y, expectBack.pan.y, 0.75);
    report(centerHeld2, "shrink: center-preserving reframe holds (round-trip)");
    const scaleHeld2 = near(backP, oldP, 1e-2);
    report(scaleHeld2, `shrink: texel size back to the original (${backP.toFixed(4)} vs ${oldP.toFixed(4)} px/texel)`);
    ok = ok && centerHeld2 && scaleHeld2;

    // Reset to HOME for the rest of the harness (enlarge cases).
    vpControl.set({ zoom: 1, pan: { x: 0, y: 0 } });
    await sleep(60);
  }

  // --- Case 2: click enlarge -> body-level fixed/high-z/isolate overlay ----
  const enlargeBtn = container.querySelector(
    'button[aria-label="Enlarge (fullscreen)"]',
  ) as HTMLButtonElement;
  enlargeBtn.click();

  const overlayAppeared = await waitFor(
    () => !!document.querySelector("[data-cairn-plot-enlarge-backdrop]"), 6000, 20);
  report(overlayAppeared, "clicking enlarge creates the overlay");
  ok = ok && overlayAppeared;
  if (!overlayAppeared) {
    root.unmount();
    container.remove();
    return false;
  }

  const backdrop = document.querySelector("[data-cairn-plot-enlarge-backdrop]") as HTMLElement;
  const atBody = backdrop.parentElement === document.body;
  report(atBody, "overlay is portaled to document.body");
  ok = ok && atBody;

  const cs = getComputedStyle(backdrop);
  const isFixed = cs.position === "fixed";
  report(isFixed, `overlay backdrop is position:fixed (got ${cs.position})`);
  ok = ok && isFixed;

  const zHigh = Number(cs.zIndex) >= 1000;
  report(zHigh, `overlay has a high z-index (got ${cs.zIndex})`);
  ok = ok && zHigh;

  const isIsolated = cs.isolation === "isolate";
  report(isIsolated, `overlay establishes its own stacking context (isolation: ${cs.isolation})`);
  ok = ok && isIsolated;

  // Theme follows the ORIGIN pane: the container is DARK-scoped, so the
  // body-portaled overlay must carry the dark tokens. The centered frame uses
  // `bg-bg-elevated`; assert its computed background is the DARK elevated token
  // (22 27 34) — the shared themed-portal helper copied the pane's vars over.
  const enlargeFrame = backdrop.querySelector("[data-cairn-plot-enlarge-frame]") as HTMLElement;
  const frameBg = getComputedStyle(enlargeFrame).backgroundColor.replace(/\s+/g, " ").trim();
  const scopeClass = backdrop.classList.contains("cairn-plot-doc");
  report(scopeClass, `overlay carries the cairn-plot-doc scope class (${scopeClass})`);
  const frameDark = frameBg === "rgb(22, 27, 34)";
  report(frameDark, `enlarged frame follows the origin pane's DARK theme (bg ${frameBg})`);
  ok = ok && scopeClass && frameDark;

  // Covers ~the viewport.
  const brect = backdrop.getBoundingClientRect();
  const coversViewport =
    Math.abs(brect.width - window.innerWidth) < 2 && Math.abs(brect.height - window.innerHeight) < 2;
  report(
    coversViewport,
    `backdrop covers the viewport (backdrop ${Math.round(brect.width)}x${Math.round(
      brect.height,
    )} vs window ${window.innerWidth}x${window.innerHeight})`,
  );
  ok = ok && coversViewport;

  // The SAME pane canvas moved into the overlay (never recreated) — identity
  // check plus "still in the DOM within the overlay".
  const canvasInOverlay = backdrop.contains(inlineCanvas) && paneCanvas(backdrop) === inlineCanvas;
  report(canvasInOverlay, "the pane's own canvas element moved into the overlay (not recreated)");
  ok = ok && canvasInOverlay;

  // The enlarged pane's canvas is ~viewport-sized.
  await sleep(300); // allow the pane's ResizeObserver to re-fit to the big box
  const encanvas = paneCanvas(backdrop)!;
  const crect = encanvas.getBoundingClientRect();
  const bigEnough = crect.width > window.innerWidth * 0.5 && crect.height > window.innerHeight * 0.5;
  report(
    bigEnough,
    `enlarged canvas is ~viewport-sized (${Math.round(crect.width)}x${Math.round(crect.height)})`,
  );
  ok = ok && bigEnough;

  // No context loss: still non-blank after the reparent + re-fit.
  const stillNonBlank = await waitNonBlank(encanvas);
  report(stillNonBlank, "enlarged canvas is still non-blank (no context loss after reparent)");
  ok = ok && stillNonBlank;

  // --- Bug 4: the ✕ sits OUTSIDE the framed viewport (in the backdrop gutter),
  // so it never overlaps the pane's toolbar / chrome. ------------------------
  {
    const frame = backdrop.querySelector("[data-cairn-plot-enlarge-frame]") as HTMLElement;
    const closeBtn = backdrop.querySelector("[data-cairn-plot-enlarge-close]") as HTMLButtonElement;
    const btnPresent = !!closeBtn && closeBtn.getAttribute("aria-label") === "Exit fullscreen (Esc)";
    report(btnPresent, "the ✕ close button is present and labelled");
    // Structural: the ✕ is a child of the BACKDROP, NOT inside the pane frame.
    const outsideFrame = !!frame && !!closeBtn && !frame.contains(closeBtn) && backdrop.contains(closeBtn);
    report(outsideFrame, "the ✕ is in the backdrop, OUTSIDE the pane frame");
    // Geometric: the ✕ rect does not intersect the pane frame (up-and-right of
    // it, in the gutter) — so it cannot overlap the frame's toolbar.
    const br = closeBtn?.getBoundingClientRect();
    const fr = frame?.getBoundingClientRect();
    const noOverlap =
      !!br && !!fr &&
      (br.right <= fr.left + 1 || br.left >= fr.right - 1 || br.bottom <= fr.top + 1 || br.top >= fr.bottom - 1);
    report(
      noOverlap,
      `the ✕ rect does not overlap the pane frame (✕ @${Math.round(br?.left ?? 0)},${Math.round(br?.top ?? 0)}; frame top ${Math.round(fr?.top ?? 0)})`,
    );
    // The toolbar (inside the frame) is clear of the ✕.
    const toolbar = frame?.querySelector(".cairn-plot-toolbar") as HTMLElement | null;
    const tr = toolbar?.getBoundingClientRect();
    const toolbarClear =
      !tr || !br || br.right <= tr.left || br.left >= tr.right || br.bottom <= tr.top || br.top >= tr.bottom;
    report(toolbarClear, "the ✕ does not overlap the pane toolbar");
    ok = ok && btnPresent && outsideFrame && noOverlap && toolbarClear;
  }

  // --- Bug 3: while the overlay is open the PAGE must NOT scroll (the scroll
  // ROOT is locked, and window.scrollY doesn't move on a wheel) — BUT a
  // scrollable element INSIDE the overlay (e.g. the diff-mode menu) must still
  // scroll (the overlay must NOT blanket-preventDefault wheel). --------------
  {
    const scrollerEl = (document.scrollingElement as HTMLElement | null) ?? document.body;
    const rootLocked = scrollerEl.style.overflow === "hidden";
    report(rootLocked, `page scroll root is locked while enlarged (overflow="${scrollerEl.style.overflow}")`);
    const beforeY = window.scrollY;
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 600, bubbles: true, cancelable: true }));
    await sleep(60);
    const noScroll = window.scrollY === beforeY;
    report(noScroll, `a plain wheel did not scroll the page (scrollY ${beforeY} -> ${window.scrollY})`);

    // A scrollable element inside the overlay must still receive/scroll on wheel:
    // the overlay must NOT cancel wheel that bubbles from in-overlay UI. Assert a
    // cancelable wheel dispatched inside the backdrop is NOT defaultPrevented.
    const inner = document.createElement("div");
    inner.style.cssText = "height:40px;overflow:auto";
    const tall = document.createElement("div");
    tall.style.height = "400px";
    inner.appendChild(tall);
    backdrop.appendChild(inner);
    const ev = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    inner.dispatchEvent(ev);
    const innerScrollable = !ev.defaultPrevented;
    report(innerScrollable, `wheel inside the overlay is NOT swallowed (defaultPrevented=${ev.defaultPrevented})`);
    inner.remove();
    ok = ok && rootLocked && noScroll && innerScrollable;
  }

  // --- Case 3a: Escape closes; inline pane resumes -------------------------
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const overlayGone = await waitFor(() => !document.querySelector("[data-cairn-plot-enlarge-backdrop]"), 6000, 20);
  report(overlayGone, "Escape removes the overlay");
  ok = ok && overlayGone;

  const backInline = await waitFor(() => !!paneCanvas(container) && container.contains(inlineCanvas), 6000, 20);
  report(backInline, "the pane resumes inline (same canvas) after Escape");
  ok = ok && backInline;

  // Bug 3: page scroll is RESTORED exactly on close (back to its prior value).
  const scrollRestored = scroller.style.overflow === prevScrollerOverflow;
  report(scrollRestored, `page scroll restored on close (scroll-root overflow back to "${scroller.style.overflow}")`);
  ok = ok && scrollRestored;

  const inlineStillLive = await waitNonBlank(inlineCanvas);
  report(inlineStillLive, "inline canvas is still non-blank after exit (no context loss)");
  ok = ok && inlineStillLive;

  // --- Case 3b: backdrop click also closes ---------------------------------
  enlargeBtn.click();
  const reopened = await waitFor(() => !!document.querySelector("[data-cairn-plot-enlarge-backdrop]"), 6000, 20);
  report(reopened, "re-open via enlarge button");
  ok = ok && reopened;
  if (reopened) {
    const bd = document.querySelector("[data-cairn-plot-enlarge-backdrop]") as HTMLElement;
    // Click the backdrop itself (top-left corner, outside the centered frame).
    bd.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }),
    );
    const closedByBackdrop = await waitFor(
      () => !document.querySelector("[data-cairn-plot-enlarge-backdrop]"), 6000, 20);
    report(closedByBackdrop, "clicking the backdrop closes the overlay");
    ok = ok && closedByBackdrop;
  }

  root.unmount();
  container.remove();
  spacer.remove();
  return ok;
}

async function main(): Promise<void> {
  report(true, "harness module loaded (boot marker)");
  try {
    const ok = await run();
    const noErrors = consoleErrors.length === 0;
    report(noErrors, `no console.error during the run (got ${consoleErrors.length})`);
    for (const e of consoleErrors.slice()) report(false, `console.error: ${e}`);
    setOverallStatus(ok && noErrors);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
