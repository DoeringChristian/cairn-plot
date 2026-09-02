/**
 * COMPARE↔COMPARE settings-sync — LIVE, self-driving Chromium harness.
 *
 * The bug this guards: when multiple compare/diff panes were selected together,
 * ONLY zoom/pan synced (the viewport bus). The compare panes' OWN settings —
 * compare mode, diff kernel, colormap, tone-map, split position — did NOT sync,
 * because `GpuComparePane` never subscribed to the shared SETTINGS bus at all.
 * The fix wires `GpuComparePane` onto the SAME settings-sync path the image
 * panes use (`useCellSettings` + `viewport-settings` bus + the
 * broadened `PlotSettings` payload). This harness proves it end-to-end.
 *
 * It mounts TWO independent `PlotApp` roots (the gallery shape — two separate
 * mounts, NOT one `cp.Grid`), each a single engine-backed compare pane, selects
 * BOTH (a plain click on A + a shift-click on B — the page-wide selection),
 * then drives a REAL control change on pane A through the pane's exposed
 * `__cairnCompareProbe` change* wrappers (the exact functions its menus/sliders
 * call) and asserts pane B's state follows:
 *   - compare MODE  (split → blend → diff → split)
 *   - diff KERNEL   (absolute → squared)
 *   - COLORMAP      (none → magma)
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
 *     src/plots/image/compare/__tests__/compare-settings-sync.browser.ts \
 *     --bundle --format=esm --jsx=automatic \
 *     --outfile=src/plots/image/compare/__tests__/compare-settings-sync.browser.bundle.js
 *   then serve ui/ and open the .browser.html (or just: npm run test:harness
 *   --only compare-settings-sync, which bundles + drives it headlessly).
 * The generated .bundle.js is gitignored — regenerate on change.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../../host/bootstrap";
import { registerCoreRenderers } from "../../../register-core";
import type { PlotSpec } from "../../../../../../packages/spec/src/spec.ts";
import { InFullscreenOverlayContext } from "../../../../primitives/components/FullscreenOverlayShell";
import {
  getGlobalSelectionStore,
  paneSyncGroups,
  GLOBAL_SELECTION_BASE,
  __resetGlobalSelectionStoreForTest,
} from "../../../../state/selection/selection-store";
import { createHarness, sleep, waitFor } from "../../../../testing/harness";

/** The subset of `GpuComparePane`'s `__cairnCompareProbe` this harness drives. */
interface CompareSyncProbe {
  compareMode: string;
  colormap: string;
  comparisonOperationId: string;
  splitPosition: number;
  effectiveTonemap: string;
  // Unified DISPLAY-encoding state (the compare-pane-on-DISPLAY follow-up): the
  // ONE derived encoding id. (The DATA-encoding norm getter/changeNorm were removed
  // with the norm picker — norm-UI-removal follow-up.)
  displayOperationId: string;
  changeCompareMode: (m: "split" | "diff") => void;
  changeComparisonOperation: (id: string) => void;
  changeColormap: (id: string) => void;
  changeTonemap: (id: string) => void;
  changeSplit: (p: number) => void;
  /** HOME (view-local reset) — the per-kernel-default-colormaps follow-up. */
  home: () => void;
}

const { report, setOverallStatus } = createHarness({ title: "COMPARE SETTINGS SYNC", colors: { pass: "#6f6", fail: "#f66" } });

const consoleErrors: string[] = [];
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.map(String).join(" "));
  origConsoleError(...args);
};

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
function compareDescriptor(fg: string, ref: string): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "compare",
      type: "image",
      presentation: "split",
      operands: [
        { kind: "url", src: makeImageUrl(ref) },
        { kind: "url", src: makeImageUrl(fg) },
      ],
      strategy: "reference",
      referenceIndex: 0,
      // Per-side captions (baselineIndex defaults to 0 → a = reference, b =
      // foreground): reference "REF_CAP" bottom-left, foreground "FG_CAP"
      // bottom-right in slide; folded into the diff caption in diff mode.
      props: { toolbar: true, labelA: "REF_CAP", labelB: "FG_CAP" },
    },
  } as PlotSpec;
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

/** The selectable pane FRAMES (one per mount, document order = [A, B, …]). This
 *  is the pane-type-AGNOSTIC anchor: it is present for a slide/blend compare
 *  (`GpuComparePane`) AND a diff compare (which — post Phase 2c routing — lowers
 *  to a `GpuImagePane` with `compareSource`, NOT a `GpuComparePane`). */
function frames(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-plot-pane-id][data-selectable="true"]'),
  );
}
/** The compare/diff probe within a pane frame — `__cairnImageDiffProbe`, exposed
 *  by the unified `GpuImagePane` in diff mode. It drives the compare surface
 *  (compareMode/comparisonOperationId/colormap/displayOperationId/changeCompareMode/changeComparisonOperation/
 *  changeColormap/home) whichever lowering is live across a mode switch. */
