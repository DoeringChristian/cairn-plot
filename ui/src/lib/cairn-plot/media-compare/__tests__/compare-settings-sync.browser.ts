/**
 * COMPARE↔COMPARE settings-sync — LIVE, self-driving Chromium harness.
 *
 * The bug this guards: when multiple compare/diff panes were selected together,
 * ONLY zoom/pan synced (the viewport bus). The compare panes' OWN settings —
 * compare mode, diff kernel, colormap, tone-map, split position — did NOT sync,
 * because `GpuComparePane` never subscribed to the shared SETTINGS bus at all.
 * The fix wires `GpuComparePane` onto the SAME settings-sync path the image
 * panes use (`useSyncedImageSettings` + `image-settings-sync` bus + the
 * broadened `ImageSyncSettings` payload). This harness proves it end-to-end.
 *
 * It mounts TWO independent `PlotApp` roots (the gallery shape — two separate
 * mounts, NOT one `cp.Grid`), each a single engine-backed compare pane, selects
 * BOTH (a plain click on A + a shift-click on B — the page-wide selection),
 * then drives a REAL control change on pane A through the pane's exposed
 * `__cairnCompareProbe` change* wrappers (the exact functions its menus/sliders
 * call) and asserts pane B's state follows:
 *   - compare MODE  (split → blend → diff → split)
 *   - diff KERNEL   (absolute → squared)
 *   - COLORMAP      (none → viridis)
 *   - TONEMAP       (srgb → aces)
 *   - SPLIT position (0.5 → 0.3)
 *
 * The engine compare pane needs WebGPU, so this is a Chromium page (like the
 * sibling engine harnesses). It is SELF-DRIVING (`data-cairn-harness`), so
 * `npm run test:harness` runs it in the DEFAULT set; when no WebGPU adapter is
 * available the runner skips-loud (exit 0), never a false pass.
 *
 * RUNNING (standalone):
 *   npx esbuild \
 *     src/lib/cairn-plot/media-compare/__tests__/compare-settings-sync.browser.ts \
 *     --bundle --format=esm --jsx=automatic \
 *     --outfile=src/lib/cairn-plot/media-compare/__tests__/compare-settings-sync.browser.bundle.js
 *   then serve ui/ and open the .browser.html (or just: npm run test:harness
 *   --only compare-settings-sync, which bundles + drives it headlessly).
 * The generated .bundle.js is gitignored — regenerate on change.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../../plot-renderers";
import type { PlotDescriptor } from "../../../../plot-descriptor";
import GpuComparePane from "../GpuComparePane";
import { InFullscreenOverlayContext } from "../../primitives/FullscreenOverlayShell";
import { listDiffMenuModes } from "../../engine/kernels";
import {
  getGlobalSelectionStore,
  paneSyncGroups,
  GLOBAL_SELECTION_BASE,
  __resetGlobalSelectionStoreForTest,
} from "../../viewport/selection-store";

/** The subset of `GpuComparePane`'s `__cairnCompareProbe` this harness drives. */
interface CompareSyncProbe {
  compareMode: string;
  colormap: string;
  diffKernel: string;
  splitPosition: number;
  effectiveTonemap: string;
  changeCompareMode: (m: "split" | "blend" | "diff") => void;
  changeDiffKernel: (id: string) => void;
  changeColormap: (id: string) => void;
  changeTonemap: (id: string) => void;
  changeSplit: (p: number) => void;
}

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "#6f6" : "#f66";
    el.appendChild(p);
  }
}

function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "#6f6" : "#f66";
  }
  document.title = pass ? "COMPARE SETTINGS SYNC PASS" : "COMPARE SETTINGS SYNC FAIL";
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
async function waitFor(predicate: () => boolean, timeoutMs = 8000, stepMs = 25): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return predicate();
}

/** A tiny non-blank PNG data URL, so each compare side is a real URL image
 *  (no WebGPU-float upload needed for the sources). */
function makeImageUrl(color: string): string {
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

/** A standalone compare descriptor (two URL frames composited). `mode` starts
 *  in a COMPOSITED mode so the engine `GpuComparePane` mounts (side would be a
 *  2-cell layout with no compare pane). */
function compareDescriptor(fg: string, ref: string): PlotDescriptor {
  return {
    mode: "local",
    root: {
      kind: "compare",
      mode: "split",
      a: { kind: "url", src: makeImageUrl(fg) },
      b: { kind: "url", src: makeImageUrl(ref) },
      // Per-side captions (baselineIndex defaults to 0 → a = reference, b =
      // foreground): reference "REF_CAP" bottom-left, foreground "FG_CAP"
      // bottom-right in slide; folded into the diff caption in diff mode.
      props: { toolbar: true, labelA: "REF_CAP", labelB: "FG_CAP" },
    },
  } as PlotDescriptor;
}

/** Stationary press (select gesture). `shift` = additive multi-select. */
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
/** The outer `data-gpu-compare-pane` root of each mounted compare pane (one per
 *  mount, in document order = [A, B]). */
function comparePaneRoots(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-gpu-compare-pane]"));
}
/** The probe/kernel seams live on the pane's INNER `paneRef` element (the padded
 *  viewport box), NOT the outer `data-gpu-compare-pane` root — so walk each
 *  pane's own subtree for whichever descendant carries `__cairnCompareProbe`. */
