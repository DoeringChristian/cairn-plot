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

/** The inner CONTENT-ASPECT box inside a host (the child of the frame). */
function innerBox(hostId: string): HTMLElement | null {
  const host = document.getElementById(hostId);
  const frame = host?.querySelector<HTMLElement>("[data-cairn-content-aspect-frame]");
  return frame?.querySelector<HTMLElement>(":scope > div") ?? null;
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

  const roots: Root[] = [];
  const mount = (divId: string, d: PlotDescriptor) => {
    const el = document.getElementById(divId)!;
    // Force a definite LANDSCAPE host box (420×240) so "fill vs content-aspect"
    // is meaningful and "100%" outer heights have something to resolve against.
    el.style.cssText = "width:420px;height:240px;overflow:hidden;background:#222";
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

  const host = document.getElementById("mount-square")!.getBoundingClientRect();
  const HOST_ASPECT = host.width / host.height; // 420/240 = 1.75 (landscape)

  // The meaningful, layout-robust invariant: the drawable frame reshapes to the
  // CONTENT aspect (NOT the mismatched host box aspect of 1.75). That is exactly
  // "the viewport tracks the content, not the box". (Absolute fill / clipping is
  // a function of the host's flex context — proven for real grid cells by the
  // selection-stage harness — so it is not re-asserted against this bare host.)

  // --- SQUARE image → frame aspect ≈ 1 (≠ host 1.75) --------------------------
  const squareReady = await waitFor(() => {
    const b = innerBox("mount-square")?.getBoundingClientRect();
    return !!b && b.width > 0 && b.height > 0 && near(b.width / b.height, 1, 0.06);
  });
  report(squareReady, "the SQUARE image frame settled to the content aspect (~1:1)");
  const sq = innerBox("mount-square")!.getBoundingClientRect();
  const sqAspect = sq.width / sq.height;
  const sqMatchesContent = near(sqAspect, 1, 0.06);
  const sqNotHost = Math.abs(sqAspect - HOST_ASPECT) > 0.2;
  report(sqMatchesContent, `square frame aspect ≈ content 1.0 (${sqAspect.toFixed(3)})`);
  report(sqNotHost, `square frame aspect ≠ host box aspect ${HOST_ASPECT.toFixed(2)} — reshaped to content, not the box`);
  ok = ok && squareReady && sqMatchesContent && sqNotHost;

  // --- WIDE 2:1 image → frame aspect ≈ 2 (≠ host 1.75) -----------------------
  const wideReady = await waitFor(() => {
    const b = innerBox("mount-wide")?.getBoundingClientRect();
    return !!b && b.width > 0 && b.height > 0 && near(b.width / b.height, 2, 0.12);
  });
  report(wideReady, "the WIDE 2:1 image frame settled to the content aspect (~2:1)");
  const wd = innerBox("mount-wide")!.getBoundingClientRect();
  const wdAspect = wd.width / wd.height;
  const wdMatchesContent = near(wdAspect, 2, 0.12);
  const wdNotHost = Math.abs(wdAspect - HOST_ASPECT) > 0.2;
  report(wdMatchesContent, `wide frame aspect ≈ content 2.0 (${wdAspect.toFixed(3)})`);
  report(wdNotHost, `wide frame aspect ≠ host box aspect ${HOST_ASPECT.toFixed(2)} — reshaped to content, not the box`);
  ok = ok && wideReady && wdMatchesContent && wdNotHost;

  // The two content aspects are DISTINCT (the frame really tracks each image, not
  // a fixed box): square ≈ 1 vs wide ≈ 2.
  const distinct = Math.abs(sqAspect - wdAspect) > 0.5;
  report(distinct, `the two frames took DIFFERENT content aspects (${sqAspect.toFixed(2)} vs ${wdAspect.toFixed(2)})`);
  ok = ok && distinct;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
