/**
 * C1 fix (whole-branch review) — fault-injection harness: a per-pane GPU
 * hard failure (any GPU init/render failure — see `engine/pool.ts`'s
 * `MAX_LIVE_SWAPCHAINS` doc) must NEVER blank a pane. It must fall back to
 * the legacy CPU pane instead. This is also the runtime safety net half of
 * the WebGPU-only engine's fallback boundary — the capability-gated half
 * (`resolveImageRenderer` in `plot-renderers.tsx`) is exercised by
 * `gpu-image-addon-check.browser.ts`.
 *
 * jsdom has no WebGPU, so — like every other `*.browser.ts` harness in this
 * tree — this is NOT a unit test, it's a browser page driven via
 * claude-in-chrome. Uses `React.createElement` (no JSX) per the existing
 * harness convention.
 *
 * FAULT INJECTION: the page is loaded with a `?forceEngineFail` query param
 * (`engine/test-hooks.ts`'s `forceEngineFailRequested()`, read by
 * `engine/pool.ts`'s `activateEntry()` — see its C1-fix doc comment) —
 * deterministically forces every pane-activation attempt to throw, exactly
 * the hard-failure branch the C1 fix targets, without needing to actually
 * exhaust a real GPU resource cap.
 *
 * CASES (all run under `?forceEngineFail`). Since Phase 4 (content-op
 * unification) EVERY compare renders on the unified `GpuImagePane` via
 * `compareSource` (`GpuComparePane` is deleted), so cases 3/4 drive the SAME
 * pane as cases 1/2, just with a `compareSource`:
 *   1. `GpuImagePane` (SDR `imageUrl` prop shape) — asserts NO
 *      `[data-gpu-image-canvas]` mounts (the engine bailed before painting)
 *      and the LEGACY `ImagePane`'s `<img>` renders instead, with the
 *      correct `src`.
 *   2. `GpuImagePane` (HDR `hdr` prop shape) — asserts NO
 *      `[data-gpu-image-canvas]` and the legacy `HdrImagePane`'s `<canvas>`
 *      renders NON-BLANK content (readback).
 *   3. `GpuImagePane` + `compareSource` (`mode:"split"`) — asserts NO
 *      `[data-gpu-image-canvas]` and the legacy `CpuImagePane` compare fallback
 *      renders its `<img>` (NOT a blank card).
 *   4. `GpuImagePane` + `compareSource` (`mode:"diff"`) — asserts NO
 *      `[data-gpu-image-canvas]` and the legacy `CpuImagePane` diff fallback
 *      renders content (`<canvas>`/`<img>`, NOT a blank card).
 *
 * Every case also asserts NO uncaught `window.onerror`/`unhandledrejection`
 * fired and NO `console.error` call — a genuinely uncaught throw would
 * unmount the whole harness subtree (React 18's default), which these
 * assertions catch even if the DOM checks above somehow didn't.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/testing/browser/renderers/engine-fallback.browser.ts \
 *        --bundle --format=esm --jsx=automatic \
 *        --outfile=src/testing/browser/renderers/engine-fallback.browser.bundle.js
 *      (`--jsx=automatic` is REQUIRED — the project's root `tsconfig.json` is
 *      a references-only stub esbuild's standalone CLI does not resolve
 *      through to `tsconfig.app.json`'s `"jsx": "react-jsx"`, so without this
 *      flag esbuild falls back to the classic `React.createElement` factory,
 *      which throws `ReferenceError: React is not defined` for every
 *      `lib/cairn-plot` component — none of them `import React` by name,
 *      relying on the real Vite build's automatic runtime instead.)
 *   2. Serve: cd cairn/ui/src/testing/browser/renderers && python3 -m http.server 8938
 *   3. Open in Chrome (claude-in-chrome), WITH the fault-injection param:
 *        http://localhost:8938/engine-fallback.browser.html?forceEngineFail
 *
 * The generated `.bundle.js` is NOT committed (gitignored) — regenerate with
 * the command above whenever this harness or its imports change.
 */
import { floatValues } from "../../../plots/image/model/pixel-buffer.ts";
import React from "react";
import { createRoot } from "react-dom/client";
import GpuImagePane from "../../../plots/image/backends/webgpu";
import { hdrSource, urlSource, type HdrData } from "../../../plots/image/backends/contracts";
import { createHarness, sleep, waitFor } from "../../harness";

