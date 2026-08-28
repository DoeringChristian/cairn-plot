/**
 * `GpuImagePane` DETECTION OVERLAY on the FLOAT (HDR) surface — the LIVE browser
 * proof for the M7 fix (duplication audit, `docs/plans/2026-08-21-duplication-
 * audit.md`). jsdom has no WebGPU, so — like every `*.browser.ts` harness under
 * `renderers/__tests__/` — this mounts live React panes; it self-drives (no
 * external pointer/keyboard) and finalizes `#status`, so it opts into the DEFAULT
 * `test:harness` set via `data-cairn-harness="self-driving"`.
 *
 * THE BUG IT PINS. `overlay`/`overlaySettings` are declared on the unified
 * `ImageBackendProps` for ANY dtype, but were threaded only on the uint8 branch
 * and HARD-NULLED for the float surface (`GpuImagePane`'s
 * `const overlay = hdrMode ? undefined : …`), so identical detection metadata drew
 * boxes on a uint8 PNG but rendered NOTHING on an EXR/float image — no error, no
 * warning. Float/EXR is exactly where per-region overlays matter most.
 *
 * WHAT IT PROVES.
 *   1. A FLOAT `GpuImagePane` given `overlay` (one box) + default `overlaySettings`
 *      renders the `ImageOverlay` layer WITH an SVG `<rect>` box on the float
 *      surface (the layer is a display-space CSS/SVG overlay, so it composites
 *      over the float canvas regardless of the WebGPU readback dance).
 *   2. CONTROL — the SAME float pane with NO `overlay` renders no `<rect>` box
 *      (so case 1 is a real effect of the prop, not an always-on artifact).
 *   3. `overlaySettings.enabled === false` suppresses the layer on the float
 *      surface (settings are honoured on float, not just uint8).
 *   Note: this exercises whichever backend WebGPU selects (real GPU pane, or the
 *   `CpuImagePane` HDR fallback if the adapter is unavailable) — both now thread
 *   the overlay through the float path, so the box must appear either way.
 *
 * RUNNING (mirrors the sibling gpu-image-diff harness):
 *   Bundle:  npx esbuild \
 *     src/testing/browser/renderers/overlay-float.browser.ts \
 *     --bundle --format=esm --jsx=automatic \
 *     --outfile=src/testing/browser/renderers/overlay-float.browser.bundle.js
 *   Serve:   (from ui/) python3 -m http.server 8937
 *   Open:    http://localhost:8937/src/testing/browser/renderers/overlay-float.browser.html
 *   The `.bundle.js` is gitignored — `npm run test:harness` regenerates it.
 */
import { floatValues } from "../../../plots/image/model/pixel-buffer.ts";
import React from "react";
import { createRoot } from "react-dom/client";
import GpuImagePane from "../../../plots/image/backend/gpu";
import { hdrSource, type HdrData } from "../../../plots/image/backend/contracts";
import {
  DEFAULT_OVERLAY_SETTINGS,
  type ImageOverlayData,
  type ImageOverlaySettings,
} from "../../../plots/types";
import { createHarness, sleep, waitFor } from "../../harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({ title: "OVERLAY FLOAT" });

const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};

// A small 8×8 grayscale HDR gradient (scene-linear, includes values >1.0).
function buildHdr(): HdrData {
  const data = new Float32Array(8 * 8);
  for (let i = 0; i < data.length; i++) data[i] = (i / (data.length - 1)) * 3.0;
  return { pixels: floatValues(data), shape: [8, 8], dtype: "<f4" };
}

// One normalized box covering the image middle (+ a label so a chip also draws).
const OVERLAY: ImageOverlayData = {
  boxes: [
    {
      class_id: 1,
      label: "obj",
      position: { minX: 0.2, minY: 0.2, maxX: 0.8, maxY: 0.8 },
      domain: "fraction",
    },
  ],
};

/** Mount a float `GpuImagePane` into a fresh sized container and return it. */
function mountFloatPane(
  id: string,
  overlay: ImageOverlayData | undefined,
  overlaySettings: ImageOverlaySettings | undefined,
): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement("div");
  container.id = id;
  container.style.position = "relative";
  container.style.width = "240px";
  container.style.height = "240px";
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(
    h(GpuImagePane, {
      source: hdrSource(buildHdr()),
      tonemap: "srgb",
      label: id,
      overlay,
      overlaySettings,
    }),
  );
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

