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
 * Three parts:
 *   A. SEED ISOLATION — mount `ContentAspectFrame` directly with `contentAspect`
 *      and a child that NEVER reports a natural size (the GPU-timing scenario).
 *      The frame must still reshape to the content aspect (the portrait fix).
 *   B. SAME-ASPECT GRID — a real `cp.Grid` of three same-aspect WIDE float
 *      sources: every viewport WIDE and the SAME size (no portrait, no bands).
 *   C. MIXED-ASPECT GRID — wide + square + tall float sources in one row: every
 *      VIEWPORT the SAME size (a grid is a UNIFORM layout; a mismatched image
 *      letterboxes within its uniform cell), and the pane FILLS its cell so the
 *      selection ring matches the viewport ("ring larger than viewport" fix).
 * CPU backend forced — `CpuImagePane` tone-maps float on the CPU, no WebGPU.
 */
import { floatValues } from "../../../plots/image/model/pixel-buffer.ts";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotSpec } from "../../../host/spec-resolver";
import { ContentAspectFrame } from "../../../layout/ContentAspectFrame";
import { createHarness, sleep, waitFor } from "../../harness";

const { report, setOverallStatus } = createHarness({ title: "GRID-FLOAT-ASPECT" });

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** A wide float source: [H, W, 3], W/H = aspect. Row-major zeros (content value
 *  is irrelevant — only the SHAPE drives the framing under test). */
function floatSource(w: number, h: number): Record<string, unknown> {
  return {
    dtype: "float",
    pixels: floatValues(new Float32Array(h * w * 3)),
    shape: [h, w, 3],
    numpyDtype: "<f4",
  };
}
function floatLeaf(w: number, h: number): unknown {
  return {
    kind: "plot",
    type: "image",
    data: { kind: "inline", props: { source: floatSource(w, h) } },
    props: { toolbar: true },
  };
}

/** Standalone content-aspect frames (Part A / standalone panes). */
function frames(hostId: string): HTMLElement[] {
  const host = document.getElementById(hostId);
  return host
    ? Array.from(host.querySelectorAll<HTMLElement>("[data-cairn-content-aspect-frame]"))
    : [];
}
/** Grid VIEWPORTS — the selectable grid item (the pane fills it, so this IS the
 *  viewport and the selection ring). */