const h = React.createElement;

declare global {
  interface Window {
    __engineFallbackTestResult?: "pass" | "fail";
  }
}

// A 1x1 red PNG, inline — no network fetch needed (matches the Python test
// suite's `_PNG` fixture precedent, just base64'd as a data URL here).
const RED_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const { report, setOverallStatus } = createHarness({ title: "ENGINE FALLBACK", resultFlag: "__engineFallbackTestResult" });

async function readbackCanvas(canvas: HTMLCanvasElement): Promise<ImageData> {
  const bitmap = await createImageBitmap(canvas);
  const tmp = document.createElement("canvas");
  tmp.width = bitmap.width;
  tmp.height = bitmap.height;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, tmp.width, tmp.height);
}

function isNonBlank(img: ImageData): boolean {
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] !== 0 || img.data[i + 1] !== 0 || img.data[i + 2] !== 0 || img.data[i + 3] !== 0) return true;
  }
  return false;
}

// Track console.error + uncaught window errors for the WHOLE run — a
// genuinely uncaught throw from an unguarded engine pane would surface here
// even if the DOM-shape assertions below somehow passed by accident.
const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};
const uncaughtErrors: string[] = [];
window.addEventListener("error", (e) => {
  uncaughtErrors.push(e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  uncaughtErrors.push(String(e.reason));
});

// ---------------------------------------------------------------------------
// Case 1: GpuImagePane, SDR path.
// ---------------------------------------------------------------------------
async function runSdrImageCase(): Promise<boolean> {
  let ok = true;
  const container = document.createElement("div");
  container.id = "harness-sdr-image";
  container.style.width = "160px";
  container.style.height = "160px";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    h(GpuImagePane, {
      source: urlSource(RED_PNG_DATA_URL),
      label: "sdr-fallback-test",
    }),
  );

  // Give the (forced-to-fail) engine effects a beat to run and bail out.
  await sleep(1000);

  const gpuCanvasFound = !!container.querySelector("canvas[data-gpu-image-canvas]");
  report(!gpuCanvasFound, "[SDR] engine bailed BEFORE mounting its own canvas (no [data-gpu-image-canvas])");
  ok = ok && !gpuCanvasFound;

  const legacyImgFound = await waitFor(() => !!container.querySelector("img"), 6000, 20);
  report(legacyImgFound, "[SDR] legacy ImagePane's <img> mounted (NOT a blank card)");
  ok = ok && legacyImgFound;

  if (legacyImgFound) {
    const img = container.querySelector("img") as HTMLImageElement;
    const srcOk = img.src === RED_PNG_DATA_URL || img.getAttribute("src") === RED_PNG_DATA_URL;
    report(srcOk, `[SDR] legacy <img> src matches the original imageUrl (got "${img.getAttribute("src")?.slice(0, 40)}...")`);
    ok = ok && srcOk;
  }

  root.unmount();
  container.remove();
  return ok;
}

// ---------------------------------------------------------------------------
// Case 2: GpuImagePane, HDR path.
// ---------------------------------------------------------------------------
async function runHdrImageCase(): Promise<boolean> {
  let ok = true;
  const container = document.createElement("div");
  container.id = "harness-hdr-image";
  container.style.width = "160px";
  container.style.height = "160px";
  document.body.appendChild(container);

  const hdr: HdrData = { pixels: floatValues(new Float32Array([0.1, 0.4, 0.7, 1.0])), shape: [2, 2], dtype: "<f4" };
  const root = createRoot(container);
  root.render(h(GpuImagePane, { source: hdrSource(hdr), tonemap: "srgb", exposure: 0, label: "hdr-fallback-test" }));

  await sleep(1000);

  const gpuCanvasFound = !!container.querySelector("canvas[data-gpu-image-canvas]");
  report(!gpuCanvasFound, "[HDR] engine bailed BEFORE mounting its own canvas (no [data-gpu-image-canvas])");
  ok = ok && !gpuCanvasFound;

  const legacyCanvasFound = await waitFor(() => container.querySelectorAll("canvas").length > 0, 6000, 20);
  report(legacyCanvasFound, "[HDR] legacy HdrImagePane's <canvas> mounted (NOT a blank card)");
  ok = ok && legacyCanvasFound;

  if (legacyCanvasFound) {
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    const gotNonBlank = await (async () => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const img = await readbackCanvas(canvas);
        if (isNonBlank(img)) return true;
        await sleep(50);
      }
      return false;
    })();
    report(gotNonBlank, "[HDR] legacy <canvas> has non-blank rendered content");
    ok = ok && gotNonBlank;
  }

  root.unmount();
  container.remove();
  return ok;
}