function probeOf(frame: HTMLElement | undefined): CompareSyncProbe | undefined {
  if (!frame) return undefined;
  type SeamEl = HTMLElement & {
    __cairnImageDiffProbe?: CompareSyncProbe;
  };
  const seam = (el: SeamEl) => el.__cairnImageDiffProbe;
  if (seam(frame as SeamEl)) return seam(frame as SeamEl);
  for (const n of Array.from(frame.querySelectorAll("*")) as SeamEl[]) {
    const p = seam(n);
    if (p) return p;
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
  // EVERY compare mode (diff AND split/blend) now routes through the unified
  // image pane (`GpuImagePane` + `compareSource`) — `GpuComparePane` is deleted
  // (content-op unification, Phase 4). Wire it so `resolveImageRenderer("gpu")`
  // finds it.
  w.__cairnPlotEagerMount = true;

  const roots: Root[] = [];
  const mount = (divId: string, d: PlotSpec) => {
    const el = document.getElementById(divId)!;
    const root = createRoot(el);
    root.render(createElement(PlotApp, { spec: d }));
    roots.push(root);
  };
  mount("mount-a", compareDescriptor("#c0392b", "#2980b9"));
  mount("mount-b", compareDescriptor("#27ae60", "#8e44ad"));

  // Both engine compare panes mount AND expose their probe (needs a real GPU
  // surface — if this never settles the runner reports TIMEOUT, not a false pass).
  const panesReady = await waitFor(
    () => frames().length === 2 && frames().every((f) => !!probeOf(f)),
    15000, 25);
  report(panesReady, `two engine compare panes mount and expose a probe (got ${frames().length})`);
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
    () => fa.getAttribute("data-selected") === "true" && fb.getAttribute("data-selected") === "true", 8000, 25);
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
  const A = () => probeOf(frames()[0])!;
  const B = () => probeOf(frames()[1])!;

  // --- 1. compare MODE: → diff (the blend view mode was removed) -----------
  A().changeCompareMode("diff");
  const modeDiff = await waitFor(() => B().compareMode === "diff", 8000, 25);
  report(modeDiff, `MODE sync: A→diff, B follows (B.compareMode=${B().compareMode})`);
  ok = ok && modeDiff;

  // --- 3. diff KERNEL: absolute → squared ----------------------------------
  A().changeComparisonOperation("squared");
  const kernelOk = await waitFor(() => B().comparisonOperationId === "squared", 8000, 25);
  report(kernelOk, `KERNEL sync: A→squared, B follows (B.comparisonOperationId=${B().comparisonOperationId})`);
  ok = ok && kernelOk;

  // --- 4. COLORMAP: none → magma (colormap menu is live in diff mode) -----
  A().changeColormap("magma");
  const cmapOk = await waitFor(() => B().colormap === "magma", 8000, 25);
  report(cmapOk, `COLORMAP sync: A→magma, B follows (B.colormap=${B().colormap})`);
  ok = ok && cmapOk;
  // The unified `encoding` key follows too (in diff+colormap the active encoding
  // IS the lut) — the compare-pane-on-DISPLAY follow-up carries ONE encoding id.
  const encOk = await waitFor(() => B().displayOperationId === "magma", 8000, 25);
  report(encOk, `ENCODING sync: B's derived encoding follows to magma (B.displayOperationId=${B().displayOperationId})`);
  ok = ok && encOk;

  // (The NORM sync step was removed — the norm Lin·Log·Pow picker is gone,
  // norm-UI-removal follow-up. The ENGINE norm parity cases live in the
  // display-operation-registry / compare-pass harnesses and stay.)

  // --- 5. back to split, then TONEMAP: srgb → aces (tonemap is split/blend) --
  A().changeCompareMode("split");
  const backSplit = await waitFor(() => B().compareMode === "split", 8000, 25);
  report(backSplit, `MODE sync: A→split, B follows (B.compareMode=${B().compareMode})`);
  ok = ok && backSplit;

  A().changeTonemap("aces");
  const tmOk = await waitFor(() => B().effectiveTonemap === "aces", 8000, 25);
  report(tmOk, `TONEMAP sync: A→aces, B follows (B.effectiveTonemap=${B().effectiveTonemap})`);
  ok = ok && tmOk;

  // --- 6. SPLIT position: 0.5 → 0.3 ----------------------------------------
  A().changeSplit(0.3);
  const splitOk = await waitFor(() => Math.abs(B().splitPosition - 0.3) < 1e-6, 8000, 25);
  report(splitOk, `SPLIT sync: A→0.3, B follows (B.splitPosition=${B().splitPosition})`);
  ok = ok && splitOk;

  // --- 7. SPLIT flip via Left/Right arrow keys (slide mode) -----------------
  // In split mode the arrows snap the divider hard to an edge, flipping between
  // the two images. The listener lives on the PANE element (not window), so the
  // keydown is dispatched on pane A's viewport box. Phase 3: split/blend now
  // render on the UNIFIED pane (`data-gpu-image-surface`), so target either
  // seam (compare | image). Because split position syncs across the selected
  // panes, B tracks the flip too.
  const paneAViewport = frames()[0]!.querySelector<HTMLElement>(
    "[data-gpu-compare-surface], [data-gpu-image-surface]",
  )!;
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
  const hoverFlipLeft = await waitFor(() => Math.abs(A().splitPosition - 0) < 1e-6, 8000, 25);
  report(hoverFlipLeft, `HOVER ArrowLeft snaps split→0 without focus (A.splitPosition=${A().splitPosition})`);
  arrow("ArrowRight");
  const hoverFlipRight = await waitFor(() => Math.abs(A().splitPosition - 1) < 1e-6, 8000, 25);
  report(hoverFlipRight, `HOVER ArrowRight snaps split→1 without focus (A.splitPosition=${A().splitPosition})`);
  ok = ok && notFocused && hoverFlipLeft && hoverFlipRight;

  // --- 7a. DEDICATED `[`/`]` slide-flip keys -------------------------------
  // `[`/`]` snap the divider to the left/right edge EVERYWHERE (their reason to
  // exist: inside a stacked grid the arrows drive the tab strip, so the flip
  // needs distinct keys). Here (inline, non-stacked) they flip alongside the
  // arrows; the pane is still hovered from above.
  const bracket = (key: "[" | "]") =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  bracket("[");
  const braceLeft = await waitFor(() => Math.abs(A().splitPosition - 0) < 1e-6, 8000, 25);
  report(braceLeft, `HOVER "[" snaps split→0 (A.splitPosition=${A().splitPosition})`);
  bracket("]");
  const braceRight = await waitFor(() => Math.abs(A().splitPosition - 1) < 1e-6, 8000, 25);
  report(braceRight, `HOVER "]" snaps split→1 (A.splitPosition=${A().splitPosition})`);
  ok = ok && braceLeft && braceRight;

  // Leaving the pane stops it reacting; and the FOCUS path still works too.
  paneAViewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
  A().changeSplit(0.4);
  await waitFor(() => Math.abs(A().splitPosition - 0.4) < 1e-6, 8000, 25);
  arrow("ArrowLeft"); // not hovered, not focused → ignored
  await sleep(60);
  const ignoredWhenAway = Math.abs(A().splitPosition - 0.4) < 1e-6;
  report(ignoredWhenAway, `arrows are IGNORED when the pointer left the pane (A.splitPosition=${A().splitPosition})`);
  paneAViewport.focus();
  arrow("ArrowRight");
  const focusFlip = await waitFor(() => Math.abs(A().splitPosition - 1) < 1e-6, 8000, 25);
  report(focusFlip, `FOCUS path still flips (A.splitPosition=${A().splitPosition})`);
  const peerTrackedFlip = await waitFor(() => Math.abs(B().splitPosition - 1) < 1e-6, 8000, 25);
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
      createElement(PlotApp, { spec: compareDescriptor("#e67e22", "#16a085") }),
    ),
  );
  roots.push(rootC);
  const overlayReady = await waitFor(() => frames().length === 3 && !!probeOf(frames()[2]), 15000, 25);
  report(overlayReady, "overlay compare pane mounts inside InFullscreenOverlayContext");
  const C = () => probeOf(frames()[2])!;
  const paneCViewport = frames()[2]!.querySelector<HTMLElement>(
    "[data-gpu-compare-surface], [data-gpu-image-surface]",
  )!;
  paneCViewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  C().changeSplit(0.4);
  await waitFor(() => Math.abs(C().splitPosition - 0.4) < 1e-6, 8000, 25);
  arrow("ArrowLeft"); // away + not focused, but inside the overlay → acts
  const overlayFlip = await waitFor(() => Math.abs(C().splitPosition - 0) < 1e-6, 2000, 25);
  report(overlayFlip, `OVERLAY ArrowLeft flips with pointer AWAY + not focused (C.splitPosition=${C().splitPosition})`);
  ok = ok && overlayReady && overlayFlip;

  // --- 8. PER-SIDE CAPTIONS — cp.Image(label=...) shown in the compare pane ---
  // Return pane A to split, then assert the REFERENCE caption sits bottom-LEFT
  // and the FOREGROUND caption bottom-RIGHT (the divider passes over them). Then
  // switch to diff and assert the ONE "<metric> · <fg> compared to <ref>" caption.
  const paneARoot = frames()[0]!;
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
  await waitFor(() => A().compareMode === "split", 8000, 25);
  await waitFor(() => !!chipByText(paneARoot, "REF_CAP") && !!chipByText(paneARoot, "FG_CAP"), 3000, 25);
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
  await waitFor(() => A().compareMode === "diff", 8000, 25);
  const diffChip = await waitFor(
    () => Array.from(paneARoot.querySelectorAll<HTMLElement>("span")).some((s) =>
      /FG_CAP compared to REF_CAP/.test(s.textContent ?? ""),
    ),
    3000, 25);
  report(diffChip, "diff: a single '<metric> · FG_CAP compared to REF_CAP' caption is shown");
  const diffCaptionEl = Array.from(paneARoot.querySelectorAll<HTMLElement>("span")).find((s) =>
    /FG_CAP compared to REF_CAP/.test(s.textContent ?? ""),
  );
  const diffHasMetric = !!diffCaptionEl && /·/.test(diffCaptionEl.textContent ?? "");
  const diffLeft = !!diffCaptionEl && inLeftHalf(diffCaptionEl, paneARoot);
  report(diffHasMetric, `diff caption names the metric (has '·'): "${diffCaptionEl?.textContent ?? ""}"`);
  report(diffLeft, "diff caption sits bottom-LEFT (clear of the bottom-right metrics)");
  ok = ok && diffChip && diffHasMetric && diffLeft;

  // NOTE: a stacked `cp.Grid` no longer syncs N mounted panes via this bus — it
  // renders ONE reused renderer and swaps the source, so settings are shared by
  // construction. That path (single pane, diff persists across a flip, instance
  // reused) is covered by `stack/grid-stacked-persist`.

  // --- 9. OPERATION-AWARE ENCODING DEFAULTS -----------------------------
  // Operation changes adopt the next semantic display default while the current
  // encoding still equals the previous default. A custom encoding is preserved.
  // Single-pane (pane A) — the exact directive steps. Each control change is
  // AWAITED to settle (home resets kernel+mode through echo setters that round-trip
  // through the owner, so a bare synchronous follow-up can race the echo).
  A().home(); // clear the override left by the earlier COLORMAP sync step
  const homeColormap = "srgb"; // authored split/light display default
  await waitFor(() => A().colormap === homeColormap && A().comparisonOperationId === "absolute", 8000, 25);
  A().changeCompareMode("diff");
  await waitFor(() => A().compareMode === "diff", 8000, 25);
  // Entering absolute from Split adopts the magnitude-error default.
  const defaultAbsolute = await waitFor(() => A().colormap === "magma", 8000, 25);
  report(defaultAbsolute, `DEFAULT: split→absolute adopts magma (got ${A().colormap})`);
  ok = ok && defaultAbsolute;
  // (a) Switching to signed adopts the diverging default.
  A().changeComparisonOperation("signed");
  const defSigned = await waitFor(
    () => A().comparisonOperationId === "signed" && A().colormap === "red-blue",
    8000, 25,
  );
  report(defSigned, `DEFAULT: signed operation adopts red-blue (got ${A().colormap})`);
  ok = ok && defSigned;
  // (b) Switching back to absolute restores the magnitude default.
  A().changeComparisonOperation("absolute");
  const defAbs = await waitFor(
    () => A().comparisonOperationId === "absolute" && A().colormap === "magma",
    8000, 25,
  );
  report(defAbs, `DEFAULT: absolute operation adopts magma (got ${A().colormap})`);
  ok = ok && defAbs;
  // (c) the user PICKS turbo explicitly → an override.
  A().changeColormap("turbo");
  const picked = await waitFor(() => A().colormap === "turbo", 8000, 25);
  report(picked, `OVERRIDE: user picks turbo (A.colormap=${A().colormap})`);
  ok = ok && picked;
  // (d) A custom choice survives a kernel switch.
  A().changeComparisonOperation("signed");
  const followed = await waitFor(() => A().comparisonOperationId === "signed" && A().colormap === "turbo", 8000, 25);
  report(followed, `SWITCH: kernel→signed preserves turbo (A.colormap=${A().colormap})`);
  ok = ok && followed;
  // (e) HOME replaces the cell settings with the active authored/default values.
  A().home();
  const homeReset = await waitFor(
    () => A().colormap === homeColormap && A().colormap !== "turbo" && A().comparisonOperationId === "absolute", 8000, 25);
  report(
    homeReset,
    `HOME: override cleared → active default (A.colormap=${A().colormap}, kernel=${A().comparisonOperationId})`,
  );
  ok = ok && homeReset;

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