function gridCells(hostId: string): HTMLElement[] {
  const host = document.getElementById(hostId);
  return host
    ? Array.from(host.querySelectorAll<HTMLElement>('[data-plot-pane-id][data-selectable="true"]'))
    : [];
}
/** The pane body that fills each grid cell (`GridCellReporter`). */
function cellBodies(hostId: string): HTMLElement[] {
  const host = document.getElementById(hostId);
  return host ? Array.from(host.querySelectorAll<HTMLElement>("[data-cairn-grid-cell]")) : [];
}
function gridDescriptor(sizes: Array<[number, number]>): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: sizes.length,
      gap: 8,
      children: sizes.map(([w, h]) => floatLeaf(w, h)),
    },
  } as unknown as PlotSpec;
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
      createElement(ContentAspectFrame, {
        outerHeight: 400,
        contentAspect: ASPECT,
        children: createElement("div", { style: { width: "100%", height: "100%" } }),
      }),
    );
    roots.push(rootA);
  }
  const seedSettled = await waitFor(() => {
    const f = frames("seed-host")[0]?.getBoundingClientRect();
    return !!f && f.width > 0 && f.height > 0 && near(f.width / f.height, ASPECT, 0.06);
  }, 6000, 20);
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

  // ── Part B: SAME-ASPECT GRID ──────────────────────────────────────────────
  // Three same-aspect WIDE (2:1) float images in a 3-col grid, no rowHeights
  // (auto rows — the user's `cp.Grid`). Uniform aspect = the content aspect, so
  // every viewport is WIDE and the same size (no portrait, no bands).
  {
    const el = document.getElementById("grid-host")!;
    el.style.cssText = "width:960px;background:#222";
    const rootB = createRoot(el);
    rootB.render(createElement(PlotApp, { spec: gridDescriptor([[128, 64], [128, 64], [128, 64]]) }));
    roots.push(rootB);
  }
  await waitFor(() => {
    const cs = gridCells("grid-host");
    return cs.length >= 3 && cs.every((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && near(r.width / r.height, 2, 0.15);
    });
  }, 6000, 20);
  const bCells = gridCells("grid-host").map((c) => c.getBoundingClientRect());
  report(bCells.length >= 3, `SAME-ASPECT: three cells present (${bCells.length})`);
  const bWide = bCells.length >= 3 && bCells.every((r) => near(r.width / r.height, 2, 0.15) && r.width > r.height);
  report(
    bWide,
    `SAME-ASPECT: every viewport WIDE ≈ 2:1, none portrait (${bCells.map((r) => (r.width / r.height).toFixed(2)).join(", ")})`,
  );
  const bUniform =
    bCells.length >= 3 &&
    bCells.every((r) => near(r.width, bCells[0].width, 2) && near(r.height, bCells[0].height, 2));
  report(
    bUniform,
    `SAME-ASPECT: all cells the SAME size (${bCells.map((r) => `${r.width.toFixed(0)}×${r.height.toFixed(0)}`).join(", ")})`,
  );
  ok = ok && bCells.length >= 3 && bWide && bUniform;

  roots.pop()?.unmount(); // tear down grid-host root
  await sleep(30);

  // ── Part C: MIXED-ASPECT GRID (the new "smart about grids" requirement) ────
  // A wide 2:1, a square 1:1, and a tall 1:2 float image in one row. Despite the
  // different content aspects, every VIEWPORT must be the SAME size (a grid is a
  // uniform layout — a mismatched image object-contain letterboxes WITHIN its
  // uniform cell). AND the pane must FILL its cell, so the selectable frame IS
  // the viewport (the selection ring matches it — no "ring larger than viewport").
  {
    const el = document.getElementById("grid-host")!;
    el.style.cssText = "width:960px;background:#222";
    const rootC = createRoot(el);
    rootC.render(createElement(PlotApp, { spec: gridDescriptor([[128, 64], [96, 96], [64, 128]]) }));
    roots.push(rootC);
  }
  await waitFor(() => gridCells("grid-host").length >= 3 && cellBodies("grid-host").length >= 3, 6000, 20);
  await sleep(120); // let the representative aspect settle across all three reports
  const cCells = gridCells("grid-host").map((c) => c.getBoundingClientRect());
  const cBodies = cellBodies("grid-host").map((c) => c.getBoundingClientRect());
  report(cCells.length >= 3, `MIXED: three cells present (${cCells.length})`);
  const cUniform =
    cCells.length >= 3 &&
    cCells.every((r) => near(r.width, cCells[0].width, 2) && near(r.height, cCells[0].height, 2));
  report(
    cUniform,
    `MIXED: cells are UNIFORM despite different content aspects (${cCells.map((r) => `${r.width.toFixed(0)}×${r.height.toFixed(0)}`).join(", ")})`,
  );
  // The pane body fills the cell → viewport == selectable frame → ring matches.
  const cFills =
    cBodies.length >= 3 &&
    cCells.length >= 3 &&
    cBodies.every((b, i) => near(b.width, cCells[i].width, 2) && near(b.height, cCells[i].height, 2));
  report(cFills, "MIXED: the pane FILLS its cell (viewport = selectable frame → selection ring matches)");
  ok = ok && cCells.length >= 3 && cUniform && cFills;

  roots.pop()?.unmount(); // tear down the mixed grid
  await sleep(30);

  // ── Part D: PAGE-HEIGHT CAP in a grid, WITHOUT gaps between figures ────────
  // A grid of very TALL images (aspect 0.125): each cell's aspect-derived height
  // (colWidth / aspect ≈ 2500px) must be capped at the window (page) height so a
  // tall grid image stays viewable in one screenful. The cap is on the grid
  // CONTAINER width (centred), so cells stay EDGE-TO-EDGE (only the 8px gap
  // between them) — no unusable space between figures.
  {
    const el = document.getElementById("grid-host")!;
    el.style.cssText = "width:960px;background:#222";
    const rootD = createRoot(el);
    rootD.render(createElement(PlotApp, { spec: gridDescriptor([[64, 512], [64, 512], [64, 512]]) }));
    roots.push(rootD);
  }
  const CAP = window.innerHeight - 24; // matches VIEWPORT_HEIGHT_MARGIN
  await waitFor(() => {
    const cs = gridCells("grid-host");
    return cs.length >= 3 && cs.every((c) => c.getBoundingClientRect().height > 0 && c.getBoundingClientRect().height <= CAP + 4);
  }, 6000, 20);
  await sleep(80);
  const dCells = gridCells("grid-host").map((c) => c.getBoundingClientRect());
  const dCapped = dCells.length >= 3 && dCells.every((r) => r.height <= CAP + 4);
  report(
    dCapped,
    `TALL grid: every cell height ≤ page height ${CAP} (got ${dCells.map((r) => r.height.toFixed(0)).join(", ")})`,
  );
  const dAspect = dCells.length >= 3 && dCells.every((r) => near(r.width / r.height, 0.125, 0.03));
  report(dAspect, `TALL grid: cells keep the content aspect 0.125 (${dCells.map((r) => (r.width / r.height).toFixed(3)).join(", ")})`);
  // Adjacent cells sit ONE grid gap apart (~8px) — NOT floating in wide columns
  // with big centring gaps between them.
  const hGap = dCells.length >= 2 ? dCells[1].left - (dCells[0].left + dCells[0].width) : 999;
  const edgeToEdge = near(hGap, 8, 3);
  report(edgeToEdge, `TALL grid: figures are edge-to-edge (h-gap ${hGap.toFixed(1)}px ≈ 8px grid gap, no unusable space between)`);
  ok = ok && dCapped && dAspect && edgeToEdge;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
