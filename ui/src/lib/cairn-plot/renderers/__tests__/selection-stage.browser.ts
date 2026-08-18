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

// --- geometry / outcome helpers (the point of THIS harness — not "el exists") ---
/** ~equal within a few px (layout rounding / sub-pixel). */
function near(a: number, b: number, tol = 4): boolean {
  return Math.abs(a - b) <= tol;
}
/** The stage grid's inner content box (padding-box). */
function stageGrid(): HTMLElement | null {
  const bd = stageBackdrop();
  return bd ? bd.querySelector<HTMLElement>("[data-cairn-stage-grid]") : null;
}
/** The pane FRAME rendered inside a stage cell (fills the cell when Bug 8 fixed). */
function cellFrame(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>("[data-plot-pane-id]");
}
/** A stage cell's colormap toolbar menu button (CPU image pane). */
function cmapButton(cell: HTMLElement): HTMLButtonElement | null {
  return cell.querySelector<HTMLButtonElement>('button[aria-label="Colormap"]');
}
/** Open a toolbar menu button and resolve its portaled listbox. */
async function openListbox(btn: HTMLButtonElement): Promise<HTMLUListElement | null> {
  btn.click();
  await waitFor(() => !!document.querySelector('ul[role="listbox"]'), 2000);
  return document.querySelector<HTMLUListElement>('ul[role="listbox"]');
}
function normColor(c: string): string {
  return c.replace(/\s+/g, " ").trim();
}
/** COMPARE-mode re-pick: a stationary click on the pane's bottom-right
 *  FOREGROUND caption chip (the label naming the compared image). A plain cell
 *  click no longer re-picks there (it would hijack the compare pane's
 *  double-click-to-reset); the chip is the only affordance. Returns false if
 *  the cell has no foreground chip. */
function repickViaForegroundChip(cell: HTMLElement): boolean {
  const chip = cell.querySelector<HTMLElement>('[data-cairn-compare-caption="foreground"]');
  if (!chip) return false;
  const r = chip.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: Math.round(r.left + r.width / 2),
    clientY: Math.round(r.top + r.height / 2),
  };
  chip.dispatchEvent(new PointerEvent("pointerdown", opts));
  chip.dispatchEvent(new PointerEvent("pointerup", opts));
  return true;
}
/** A stationary plain click on the cell background (NOT the button) — used to
 *  assert it does NOT change the reference. */
function plainCellClick(cell: HTMLElement): void {
  const r = cell.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: Math.round(r.left + r.width / 2),
    clientY: Math.round(r.bottom - 8),
  };
  cell.dispatchEvent(new PointerEvent("pointerdown", opts));
  cell.dispatchEvent(new PointerEvent("pointerup", opts));
}
/** The stage's mode-toggle segment button for a given mode. */
function stageModeBtn(mode: "enlarge" | "compare"): HTMLButtonElement | null {
  const bd = stageBackdrop();
  return bd?.querySelector<HTMLButtonElement>(`[data-cairn-stage-mode-btn="${mode}"]`) ?? null;
}
/** The CPU image pane's transformed wrapper (`transform: translate(pan) scale(zoom)`)
 *  inside a stage cell — the DOM signal a zoom/pan is applied to. */
