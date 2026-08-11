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
import CpuImagePane from "../CpuImagePane";
import { hdrSource, type HdrData } from "../image-backend";
import type { Viewport as ImageViewport } from "../../hooks/use-image-viewport";

const h = React.createElement;

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "green" : "red";
    el.appendChild(p);
  }
}

function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  document.title = pass ? "PANE ENLARGE PASS" : "PANE ENLARGE FAIL";
}

const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 6000, stepMs = 20): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return predicate();
}

// A small 4x4 grayscale HDR gradient (scene-linear), includes values >1.0.
function buildHdr(): HdrData {
  const values = [0.0, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 0.05, 0.3, 0.6, 0.9, 1.2, 1.8, 2.5, 3.0];
  return { data: new Float32Array(values), shape: [4, 4], dtype: "<f4" };
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
  document.body.appendChild(container);

  let latestViewport: ImageViewport = { zoom: 1, pan: { x: 0, y: 0 } };
  const hdr = buildHdr();
  const root = createRoot(container);

  function Harness() {
    const [viewport, setViewport] = React.useState<ImageViewport>(latestViewport);
    return h(CpuImagePane, {
      source: hdrSource(hdr),
      tonemap: "srgb",
      exposure: 0.5,
      zoom: viewport.zoom,
      pan: viewport.pan,
      onViewportChange: (v: ImageViewport) => {
        latestViewport = v;
        setViewport(v);
      },
      label: "enlarge-test",
    });
  }
  root.render(h(Harness));

  // --- Case 1: enlarge button + a non-blank inline canvas ------------------
  const btnFound = await waitFor(
    () => !!container.querySelector('button[aria-label="Enlarge (fullscreen)"]'),
  );
  report(btnFound, "enlarge toolbar button mounts");
  ok = ok && btnFound;
  if (!btnFound) {
    root.unmount();
    container.remove();
    return false;
  }

  const canvasFound = await waitFor(() => !!paneCanvas(container));
  report(canvasFound, "pane canvas mounts inline");
  ok = ok && canvasFound;
  const inlineCanvas = paneCanvas(container)!;

  const inlineNonBlank = await waitNonBlank(inlineCanvas);
  report(inlineNonBlank, "inline pane canvas renders non-blank");
  ok = ok && inlineNonBlank;

  // --- Case 2: click enlarge -> body-level fixed/high-z/isolate overlay ----
  const enlargeBtn = container.querySelector(
    'button[aria-label="Enlarge (fullscreen)"]',
  ) as HTMLButtonElement;
  enlargeBtn.click();

  const overlayAppeared = await waitFor(
    () => !!document.querySelector("[data-cairn-plot-enlarge-backdrop]"),
  );
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

  // --- Case 3a: Escape closes; inline pane resumes -------------------------
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const overlayGone = await waitFor(() => !document.querySelector("[data-cairn-plot-enlarge-backdrop]"));
  report(overlayGone, "Escape removes the overlay");
  ok = ok && overlayGone;

  const backInline = await waitFor(() => !!paneCanvas(container) && container.contains(inlineCanvas));
  report(backInline, "the pane resumes inline (same canvas) after Escape");
  ok = ok && backInline;

  const inlineStillLive = await waitNonBlank(inlineCanvas);
  report(inlineStillLive, "inline canvas is still non-blank after exit (no context loss)");
  ok = ok && inlineStillLive;

  // --- Case 3b: backdrop click also closes ---------------------------------
  enlargeBtn.click();
  const reopened = await waitFor(() => !!document.querySelector("[data-cairn-plot-enlarge-backdrop]"));
  report(reopened, "re-open via enlarge button");
  ok = ok && reopened;
  if (reopened) {
    const bd = document.querySelector("[data-cairn-plot-enlarge-backdrop]") as HTMLElement;
    // Click the backdrop itself (top-left corner, outside the centered frame).
    bd.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }),
    );
    const closedByBackdrop = await waitFor(
      () => !document.querySelector("[data-cairn-plot-enlarge-backdrop]"),
    );
    report(closedByBackdrop, "clicking the backdrop closes the overlay");
    ok = ok && closedByBackdrop;
  }

  root.unmount();
  container.remove();
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
