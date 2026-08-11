/**
 * PAGE-WIDE multi-viewport SELECTION — LIVE, self-driving browser harness.
 *
 * The bug this guards: selection used to exist ONLY inside a `cp.Grid` (a
 * per-grid store + a grid-only `SelectionCell`), so a gallery page of STANDALONE
 * `PlotApp` mounts — the common case — had NO selectable panes at all. Selection
 * is now PAGE-WIDE: one document-scoped `SelectionStore` (`getGlobalSelectionStore`)
 * and one `PaneSelectionFrame` around EVERY pane (`plot-node.tsx`'s
 * `PlotNodeView`), so standalone mounts and grid cells select from the SAME
 * mechanism.
 *
 * This harness mounts THREE INDEPENDENT `PlotApp` roots on one page (mimicking
 * the gallery — three separate mount calls, NOT one `cp.Grid`), each a single
 * CPU image pane, then drives real pointer gestures and asserts:
 *   1. plain click on pane A → A gets the ring (`data-selected`), B/C do not;
 *   2. shift-click pane B → BOTH A and B selected (cross-MOUNT selection);
 *   3. the two selected panes share ONE viewport-sync group AND ONE
 *      settings-sync group (probed via `paneSyncGroups` on the global store);
 *      the unselected third pane derives to NO group;
 *   4. a plain click on C → single-select resets (only C selected).
 *
 * jsdom has no layout/pointer-capture, so — like the sibling `*.browser.ts` —
 * this is a Chromium page. It is SELF-DRIVING (declared via
 * `data-cairn-harness="self-driving"` in the HTML), so `npm run test:harness`
 * runs it in the DEFAULT set. No WebGPU: the CPU backend is forced, and the
 * image is a tiny canvas-drawn PNG data URL.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";
import {
  getGlobalSelectionStore,
  paneSyncGroups,
  GLOBAL_SELECTION_BASE,
  __resetGlobalSelectionStoreForTest,
} from "../../viewport/selection-store";

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
  document.title = pass ? "PAGE-WIDE SELECTION PASS" : "PAGE-WIDE SELECTION FAIL";
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

/** A tiny non-blank PNG data URL (drawn on a canvas), so each pane is a REAL
 *  image pane without embedding base64 or needing WebGPU. */
function makeImageUrl(color: string): string {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 8);
  return c.toDataURL("image/png");
}

/** A standalone single-image descriptor (the `url` data spec → a uint8 source →
 *  CPU `<img>` pane). */
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

/** Dispatch a stationary press (down+up at the same point) on `el` — a SELECT
 *  gesture (< slop). `shift` toggles additive multi-select. */
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
function isRinged(el: HTMLElement): boolean {
  return el.getAttribute("data-selected") === "true";
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  __resetGlobalSelectionStoreForTest();
  // Force the CPU backend (no WebGPU) and eager mount (skip the lazy IO gate).
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;

  const roots: Root[] = [];
  const mount = (divId: string, d: PlotDescriptor) => {
    const el = document.getElementById(divId)!;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { descriptor: d }));
    roots.push(root);
  };
  // THREE independent mounts (separate roots) — the gallery shape, not a grid.
  mount("mount-a", imageDescriptor("A", "#c0392b"));
  mount("mount-b", imageDescriptor("B", "#27ae60"));
  mount("mount-c", imageDescriptor("C", "#2980b9"));

  // Each mount renders exactly one selectable pane frame.
  const framesReady = await waitFor(() => frames().length === 3);
  report(framesReady, `three selectable pane frames mount (got ${frames().length})`);
  ok = ok && framesReady;
  if (!framesReady) {
    roots.forEach((r) => r.unmount());
    return false;
  }

  // Each pane is a REAL image pane (its <img> renders the data-URL source).
  const imagesReady = await waitFor(() => document.querySelectorAll("img[src^='data:image/png']").length >= 3);
  report(imagesReady, "each mount renders a real image pane (<img> source)");
  ok = ok && imagesReady;

  const [fa, fb, fc] = frames();
  const idA = fa.getAttribute("data-plot-pane-id")!;
  const idB = fb.getAttribute("data-plot-pane-id")!;
  const idC = fc.getAttribute("data-plot-pane-id")!;
  const distinctIds = new Set([idA, idB, idC]).size === 3;
  report(distinctIds, `pane ids are unique across mounts (${idA}, ${idB}, ${idC})`);
  ok = ok && distinctIds;

  const store = getGlobalSelectionStore();

  // --- 1. plain click A → only A ringed ------------------------------------
  clickPane(fa);
  const aOnly = await waitFor(() => isRinged(fa) && !isRinged(fb) && !isRinged(fc));
  report(aOnly, "plain click on A rings A only (B/C not selected)");
  ok = ok && aOnly;

  // --- 2. shift-click B → A and B both selected (cross-mount) ---------------
  clickPane(fb, true);
  const bothSel = await waitFor(() => isRinged(fa) && isRinged(fb) && !isRinged(fc));
  report(bothSel, "shift-click B selects BOTH A and B across separate mounts");
  ok = ok && bothSel;

  // --- 3. probe: A and B share ONE viewport + ONE settings sync group -------
  const gA = paneSyncGroups(store, idA, GLOBAL_SELECTION_BASE);
  const gB = paneSyncGroups(store, idB, GLOBAL_SELECTION_BASE);
  const gC = paneSyncGroups(store, idC, GLOBAL_SELECTION_BASE);
  const sharedVp = !!gA && !!gB && gA.viewportGroupId === gB.viewportGroupId;
  const sharedSt = !!gA && !!gB && gA.settingsGroupId === gB.settingsGroupId;
  report(sharedVp, `A and B share ONE viewport sync group (${gA?.viewportGroupId})`);
  report(sharedSt, `A and B share ONE settings sync group (${gA?.settingsGroupId})`);
  report(gC === null, "the unselected third pane C is in NO sync group");
  report(gA?.isAnchor === true && gB?.isAnchor === false, "A (first-selected) is the group anchor, B is not");
  ok = ok && sharedVp && sharedSt && gC === null && gA?.isAnchor === true && gB?.isAnchor === false;

  // --- 4. plain click C → single-select resets to just C --------------------
  clickPane(fc);
  const cOnly = await waitFor(() => isRinged(fc) && !isRinged(fa) && !isRinged(fb));
  report(cOnly, "plain click on C resets to a single selection (A/B cleared)");
  ok = ok && cOnly;
  const cGroupGone =
    paneSyncGroups(store, idC, GLOBAL_SELECTION_BASE) === null &&
    paneSyncGroups(store, idA, GLOBAL_SELECTION_BASE) === null;
  report(cGroupGone, "a lone selection is NOT a sync group (no ≥2 members)");
  ok = ok && cGroupGone;

  roots.forEach((r) => r.unmount());
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
