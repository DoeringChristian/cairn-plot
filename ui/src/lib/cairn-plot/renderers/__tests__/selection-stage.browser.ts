/**
 * COMPARE / ENLARGE VIA SELECTION — LIVE, self-driving browser harness.
 *
 * Proves the page-level selection STAGE + floating ACTION BAR
 * (`plot-selection-stage.tsx`) end to end: it mounts THREE independent `PlotApp`
 * roots (the gallery shape — three separate image panes, NOT one `cp.Grid`),
 * selects all three (last = reference), then drives the real UI:
 *   1. selecting ≥2 panes surfaces the floating action bar — count "3 selected"
 *      + an ENLARGE and a (enabled, since 3 image panes) COMPARE button;
 *   2. ENLARGE → a body-portaled, fixed, high-z, isolated, THEMED fullscreen
 *      grid of all 3 panes (~√N = 2 columns), with the reference (last-selected)
 *      cell badged;
 *   3. close, COMPARE → a grid of 2 comparison panes (each non-ref vs the ref),
 *      the reference badged;
 *   4. re-pick the reference IN the grid (a cell's REF affordance) → the store
 *      reference changes and the comparisons rebuild against it;
 *   5. Escape closes; the page did NOT scroll, but a scrollable element INSIDE
 *      the overlay still scrolls (the scroll-lock reuse).
 *
 * jsdom has no layout/pointer-capture, so — like the sibling `*.browser.ts` —
 * this is a Chromium page. CPU backend is forced (no WebGPU dependency: the
 * compare panes use the CPU clip-path split fallback), and each image is a tiny
 * canvas-drawn PNG data URL.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";
import {
  getGlobalSelectionStore,
  __resetGlobalSelectionStoreForTest,
} from "../../viewport/selection-store";
import { __resetSelectionOverlayHostForTest } from "../../../../plot-selection-stage";
import { __resetSelectionRegistryForTest } from "../../../../plot-selection-pane-registry";

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
  document.title = pass ? "SELECTION STAGE PASS" : "SELECTION STAGE FAIL";
}

const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};

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

function makeImageUrl(color: string): string {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  return c.toDataURL("image/png");
}

function imageDescriptor(label: string, color: string): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "plot",
      renderer: "image",
      data: { kind: "url", src: makeImageUrl(color) },
      props: { label, toolbar: true },
    },
  } as PlotDescriptor;
}

function clickPane(el: Element, shift = false): void {
  const r = el.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2);
  const y = Math.round(r.top + r.height / 2);
  const opts = (extra: object) => ({
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: x,
    clientY: y,
    ...extra,
  });
  el.dispatchEvent(new PointerEvent("pointerdown", opts({})));
  el.dispatchEvent(new PointerEvent("pointerup", opts({ shiftKey: shift })));
}

function frames(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-plot-pane-id][data-selectable="true"]'),
  );
}
function actionBar(): HTMLElement | null {
  return document.querySelector("[data-cairn-selection-actionbar]");
}
function stageBackdrop(): HTMLElement | null {
  return document.querySelector("[data-cairn-plot-stage-backdrop]");
}
function stageCells(): HTMLElement[] {
  const bd = stageBackdrop();
  return bd ? Array.from(bd.querySelectorAll<HTMLElement>("[data-cairn-stage-cell]")) : [];
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  __resetSelectionOverlayHostForTest();
  __resetSelectionRegistryForTest();
  __resetGlobalSelectionStoreForTest();
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

  const roots: Root[] = [];
  const mount = (divId: string, d: PlotDescriptor) => {
    const el = document.getElementById(divId)!;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { descriptor: d }));
    roots.push(root);
  };
  mount("mount-a", imageDescriptor("A", "#c0392b"));
  mount("mount-b", imageDescriptor("B", "#27ae60"));
  mount("mount-c", imageDescriptor("C", "#2980b9"));

  const framesReady = await waitFor(() => frames().length === 3);
  report(framesReady, `three selectable pane frames mount (got ${frames().length})`);
  ok = ok && framesReady;
  if (!framesReady) {
    roots.forEach((r) => r.unmount());
    return false;
  }
  const imagesReady = await waitFor(
    () => document.querySelectorAll("img[src^='data:image/png']").length >= 3,
  );
  report(imagesReady, "each mount renders a real image pane");
  ok = ok && imagesReady;

  const [fa, fb, fc] = frames();
  const idA = fa.getAttribute("data-plot-pane-id")!;
  const idC = fc.getAttribute("data-plot-pane-id")!;
  const store = getGlobalSelectionStore();

  // --- Select all three: A, then shift-B, then shift-C (last = reference) ----
  clickPane(fa);
  clickPane(fb, true);
  clickPane(fc, true);
  const allThree = await waitFor(() => store.count() === 3);
  report(allThree, `all three panes selected (count ${store.count()})`);
  ok = ok && allThree;
  const refIsLast = store.reference() === idC;
  report(refIsLast, `the LAST-selected pane (C) is the reference (${store.reference()})`);
  ok = ok && refIsLast;

  // --- 1. the action bar appears with count 3 + Enlarge + Compare ------------
  const barReady = await waitFor(() => !!actionBar());
  report(barReady, "the floating action bar appears for a ≥2 selection");
  ok = ok && barReady;
  const bar = actionBar()!;
  const barPortaled = bar.parentElement === document.body;
  report(barPortaled, "the action bar is body-portaled");
  const countText = bar.querySelector("[data-cairn-selection-count]")?.textContent ?? "";
  const countOk = /\b3\b/.test(countText);
  report(countOk, `the bar shows the selected count (“${countText.trim()}”)`);
  const enlargeBtn = bar.querySelector('[data-cairn-action="enlarge"]') as HTMLButtonElement | null;
  const compareBtn = bar.querySelector('[data-cairn-action="compare"]') as HTMLButtonElement | null;
  report(!!enlargeBtn, "the bar has an Enlarge button");
  report(!!compareBtn, "the bar has a Compare button");
  const compareEnabled = !!compareBtn && !compareBtn.disabled;
  report(compareEnabled, "Compare is ENABLED (3 image-compatible panes selected)");
  ok = ok && barPortaled && countOk && !!enlargeBtn && !!compareBtn && compareEnabled;
  if (!enlargeBtn || !compareBtn) {
    roots.forEach((r) => r.unmount());
    return false;
  }

  // --- 2. ENLARGE → fullscreen grid of all 3 panes ---------------------------
  enlargeBtn.click();
  const stageUp = await waitFor(() => !!stageBackdrop());
  report(stageUp, "clicking Enlarge opens the fullscreen stage");
  ok = ok && stageUp;
  if (!stageUp) {
    roots.forEach((r) => r.unmount());
    return false;
  }
  const bd = stageBackdrop()!;
  const atBody = bd.parentElement === document.body;
  report(atBody, "the stage overlay is portaled to document.body");
  const cs = getComputedStyle(bd);
  const isFixed = cs.position === "fixed";
  const zHigh = Number(cs.zIndex) >= 1000;
  const isIsolated = cs.isolation === "isolate";
  report(isFixed, `stage backdrop is position:fixed (got ${cs.position})`);
  report(zHigh, `stage backdrop has a high z-index (got ${cs.zIndex})`);
  report(isIsolated, `stage backdrop is its own stacking context (isolation: ${cs.isolation})`);
  ok = ok && atBody && isFixed && zHigh && isIsolated;

  // Theme follows the DARK origin: the centered frame uses `bg-bg-elevated`; the
  // themed portal must have copied the dark elevated token (22 27 34).
  const scopeClass = bd.classList.contains("cairn-plot-doc");
  const frame = bd.querySelector("[data-cairn-plot-stage-frame]") as HTMLElement;
  const frameBg = getComputedStyle(frame).backgroundColor.replace(/\s+/g, " ").trim();
  const frameDark = frameBg === "rgb(22, 27, 34)";
  report(scopeClass, `stage carries the cairn-plot-doc scope class (${scopeClass})`);
  report(frameDark, `stage frame follows the origin DARK theme (bg ${frameBg})`);
  ok = ok && scopeClass && frameDark;

  // 3 cells, laid out in a ~√3 = 2-column grid.
  const threeCells = await waitFor(() => stageCells().length === 3);
  report(threeCells, `the enlarge grid has 3 pane cells (got ${stageCells().length})`);
  const grid = bd.querySelector("[data-cairn-stage-grid]") as HTMLElement;
  const templateCols = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
  const twoCols = templateCols === 2;
  report(twoCols, `the grid uses ~ceil(sqrt(3)) = 2 columns (got ${templateCols})`);
  // Each cell rendered a fresh image pane.
  const cellsHaveImages = stageCells().every((c) => !!c.querySelector("img,canvas"));
  report(cellsHaveImages, "each enlarge cell rendered a fresh pane surface");
  // Exactly one cell is badged as the reference (the last-selected, C).
  const refCells = bd.querySelectorAll('[data-cairn-stage-cell][data-cairn-stage-ref="true"]');
  const oneRef = refCells.length === 1;
  const refReprIsC = (refCells[0] as HTMLElement | undefined)?.getAttribute("data-stage-repr-pane") === idC;
  report(oneRef, `exactly one cell is the reference (got ${refCells.length})`);
  report(refReprIsC, "the badged reference cell is the last-selected pane (C)");
  const refChip = !!bd.querySelector("[data-cairn-stage-ref-chip]");
  report(refChip, "the reference cell shows a REF chip");
  ok = ok && threeCells && twoCols && cellsHaveImages && oneRef && refReprIsC && refChip;

  // Close the enlarge stage (✕), bar comes back.
  (bd.querySelector("[data-cairn-plot-stage-close]") as HTMLButtonElement).click();
  const stageGone = await waitFor(() => !stageBackdrop());
  report(stageGone, "the ✕ closes the enlarge stage");
  const barBack = await waitFor(() => !!actionBar());
  report(barBack, "the action bar returns after closing the stage");
  ok = ok && stageGone && barBack;

  // --- 3. COMPARE → grid of 2 comparison panes -------------------------------
  (actionBar()!.querySelector('[data-cairn-action="compare"]') as HTMLButtonElement).click();
  const compareUp = await waitFor(() => !!stageBackdrop());
  report(compareUp, "clicking Compare opens the fullscreen compare stage");
  ok = ok && compareUp;
  if (!compareUp) {
    roots.forEach((r) => r.unmount());
    return false;
  }
  const cbd = stageBackdrop()!;
  const twoComparisons = await waitFor(() => stageCells().length === 2);
  report(twoComparisons, `3 selected → 2 comparison panes (got ${stageCells().length})`);
  const modeIsCompare = cbd.querySelector('[data-cairn-stage-grid][data-cairn-stage-mode="compare"]');
  report(!!modeIsCompare, "the stage is in compare mode");
  // Each comparison cell represents a NON-reference pane vs the reference (C).
  const reprPanes = stageCells().map((c) => c.getAttribute("data-stage-repr-pane"));
  const noRefInCells = !reprPanes.includes(idC);
  report(noRefInCells, "the reference (C) is NOT one of the comparison cells (it's the baseline)");
  const compareChip = !!cbd.querySelector("[data-cairn-stage-ref-chip]");
  report(compareChip, "each comparison badges the reference (REF chip)");
  // The comparison panes actually rendered (CPU split → <img>s).
  const compHasSurface = await waitFor(
    () => stageCells().length === 2 && stageCells().every((c) => !!c.querySelector("img,canvas")),
  );
  report(compHasSurface, "each comparison cell rendered its compare pane");
  ok = ok && twoComparisons && !!modeIsCompare && noRefInCells && compareChip && compHasSurface;

  // --- 4. Re-pick the reference IN the grid → comparisons rebuild ------------
  const reprBefore = new Set(reprPanes);
  const setRefBtn = stageCells()[0].querySelector("[data-cairn-stage-set-ref]") as HTMLButtonElement;
  const newRefId = stageCells()[0].getAttribute("data-stage-repr-pane")!;
  setRefBtn.click();
  const refChanged = await waitFor(() => store.reference() === newRefId);
  report(refChanged, `clicking a cell's REF affordance re-designates the reference (now ${store.reference()})`);
  const rebuilt = await waitFor(() => {
    const now = stageCells().map((c) => c.getAttribute("data-stage-repr-pane"));
    // The new reference is no longer a comparison cell; the old reference now is.
    return now.length === 2 && !now.includes(newRefId) && now.includes(idC);
  });
  report(rebuilt, "the comparisons rebuilt against the new reference (old ref now compared)");
  const reprAfter = new Set(stageCells().map((c) => c.getAttribute("data-stage-repr-pane")));
  const setChanged = reprAfter.size === 2 && [...reprAfter].some((id) => !reprBefore.has(id));
  report(setChanged, "the set of compared panes changed");
  ok = ok && refChanged && rebuilt && setChanged;

  // --- 5. Escape closes; page did NOT scroll but in-overlay scrolls still ----
  {
    const scroller = (document.scrollingElement as HTMLElement | null) ?? document.body;
    const rootLocked = scroller.style.overflow === "hidden";
    report(rootLocked, `page scroll root is locked while the stage is open (overflow="${scroller.style.overflow}")`);
    const beforeY = window.scrollY;
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 600, bubbles: true, cancelable: true }));
    await sleep(60);
    const noScroll = window.scrollY === beforeY;
    report(noScroll, `a plain wheel did not scroll the page (scrollY ${beforeY} -> ${window.scrollY})`);
    // A scrollable element INSIDE the overlay must still receive wheel (not swallowed).
    const inner = document.createElement("div");
    inner.style.cssText = "height:40px;overflow:auto";
    const tall = document.createElement("div");
    tall.style.height = "400px";
    inner.appendChild(tall);
    stageBackdrop()!.appendChild(inner);
    const ev = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    inner.dispatchEvent(ev);
    const innerScrollable = !ev.defaultPrevented;
    report(innerScrollable, `wheel inside the overlay is NOT swallowed (defaultPrevented=${ev.defaultPrevented})`);
    inner.remove();
    ok = ok && rootLocked && noScroll && innerScrollable;
  }

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const closedByEsc = await waitFor(() => !stageBackdrop());
  report(closedByEsc, "Escape closes the compare stage");
  const scrollRestored =
    ((document.scrollingElement as HTMLElement | null) ?? document.body).style.overflow !== "hidden";
  report(scrollRestored, "page scroll is restored on close");
  ok = ok && closedByEsc && scrollRestored;

  roots.forEach((r) => r.unmount());
  __resetSelectionOverlayHostForTest();
  return ok;
}

async function main(): Promise<void> {
  report(true, "harness module loaded (boot marker)");
  try {
    const ok = await run();
    const noErrors = consoleErrors.length === 0;
    report(noErrors, `no console.error during the run (got ${consoleErrors.length})`);
    for (const e of consoleErrors.slice()) report(false, `console.error: ${e}`);
    setOverallStatus(ok && noErrors);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