/** Count the overlay `<rect>` boxes drawn inside a mounted pane. */
function overlayBoxCount(container: HTMLElement): number {
  const layer = container.querySelector("[data-image-overlay]");
  if (!layer) return 0;
  return layer.querySelectorAll("svg rect").length;
}

/** Diagnostics for why an overlay may not be drawing (layer/svg/sizing). */
function overlayDiag(container: HTMLElement): string {
  const layer = container.querySelector("[data-image-overlay]") as HTMLElement | null;
  const wrap = container.querySelector("[data-gpu-image-surface]") as HTMLElement | null;
  const canvas = container.querySelector("canvas") as HTMLElement | null;
  const paneKind = container.querySelector("[data-gpu-image-pane]")
    ? "gpu"
    : container.querySelector("[data-cpu-image-pane]")
      ? "cpu"
      : "none";
  const lr = layer?.getBoundingClientRect();
  const wr = wrap?.getBoundingClientRect();
  const cr = canvas?.getBoundingClientRect();
  return [
    `pane=${paneKind}`,
    `layer=${layer ? "yes" : "NO"}`,
    layer ? `layer:${Math.round(lr!.width)}x${Math.round(lr!.height)}` : "",
    `svg=${layer?.querySelector("svg") ? "yes" : "NO"}`,
    `rects=${layer?.querySelectorAll("svg rect").length ?? 0}`,
    wrap ? `viewport:${Math.round(wr!.width)}x${Math.round(wr!.height)}` : "viewport:NO",
    canvas ? `canvas:${Math.round(cr!.width)}x${Math.round(cr!.height)}` : "canvas:NO",
  ]
    .filter(Boolean)
    .join(" ");
}

async function main(): Promise<void> {
  let ok = true;
  try {
    // Case 1 — float pane WITH an overlay: the box renders on the float surface.
    const withOverlay = mountFloatPane("float-with-overlay", OVERLAY, {
      ...DEFAULT_OVERLAY_SETTINGS,
    });
    const canvasUp = await waitFor(
      () => !!withOverlay.container.querySelector("canvas"), 8000, 40);
    report(canvasUp, "float pane mounts a canvas (image surface up)");
    ok = ok && canvasUp;

    const boxDrew = await waitFor(() => overlayBoxCount(withOverlay.container) > 0, 8000, 40);
    report(
      boxDrew,
      `overlay box renders on the FLOAT surface (found ${overlayBoxCount(withOverlay.container)} <rect>` +
        ` — ${overlayDiag(withOverlay.container)})`,
    );
    ok = ok && boxDrew;

    // Case 2 — CONTROL: same float pane, NO overlay → no box (proves case 1 is
    // caused by the prop, not an always-present artifact).
    const noOverlay = mountFloatPane("float-no-overlay", undefined, undefined);
    await waitFor(() => !!noOverlay.container.querySelector("canvas"), 8000, 40);
    await sleep(400);
    const noBox = overlayBoxCount(noOverlay.container) === 0;
    report(noBox, `float pane WITHOUT overlay draws no box (found ${overlayBoxCount(noOverlay.container)})`);
    ok = ok && noBox;

    // Case 3 — overlaySettings.enabled=false suppresses the layer on float.
    const disabled = mountFloatPane("float-overlay-disabled", OVERLAY, {
      ...DEFAULT_OVERLAY_SETTINGS,
      enabled: false,
    });
    await waitFor(() => !!disabled.container.querySelector("canvas"), 8000, 40);
    await sleep(400);
    const suppressed = overlayBoxCount(disabled.container) === 0;
    report(
      suppressed,
      `overlaySettings.enabled=false suppresses the overlay on float (found ${overlayBoxCount(disabled.container)})`,
    );
    ok = ok && suppressed;

    withOverlay.unmount();
    noOverlay.unmount();
    disabled.unmount();

    const noConsoleErrors = consoleErrors.length === 0;
    report(noConsoleErrors, `no console.error calls during the run (got ${consoleErrors.length})`);
    for (const e of consoleErrors.slice()) report(false, `console.error: ${e}`);

    setOverallStatus(ok && noConsoleErrors);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
