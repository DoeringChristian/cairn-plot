/**
 * GPU IMAGE PAGE-HEIGHT CAP — a TALL standalone FLOAT image, rendered through the
 * REAL WebGPU `GpuImagePane` (not the CPU fallback), must have its drawable box
 * (and canvas) capped at the browser window height, exactly like the uint8/CPU
 * path. Reproduces "GPU images are still larger vertically than the window".
 *
 * Registers `GpuImagePane` as the resolved image backend + forces `gpu` render
 * mode, then mounts a standalone float image via `PlotApp` so it goes through
 * `ImageStandalone` → `ContentAspectFrame` (the capped frame). Needs WebGPU.
 */
import { floatValues } from "../../../plots/image/runtime/pixel-buffer.ts";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotSpec } from "../../../../../packages/spec/src/spec.ts";
import { createHarness, sleep, waitFor } from "../../harness";

const { report, setOverallStatus } = createHarness({ title: "GPU-PAGE-CAP" });

/** A TALL float source [H, W, 3] (H >> W), diagonal gradient. */
function tallFloatDescriptor(w: number, h: number): PlotSpec {
  const data = new Float32Array(h * w * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) / (w + h);
      const b = (y * w + x) * 3;
      data[b] = v;
      data[b + 1] = v * 0.5;
      data[b + 2] = 1 - v;
    }
  }
  return {
    mode: "local",
    root: {
      kind: "plot",
      type: "image",
      data: { kind: "inline", props: { source: { dtype: "float", pixels: floatValues(data), shape: [h, w, 3] } } },
      props: { toolbar: true },
    },
  } as unknown as PlotSpec;
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  // Force the REAL WebGPU image pane (not the CPU fallback) + eager mount —
  // GpuImagePane is in core now (addon fold); the lazy device gate settles
  // async, so the assertions below waitFor the gpu canvas.
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "gpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

  const HOST_W = 320;
  const el = document.getElementById("host")!;
  el.style.cssText = `width:${HOST_W}px;background:#222`; // fixed width, AUTO height
  const root = createRoot(el);
  root.render(createElement(PlotApp, { spec: tallFloatDescriptor(64, 512) })); // aspect 0.125
  const roots: Root[] = [root];

  const gpuUp = await waitFor(() => !!el.querySelector("canvas[data-gpu-image-canvas]"), 8000, 25);
  report(gpuUp, "real GPU image pane mounts (data-gpu-image-canvas)");
  ok = ok && gpuUp;

  // Let the frame measure + the pane settle.
  await sleep(400);

  const frame = el.querySelector<HTMLElement>("[data-cairn-content-aspect-frame]")?.getBoundingClientRect();
  const canvas = el.querySelector<HTMLElement>("canvas[data-gpu-image-canvas]")?.getBoundingClientRect();
  const pane = el.querySelector<HTMLElement>("[data-gpu-image-pane]")?.getBoundingClientRect();
  const win = window.innerHeight;
  const CAP = win - 24; // ContentAspectFrame's VIEWPORT_HEIGHT_MARGIN

  report(!!frame, `frame present — ${frame ? `${frame.width.toFixed(0)}×${frame.height.toFixed(0)}` : "MISSING"} (window ${win})`);
  report(!!canvas, `canvas present — ${canvas ? `${canvas.width.toFixed(0)}×${canvas.height.toFixed(0)}` : "MISSING"}`);
  report(!!pane, `pane present — ${pane ? `${pane.width.toFixed(0)}×${pane.height.toFixed(0)}` : "MISSING"}`);

  // THE bug: the pane / canvas is taller than the window.
  const frameCapped = !!frame && frame.height <= CAP + 4;
  const canvasCapped = !!canvas && canvas.height <= CAP + 4;
  const paneCapped = !!pane && pane.height <= CAP + 4;
  report(frameCapped, `frame height ≤ page height (${frame?.height.toFixed(0)} ≤ ${CAP})`);
  report(canvasCapped, `GPU canvas height ≤ page height (${canvas?.height.toFixed(0)} ≤ ${CAP})`);
  report(paneCapped, `GPU pane height ≤ page height (${pane?.height.toFixed(0)} ≤ ${CAP})`);
  ok = ok && frameCapped && canvasCapped && paneCapped;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
