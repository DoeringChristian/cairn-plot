/**
 * STACKED GRID — a `cp.Grid(mode="stack")` shows ONE child at a time with a
 * keyboard-driven tab strip, plus a live normal⇄stacked toggle on the grid.
 * Verifies: the toggle exists (the reported "no such button"); stacked shows one
 * pane + N tabs; arrows / hjkl / number / letter switch the active tab; clicking
 * the toggle flips modes; a single-child grid has no toggle. CPU float panes —
 * no WebGPU needed.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../../plots/register-core";
import type { PlotSpec } from "../../../../../packages/spec/src/spec.ts";
import { createHarness, sleep, waitFor } from "../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "GRID-STACKED" });

function floatLeaf(w: number, h: number, label: string): unknown {
  const data = new Float32Array(h * w * 3);
  for (let i = 0; i < data.length; i++) data[i] = ((i % 97) / 97) * 0.8;
  return {
    kind: "plot",
    type: "image",
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
    type: "image",
    presentation: "split",
    operands: [{ kind: "url", src: imgUrl(ref) }, { kind: "url", src: imgUrl(fg) }],
    strategy: "reference",
    referenceIndex: 0,
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
    type: "image",
    presentation: "difference",
    operands: [{ kind: "url", src: imgUrl(ref) }, { kind: "url", src: imgUrl(fg) }],
    strategy: "reference",
    referenceIndex: 0,
    settings: { "compare.operation": "absolute" },
    props: { toolbar: true, label },
  };
}
// A stacked grid mixing an image LEAF and a DIFF compare — homogeneous by the
// Phase 2c `stackKindKey` (both lower to `plot:image`), so the flip is a reused-
// instance source-swap, NOT a mount-swap.
function imageDiffGrid(initialLayout: "grid" | "stack"): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      initialLayout,
      children: [
        { kind: "plot", type: "image", data: { kind: "url", src: imgUrl("#888") }, props: { toolbar: true, label: "Image" } },
        diffUrlChild("#c0392b", "#2980b9", "Diff"),
      ],
    },
  } as unknown as PlotSpec;
}
// A HETEROGENEOUS grid: an image LEAF next to a COMPARE pane. Stacking these
// Phase 3: an image LEAF next to a SPLIT compare — HOMOGENEOUS (both lower to
// `plot:image`), so the flip is a reused-instance source-swap, NOT a mount-swap
// (the 341c577 mixed-stack sync-group machinery is retired). Both sides are URL
// sources ⇒ CpuImagePane renders each as an `<img>`, so the SAME surface DOM node
// survives the flip (the no-remount proof, no WebGPU needed).
function mixedGrid(initialLayout: "grid" | "stack"): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      gap: 8,
      initialLayout,
      children: [
        { kind: "plot", type: "image", data: { kind: "url", src: imgUrl("#888") }, props: { toolbar: true, label: "Image" } },
        compareUrlChild("#c0392b", "#2980b9", "Compare"),
      ],
    },
  } as unknown as PlotSpec;
}
function stackedGrid(labels: string[], initialLayout: "grid" | "stack"): PlotSpec {
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
      initialLayout,
      children: labels.map((l, i) => floatLeaf(...(dims[i % dims.length] as [number, number]), l)),
    },
  } as unknown as PlotSpec;
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
  rootA.render(createElement(PlotApp, { spec: stackedGrid(["Alpha", "Bravo", "Charlie"], "stack") }));
  roots.push(rootA);

  const up = await waitFor(() => qa("m1", "[data-cairn-stack-tab]").length >= 1 || qa("m1", "[role='tab']").length >= 3, 5000, 20);
  const tabs = qa("m1", "[role='tab']");
  report(tabs.length === 3, `stacked grid renders a tab strip with 3 tabs (got ${tabs.length})`);
  report(!!q("m1", "[data-cairn-grid-header]"), "grid header (holds tabs + toggle, above the cells) present");
  report(!!q("m1", "[data-cairn-stacked-view]"), "stacked panes container present");
  // Single-renderer model: exactly ONE pane is rendered (the active source), not
  // three hidden ones — flipping swaps the source on this reused instance.
  const oneVisible =
    qa("m1", "[data-cairn-stacked-pane]").length === 1 &&
    qa("m1", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneVisible, "exactly ONE pane rendered (single reused renderer, not N hidden panes)");
  const initialCellIds = qa("m1", "[data-plot-pane-id]").map((cell) => cell.dataset.plotPaneId);
  report(initialCellIds.length === 1, `stacked grid owns exactly one plot cell (got ${initialCellIds.length})`);
  report(activePaneIndex("m1") === 0, `tab 0 active initially (got ${activePaneIndex("m1")})`);
  ok = ok && up && tabs.length === 3 && oneVisible && activePaneIndex("m1") === 0;

  // hover the stack so keys are in scope, then navigate.
  q("m1", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));

  key("ArrowRight");
  report(await waitFor(() => activePaneIndex("m1") === 1, 5000, 20), `→ moves to tab 1 (got ${activePaneIndex("m1")})`);
  key("l"); // vim next
  report(await waitFor(() => activePaneIndex("m1") === 2, 5000, 20), `l (vim) → tab 2 (got ${activePaneIndex("m1")})`);
  key("l"); // wrap
  report(await waitFor(() => activePaneIndex("m1") === 0, 5000, 20), `l wraps 2→0 (got ${activePaneIndex("m1")})`);
  key("h"); // vim prev wraps
  report(await waitFor(() => activePaneIndex("m1") === 2, 5000, 20), `h (vim) wraps 0→2 (got ${activePaneIndex("m1")})`);
  key("1"); // number jump
  report(await waitFor(() => activePaneIndex("m1") === 0, 5000, 20), `number 1 → tab 0 (got ${activePaneIndex("m1")})`);
  key("c"); // letter jump
  report(await waitFor(() => activePaneIndex("m1") === 2, 5000, 20), `letter c → tab 2 (got ${activePaneIndex("m1")})`);
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
  await waitFor(() => activePaneIndex("m1") === 0, 5000, 20);
  await sleep(100);
  const box0 = viewBox();
  key("2");
  await waitFor(() => activePaneIndex("m1") === 1, 5000, 20);
  await sleep(100);
  const box1 = viewBox();
  key("3");
  await waitFor(() => activePaneIndex("m1") === 2, 5000, 20);
  await sleep(100);
  const box2 = viewBox();
  const boxStable = box0 === box1 && box1 === box2;
  report(boxStable, `stacked viewport BOX is latched across flips of differently-shaped slots (${box0} | ${box1} | ${box2})`);
  const flippedCellIds = qa("m1", "[data-plot-pane-id]").map((cell) => cell.dataset.plotPaneId);
  const cellStable = flippedCellIds.length === 1 && flippedCellIds[0] === initialCellIds[0];
  report(cellStable, `tab flips retain the exact stack cell id (${initialCellIds[0]} → ${flippedCellIds[0]})`);
  ok = ok && boxStable && cellStable;

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
    await waitFor(() => activePaneIndex("m1") === 0, 5000, 20);
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
  rootB.render(createElement(PlotApp, { spec: stackedGrid(["one", "two", "three"], "grid") }));
  roots.push(rootB);
  const toggleUp = await waitFor(() => !!q("m2", "[data-cairn-grid-layout-toggle]"), 5000, 20);
  report(toggleUp, "NORMAL grid shows the normal|stacked toggle button (the missing button)");
  const startsNormal = await waitFor(() => qa("m2", "[role='tab']").length === 0, 5000, 20);
  report(startsNormal, "normal grid shows NO tab strip");
  report(qa("m2", "[data-plot-pane-id]").length === 3, "normal 3-child grid owns three independent plot cells");
  const stackedBtn = q("m2", '[data-cairn-grid-layout="stack"]');
  report(!!stackedBtn, "toggle has a 'stacked' button");
  stackedBtn?.click();
  const flipped = await waitFor(() => qa("m2", "[role='tab']").length === 3, 5000, 20);
  report(flipped, "clicking the toggle switches the grid to stacked (tab strip appears)");
  const collapsedToOneCell = qa("m2", "[data-plot-pane-id]").length === 1;
  report(collapsedToOneCell, "switching normal→stacked collapses three cells into one stack-owned cell");
  ok = ok && toggleUp && startsNormal && !!stackedBtn && flipped && collapsedToOneCell;

  // ── Single-child grid: no toggle (stacking a lone child is a no-op) ───────
  const rootC = createRoot(host("m3"));
  rootC.render(createElement(PlotApp, { spec: stackedGrid(["solo"], "grid") }));
  roots.push(rootC);
  await sleep(150);
  const noToggle = !q("m3", "[data-cairn-grid-layout-toggle]");
  report(noToggle, "single-child grid has NO mode toggle");
  ok = ok && noToggle;

  // `switchable:false` disables authoring UI; it must not override the authored
  // initial presentation.
  const fixedDescriptor = stackedGrid(["fixed-a", "fixed-b"], "stack");
  if (fixedDescriptor.root.kind === "grid") fixedDescriptor.root.switchable = false;
  const rootFixed = createRoot(host("m6"));
  rootFixed.render(createElement(PlotApp, { spec: fixedDescriptor }));
  roots.push(rootFixed);
  const fixedStacked = await waitFor(() => qa("m6", "[role='tab']").length === 0 && !!q("m6", "[data-cairn-stacked-view]"), 5000, 20);
  const fixedNoToggle = !q("m6", "[data-cairn-grid-layout-toggle]");
  report(fixedStacked && fixedNoToggle, "switchable:false preserves authored stacked mode while hiding switching controls");
  ok = ok && fixedStacked && fixedNoToggle;

  // ── image + SLIDE-compare stack: HOMOGENEOUS, NO remount on the flip ─────────
  // Phase 3: a compare node in ANY mode (diff AND split/blend) lowers to the SAME
  // `image` leaf family, so `[image, slide-compare]` is HOMOGENEOUS → a source-
  // swap on ONE reused pane instance (no mount-swap, no sync groups — the retired
  // 341c577 machinery). Prove it by DOM-element PERSISTENCE (like the [image,diff]
  // section below): tag the surface on tab 0, flip to the compare tab, and assert
  // the SAME node survives + zoom persists + exactly ONE stacked-pane.
  const rootD = createRoot(host("m4"));
  rootD.render(createElement(PlotApp, { spec: mixedGrid("grid") }));
  roots.push(rootD);
  const mixToggle = await waitFor(() => !!q("m4", "[data-cairn-grid-layout-toggle]"), 5000, 20);
  report(mixToggle, "image+compare grid shows the normal|stacked toggle");
  q("m4", '[data-cairn-grid-layout="stack"]')?.click();
  const mixStacked = await waitFor(() => qa("m4", "[role='tab']").length === 2, 5000, 20);
  report(mixStacked, `image+compare grid switches to stacked: 2 tabs (got ${qa("m4", "[role='tab']").length})`);
  const oneMixPane = qa("m4", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneMixPane, "exactly ONE pane rendered in the stack (single reused slot)");
  const imgOnTab0 = await waitFor(
    () => !!(q("m4", "[data-cairn-stacked-pane] canvas") ?? q("m4", "[data-cairn-stacked-pane] img")), 5000, 20);
  report(imgOnTab0, "tab 0 mounts the IMAGE leaf");
  ok = ok && mixToggle && mixStacked && oneMixPane && imgOnTab0;

  q("m4", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
  const mixSurface = q("m4", "[data-cairn-stacked-pane] canvas") ?? q("m4", "[data-cairn-stacked-pane] img");
  if (mixSurface) {
    // Tag the live surface node so we can assert THIS exact DOM node survives.
    mixSurface.setAttribute("data-cairn-noremount-marker", "1");
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
    report(mixZoomApplied, `wheel-zoom applied on the stack's image (${JSON.stringify(mixImgZoom)})`);

    key("2"); // → slide-compare tab (source-swap on the reused instance)
    await waitFor(() => activePaneIndex("m4") === 1, 5000, 20);
    await sleep(150);
    // A source-swap keeps the marked node; a remount would replace it.
    const mixMarkerSurvived =
      !!q("m4", '[data-cairn-stacked-pane] [data-cairn-noremount-marker="1"], [data-cairn-stacked-pane][data-cairn-noremount-marker="1"]') ||
      q("m4", "[data-cairn-stacked-pane] canvas")?.getAttribute("data-cairn-noremount-marker") === "1" ||
      q("m4", "[data-cairn-stacked-pane] img")?.getAttribute("data-cairn-noremount-marker") === "1";
    report(mixMarkerSurvived, "the SAME surface DOM node persists across the image↔slide-compare flip (NO remount)");
    const stillOneMixPane = qa("m4", '[data-cairn-stacked-pane="active"]').length === 1;
    report(stillOneMixPane, "still exactly ONE stacked-pane after the flip (no hidden sibling)");
    await sleep(50);
    const mixCmpZoom = zoomTransformsIn("m4");
    const compareAdopted = mixCmpZoom.some((t) => !/scale\(1\)/.test(t));
    report(compareAdopted, `the zoom PERSISTS across the flip — ONE shared camera by construction (${JSON.stringify(mixCmpZoom)})`);
    ok = ok && mixZoomApplied && mixMarkerSurvived && stillOneMixPane && compareAdopted;
  } else {
    report(false, "no image surface found in the mixed stack for the no-remount check");
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
  rootE.render(createElement(PlotApp, { spec: imageDiffGrid("stack") }));
  roots.push(rootE);
  const diffUp = await waitFor(() => qa("m5", "[role='tab']").length === 2, 5000, 20);
  report(diffUp, `[image, diff] stack renders 2 tabs (got ${qa("m5", "[role='tab']").length})`);
  const oneDiffPane = qa("m5", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneDiffPane, "exactly ONE stacked-pane (single reused instance, no hidden sibling)");
  const diffSurface0 = await waitFor(
    () => !!(q("m5", "[data-cairn-stacked-pane] canvas") ?? q("m5", "[data-cairn-stacked-pane] img")), 5000, 20);
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
  await waitFor(() => activePaneIndex("m5") === 1, 5000, 20);
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
