/**
 * Diff-kernels toolbar-menu verification harness (NOT a unit test — jsdom has
 * no WebGPU; driven live via claude-in-chrome, same convention as
 * `gpu-compare-geometry.browser.ts`).
 *
 * Verifies the compute-decoupling contract of the toolbar MENUS (Track B) with
 * the engine's `getDiffComputeCount()` counter (incremented ONLY on a real
 * kernel cache-miss compute — `engine/diff-engine.ts`):
 *
 *   1. Switching the diff KERNEL via the MODE menu recomputes EXACTLY ONCE
 *      (count +1) and the displayed pixels change.
 *   2. Switching the COLORMAP via the COLORMAP menu does NOT recompute
 *      (count +0 — display-only) yet the displayed pixels still change.
 *   3. Zoom + pan do NOT recompute (count +0) — display-only.
 *
 * Drives the ACTUAL toolbar menu DOM (open the menu button, click an option),
 * so it also exercises the PlotToolbar dropdown wiring end-to-end.
 *
 * A self-running `main()` performs the sequence with PROMISE/rAF-based settling
 * (`waitForStableCount` — NOT plain setTimeouts, which a backgrounded tab
 * throttles) and writes PASS/FAIL to the page. In addition, the harness exposes
 * `window.__menuHarness` so the sequence can be driven step-by-step from an MCP
 * `javascript_tool` session (each call runs on-demand, immune to timer
 * throttling) when eyeballing the exact numbers.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/lib/cairn-plot/media-compare/__tests__/gpu-compare-menus.browser.ts \
 *        --bundle --format=esm --tsconfig=tsconfig.app.json \
 *        --outfile=src/lib/cairn-plot/media-compare/__tests__/gpu-compare-menus.browser.bundle.js
 *   2. Copy CSS: cp dist/plot-inline/style.css \
 *        src/lib/cairn-plot/media-compare/__tests__/harness-style.css
 *   3. Serve: cd cairn/ui/src/lib/cairn-plot/media-compare/__tests__ && python3 -m http.server 8939
 *   4. Open in Chrome (WebGPU required), tab kept FOREGROUND:
 *        http://localhost:8939/gpu-compare-menus.browser.html
 *
 * The generated `.bundle.js`/`harness-style.css` are NOT committed (gitignored)
 * — regenerate with the commands above whenever this harness, its imports, or
 * the Tailwind build change.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import GpuComparePane from "../GpuComparePane";
import { getDiffComputeCount } from "../../engine/diff-engine";
import type { Viewport as ImageViewport } from "../../hooks/use-image-viewport";

declare global {
  interface Window {
    __menuTestResult?: "pass" | "fail";
    __menuHarness?: MenuHarnessApi;
  }
}

interface MenuHarnessApi {
  count(): number;
  kernel(): string | undefined;
  clickMenu(menuAriaLabel: string, optionText: string): boolean;
  setViewport(v: ImageViewport): void;
  readback(): ImageData;
  meanDiff(a: ImageData, b: ImageData): number;
  canvas(): HTMLCanvasElement | null;
}

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
  window.__menuTestResult = pass ? "pass" : "fail";
  document.title = pass ? "MENUS PASS" : "MENUS FAIL";
}

/** rAF-based wait — advances even under background setTimeout throttling far
 *  better than a raw setTimeout would; enough turns for a promise chain
 *  (ensureDiff) to settle. */
function nextFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}

/** Poll `getDiffComputeCount()` until it holds steady for `stableFrames`
 *  consecutive frames (the async ensureDiff compute has settled), then return
 *  it. Bounded by `maxFrames`. */
async function waitForStableCount(stableFrames = 20, maxFrames = 400): Promise<number> {
  let last = getDiffComputeCount();
  let stable = 0;
  for (let f = 0; f < maxFrames; f++) {
    await nextFrames(1);
    const now = getDiffComputeCount();
    if (now === last) {
      if (++stable >= stableFrames) return now;
    } else {
      stable = 0;
      last = now;
    }
  }
  return last;
}

/** A textured NxN PNG data URL (a diagonal gradient + a bright disk) so the two
 *  sources differ with STRUCTURE (edges) — FLIP has something to key off. */
function texturedDataUrl(size: number, shift: number, dim: number): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = (x + shift) % size;
      const disk = Math.exp(-(((sx - size * 0.5) ** 2 + (y - size * 0.5) ** 2) / (size * 1.2))) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, ((sx / size) * 255 + disk) * dim);
      img.data[i + 1] = Math.min(255, (y / size) * 255 * dim);
      img.data[i + 2] = Math.min(255, disk * dim);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

/** Synchronous readback — `drawImage(webgpuCanvas)` onto a 2D canvas (no
 *  `createImageBitmap`, whose promise can stall on a backgrounded tab). The
 *  pane renders on demand and keeps its last frame, so a direct copy captures
 *  live pixels. */
function readbackOf(canvas: HTMLCanvasElement): ImageData {
  const tmp = document.createElement("canvas");
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const ctx = tmp.getContext("2d")!;
  ctx.clearRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, tmp.width, tmp.height);
}

/** Mean absolute per-channel difference between two equal-size readbacks. */
function meanDiff(a: ImageData, b: ImageData): number {
  const n = Math.min(a.data.length, b.data.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a.data[i]! - b.data[i]!);
  return sum / n;
}

