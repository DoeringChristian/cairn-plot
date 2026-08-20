/**
 * STACKED GRID — a `cp.Grid(mode="stacked")` shows ONE child at a time with a
 * keyboard-driven tab strip, plus a live normal⇄stacked toggle on the grid.
 * Verifies: the toggle exists (the reported "no such button"); stacked shows one
 * pane + N tabs; arrows / hjkl / number / letter switch the active tab; clicking
 * the toggle flips modes; a single-child grid has no toggle. CPU float panes —
 * no WebGPU needed.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../plot-renderers";
import type { PlotDescriptor } from "../../../plot-descriptor";

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
  document.title = pass ? "GRID-STACKED PASS" : "GRID-STACKED FAIL";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred: () => boolean, timeoutMs = 5000, step = 20): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

function floatLeaf(w: number, h: number, label: string): unknown {
  const data = new Float32Array(h * w * 3);
  for (let i = 0; i < data.length; i++) data[i] = ((i % 97) / 97) * 0.8;
  return {
    kind: "plot",
    renderer: "image",
    data: { kind: "inline", props: { source: { dtype: "float", data, shape: [h, w, 3], precision: "f32" } } },
    props: { toolbar: true, label },
  };
}
// A flat colour PNG data-url — the CPU compare pane takes URL sources and
// rasterizes/blends them with a CSS `translate(pan) scale(zoom)` transform (the
// same transform an image leaf uses), so a MIXED stack's camera is observable
// on both cell types without WebGPU.
function imgUrl(color: string): string {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#000";
  ctx.fillRect(4, 4, 8, 8);
  return c.toDataURL("image/png");
}
function compareUrlChild(fg: string, ref: string, label: string): unknown {
  return {
    kind: "compare",
    mode: "split", // CPU-composited split (no WebGPU) — still exercises the sync group
    a: { kind: "url", src: imgUrl(fg) },
    b: { kind: "url", src: imgUrl(ref) },
    props: { toolbar: true, label },
  };
}
// A DIFF-mode compare (mode="diff") lowers — post Phase 2c routing — to the SAME
// `image` renderer family an image leaf uses (`LeafView` + a `compareSource`),
// so an `[image, diff]` stack is HOMOGENEOUS and a flip is a SOURCE-SWAP on ONE
// reused instance (no remount / no flicker). URL sources ⇒ CpuImagePane renders
// each as an `<img>` (no WebGPU needed to prove the React reconciliation).
function diffUrlChild(fg: string, ref: string, label: string): unknown {
  return {
    kind: "compare",
    mode: "diff",
    a: { kind: "url", src: imgUrl(fg) },
    b: { kind: "url", src: imgUrl(ref) },
    diffSubmode: "absolute",
    props: { toolbar: true, label },
  };
}
// A stacked grid mixing an image LEAF and a DIFF compare — homogeneous by the
// Phase 2c `stackKindKey` (both lower to `plot:image`), so the flip is a reused-
// instance source-swap, NOT a mount-swap.
function imageDiffGrid(mode: "normal" | "stacked"): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode,
      children: [
        { kind: "plot", renderer: "image", data: { kind: "url", src: imgUrl("#888") }, props: { toolbar: true, label: "Image" } },
        diffUrlChild("#c0392b", "#2980b9", "Diff"),
      ],
    },
  } as unknown as PlotDescriptor;
}
// A HETEROGENEOUS grid: an image LEAF next to a COMPARE pane. Stacking these
// can't reuse ONE renderer instance (the pane mount-swaps on the kind flip), so
// the grid threads stage-style viewport+settings sync groups to carry zoom/pan
// across the remount. Pre-fix the ▭ toggle was hidden on any mixed grid.
function mixedGrid(mode: "normal" | "stacked"): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      mode,
      children: [floatLeaf(96, 96, "Image"), compareUrlChild("#c0392b", "#2980b9", "Compare")],
    },
  } as unknown as PlotDescriptor;
}
function stackedGrid(labels: string[], mode: "normal" | "stacked"): PlotDescriptor {
  // DELIBERATELY different sizes/aspects per child: the stacked viewport BOX is
  // latched (one fixed surface; a differently-shaped slot letterboxes within
  // it), and the box-stability assertions below depend on the children actually
  // differing — identical children would pass even without the latch.
  const dims: Array<[number, number]> = [
    [96, 96],
    [48, 192],
    [144, 48],
  ];
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: labels.length,
      gap: 8,
      mode,
      children: labels.map((l, i) => floatLeaf(...(dims[i % dims.length] as [number, number]), l)),
    },
  } as unknown as PlotDescriptor;
}

function host(id: string): HTMLElement {
  const el = document.getElementById(id)!;
  el.style.cssText = "width:640px;background:#222";
  return el;
}
const q = (id: string, sel: string) => document.getElementById(id)!.querySelector<HTMLElement>(sel);
const qa = (id: string, sel: string) => Array.from(document.getElementById(id)!.querySelectorAll<HTMLElement>(sel));
// Stacked mode renders ONE reused pane; the active tab index lives on the
// stacked-view container (`data-cairn-stack-active`), not per-child panes.
const activePaneIndex = (id: string): number => {
  const el = q(id, "[data-cairn-stack-active]");
  const v = el?.getAttribute("data-cairn-stack-active");
  return v == null ? -1 : parseInt(v, 10);
};
const key = (k: string, extra: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;
  const roots: Root[] = [];

  // ── A stacked grid of 3 labelled panes ────────────────────────────────────
  const rootA = createRoot(host("m1"));
  rootA.render(createElement(PlotApp, { descriptor: stackedGrid(["Alpha", "Bravo", "Charlie"], "stacked") }));
  roots.push(rootA);

  const up = await waitFor(() => qa("m1", "[data-cairn-stack-tab]").length >= 1 || qa("m1", "[role='tab']").length >= 3);
  const tabs = qa("m1", "[role='tab']");
  report(tabs.length === 3, `stacked grid renders a tab strip with 3 tabs (got ${tabs.length})`);
  report(!!q("m1", "[data-cairn-grid-header]"), "grid header (holds tabs + toggle, above the viewports) present");
  report(!!q("m1", "[data-cairn-stacked-view]"), "stacked panes container present");
  // Single-renderer model: exactly ONE pane is rendered (the active source), not
  // three hidden ones — flipping swaps the source on this reused instance.
  const oneVisible =
    qa("m1", "[data-cairn-stacked-pane]").length === 1 &&
    qa("m1", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneVisible, "exactly ONE pane rendered (single reused renderer, not N hidden panes)");
  report(activePaneIndex("m1") === 0, `tab 0 active initially (got ${activePaneIndex("m1")})`);
  ok = ok && up && tabs.length === 3 && oneVisible && activePaneIndex("m1") === 0;

  // hover the stack so keys are in scope, then navigate.
  q("m1", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));

  key("ArrowRight");
  report(await waitFor(() => activePaneIndex("m1") === 1), `→ moves to tab 1 (got ${activePaneIndex("m1")})`);
  key("l"); // vim next
  report(await waitFor(() => activePaneIndex("m1") === 2), `l (vim) → tab 2 (got ${activePaneIndex("m1")})`);
  key("l"); // wrap
  report(await waitFor(() => activePaneIndex("m1") === 0), `l wraps 2→0 (got ${activePaneIndex("m1")})`);
  key("h"); // vim prev wraps
  report(await waitFor(() => activePaneIndex("m1") === 2), `h (vim) wraps 0→2 (got ${activePaneIndex("m1")})`);
  key("1"); // number jump
  report(await waitFor(() => activePaneIndex("m1") === 0), `number 1 → tab 0 (got ${activePaneIndex("m1")})`);
  key("c"); // letter jump
  report(await waitFor(() => activePaneIndex("m1") === 2), `letter c → tab 2 (got ${activePaneIndex("m1")})`);
  ok =
    ok &&
    activePaneIndex("m1") === 2;

  // ── VIEWPORT-BOX LATCH: one FIXED surface across flips ────────────────────
  // The children have DIFFERENT aspects (1:1, 1:4, 3:1). Without the latch the
  // stacked box tracked the ACTIVE slot's aspect (its only reporter) and the
  // canvas RESIZED on every flip — the reported "canvas size changes per
  // viewport". The box must stay identical on every tab.
  const viewBox = (): string => {
    const v = q("m1", "[data-cairn-stacked-view]")!.getBoundingClientRect();
    return `${Math.round(v.width)}x${Math.round(v.height)}`;
  };
  key("1");
  await waitFor(() => activePaneIndex("m1") === 0);
  await sleep(100);
  const box0 = viewBox();
  key("2");
  await waitFor(() => activePaneIndex("m1") === 1);
  await sleep(100);
  const box1 = viewBox();
  key("3");
  await waitFor(() => activePaneIndex("m1") === 2);
  await sleep(100);
  const box2 = viewBox();
  const boxStable = box0 === box1 && box1 === box2;
  report(boxStable, `stacked viewport BOX is latched across flips of differently-shaped slots (${box0} | ${box1} | ${box2})`);
  ok = ok && boxStable;

  // ── ZOOM PERSISTENCE: the shared camera survives a flip ───────────────────
  // Wheel-zoom the (CPU) pane — its zoom renders as an inline `scale(...)`
  // transform — then flip and assert the SAME transform still applies (one
  // reused renderer instance ⇒ one camera, shared by construction).
  const zoomTransformsIn = (id: string): string[] =>
    qa(id, "*")
      .filter((n) => n.style?.transform && /scale\(/.test(n.style.transform))
      .map((n) => n.style.transform);
  const zoomTransforms = (): string[] => zoomTransformsIn("m1");
  const surface = q("m1", "[data-cairn-stacked-pane] canvas") ?? q("m1", "[data-cairn-stacked-pane] img");
  if (surface) {
    const r = surface.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      surface.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          deltaY: -120,
          ctrlKey: true, // wheel zoom is modifier-gated (ctrl = pinch signature)
        }),
      );
      await sleep(30);
    }
    await sleep(150);
    const zoomed = zoomTransforms();
    const zoomApplied = zoomed.length > 0 && zoomed.some((t) => !/scale\(1\)/.test(t));
    report(zoomApplied, `wheel-zoom applied on the stacked pane (transforms: ${JSON.stringify(zoomed)})`);
    key("1"); // flip to tab 0
    await waitFor(() => activePaneIndex("m1") === 0);
    await sleep(150);
    const afterFlip = zoomTransforms();
    const zoomPersisted = JSON.stringify(afterFlip) === JSON.stringify(zoomed);
    report(zoomPersisted, `the zoom PERSISTS across the flip (before ${JSON.stringify(zoomed)} → after ${JSON.stringify(afterFlip)})`);
    ok = ok && zoomApplied && zoomPersisted;
  } else {
    report(false, "no pane surface found for the zoom-persistence check");
    ok = false;
  }

  // ── The live toggle: a NORMAL grid has the button; click → stacked ────────
  const rootB = createRoot(host("m2"));
  rootB.render(createElement(PlotApp, { descriptor: stackedGrid(["one", "two", "three"], "normal") }));
  roots.push(rootB);
  const toggleUp = await waitFor(() => !!q("m2", "[data-cairn-grid-mode-toggle]"));
  report(toggleUp, "NORMAL grid shows the normal|stacked toggle button (the missing button)");
  const startsNormal = await waitFor(() => qa("m2", "[role='tab']").length === 0);
  report(startsNormal, "normal grid shows NO tab strip");
  const stackedBtn = q("m2", '[data-cairn-grid-mode="stacked"]');
  report(!!stackedBtn, "toggle has a 'stacked' button");
  stackedBtn?.click();
  const flipped = await waitFor(() => qa("m2", "[role='tab']").length === 3);
  report(flipped, "clicking the toggle switches the grid to stacked (tab strip appears)");
  ok = ok && toggleUp && startsNormal && !!stackedBtn && flipped;

  // ── Single-child grid: no toggle (stacking a lone child is a no-op) ───────
  const rootC = createRoot(host("m3"));
  rootC.render(createElement(PlotApp, { descriptor: stackedGrid(["solo"], "normal") }));
  roots.push(rootC);
  await sleep(150);
  const noToggle = !q("m3", "[data-cairn-grid-mode-toggle]");
  report(noToggle, "single-child grid has NO mode toggle");
  ok = ok && noToggle;

  // ── MIXED image + compare stack: toggle present, mount-swap keeps the camera ─
  // The reported bug: a grid mixing an image leaf and a compare pane offered NO
  // ▭ toggle (stacking required a HOMOGENEOUS grid). Now a mixed image-compatible
  // grid stacks too — the pane mount-swaps on a kind flip but the stacked grid's
  // sync groups carry zoom/pan across the remount, so pixel-level eyeballing
  // survives a flip.
  const rootD = createRoot(host("m4"));
  rootD.render(createElement(PlotApp, { descriptor: mixedGrid("normal") }));
  roots.push(rootD);
  const mixToggle = await waitFor(() => !!q("m4", "[data-cairn-grid-mode-toggle]"));
  report(mixToggle, "MIXED image+compare grid shows the normal|stacked toggle (was hidden pre-fix)");
  q("m4", '[data-cairn-grid-mode="stacked"]')?.click();
  const mixStacked = await waitFor(() => qa("m4", "[role='tab']").length === 2);
  report(mixStacked, `mixed grid switches to stacked: 2 tabs (got ${qa("m4", "[role='tab']").length})`);
  const oneMixPane = qa("m4", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneMixPane, "exactly ONE pane rendered in the mixed stack (single mounted slot)");
  const imgOnTab0 = await waitFor(
    () => !!(q("m4", "[data-cairn-stacked-pane] canvas") ?? q("m4", "[data-cairn-stacked-pane] img")),
  );
  report(imgOnTab0, "tab 0 mounts the IMAGE leaf");
  ok = ok && mixToggle && mixStacked && oneMixPane && imgOnTab0;

  // Zoom the image (tab 0), then flip through the COMPARE (tab 1) and back. The
  // image REMOUNTS on the round-trip (image→compare→image is a mount-swap, not a
  // source-swap), so a surviving zoom proves the sync group — not instance reuse
  // — carried the camera. The compare must ALSO show the same zoom on its tab
  // (cross-type adoption).
  q("m4", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
  const mixSurface = q("m4", "[data-cairn-stacked-pane] canvas") ?? q("m4", "[data-cairn-stacked-pane] img");
  if (mixSurface) {
    const r = mixSurface.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      mixSurface.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          deltaY: -120,
          ctrlKey: true,
        }),
      );
      await sleep(30);
    }
    await sleep(150);
    const mixImgZoom = zoomTransformsIn("m4");
    const mixZoomApplied = mixImgZoom.some((t) => !/scale\(1\)/.test(t));
    report(mixZoomApplied, `wheel-zoom applied on the mixed stack's image (${JSON.stringify(mixImgZoom)})`);

    key("2"); // → compare tab (mount-swap)
    await waitFor(() => activePaneIndex("m4") === 1);
    // The CPU compare pane stacks two <img>s (foreground "pred" over reference
    // "ref"); the image leaf is a <canvas>. `img[alt="ref"]` is unique to the
    // compare, so its presence proves the mount-swap put the compare on tab 1.
    const compareShown = await waitFor(() => !!q("m4", "[data-cairn-stacked-pane] img[alt='ref']"));
    report(compareShown, "flip to tab 1 MOUNT-SWAPS in the compare pane");
    await sleep(150);
    const mixCmpZoom = zoomTransformsIn("m4");
    const compareAdopted = mixCmpZoom.some((t) => !/scale\(1\)/.test(t));
    report(compareAdopted, `the compare ADOPTS the image's zoom across the mount-swap (${JSON.stringify(mixCmpZoom)})`);

    key("1"); // → back to the image tab (remount)
    await waitFor(() => activePaneIndex("m4") === 0);
    await waitFor(() => !!(q("m4", "[data-cairn-stacked-pane] canvas") ?? q("m4", "[data-cairn-stacked-pane] img")));
    await sleep(150);
    const mixImgAfter = zoomTransformsIn("m4");
    const cameraPersisted = mixImgAfter.some((t) => !/scale\(1\)/.test(t));
    report(cameraPersisted, `the zoom PERSISTS on the image after the round-trip remount (${JSON.stringify(mixImgAfter)})`);
    ok = ok && mixZoomApplied && compareShown && compareAdopted && cameraPersisted;
  } else {
    report(false, "no image surface found in the mixed stack for the camera-persistence check");
    ok = false;
  }

  // ── HOMOGENEOUS image + DIFF stack: NO remount on the image↔diff flip ─────
  // The Phase 2c flicker fix: a diff-mode compare lowers to the SAME `image` leaf
  // family, so `[image, diff]` is HOMOGENEOUS → source-swap on ONE reused pane
  // instance (no mount-swap, no sync group). Prove it by DOM-element PERSISTENCE:
  // tag the pane surface on tab 0, flip to the diff tab, and assert the SAME node
  // is still the active surface (a remount would replace it), zoom persists, and
  // there is exactly ONE stacked-pane (no hidden sibling).
  const rootE = createRoot(host("m5"));
  rootE.render(createElement(PlotApp, { descriptor: imageDiffGrid("stacked") }));
  roots.push(rootE);
  const diffUp = await waitFor(() => qa("m5", "[role='tab']").length === 2);
  report(diffUp, `[image, diff] stack renders 2 tabs (got ${qa("m5", "[role='tab']").length})`);
  const oneDiffPane = qa("m5", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneDiffPane, "exactly ONE stacked-pane (single reused instance, no hidden sibling)");
  const diffSurface0 = await waitFor(
    () => !!(q("m5", "[data-cairn-stacked-pane] canvas") ?? q("m5", "[data-cairn-stacked-pane] img")),
  );
  report(diffSurface0, "tab 0 (image leaf) mounts a pane surface");
  const surfaceBefore = q("m5", "[data-cairn-stacked-pane] canvas") ?? q("m5", "[data-cairn-stacked-pane] img");
  // Tag the live surface node so we can assert THIS exact DOM node survives.
  surfaceBefore?.setAttribute("data-cairn-noremount-marker", "1");

  // Zoom the image (source-swap stacks share ONE camera by construction).
  q("m5", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
  if (surfaceBefore) {
    const r = surfaceBefore.getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      surfaceBefore.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, deltaY: -120, ctrlKey: true }),
      );
      await sleep(30);
    }
    await sleep(120);
  }
  const diffZoomBefore = zoomTransformsIn("m5");

  // Flip to the DIFF tab. A source-swap keeps the marked node; a remount drops it.
  key("2");
  await waitFor(() => activePaneIndex("m5") === 1);
  await sleep(150);
  const markerSurvived = !!q("m5", '[data-cairn-stacked-pane] [data-cairn-noremount-marker="1"], [data-cairn-stacked-pane][data-cairn-noremount-marker="1"]')
    || (q("m5", "[data-cairn-stacked-pane] canvas")?.getAttribute("data-cairn-noremount-marker") === "1")
    || (q("m5", "[data-cairn-stacked-pane] img")?.getAttribute("data-cairn-noremount-marker") === "1");
  report(markerSurvived, "the SAME surface DOM node persists across the image↔diff flip (NO remount)");
  const stillOnePane = qa("m5", '[data-cairn-stacked-pane="active"]').length === 1;
  report(stillOnePane, "still exactly ONE stacked-pane after the flip (no hidden sibling)");
  const diffZoomAfter = zoomTransformsIn("m5");
  const diffZoomPersisted = JSON.stringify(diffZoomAfter) === JSON.stringify(diffZoomBefore) && diffZoomAfter.some((t) => !/scale\(1\)/.test(t));
  report(diffZoomPersisted, `zoom PERSISTS across the image↔diff flip (before ${JSON.stringify(diffZoomBefore)} → after ${JSON.stringify(diffZoomAfter)})`);
  ok = ok && diffUp && oneDiffPane && diffSurface0 && markerSurvived && stillOnePane && diffZoomPersisted;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