function zoomWrapper(cell: HTMLElement): HTMLElement | null {
  const pane = cell.querySelector<HTMLElement>("[data-cpu-image-pane]");
  if (!pane) return null;
  return Array.from(pane.querySelectorAll<HTMLElement>("*")).find((el) =>
    /scale\(/.test(el.style.transform),
  ) ?? null;
}
const ORANGE = "rgb(245, 158, 11)"; // REFERENCE_COLOR (#f59e0b)
/** The repr-pane id of the CURRENT stage's reference cell (the orange-ringed one). */
function bd2RefRepr(): string | null {
  const bd = stageBackdrop();
  const ref = bd?.querySelector<HTMLElement>('[data-cairn-stage-cell][data-cairn-stage-ref="true"]');
  return ref?.getAttribute("data-stage-repr-pane") ?? null;
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

  // --- Bug 2 (page) — the REFERENCE pane rings ORANGE; a non-ref selected pane
  //     rings in the (non-orange) blue accent. Assert COMPUTED outline colour, not
  //     mere presence, and the `data-reference` marker on exactly the ref pane. ---
  await sleep(30);
  const refFrameMarked = await waitFor(() => fc.getAttribute("data-reference") === "true");
  const nonRefUnmarked = fa.getAttribute("data-reference") == null;
  report(refFrameMarked, "the reference pane (C) carries data-reference=true");
  report(nonRefUnmarked, "a non-reference selected pane (A) is NOT marked reference");
  const refOutline = normColor(getComputedStyle(fc).outlineColor);
  const selOutline = normColor(getComputedStyle(fa).outlineColor);
  const refIsOrange = refOutline === ORANGE;
  const selIsNotOrange = selOutline !== ORANGE && selOutline !== "" && selOutline !== "rgba(0, 0, 0, 0)";
  report(refIsOrange, `reference pane outline is ORANGE (${refOutline})`);
  report(selIsNotOrange, `non-reference selected pane outline is the blue accent, NOT orange (${selOutline})`);
  ok = ok && refFrameMarked && nonRefUnmarked && refIsOrange && selIsNotOrange;

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
  const packedCols = Number(grid.getAttribute("data-cairn-stage-cols"));
  const twoCols = packedCols === 2;
  report(twoCols, `the content-aspect pack uses ~ceil(sqrt(3)) = 2 columns (got ${packedCols})`);
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

  // === Bug 2 (stage) — the reference CELL rings ORANGE (not the blue accent). ===
  const refCell = bd.querySelector<HTMLElement>('[data-cairn-stage-cell][data-cairn-stage-ref="true"]')!;
  const refCellOutline = normColor(getComputedStyle(refCell).outlineColor);
  const refCellOrange = refCellOutline === ORANGE;
  report(refCellOrange, `the reference cell outline is ORANGE (${refCellOutline})`);
  ok = ok && refCellOrange;

  // === CONTENT-ASPECT PACKING (3 square images) — the cells are sized to the
  //     CONTENT aspect (square, since the images are 8x8) and CLUSTERED centrally
  //     with small gaps, rather than stretched to fill the grid quadrants. Each
  //     pane still FILLS its (content-aspect) cell; the ref RING is on the CELL. ==
  await waitFor(() => {
    const c0 = stageCells()[0]?.getBoundingClientRect();
    return !!c0 && c0.width > 40 && near(c0.width / c0.height, 1, 0.06);
  }, 3000);
  {
    const g = stageGrid()!;
    const gRect = g.getBoundingClientRect();
    const cellRects = stageCells().map((c) => c.getBoundingClientRect());
    // Every cell carries the CONTENT aspect (≈ square) — NOT a stretched 1fr
    // quadrant (which would be ~gridW/2 x gridH/2, aspect gridW/gridH ≠ 1).
    const squareCells = cellRects.every((r) => r.height > 40 && near(r.width / r.height, 1, 0.06));
    report(squareCells, `each cell is sized to the CONTENT aspect (square) — ${cellRects.map((r) => (r.width / r.height).toFixed(2)).join(", ")}`);
    // Each pane frame still fills its (content-aspect) cell.
    const framesFillCells = stageCells().every((c) => {
      const cr = c.getBoundingClientRect();
      const fr = cellFrame(c)?.getBoundingClientRect();
      return !!fr && cr.height > 40 && near(fr.height, cr.height, 6) && near(fr.width, cr.width, 6);
    });
    report(framesFillCells, "each cell's pane frame fills its content-aspect cell (height/width match)");
    // DENSE + CENTRAL clustering: the cluster does NOT span the full grid width —
    // there are centring side margins (the "no stretched quadrants / empty cross"
    // requirement) — and adjacent cells sit only a SMALL gap apart.
    const minLeft = Math.min(...cellRects.map((r) => r.left));
    const maxRight = Math.max(...cellRects.map((r) => r.right));
    const clusterW = maxRight - minLeft;
    const clustered = clusterW < gRect.width - 20;
    report(clustered, `the cells cluster centrally — cluster ${clusterW.toFixed(0)}px is narrower than the stage ${gRect.width.toFixed(0)}px (side margins, not stretched)`);
    // The two top-row cells are a SMALL gap (~8px) apart, not a fat 1fr gutter.
    const row0 = cellRects.filter((r) => near(r.top, cellRects[0].top, 2)).sort((a, b) => a.left - b.left);
    const hGap = row0.length >= 2 ? row0[1].left - row0[0].right : 8;
    const smallGap = hGap >= 4 && hGap <= 16;
    report(smallGap, `adjacent cells are a small gap apart (~8px, got ${hGap.toFixed(1)})`);
    // The ref ring is on the CELL, never the full overlay width.
    const refCellRect = refCell.getBoundingClientRect();
    const ringOnCell = refCellRect.width < gRect.width - 20;
    report(ringOnCell, `the reference ring is on its CELL (${refCellRect.width.toFixed(0)}px), not the overlay (${gRect.width.toFixed(0)}px)`);
    ok = ok && squareCells && framesFillCells && clustered && smallGap && ringOnCell;
  }

  // === ENLARGE re-pick affordance — the WHOLE non-reference cell is the click
  // target (plain image cells: no gesture to collide with), cursor:pointer, and
  // NO "Set ref" button (that button is compare-mode-only, where a cell click
  // would hijack the compare pane's double-click-to-reset). ==
  {
    const nonRef = stageCells().find((c) => c.getAttribute("data-cairn-stage-ref") !== "true")!;
    const noButton = !nonRef.querySelector("[data-cairn-stage-set-ref]");
    report(noButton, "ENLARGE cells have NO 'Set ref' button (whole-cell click instead)");
    const clickable = getComputedStyle(nonRef).cursor === "pointer";
    report(clickable, `the non-reference enlarge cell is the click target (cursor: ${getComputedStyle(nonRef).cursor})`);
    ok = ok && noButton && clickable;
  }

  // === MODE TOGGLE — the in-stage segmented control switches the LIVE stage
  //     enlarge ⇄ compare (so "I picked a reference, now compare against it"
  //     works WITHOUT reopening). Enlarge is active; Compare is enabled (3 image
  //     panes). Switch to compare (2 comparison cells) and back to enlarge. ======
  {
    const enlargeSeg = stageModeBtn("enlarge");
    const compareSeg = stageModeBtn("compare");
    const togglePresent = !!enlargeSeg && !!compareSeg;
    report(togglePresent, "the stage shows an Enlarge/Compare mode toggle");
    const enlargeActive = enlargeSeg?.getAttribute("data-active") === "true";
    const compareEnabled = !!compareSeg && !compareSeg.disabled;
    report(enlargeActive, "Enlarge is the active toggle segment in the enlarge stage");
    report(compareEnabled, "Compare is enabled in the toggle (3 image-compatible panes)");
    ok = ok && togglePresent && enlargeActive && compareEnabled;
    if (compareSeg && enlargeSeg) {
      compareSeg.click();
      const switched = await waitFor(
        () =>
          !!stageBackdrop()?.querySelector('[data-cairn-stage-grid][data-cairn-stage-mode="compare"]') &&
          stageCells().length === 2,
        3000,
      );
      report(switched, "the toggle switches the live stage into COMPARE (2 comparison cells) — no reopen");
      // Switch back so the rest of the enlarge assertions have their 3 leaves.
      stageModeBtn("enlarge")!.click();
      const back = await waitFor(
        () =>
          !!stageBackdrop()?.querySelector('[data-cairn-stage-grid][data-cairn-stage-mode="enlarge"]') &&
          stageCells().length === 3,
        3000,
      );
      report(back, "the toggle switches back to ENLARGE (3 cells restored)");
      ok = ok && switched && back;
    }
  }

  // === VIEWPORT SYNC — the fix for "viewports not synced in multi-enlarge".
  //     Drive a REAL ctrl+wheel zoom on cell A's viewport and assert cell B zooms
  //     to the SAME transform: the stage cells now share ONE viewportSyncGroupId
  //     (the group the stage previously dropped while keeping only settings). ====
  {
    const cells = stageCells();
    const vpA = cells[0]?.querySelector<HTMLElement>("[data-cpu-image-viewport]") ?? null;
    const wrapA = cells[0] ? zoomWrapper(cells[0]) : null;
    const wrapB = cells[1] ? zoomWrapper(cells[1]) : null;
    if (vpA && wrapA && wrapB) {
      const beforeB = getComputedStyle(wrapB).transform;
      const r = vpA.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2);
      const cy = Math.round(r.top + r.height / 2);
      for (let i = 0; i < 4; i++) {
        vpA.dispatchEvent(
          new WheelEvent("wheel", {
            deltaY: -120,
            ctrlKey: true, // the zoom signature the viewport handler requires
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
          }),
        );
        await sleep(20);
      }
      const propagated = await waitFor(() => getComputedStyle(wrapB).transform !== beforeB, 3000);
      report(propagated, "ctrl+wheel zoom on enlarge cell A PROPAGATES to cell B (viewport sync)");
      const tA = getComputedStyle(wrapA).transform;
      const tB = getComputedStyle(wrapB).transform;
      const synced = tA === tB && tA !== "matrix(1, 0, 0, 1, 0, 0)" && tA !== "none";
      report(synced, `both enlarge cells share the SAME zoomed viewport transform (A=${tA}, B=${tB})`);
      ok = ok && propagated && synced;
    } else {
      report(false, "could not locate the CPU image viewport/wrapper for the viewport-sync probe");
      ok = false;
    }
  }

  // === Bug 3 + Bug 4 — settings SYNC across the stage + a toolbar menu opened
  //     INSIDE the stage floats ABOVE the backdrop (reachable/clickable). Drive a
  //     REAL colormap change on cell A and assert (a) the menu was on top and (b)
  //     cell B's colormap FOLLOWS. ==============================================
  {
    const cells = stageCells();
    const cellA = cells[0]!;
    const cellB = cells[1]!;
    const btnA = cmapButton(cellA);
    const btnB = cmapButton(cellB);
    if (btnA && btnB) {
      const faceBefore = (btnB.textContent ?? "").trim();
      const ul = await openListbox(btnA);
      report(!!ul, "a stage cell's colormap menu opens (portaled listbox present)");
      if (ul) {
        // Bug 4 — the portaled menu paints ABOVE the stage backdrop: elementFromPoint
        // at a menu OPTION returns that option, not the stage backdrop underneath.
        const opts = Array.from(ul.querySelectorAll<HTMLButtonElement>('li[role="option"] button'));
        const target = opts.find((o) => (o.textContent ?? "").trim() !== faceBefore) ?? opts[1] ?? opts[0]!;
        const menuZ = Number(getComputedStyle(ul).zIndex);
        const bdZ = Number(getComputedStyle(stageBackdrop()!).zIndex);
        const zAbove = menuZ > bdZ;
        report(zAbove, `the in-stage menu z (${menuZ}) is ABOVE the stage backdrop z (${bdZ})`);
        const tr = target.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.round(tr.left + tr.width / 2), Math.round(tr.top + tr.height / 2));
        const hitIsMenu = !!hit && !!hit.closest('ul[role="listbox"]');
        report(hitIsMenu, `elementFromPoint at a menu item hits the MENU, not the stage backdrop (${hit?.tagName ?? "null"})`);
        const wantLabel = (target.textContent ?? "").trim();
        target.click();
        // Bug 3 — cell B's colormap menu face follows cell A's pick (shared group).
        const bFollowed = await waitFor(() => (cmapButton(cellB)?.textContent ?? "").trim() === wantLabel, 3000);
        report(bFollowed, `changing colormap on cell A → cell B follows ("${faceBefore}" → "${wantLabel}")`);
        ok = ok && zAbove && hitIsMenu && bFollowed;
      } else {
        ok = false;
      }
    } else {
      report(false, "stage cells expose a colormap toolbar menu (needed for Bug 3/4)");
      ok = false;
    }
  }

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
  // No stage-level "vs REF" chip on comparison cells: it sat at the same top-left
  // corner as the compare pane's OWN reference marker and overlapped it. The
  // compare pane labels its reference side itself.
  const noStageChip = !cbd.querySelector("[data-cairn-stage-ref-chip]");
  report(noStageChip, "comparison cells carry NO overlapping stage 'vs REF' chip (compare pane labels its own ref)");
  // The comparison panes actually rendered (CPU split → <img>s).
  const compHasSurface = await waitFor(
    () => stageCells().length === 2 && stageCells().every((c) => !!c.querySelector("img,canvas")),
  );
  report(compHasSurface, "each comparison cell rendered its compare pane");
  ok = ok && twoComparisons && !!modeIsCompare && noRefInCells && noStageChip && compHasSurface;

  // --- 4. Re-pick the reference IN the grid → comparisons rebuild ------------
  // COMPARE mode: a PLAIN cell click must NOT re-pick (compare panes own
  // double-click-to-reset — the first click of a double-click would hijack it);
  // re-pick is ONLY the dedicated "Set ref" button.
  const reprBefore = new Set(reprPanes);
  {
    const refBeforePlain = store.reference();
    plainCellClick(stageCells()[0]);
    await sleep(120);
    const plainNoop = store.reference() === refBeforePlain;
    report(plainNoop, `COMPARE: a plain cell click does NOT change the reference (${refBeforePlain} → ${store.reference()})`);
    const cellNotPointer = getComputedStyle(stageCells()[0]).cursor !== "pointer";
    report(cellNotPointer, `COMPARE: the cell is not a click-to-set-ref target (cursor: ${getComputedStyle(stageCells()[0]).cursor})`);
    ok = ok && plainNoop && cellNotPointer;
  }
  const newRefId = stageCells()[0].getAttribute("data-stage-repr-pane")!;
  const pickedCompare = repickViaForegroundChip(stageCells()[0]);
  report(pickedCompare, "the first comparison cell has a clickable FOREGROUND caption chip");
  const refChanged = await waitFor(() => store.reference() === newRefId);
  report(refChanged, `clicking the foreground chip re-designates the reference (now ${store.reference()})`);
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

  // === Bug 8 (2 images) — Enlarge → cells FILL the overlay in ONE row; each cell
  //     rect height ≈ the grid content height; the pane fills its cell. ===========
  // Drop to a 2-selection (toggle C off — it is not the current reference).
  clickPane(fc, true);
  const twoSel = await waitFor(() => store.count() === 2);
  report(twoSel, `dropped to a 2-pane selection (count ${store.count()})`);
  const bar2 = await waitFor(() => !!actionBar());
  report(bar2, "the action bar is back for the 2-selection");
  (actionBar()!.querySelector('[data-cairn-action="enlarge"]') as HTMLButtonElement).click();
  const enl2Up = await waitFor(() => !!stageBackdrop() && stageCells().length === 2);
  report(enl2Up, `Enlarge with 2 images → a 2-cell grid (got ${stageCells().length})`);
  if (enl2Up) {
    const g = stageGrid()!;
    const gRect = g.getBoundingClientRect();
    await waitFor(() => {
      const c0 = stageCells()[0]?.getBoundingClientRect();
      return !!c0 && c0.width > 40 && near(c0.width / c0.height, 1, 0.06);
    }, 3000);
    const cells = stageCells();
    const cellRects = cells.map((c) => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    // CONTENT-ASPECT: two square cells (8x8 images), NOT two half-width slabs
    // stretched to the full overlay height.
    const squareCells = cellRects.every((r) => r.height > 40 && near(r.width / r.height, 1, 0.06));
    report(squareCells, `each of the 2 cells is content-aspect (square) — ${cellRects.map((r) => (r.width / r.height).toFixed(2)).join(", ")}`);
    // One row, clustered CENTRALLY with a small gap (side margins on the stage).
    const oneRow = near(cellRects[0].top, cellRects[1].top, 2);
    report(oneRow, "the 2 cells sit in one row");
    // Central clustering leaves a centring margin on the NON-binding axis (here
    // the square cells fill the width, so the margin is vertical) — the cluster
    // never stretches to fill BOTH axes.
    const clusterW = cellRects[1].right - cellRects[0].left;
    const clusterH = Math.max(...cellRects.map((r) => r.bottom)) - Math.min(...cellRects.map((r) => r.top));
    const clustered = clusterW < gRect.width - 20 || clusterH < gRect.height - 20;
    report(clustered, `the 2 cells cluster centrally (margin on ≥1 axis: cluster ${clusterW.toFixed(0)}x${clusterH.toFixed(0)} vs stage ${gRect.width.toFixed(0)}x${gRect.height.toFixed(0)})`);
    const hGap = cellRects[1].left - cellRects[0].right;
    const smallGap = hGap >= 4 && hGap <= 16;
    report(smallGap, `the 2 cells are a small gap apart (~8px, got ${hGap.toFixed(1)})`);
    // The pane frame fills its content-aspect cell.
    const panesFill = cells.every((c) => {
      const cr = c.getBoundingClientRect();
      const fr = cellFrame(c)?.getBoundingClientRect();
      return !!fr && near(fr.height, cr.height, 6) && near(fr.width, cr.width, 6);
    });
    report(panesFill, "each 2-image cell's pane fills the cell");
    ok = ok && squareCells && oneRow && clustered && smallGap && panesFill;

    // === Bug 7 (enlarge) — re-pick the reference IN the enlarge grid: the ORANGE
    //     ref badge MOVES to the clicked cell, live (no reopen). =================
    const refBefore = bd2RefRepr();
    const nonRefCell = stageCells().find((c) => c.getAttribute("data-cairn-stage-ref") !== "true")!;
    const newRef = nonRefCell.getAttribute("data-stage-repr-pane")!;
    plainCellClick(nonRefCell); // ENLARGE: the whole cell is the re-pick target
    const badgeMoved = await waitFor(() => bd2RefRepr() === newRef && store.reference() === newRef, 3000);
    report(badgeMoved, `enlarge re-pick moved the reference badge live (${refBefore} → ${bd2RefRepr()})`);
    // The newly-referenced cell now rings orange.
    const newRefCell = stageCells().find((c) => c.getAttribute("data-stage-repr-pane") === newRef)!;
    const newRefOrange = normColor(getComputedStyle(newRefCell).outlineColor) === ORANGE;
    report(newRefOrange, "the re-picked cell now rings ORANGE");
    ok = ok && badgeMoved && newRefOrange;

    (stageBackdrop()!.querySelector("[data-cairn-plot-stage-close]") as HTMLButtonElement).click();
    await waitFor(() => !stageBackdrop());
  } else {
    ok = false;
  }

  // === Bug 8 (2 images, compare) — Compare → ONE comparison pane that fills the
  //     WHOLE overlay content area. ===============================================
  const bar3 = await waitFor(() => !!actionBar());
  report(bar3, "the action bar returns before Compare (2 images)");
  (actionBar()!.querySelector('[data-cairn-action="compare"]') as HTMLButtonElement).click();
  const cmp1Up = await waitFor(() => !!stageBackdrop() && stageCells().length === 1);
  report(cmp1Up, `Compare with 2 images → a single comparison pane (got ${stageCells().length})`);
  if (cmp1Up) {
    const g = stageGrid()!;
    const gRect = g.getBoundingClientRect();
    const cs = getComputedStyle(g);
    const gInnerH = gRect.height - parseFloat(cs.paddingTop || "0") - parseFloat(cs.paddingBottom || "0");
    const gInnerW = gRect.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
    const cell = stageCells()[0]!;
    const cr = cell.getBoundingClientRect();
    // The images are 8×8 (square). In a landscape overlay the single pane is
    // sized to its CONTENT aspect (square) — it FILLS the binding (shorter) axis
    // and is centred on the other, NOT stretched to the overlay's aspect (which
    // would object-contain letterbox to checkerboard). Viewport aspect == content.
    const cellAspect = cr.width / cr.height;
    const isContentAspect = near(cellAspect, 1, 0.06);
    const fillsHeight = near(cr.height, gInnerH, 8); // binding axis (landscape stage)
    const notStretchedWide = cr.width < gInnerW - 20; // centred, not stretched to full width
    report(isContentAspect, `the single compare pane is CONTENT-aspect (square) not overlay-aspect (${cellAspect.toFixed(3)})`);
    report(fillsHeight && notStretchedWide, `it fills the binding axis + centres (${cr.width.toFixed(0)}x${cr.height.toFixed(0)} in ${gInnerW.toFixed(0)}x${gInnerH.toFixed(0)}) — no letterbox`);
    const fr = cellFrame(cell)?.getBoundingClientRect();
    const paneFills = !!fr && near(fr.height, cr.height, 6);
    report(paneFills, "the compare pane frame fills its content-aspect cell");
    ok = ok && isContentAspect && fillsHeight && notStretchedWide && paneFills;
    (stageBackdrop()!.querySelector("[data-cairn-plot-stage-close]") as HTMLButtonElement).click();
    await waitFor(() => !stageBackdrop());
  } else {
    ok = false;
  }

  // === Bug 1 — CLICK EMPTY SPACE deselects: the selection clears and the action
  //     bar disappears. ==========================================================
  {
    const beforeCount = store.count();
    report(beforeCount >= 2, `a selection exists before the empty-space click (count ${beforeCount})`);
    // A stationary press whose target is the bare document body (no pane, no UI).
    const opts = { bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", button: 0, clientX: 3, clientY: 3 };
    document.body.dispatchEvent(new PointerEvent("pointerdown", opts));
    document.body.dispatchEvent(new PointerEvent("pointerup", opts));
    const cleared = await waitFor(() => store.count() === 0, 2000);
    report(cleared, `clicking empty space cleared the selection (count ${store.count()})`);
    const barGone = await waitFor(() => !actionBar(), 2000);
    report(barGone, "the action bar disappeared after deselect");
    ok = ok && cleared && barGone;
  }

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