function probeOf(root: HTMLElement | undefined): CompareSyncProbe | undefined {
  if (!root) return undefined;
  type SeamEl = HTMLElement & { __cairnCompareProbe?: CompareSyncProbe };
  if ((root as SeamEl).__cairnCompareProbe) return (root as SeamEl).__cairnCompareProbe;
  for (const n of Array.from(root.querySelectorAll("*")) as SeamEl[]) {
    if (n.__cairnCompareProbe) return n.__cairnCompareProbe;
  }
  return undefined;
}

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  __resetGlobalSelectionStoreForTest();

  // Route split/blend/diff through the ENGINE compare pane, and mount eagerly.
  const w = window as unknown as Record<string, unknown>;
  w.__cairnPlotRenderMode = "gpu";
  w.__cairnPlotUseGpuImage = true;
  w.__cairnPlotGpuComparePane = GpuComparePane;
  w.__cairnPlotDiffMenuModes = listDiffMenuModes();
  w.__cairnPlotEagerMount = true;

  const roots: Root[] = [];
  const mount = (divId: string, d: PlotDescriptor) => {
    const el = document.getElementById(divId)!;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { descriptor: d }));
    roots.push(root);
  };
  mount("mount-a", compareDescriptor("#c0392b", "#2980b9"));
  mount("mount-b", compareDescriptor("#27ae60", "#8e44ad"));

  // Both engine compare panes mount AND expose their probe (needs a real GPU
  // surface — if this never settles the runner reports TIMEOUT, not a false pass).
  const panesReady = await waitFor(
    () => comparePaneRoots().length === 2 && comparePaneRoots().every((p) => !!probeOf(p)),
    15000,
  );
  report(panesReady, `two engine compare panes mount and expose a probe (got ${comparePaneRoots().length})`);
  ok = ok && panesReady;
  if (!panesReady) {
    roots.forEach((r) => r.unmount());
    return false;
  }

  const [fa, fb] = frames();
  const framesOk = frames().length === 2 && !!fa && !!fb;
  report(framesOk, `two selectable pane frames present (got ${frames().length})`);
  ok = ok && framesOk;
  if (!framesOk) {
    roots.forEach((r) => r.unmount());
    return false;
  }
  const idA = fa.getAttribute("data-plot-pane-id")!;
  const idB = fb.getAttribute("data-plot-pane-id")!;

  // --- select BOTH panes (plain click A, shift-click B) --------------------
  clickPane(fa);
  clickPane(fb, true);
  const store = getGlobalSelectionStore();
  const bothSelected = await waitFor(
    () => fa.getAttribute("data-selected") === "true" && fb.getAttribute("data-selected") === "true",
  );
  report(bothSelected, "both compare panes are selected together");
  ok = ok && bothSelected;

  // They share ONE settings-sync group; A (first-selected) is the anchor.
  const gA = paneSyncGroups(store, idA, GLOBAL_SELECTION_BASE);
  const gB = paneSyncGroups(store, idB, GLOBAL_SELECTION_BASE);
  const sharedGroup = !!gA && !!gB && gA.settingsGroupId === gB.settingsGroupId;
  report(sharedGroup, `both share ONE settings sync group (${gA?.settingsGroupId})`);
  report(gA?.isAnchor === true && gB?.isAnchor === false, "A is the group anchor, B is not");
  ok = ok && sharedGroup;

  // Pane A is the anchor — drive A, assert B follows. Re-read the probe each
  // poll (the pane recreates the probe object on every render).
  const A = () => probeOf(comparePaneRoots()[0])!;
  const B = () => probeOf(comparePaneRoots()[1])!;

  // --- 1. compare MODE: split → blend --------------------------------------
  A().changeCompareMode("blend");
  const modeBlend = await waitFor(() => B().compareMode === "blend");
  report(modeBlend, `MODE sync: A→blend, B follows (B.compareMode=${B().compareMode})`);
  ok = ok && modeBlend;

  // --- 2. compare MODE: blend → diff ---------------------------------------
  A().changeCompareMode("diff");
  const modeDiff = await waitFor(() => B().compareMode === "diff");
  report(modeDiff, `MODE sync: A→diff, B follows (B.compareMode=${B().compareMode})`);
  ok = ok && modeDiff;

  // --- 3. diff KERNEL: absolute → squared ----------------------------------
  A().changeDiffKernel("squared");
  const kernelOk = await waitFor(() => B().diffKernel === "squared");
  report(kernelOk, `KERNEL sync: A→squared, B follows (B.diffKernel=${B().diffKernel})`);
  ok = ok && kernelOk;

  // --- 4. COLORMAP: none → viridis (colormap menu is live in diff mode) -----
  A().changeColormap("viridis");
  const cmapOk = await waitFor(() => B().colormap === "viridis");
  report(cmapOk, `COLORMAP sync: A→viridis, B follows (B.colormap=${B().colormap})`);
  ok = ok && cmapOk;

  // --- 5. back to split, then TONEMAP: srgb → aces (tonemap is split/blend) --
  A().changeCompareMode("split");
  const backSplit = await waitFor(() => B().compareMode === "split");
  report(backSplit, `MODE sync: A→split, B follows (B.compareMode=${B().compareMode})`);
  ok = ok && backSplit;

  A().changeTonemap("aces");
  const tmOk = await waitFor(() => B().effectiveTonemap === "aces");
  report(tmOk, `TONEMAP sync: A→aces, B follows (B.effectiveTonemap=${B().effectiveTonemap})`);
  ok = ok && tmOk;

  // --- 6. SPLIT position: 0.5 → 0.3 ----------------------------------------
  A().changeSplit(0.3);
  const splitOk = await waitFor(() => Math.abs(B().splitPosition - 0.3) < 1e-6);
  report(splitOk, `SPLIT sync: A→0.3, B follows (B.splitPosition=${B().splitPosition})`);
  ok = ok && splitOk;

  // --- 7. SPLIT flip via Left/Right arrow keys (slide mode) -----------------
  // In split mode the arrows snap the divider hard to an edge, flipping between
  // the two images. The listener lives on the PANE element (not window), so the
  // keydown is dispatched on pane A's viewport box (`data-gpu-compare-viewport`,
  // which IS the pane's own paneRef). Because split position syncs across the
  // selected panes, B tracks the flip too.
  const paneAViewport = comparePaneRoots()[0]!.querySelector<HTMLElement>("[data-gpu-compare-viewport]")!;
  const arrow = (key: "ArrowLeft" | "ArrowRight") =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

  // PRIMARY path — HOVER (what users actually do): the pointer is over the pane,
  // NOT focused. Ensure focus is elsewhere, hover the pane (pointerenter), then
  // key on window. This is the path the first cut got wrong (it required focus).
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const notFocused = !paneAViewport.contains(document.activeElement);
  report(notFocused, "arrow-flip HOVER path: pane is NOT focused before the gesture");
  paneAViewport.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
  arrow("ArrowLeft");
  const hoverFlipLeft = await waitFor(() => Math.abs(A().splitPosition - 0) < 1e-6);
  report(hoverFlipLeft, `HOVER ArrowLeft snaps split→0 without focus (A.splitPosition=${A().splitPosition})`);
  arrow("ArrowRight");
  const hoverFlipRight = await waitFor(() => Math.abs(A().splitPosition - 1) < 1e-6);
  report(hoverFlipRight, `HOVER ArrowRight snaps split→1 without focus (A.splitPosition=${A().splitPosition})`);
  ok = ok && notFocused && hoverFlipLeft && hoverFlipRight;

  // Leaving the pane stops it reacting; and the FOCUS path still works too.
  paneAViewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
  A().changeSplit(0.4);
  await waitFor(() => Math.abs(A().splitPosition - 0.4) < 1e-6);
  arrow("ArrowLeft"); // not hovered, not focused → ignored
  await sleep(60);
  const ignoredWhenAway = Math.abs(A().splitPosition - 0.4) < 1e-6;
  report(ignoredWhenAway, `arrows are IGNORED when the pointer left the pane (A.splitPosition=${A().splitPosition})`);
  paneAViewport.focus();
  arrow("ArrowRight");
  const focusFlip = await waitFor(() => Math.abs(A().splitPosition - 1) < 1e-6);
  report(focusFlip, `FOCUS path still flips (A.splitPosition=${A().splitPosition})`);
  const peerTrackedFlip = await waitFor(() => Math.abs(B().splitPosition - 1) < 1e-6);
  report(peerTrackedFlip, `the flip syncs to the peer pane (B.splitPosition=${B().splitPosition})`);
  ok = ok && ignoredWhenAway && focusFlip && peerTrackedFlip;

  // --- 7b. OVERLAY path — a compare pane rendered INSIDE a fullscreen overlay
  //     (wrapped in `InFullscreenOverlayContext`, exactly as the compare/enlarge
  //     stage does) acts on the arrows with NO hover and NO focus (modal, one
  //     active compare). Mount a third pane in that context, move the pointer
  //     AWAY, blur, then key: it must STILL flip (the inline "away" rule lifted).
  const rootC = createRoot(document.getElementById("mount-c")!);
  rootC.render(
    createElement(
      InFullscreenOverlayContext.Provider,
      { value: true },
      createElement(PlotApp, { descriptor: compareDescriptor("#e67e22", "#16a085") }),
    ),
  );
  roots.push(rootC);
  const overlayReady = await waitFor(() => comparePaneRoots().length === 3 && !!probeOf(comparePaneRoots()[2]), 15000);
  report(overlayReady, "overlay compare pane mounts inside InFullscreenOverlayContext");
  const C = () => probeOf(comparePaneRoots()[2])!;
  const paneCViewport = comparePaneRoots()[2]!.querySelector<HTMLElement>("[data-gpu-compare-viewport]")!;
  paneCViewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  C().changeSplit(0.4);
  await waitFor(() => Math.abs(C().splitPosition - 0.4) < 1e-6);
  arrow("ArrowLeft"); // away + not focused, but inside the overlay → acts
  const overlayFlip = await waitFor(() => Math.abs(C().splitPosition - 0) < 1e-6, 2000);
  report(overlayFlip, `OVERLAY ArrowLeft flips with pointer AWAY + not focused (C.splitPosition=${C().splitPosition})`);
  ok = ok && overlayReady && overlayFlip;

  // --- 8. PER-SIDE CAPTIONS — cp.Image(label=...) shown in the compare pane ---
  // Return pane A to split, then assert the REFERENCE caption sits bottom-LEFT
  // and the FOREGROUND caption bottom-RIGHT (the divider passes over them). Then
  // switch to diff and assert the ONE "<metric> · <fg> compared to <ref>" caption.
  const paneARoot = comparePaneRoots()[0]!;
  const chipByText = (root: HTMLElement, text: string): HTMLElement | null =>
    Array.from(root.querySelectorAll<HTMLElement>("span")).find(
      (s) => (s.textContent ?? "").trim() === text && !s.querySelector("span"),
    ) ?? null;
  const inLeftHalf = (el: HTMLElement, root: HTMLElement): boolean => {
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    return r.left + r.width / 2 < rr.left + rr.width / 2;
  };
  A().changeCompareMode("split");
  await waitFor(() => A().compareMode === "split");
  await waitFor(() => !!chipByText(paneARoot, "REF_CAP") && !!chipByText(paneARoot, "FG_CAP"), 3000);
  const refChip = chipByText(paneARoot, "REF_CAP");
  const fgChip = chipByText(paneARoot, "FG_CAP");
  const bothPresent = !!refChip && !!fgChip;
  report(bothPresent, `slide: BOTH per-side captions render (ref=${!!refChip}, fg=${!!fgChip})`);
  // Reference is pinned to the LEFT gutter, foreground to the RIGHT — so the
  // reference caption's left edge is strictly left of the foreground caption's.
  const refLeftOfFg =
    bothPresent && refChip!.getBoundingClientRect().left < fgChip!.getBoundingClientRect().left;
  report(refLeftOfFg, "slide: the REFERENCE caption sits left of the FOREGROUND caption");
  // And the reference caption hugs the left half (its own corner).
  const refInLeft = !!refChip && inLeftHalf(refChip, paneARoot);
  report(refInLeft, "slide: the reference caption hugs the bottom-LEFT gutter");
  ok = ok && bothPresent && refLeftOfFg && refInLeft;

  // Diff mode: one caption "<metric> · FG_CAP compared to REF_CAP" (bottom-left).
  A().changeCompareMode("diff");
  await waitFor(() => A().compareMode === "diff");
  const diffChip = await waitFor(
    () => Array.from(paneARoot.querySelectorAll<HTMLElement>("span")).some((s) =>
      /FG_CAP compared to REF_CAP/.test(s.textContent ?? ""),
    ),
    3000,
  );
  report(diffChip, "diff: a single '<metric> · FG_CAP compared to REF_CAP' caption is shown");
  const diffCaptionEl = Array.from(paneARoot.querySelectorAll<HTMLElement>("span")).find((s) =>
    /FG_CAP compared to REF_CAP/.test(s.textContent ?? ""),
  );
  const diffHasMetric = !!diffCaptionEl && /·/.test(diffCaptionEl.textContent ?? "");
  const diffLeft = !!diffCaptionEl && inLeftHalf(diffCaptionEl, paneARoot);
  report(diffHasMetric, `diff caption names the metric (has '·'): "${diffCaptionEl?.textContent ?? ""}"`);
  report(diffLeft, "diff caption sits bottom-LEFT (clear of the bottom-right metrics)");
  ok = ok && diffChip && diffHasMetric && diffLeft;

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