async function main(): Promise<void> {
  try {
    const refUrl = texturedDataUrl(48, 0, 1.0);
    const predUrl = texturedDataUrl(48, 2, 0.9); // shifted + dimmed → structured diff

    const container = document.createElement("div");
    container.id = "menu-harness";
    container.style.width = "480px";
    container.style.height = "320px";
    document.body.appendChild(container);

    let setViewportFn: ((v: ImageViewport) => void) | null = null;

    function Harness() {
      const [viewport, setViewport] = React.useState<ImageViewport>({ zoom: 1, pan: { x: 0, y: 0 } });
      setViewportFn = setViewport;
      return h(GpuComparePane, {
        imageUrl: predUrl, // texB — prediction/foreground
        baselineUrl: refUrl, // texA — reference/baseline
        mode: "diff",
        diffKernel: "flip", // start on FLIP
        colormap: "viridis",
        splitPosition: 0.5,
        blendAlpha: 0.5,
        zoom: viewport.zoom,
        pan: viewport.pan,
        onViewportChange: setViewport,
        label: "menu-test",
      });
    }
    const root = createRoot(container);
    root.render(h(Harness));

    const canvasOf = () => container.querySelector("canvas[data-gpu-compare-canvas]") as HTMLCanvasElement | null;
    const paneEl = () =>
      container.querySelector("[data-gpu-compare-viewport]") as
        | (HTMLElement & { __cairnDiffKernel?: { current: string; set(id: string): void } })
        | null;

    /** Open the named leading MENU (by aria-label), then click the option whose
     *  visible text matches `optionText`. React 18 flushes the open setState
     *  synchronously inside the click handler, so the list is queryable at once. */
    const clickMenu = (menuAriaLabel: string, optionText: string): boolean => {
      const menuBtn = container.querySelector<HTMLButtonElement>(`button[aria-label="${menuAriaLabel}"]`);
      if (!menuBtn) return false;
      menuBtn.click();
      const opts = Array.from(document.querySelectorAll<HTMLButtonElement>('ul[role="listbox"] button'));
      const target = opts.find((o) => (o.textContent ?? "").trim() === optionText);
      if (!target) {
        menuBtn.click(); // close
        return false;
      }
      target.click();
      return true;
    };

    // Expose an on-demand API for step-by-step MCP driving (immune to
    // background-tab timer throttling — each call runs when invoked).
    window.__menuHarness = {
      count: () => getDiffComputeCount(),
      kernel: () => paneEl()?.__cairnDiffKernel?.current,
      clickMenu,
      setViewport: (v) => setViewportFn?.(v),
      readback: () => readbackOf(canvasOf()!),
      meanDiff,
      canvas: canvasOf,
    };

    // Wait for the canvas + first (FLIP) compute to settle.
    await nextFrames(4);
    if (!canvasOf()) {
      report(false, "GPU compare canvas did not mount");
      setOverallStatus(false);
      return;
    }
    await waitForStableCount();

    const gpuActive = getDiffComputeCount() > 0 && !!paneEl()?.__cairnDiffKernel;
    report(gpuActive, `GPU diff path active (computeCount=${getDiffComputeCount()}, __cairnDiffKernel present=${!!paneEl()?.__cairnDiffKernel})`);
    if (!gpuActive) {
      report(false, "WebGPU diff path not active — cannot verify compute counts (open in a WebGPU-capable Chrome, tab foreground).");
      setOverallStatus(false);
      return;
    }

    let ok = true;
    const canvas = canvasOf()!;

    // --- (1) kernel switch via MODE menu → recompute EXACTLY once + display changes ---
    {
      const before = readbackOf(canvas);
      const countBefore = getDiffComputeCount();
      const clicked = clickMenu("Compare / diff mode", "Absolute Error");
      report(clicked, "[1] MODE menu opens and 'Absolute Error' option clicks");
      const countAfter = await waitForStableCount();
      const kernelNow = paneEl()?.__cairnDiffKernel?.current;
      const after = readbackOf(canvas);
      const delta = countAfter - countBefore;
      const md = meanDiff(before, after);
      report(kernelNow === "absolute", `[1] kernel is now "absolute" (got "${kernelNow}")`);
      report(delta === 1, `[1] switching kernel recomputes EXACTLY once (computeCount +${delta})`);
      report(md > 1.0, `[1] display changed after kernel switch (meanDiff=${md.toFixed(2)})`);
      ok = ok && clicked && kernelNow === "absolute" && delta === 1 && md > 1.0;
    }

    // --- (2) colormap switch via COLORMAP menu → NO recompute + display changes ---
    {
      const before = readbackOf(canvas);
      const countBefore = getDiffComputeCount();
      const clicked = clickMenu("Colormap", "Red–Blue");
      report(clicked, "[2] COLORMAP menu opens and 'Red–Blue' option clicks");
      const countAfter = await waitForStableCount();
      const after = readbackOf(canvas);
      const delta = countAfter - countBefore;
      const md = meanDiff(before, after);
      report(delta === 0, `[2] switching COLORMAP does NOT recompute (computeCount +${delta})`);
      report(md > 1.0, `[2] display changed after colormap switch (meanDiff=${md.toFixed(2)})`);
      ok = ok && clicked && delta === 0 && md > 1.0;
    }

    // --- (3) zoom + pan → NO recompute ---
    {
      const countBefore = getDiffComputeCount();
      setViewportFn!({ zoom: 2.5, pan: { x: -40, y: -30 } });
      await waitForStableCount(10, 120);
      setViewportFn!({ zoom: 2.5, pan: { x: -120, y: -30 } });
      const countAfter = await waitForStableCount(10, 120);
      const delta = countAfter - countBefore;
      report(delta === 0, `[3] zoom + pan do NOT recompute (computeCount +${delta})`);
      ok = ok && delta === 0;
    }

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
