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
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotSpec } from "../../../../../packages/spec/src/spec.ts";
import { createHarness, sleep, waitFor } from "../../harness";

const { report, setOverallStatus } = createHarness({ title: "CONTENT-ASPECT" });

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
function imageDescriptor(w: number, h: number, color: string): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "plot",
      type: "image",
      data: { kind: "url", src: makeImageUrl(w, h, color) },
      props: { toolbar: true },
    },
  } as PlotSpec;
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
  const mount = (divId: string, d: PlotSpec) => {
    const el = document.getElementById(divId)!;
    // A fixed-WIDTH, AUTO-HEIGHT host (a gallery column / report body / auto card):
    // the exact context where "big empty bands" appear. With the fix the host
    // COLLAPSES to the content-aspect frame → NO bands. (`height` is intentionally
    // unset so the parent tracks the child.)
    el.style.cssText = `width:${HOST_W}px;background:#222`;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { spec: d }));
    roots.push(root);
  };
  mount("mount-square", imageDescriptor(64, 64, "#c0392b")); // aspect 1
  mount("mount-wide", imageDescriptor(128, 64, "#2980b9")); // aspect 2

  const imagesReady = await waitFor(
    () => document.querySelectorAll("img[src^='data:image/png']").length >= 2, 6000, 20);
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
    }, 6000, 20);
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
  roots.length = 0;
  await sleep(30);

  // PAGE-HEIGHT CAP — a very TALL image's drawable box must not exceed the window
  // (page) height, so it stays viewable in ONE screenful; the width shrinks to
  // keep the content aspect (centred). Fixed-WIDTH (300) auto-height host; the
  // uncapped width-driven height (300 / aspect = ~4800) is far taller than any
  // window, so the cap MUST engage.
  const VIEWPORT_MARGIN = 24; // matches ContentAspectFrame's VIEWPORT_HEIGHT_MARGIN
  const TALL_ASPECT = 32 / 512; // 0.0625 — a very tall portrait
  {
    const el = document.getElementById("mount-square")!;
    el.style.cssText = `width:${HOST_W}px;background:#222`;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { spec: imageDescriptor(32, 512, "#16a085") }));
    roots.push(root);
  }
  const cap = window.innerHeight - VIEWPORT_MARGIN;
  const tallSettled = await waitFor(() => {
    const b = innerBox("mount-square")?.getBoundingClientRect();
    return !!b && b.height > 4 && b.width > 1 && near(b.width / b.height, TALL_ASPECT, 0.02);
  }, 6000, 20);
  const tf = innerBox("mount-square")!.getBoundingClientRect();
  const keptAspect = near(tf.width / tf.height, TALL_ASPECT, 0.02);
  const capped = tf.height <= cap + 4;
  const wasClamped = tf.height < HOST_W / TALL_ASPECT - 100; // NOT the uncapped ~4800px
  report(tallSettled && keptAspect, `TALL cap: box keeps content aspect ${TALL_ASPECT.toFixed(4)} (got ${(tf.width / tf.height).toFixed(4)})`);
  report(
    capped && wasClamped,
    `TALL cap: box height ${tf.height.toFixed(0)} ≤ page height ${cap} (not the uncapped ${(HOST_W / TALL_ASPECT).toFixed(0)})`,
  );
  ok = ok && tallSettled && keptAspect && capped && wasClamped;

  roots.forEach((r) => r.unmount());
  roots.length = 0;
  await sleep(30);

  // FIXED-container guard (both orientations) — the pane must be sized to the
  // largest content-aspect box that FITS the fixed host, in BOTH dimensions, so
  // there is NO letterbox AND NO overflow (the previous cut overflowed a tall
  // image in a short-wide container). The host is bounded on BOTH axes here, so
  // the frame does NOT fill it — the point is the pane's OWN box is content-
  // aspect (no checkerboard) and stays within the host.
  const checkFixed = async (
    id: string,
    hostW: number,
    hostH: number,
    imgW: number,
    imgH: number,
    name: string,
  ): Promise<boolean> => {
    const el = document.getElementById(id)!;
    el.style.cssText = `width:${hostW}px;height:${hostH}px;overflow:hidden;background:#222`;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { spec: imageDescriptor(imgW, imgH, "#8e44ad") }));
    roots.push(root);
    const aspect = imgW / imgH;
    const settled = await waitFor(() => {
      const b = innerBox(id)?.getBoundingClientRect();
      return !!b && b.width > 4 && b.height > 4 && near(b.width / b.height, aspect, 0.08);
    }, 6000, 20);
    const f = innerBox(id)!.getBoundingClientRect();
    const contentAspect = near(f.width / f.height, aspect, 0.08);
    const fits = f.width <= hostW + 2 && f.height <= hostH + 2; // NO overflow
    report(settled && contentAspect, `${name}: pane is content-aspect ${aspect.toFixed(2)} (got ${(f.width / f.height).toFixed(3)}) — no checkerboard`);
    report(fits, `${name}: pane fits the fixed ${hostW}×${hostH} host (${f.width.toFixed(0)}×${f.height.toFixed(0)}) — no overflow`);
    return settled && contentAspect && fits;
  };

  // wide 2:1 image in a fixed TALL host → ~fills width, short (fits).
  const fixA = await checkFixed("mount-square", 300, 500, 128, 64, "FIXED tall host / wide img");
  // tall 1:2 image in a fixed SHORT-WIDE host → ~fills height, narrow (fits — the overflow guard).
  const fixB = await checkFixed("mount-wide", 500, 300, 64, 128, "FIXED short host / tall img");
  ok = ok && fixA && fixB;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