// ---------------------------------------------------------------------------
// Case 3: GpuImagePane + compareSource, split mode.
// ---------------------------------------------------------------------------
async function runCompareSplitCase(): Promise<boolean> {
  let ok = true;
  const container = document.createElement("div");
  container.id = "harness-compare-split";
  container.style.width = "160px";
  container.style.height = "160px";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    h(GpuImagePane, {
      source: urlSource(RED_PNG_DATA_URL),
      compareSource: {
        b: urlSource(RED_PNG_DATA_URL),
        opId: "absolute",
        mode: "split",
        splitPosition: 0.5,
      },
      zoom: 1,
      pan: { x: 0, y: 0 },
      label: "compare-split-fallback-test",
    }),
  );

  await sleep(1000);

  const gpuCanvasFound = !!container.querySelector("canvas[data-gpu-image-canvas]");
  report(!gpuCanvasFound, "[compare/split] engine bailed BEFORE mounting its own canvas (no [data-gpu-image-canvas])");
  ok = ok && !gpuCanvasFound;

  const legacyImgFound = await waitFor(() => container.querySelectorAll("img").length > 0, 6000, 20);
  report(legacyImgFound, "[compare/split] legacy CpuImagePane compare fallback <img> mounted (NOT a blank card)");
  ok = ok && legacyImgFound;

  root.unmount();
  container.remove();
  return ok;
}

// ---------------------------------------------------------------------------
// Case 4: GpuImagePane + compareSource, diff mode.
// ---------------------------------------------------------------------------
async function runCompareDiffCase(): Promise<boolean> {
  let ok = true;
  const container = document.createElement("div");
  container.id = "harness-compare-diff";
  container.style.width = "160px";
  container.style.height = "160px";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    h(GpuImagePane, {
      source: urlSource(RED_PNG_DATA_URL),
      compareSource: {
        b: urlSource(RED_PNG_DATA_URL),
        opId: "signed",
        mode: "diff",
        colormap: "red-blue",
      },
      zoom: 1,
      pan: { x: 0, y: 0 },
      label: "compare-diff-fallback-test",
    }),
  );

  await sleep(1500);

  const gpuCanvasFound = !!container.querySelector("canvas[data-gpu-image-canvas]");
  report(!gpuCanvasFound, "[compare/diff] engine bailed BEFORE mounting its own canvas (no [data-gpu-image-canvas])");
  ok = ok && !gpuCanvasFound;

  // ImagePane's diff path renders EITHER a <canvas> (diff computed) or an
  // <img> (diff not ready yet / plain passthrough) — either is acceptable
  // proof the legacy pane mounted; only a totally empty container is a
  // failure.
  const legacyContentFound = await waitFor(
    () => container.querySelectorAll("canvas, img").length > 0, 6000, 20);
  report(legacyContentFound, "[compare/diff] legacy CpuImagePane content (<canvas>/<img>) mounted (NOT a blank card)");
  ok = ok && legacyContentFound;

  root.unmount();
  container.remove();
  return ok;
}

async function main(): Promise<void> {
  try {
    const hasFlag = new URLSearchParams(location.search).has("forceEngineFail");
    report(hasFlag, `location.search carries ?forceEngineFail (got "${location.search}")`);

    const sdrOk = await runSdrImageCase();
    const hdrOk = await runHdrImageCase();
    const splitOk = await runCompareSplitCase();
    const diffOk = await runCompareDiffCase();

    const noUncaught = uncaughtErrors.length === 0;
    report(noUncaught, `no uncaught window error/unhandledrejection during the run (got ${uncaughtErrors.length})`);
    for (const e of uncaughtErrors) report(false, `uncaught: ${e}`);

    const noConsoleErrors = consoleErrors.length === 0;
    report(noConsoleErrors, `no console.error calls during the run (got ${consoleErrors.length})`);
    for (const e of consoleErrors.slice()) report(false, `console.error: ${e}`);

    setOverallStatus(hasFlag && sdrOk && hdrOk && splitOk && diffOk && noUncaught && noConsoleErrors);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
