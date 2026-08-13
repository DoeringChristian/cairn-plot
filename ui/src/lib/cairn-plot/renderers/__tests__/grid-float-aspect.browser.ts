/**
 * GRID FLOAT-ASPECT — the "portrait viewport for a wide float image in a grid"
 * regression (user report: a `cp.Grid` of three same-aspect WIDE EXR images
 * renders each viewport TALLER than wide, with empty checkerboard bands above
 * and below the content).
 *
 * Root cause: `ContentAspectFrame` only learned the content aspect from the
 * pane's ASYNC natural-size report, which for the WebGPU float path only fires
 * post-`paneReady` + decode. Until then the frame sat in its tall `outerHeight`
 * fallback (`DEFAULT_CHART_HEIGHT` = 400) → a `colWidth × 400` PORTRAIT box for a
 * wide image. Fix: a float/EXR source carries its pixel dims in `source.shape`
 * ([H,W,…]), so the aspect is known SYNCHRONOUSLY — `ImageStandalone` hands it to
 * the frame via `contentAspect`, which seeds the reshape immediately (no wait,
 * no WebGPU/decode dependency).
 *
 * Two parts:
 *   A. SEED ISOLATION — mount `ContentAspectFrame` directly with `contentAspect`
 *      and a child that NEVER reports a natural size (the GPU-timing scenario).
 *      The frame must still reshape to the content aspect. This is the part that
 *      FAILS without the fix (aspect stays null → tall 400 fallback).
 *   B. END-TO-END — a real `cp.Grid` (PlotApp descriptor) of three same-aspect
 *      WIDE float sources. Every content-aspect frame must be WIDE (≈ content
 *      aspect) and the three the same height (the row collapsed onto the content,
 *      no bands). CPU backend forced — `CpuImagePane` tone-maps float on the CPU,
 *      so this runs without WebGPU.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";
import { ContentAspectFrame } from "../ContentAspectFrame";

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
  document.title = pass ? "GRID-FLOAT-ASPECT PASS" : "GRID-FLOAT-ASPECT FAIL";
}

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
function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** A wide float source: [H, W, 3], W/H = aspect. Row-major zeros (content value
 *  is irrelevant — only the SHAPE drives the framing under test). */
function floatSource(w: number, h: number): Record<string, unknown> {
  return {
    dtype: "float",
    data: new Float32Array(h * w * 3),
    shape: [h, w, 3],
    precision: "f32",
    numpyDtype: "<f4",
  };
}
function floatLeaf(w: number, h: number): unknown {
  return {
    kind: "plot",
    renderer: "image",
    data: { kind: "inline", props: { source: floatSource(w, h) } },
    props: { toolbar: true },
  };
}

function frames(hostId: string): HTMLElement[] {
  const host = document.getElementById(hostId);
  return host
    ? Array.from(host.querySelectorAll<HTMLElement>("[data-cairn-content-aspect-frame]"))
    : [];
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

  const roots: Root[] = [];

  // ── Part A: SEED ISOLATION ────────────────────────────────────────────────
  // `ContentAspectFrame` with a known `contentAspect` and a child that NEVER
  // publishes a natural size (no `ImagePaneShell` → the report context is never
  // called). Without the seed the frame stays null-aspect → tall 400 fallback →
  // PORTRAIT in a fixed-width auto-height host. With the seed it reshapes to the
  // content aspect. Host is 300px wide, auto height (a grid column / report body).
  const ASPECT = 2; // wide 2:1
  {
    const el = document.getElementById("seed-host")!;
    el.style.cssText = "width:300px;background:#222";
    const rootA = createRoot(el);
    rootA.render(
      createElement(
        ContentAspectFrame,
        { outerHeight: 400, contentAspect: ASPECT },
        createElement("div", { style: { width: "100%", height: "100%" } }),
      ),
    );
    roots.push(rootA);
  }
  const seedSettled = await waitFor(() => {
    const f = frames("seed-host")[0]?.getBoundingClientRect();
    return !!f && f.width > 0 && f.height > 0 && near(f.width / f.height, ASPECT, 0.06);
  });
  const seedFrame = frames("seed-host")[0]?.getBoundingClientRect();
  const seedAspect = seedFrame ? seedFrame.width / seedFrame.height : 0;
  const seedWide = !!seedFrame && seedFrame.width > seedFrame.height;
  report(
    seedSettled && near(seedAspect, ASPECT, 0.06),
    `SEED: frame reshapes to content aspect ${ASPECT} WITHOUT any pane report (got ${seedAspect.toFixed(3)})`,
  );
  report(
    seedWide,
    `SEED: frame is WIDE not portrait (${seedFrame?.width.toFixed(0)}×${seedFrame?.height.toFixed(0)})`,
  );
  ok = ok && seedSettled && near(seedAspect, ASPECT, 0.06) && seedWide;

  // ── Part B: END-TO-END GRID ───────────────────────────────────────────────
  // Three same-aspect WIDE (2:1) float images in a 3-col grid, no rowHeights
  // (auto rows — the user's `cp.Grid`). Every frame must be WIDE and the three
  // the same height (the auto row collapsed onto the content → no bands).
  const gridDescriptor: PlotDescriptor = {
    mode: "local",
    root: {
      kind: "grid",
      cols: 3,
      gap: 8,
      children: [floatLeaf(128, 64), floatLeaf(128, 64), floatLeaf(128, 64)],
    },
  } as unknown as PlotDescriptor;
  {
    const el = document.getElementById("grid-host")!;
    el.style.cssText = "width:960px;background:#222";
    const rootB = createRoot(el);
    rootB.render(createElement(PlotApp, { descriptor: gridDescriptor }));
    roots.push(rootB);
  }
  const gridSettled = await waitFor(() => {
    const fs = frames("grid-host");
    return fs.length >= 3 && fs.every((f) => {
      const r = f.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && near(r.width / r.height, 2, 0.15);
    });
  });
  const gridFrames = frames("grid-host").map((f) => f.getBoundingClientRect());
  report(gridFrames.length >= 3, `GRID: three content-aspect frames present (${gridFrames.length})`);
  const allWide = gridFrames.length >= 3 && gridFrames.every((r) => near(r.width / r.height, 2, 0.15));
  report(
    allWide,
    `GRID: every viewport is WIDE ≈ 2:1 (got ${gridFrames.map((r) => (r.width / r.height).toFixed(2)).join(", ")}) — NOT portrait`,
  );
  const noneTall = gridFrames.every((r) => r.width > r.height);
  report(noneTall, "GRID: no viewport is taller than wide");
  const heights = gridFrames.map((r) => r.height);
  const sameHeight =
    heights.length >= 3 && heights.every((h) => near(h, heights[0], 4));
  report(
    sameHeight,
    `GRID: all three frames the SAME height — the auto row collapsed onto the content, no bands (${heights.map((h) => h.toFixed(0)).join(", ")})`,
  );
  ok = ok && gridSettled && gridFrames.length >= 3 && allWide && noneTall && sameHeight;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
