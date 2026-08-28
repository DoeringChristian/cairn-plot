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
import { PlotApp } from "../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../plot-renderers";
import type { PlotDescriptor, PlotNode } from "../../../plot-descriptor";
import {
  getGlobalSelectionStore,
  paneSyncGroups,
  GLOBAL_SELECTION_BASE,
  __resetGlobalSelectionStoreForTest,
} from "../../../state/selection/selection-store";
import { createHarness, sleep, waitFor } from "../../harness";

const { report, setOverallStatus } = createHarness({ title: "PAGE-WIDE SELECTION" });

const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};

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

/** One image LEAF node for a `cp.Grid` cell (Bug 2's 2×2 grid). */
function gridCell(label: string, color: string): PlotNode {
  return {
    kind: "plot",
    renderer: "image",
    data: { kind: "url", src: makeImageUrl(color) },
    props: { label, toolbar: false },
  } as unknown as PlotNode;
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
  const framesReady = await waitFor(() => frames().length === 3, 6000, 20);
  report(framesReady, `three selectable pane frames mount (got ${frames().length})`);
  ok = ok && framesReady;
  if (!framesReady) {
    roots.forEach((r) => r.unmount());
    return false;
  }

  // Each pane is a REAL image pane (its <img> renders the data-URL source).
  const imagesReady = await waitFor(() => document.querySelectorAll("img[src^='data:image/png']").length >= 3, 6000, 20);
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
  const aOnly = await waitFor(() => isRinged(fa) && !isRinged(fb) && !isRinged(fc), 6000, 20);
  report(aOnly, "plain click on A rings A only (B/C not selected)");
  ok = ok && aOnly;

  // --- Bug 1: the selection ring is CLEARLY VISIBLE — a solid accent outline
  // (not the faint 1px/50% decorative 3D-canvas border, which read as absent) —
  // plus a glow, at a 4px radius. Assert a solid, full-width accent outline and
  // a non-"none" box-shadow so an invisible/too-faint ring can't regress in. --
  {
    const fcs = getComputedStyle(fa);
    const widthOk = fcs.outlineWidth === "2px";
    report(widthOk, `ring outline is a visible 2px (got ${fcs.outlineWidth})`);
    const styleOk = fcs.outlineStyle === "solid";
    report(styleOk, `ring outline is solid (got ${fcs.outlineStyle})`);
    // Accent is fully opaque (var(--color-accent)) — the color must NOT be a
    // transparent/50%-alpha value that would render as invisible.
    const colorOk = /^rgba?\(/.test(fcs.outlineColor) && !/,\s*0(\.\d+)?\)$/.test(fcs.outlineColor);
    report(colorOk, `ring color is opaque accent (got ${fcs.outlineColor})`);
    const radiusOk = fcs.borderTopLeftRadius === "4px";
    report(radiusOk, `ring radius is 4px (got ${fcs.borderTopLeftRadius})`);
    const hasGlow = fcs.boxShadow !== "none" && fcs.boxShadow.length > 0;
    report(hasGlow, `ring has a visible glow (box-shadow: "${fcs.boxShadow}")`);
    ok = ok && widthOk && styleOk && colorOk && radiusOk && hasGlow;
  }

  // --- 2. shift-click B → A and B both selected (cross-mount) ---------------
  clickPane(fb, true);
  const bothSel = await waitFor(() => isRinged(fa) && isRinged(fb) && !isRinged(fc), 6000, 20);
  report(bothSel, "shift-click B selects BOTH A and B across separate mounts");
  ok = ok && bothSel;

  // --- 3. probe: A and B share ONE viewport-settings group -----------------
  const gA = paneSyncGroups(store, idA, GLOBAL_SELECTION_BASE);
  const gB = paneSyncGroups(store, idB, GLOBAL_SELECTION_BASE);
  const gC = paneSyncGroups(store, idC, GLOBAL_SELECTION_BASE);
  const sharedSt = !!gA && !!gB && gA.settingsGroupId === gB.settingsGroupId;
  report(sharedSt, `A and B share ONE viewport-settings group (${gA?.settingsGroupId})`);
  report(gC === null, "the unselected third pane C is in NO sync group");
  report(gA?.isAnchor === true && gB?.isAnchor === false, "A (first-selected) is the group anchor, B is not");
  ok = ok && sharedSt && gC === null && gA?.isAnchor === true && gB?.isAnchor === false;

  // --- 4. plain click C → single-select resets to just C --------------------
  clickPane(fc);
  const cOnly = await waitFor(() => isRinged(fc) && !isRinged(fa) && !isRinged(fb), 6000, 20);
  report(cOnly, "plain click on C resets to a single selection (A/B cleared)");
  ok = ok && cOnly;
  const cGroupGone =
    paneSyncGroups(store, idC, GLOBAL_SELECTION_BASE) === null &&
    paneSyncGroups(store, idA, GLOBAL_SELECTION_BASE) === null;
  report(cGroupGone, "a lone selection is NOT a sync group (no ≥2 members)");
  ok = ok && cGroupGone;

  // --- Bug 2: two ADJACENT selected cells in ONE 2×2 grid — each selected
  // cell must be RAISED (position:relative + a z-index) so its ring is never
  // occluded by a later grid sibling. Tear down the standalone mounts first so
  // only the grid's frames remain. -------------------------------------------
  roots.forEach((r) => r.unmount());
  await sleep(30);
  __resetGlobalSelectionStoreForTest();

  const gridDesc: PlotDescriptor = {
    mode: "local",
    root: {
      kind: "grid",
      cols: 2,
      children: [
        gridCell("g0", "#c0392b"),
        gridCell("g1", "#27ae60"),
        gridCell("g2", "#2980b9"),
        gridCell("g3", "#8e44ad"),
      ],
    },
  } as PlotDescriptor;
  const gridRoot = createRoot(document.getElementById("mount-c")!);
  gridRoot.render(createElement(PlotApp, { descriptor: gridDesc }));

  const gridReady = await waitFor(() => frames().length === 4, 6000, 20);
  report(gridReady, `a 2×2 grid mounts four selectable cells (got ${frames().length})`);
  ok = ok && gridReady;

  if (gridReady) {
    const cells = frames(); // DOM order: [0,1] top row, [2,3] bottom row
    // Two horizontally-adjacent cells (top row).
    clickPane(cells[0]);
    clickPane(cells[1], true);
    const bothRinged = await waitFor(() => isRinged(cells[0]) && isRinged(cells[1]), 6000, 20);
    report(bothRinged, "two adjacent grid cells are both selected");
    ok = ok && bothRinged;

    const raised = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return cs.position === "relative" && cs.zIndex !== "auto" && Number(cs.zIndex) >= 1;
    };
    const bothRaised = raised(cells[0]) && raised(cells[1]);
    report(
      bothRaised,
      `both selected cells are raised (z-index ${getComputedStyle(cells[0]).zIndex}/${getComputedStyle(cells[1]).zIndex}), so neither ring is occluded`,
    );
    // The unselected siblings stay at the default stacking (z-index:auto).
    const unselAuto = getComputedStyle(cells[2]).zIndex === "auto";
    report(unselAuto, `an unselected cell keeps the default stacking (z-index: ${getComputedStyle(cells[2]).zIndex})`);
    ok = ok && bothRaised && unselAuto;
  }

  gridRoot.unmount();
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
