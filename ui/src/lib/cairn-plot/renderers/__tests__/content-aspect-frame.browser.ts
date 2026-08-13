/**
 * CONTENT-ASPECT FRAMING — LIVE, self-driving browser harness (Part 1 of the
 * aspect/packing feature). Mounts a standalone image pane in a deliberately
 * NON-content-aspect (1.75 landscape) host box and asserts the drawable frame
 * reshapes to the CONTENT aspect rather than the mismatched box aspect:
 *
 *   - a SQUARE (64×64) image → the frame's aspect ≈ 1 (≠ the 1.75 host);
 *   - a WIDE 2:1 (128×64) image → the frame's aspect ≈ 2 (≠ the 1.75 host);
 *   - the two frames take DISTINCT aspects (it tracks each image, not a box).
 *
 * This proves "the viewport tracks the content, not the box" (the empty-band
 * fix). Absolute fill/clipping depends on the host's flex context (proven for
 * real grid cells by the selection-stage harness), so it is not re-asserted
 * against this bare block host. CPU backend forced (uint8 URL images need no
 * WebGPU); each image is a canvas-drawn PNG data URL whose pixel dims set the
 * content aspect.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";

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
  document.title = pass ? "CONTENT-ASPECT PASS" : "CONTENT-ASPECT FAIL";
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

function makeImageUrl(w: number, h: number, color: string): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c.toDataURL("image/png");
}
function imageDescriptor(w: number, h: number, color: string): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "plot",
      renderer: "image",
      data: { kind: "url", src: makeImageUrl(w, h, color) },
      props: { toolbar: true },
    },
  } as PlotDescriptor;
}

/** The content-aspect FRAME element inside a host (it IS the content-aspect box
 *  now — it reshapes itself, not an inner child). */
function innerBox(hostId: string): HTMLElement | null {
  const host = document.getElementById(hostId);
  return host?.querySelector<HTMLElement>("[data-cairn-content-aspect-frame]") ?? null;
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

  const roots: Root[] = [];
  const HOST_W = 300;
  const mount = (divId: string, d: PlotDescriptor) => {
    const el = document.getElementById(divId)!;
    // A fixed-WIDTH, AUTO-HEIGHT host (a gallery column / report body / auto card):
    // the exact context where "big empty bands" appear. With the fix the host
    // COLLAPSES to the content-aspect frame → NO bands. (`height` is intentionally
    // unset so the parent tracks the child.)
    el.style.cssText = `width:${HOST_W}px;background:#222`;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { descriptor: d }));
    roots.push(root);
  };
  mount("mount-square", imageDescriptor(64, 64, "#c0392b")); // aspect 1
  mount("mount-wide", imageDescriptor(128, 64, "#2980b9")); // aspect 2

  const imagesReady = await waitFor(
    () => document.querySelectorAll("img[src^='data:image/png']").length >= 2,
  );
  report(imagesReady, "both standalone image panes mount");
  ok = ok && imagesReady;

  // The real "no empty bands" invariant: in a fixed-width / auto-height parent the
  // frame reshapes to the CONTENT aspect (width-driven), and the PARENT COLLAPSES
  // onto it — so the parent's height ≈ the frame's height (no vertical bands) and
  // the frame spans the full parent width (no horizontal bands). This is exactly
  // the empty-space fix the previous (center-in-fixed-box) version did NOT deliver.
  const check = async (id: string, aspect: number, tol: number, name: string): Promise<boolean> => {
    const settled = await waitFor(() => {
      const b = innerBox(id)?.getBoundingClientRect();
      return !!b && b.width > 0 && b.height > 0 && near(b.width / b.height, aspect, tol);
    });
    const frame = innerBox(id)!.getBoundingClientRect();
    const hostBox = document.getElementById(id)!.getBoundingClientRect();
    const a = frame.width / frame.height;
    const aspectOk = near(a, aspect, tol);
    const expectH = HOST_W / aspect;
    // Slack SLACK ≈ the pane's own chrome padding (~8px/side) — the point is the
    // absence of BIG bands (the old behaviour parked the pane in a fixed 400px
    // box regardless of content), not sub-pixel exactness.
    const SLACK = 20;
    const fillsWidth = frame.width >= HOST_W - SLACK; //   ~full parent width: no side bands
    const parentCollapsed = near(hostBox.height, expectH, SLACK); // host tracks content height: no vertical bands
    const notFixedBox = Math.abs(hostBox.height - 400) > 60; // NOT the old fixed DEFAULT_CHART_HEIGHT
    report(settled && aspectOk, `${name}: frame aspect ≈ content ${aspect} (got ${a.toFixed(3)})`);
    report(fillsWidth, `${name}: frame spans ~full parent width (${frame.width.toFixed(0)}/${HOST_W}) — NO side bands`);
    report(
      parentCollapsed && notFixedBox,
      `${name}: parent COLLAPSED to content height (host ${hostBox.height.toFixed(0)} ≈ ${expectH.toFixed(0)}, not a fixed 400px box) — NO empty bands`,
    );
    return settled && aspectOk && fillsWidth && parentCollapsed && notFixedBox;
  };

  const sqOk = await check("mount-square", 1, 0.06, "SQUARE (64×64)");
  const wdOk = await check("mount-wide", 2, 0.12, "WIDE 2:1 (128×64)");
  ok = ok && sqOk && wdOk;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
