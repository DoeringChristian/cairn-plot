/**
 * `toolbar-fold-menu.browser.ts` — reproduction + regression harness for the
 * FOLDED `<PlotToolbar>` leading-menu clipping bug (NOT a jsdom unit test — the
 * defect is a real CSS layout/overflow clip, so it needs a live browser with the
 * Tailwind chrome; driven via claude-in-chrome, same convention as the
 * media-compare `*.browser.ts` harnesses).
 *
 * ## The bug this pins
 * On a narrow pane the toolbar folds into a single "⋯" button whose popover is
 * an `overflow-auto` scroll container. The leading MENUS (compare MODE selector,
 * COLORMAP selector) used to render inside it via `<ToolbarMenu>`, whose option
 * list is `position:absolute`. An absolutely-positioned descendant of an
 * `overflow-auto` box is CLIPPED to that box's padding edge — so the dropdown's
 * options fell outside the popover's clip rect and were neither painted nor
 * hit-testable: unusable. The fix renders each leading menu as an INLINE
 * expandable row (options in normal flow) so the popover simply scrolls and
 * every option stays reachable.
 *
 * ## What the harness asserts
 *  1. The toolbar actually folds at 240px (a single "⋯" trigger, no button row).
 *  2. Opening "⋯" then the MODE menu exposes ALL of its options and every one is
 *     hit-testable at its own center (`elementFromPoint` returns the option) —
 *     i.e. not clipped by the popover. Same for the COLORMAP menu.
 *  3. The sliders row inside the folded popover is present and its range inputs
 *     are hit-testable.
 * Run BEFORE the fix → step 2 FAILS (options clipped / not hittable). Run AFTER
 * → all steps PASS.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/lib/cairn-plot/primitives/__tests__/toolbar-fold-menu.browser.ts \
 *        --bundle --format=esm --tsconfig=tsconfig.app.json \
 *        --outfile=src/lib/cairn-plot/primitives/__tests__/toolbar-fold-menu.browser.bundle.js
 *   2. Copy CSS: cp dist/plot-inline/style.css \
 *        src/lib/cairn-plot/primitives/__tests__/harness-style.css
 *   3. Serve: cd cairn/ui/src/lib/cairn-plot/primitives/__tests__ && python3 -m http.server 8941
 *   4. Open in Chrome: http://localhost:8941/toolbar-fold-menu.browser.html
 *
 * The generated `.bundle.js`/`harness-style.css` are gitignored — regenerate
 * whenever this harness, its imports, or the Tailwind build change.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import PlotToolbar from "../PlotToolbar";
import type { PlotController, ControllerCapabilities } from "../../controls/types";
import type { ToolbarConfig } from "../../controls/ToolbarConfig";

declare global {
  interface Window {
    __toolbarTestResult?: "pass" | "fail";
    __toolbarHarness?: ToolbarHarnessApi;
  }
}

interface HitReport {
  total: number;
  hittable: number;
  labels: string[];
  clipped: string[];
}
interface ToolbarHarnessApi {
  isFolded(): boolean;
  openOverflow(): boolean;
  openMenu(ariaLabel: string): boolean;
  hitTestOptions(): HitReport;
  slidersHittable(): { total: number; hittable: number };
}

const h = React.createElement;
const container = document.getElementById("pane") as HTMLElement;

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
  window.__toolbarTestResult = pass ? "pass" : "fail";
  document.title = pass ? "TOOLBAR FOLD PASS" : "TOOLBAR FOLD FAIL";
}

const allCaps: ControllerCapabilities = {
  zoom: true, pan: true, boxZoom: true, select: true, lasso: true,
  autoscale: true, reset: true, screenshot: true, hover: true, spikelines: true,
  hoverModes: true, legend: true, axisScaleToggle: true, perAxisDrag: true,
  brush: true, reorder: true,
};

function makeController(): PlotController {
  return {
    capabilities: allCaps,
    dragMode: "pan",
    hoverMode: "closest",
    spikelines: false,
    isModified: true,
    setDragMode() {},
    setHoverMode() {},
    toggleSpikelines() {},
    zoomIn() {},
    zoomOut() {},
    autoscale() {},
    reset() {},
    toPNG: () => Promise.resolve(new Blob()),
  };
}

let mode = "flip";
let cmap = "viridis";
let exposure = 0;
let offset = 0;

function buildConfig(): ToolbarConfig {
  return {
    visibility: "always",
    position: "top-right",
    leadingButtons: [
      {
        id: "mode",
        title: "Compare / diff mode",
        menu: {
          value: mode,
          onSelect: (id) => { mode = id; render(); },
          options: [
            { id: "flip", label: "FLIP" },
            { id: "absolute", label: "Absolute Error" },
            { id: "squared", label: "Squared Error" },
            { id: "ssim", label: "SSIM" },
            { id: "heatmap", label: "Heatmap" },
          ],
        },
      },
      {
        id: "cmap",
        title: "Colormap",
        menu: {
          value: cmap,
          onSelect: (id) => { cmap = id; render(); },
          options: [
            { id: "viridis", label: "Viridis" },
            { id: "magma", label: "Magma" },
            { id: "rdbu", label: "Red–Blue" },
            { id: "turbo", label: "Turbo" },
          ],
        },
      },
    ],
    sliders: [
      { id: "ev", label: "EV", icon: "sun", title: "Exposure", min: -4, max: 4, step: 0.1, value: exposure, defaultValue: 0, onChange: (v) => { exposure = v; render(); } },
      { id: "off", label: "OFF", icon: "plusminus", title: "Offset", min: -1, max: 1, step: 0.01, value: offset, defaultValue: 0, onChange: (v) => { offset = v; render(); } },
    ],
  };
}

const root = createRoot(container);
function render(): void {
  root.render(h(PlotToolbar, { controller: makeController(), config: buildConfig() }));
}

const overflowBtn = () => container.querySelector<HTMLButtonElement>('button[aria-label="More controls"]');
const isFolded = () => !!overflowBtn() && !container.querySelector('[role="toolbar"] [aria-label="Box zoom"]');

/** A full native pointer→click sequence. A bare `.click()` does not dispatch
 *  the `pointerdown` the menu wiring keys off, so drive the real sequence. */
function fire(el: Element): void {
  for (const t of ["pointerdown", "mousedown", "mouseup", "click"] as const) {
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  }
}

function openOverflow(): boolean {
  const btn = overflowBtn();
  if (!btn) return false;
  if (btn.getAttribute("aria-expanded") !== "true") fire(btn);
  return true;
}

/** Open a leading menu by its aria-label / title, whether it renders as the
 *  expanded absolute `<ToolbarMenu>` (aria-label button) OR the folded inline
 *  expandable row (also an `aria-label`-carrying button). Collapse any OTHER
 *  open group first so only this one's options are in the DOM. */
function openMenu(label: string): boolean {
  container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"][aria-expanded="true"]').forEach((b) => {
    if (b.getAttribute("aria-label") !== label && b.getAttribute("aria-label") !== "More controls") fire(b);
  });
  const btn =
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ??
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.getAttribute("aria-label") ?? b.textContent ?? "").includes(label),
    ) ??
    null;
  if (!btn) return false;
  if (btn.getAttribute("aria-expanded") !== "true") fire(btn);
  return true;
}

/** Every currently-rendered option button (both listbox <ul> and inline rows). */
function optionButtons(): HTMLButtonElement[] {
  const listbox = Array.from(container.querySelectorAll<HTMLButtonElement>('ul[role="listbox"] button'));
  const inline = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-menu-option]'));
  return listbox.length ? listbox : inline;
}

/** An option counts as usable only if its FULL width is painted + hit-testable
 *  — sample 15% / 50% / 85% across it. (The bug clipped the right ~50px, where
 *  the label text sits, so a center-only probe would miss it.) */
function optionUsable(o: Element): boolean {
  const r = o.getBoundingClientRect();
  if (!(r.width > 0) || !(r.height > 0)) return false;
  const cy = r.top + r.height / 2;
  return [0.15, 0.5, 0.85].every((f) => {
    const el = document.elementFromPoint(r.left + r.width * f, cy);
    return !!el && (el === o || o.contains(el));
  });
}

function hitTestOptions(): HitReport {
  const opts = optionButtons();
  const labels: string[] = [];
  const clipped: string[] = [];
  let hittable = 0;
  for (const o of opts) {
    const txt = (o.textContent ?? "").trim();
    labels.push(txt);
    if (optionUsable(o)) hittable++;
    else clipped.push(txt);
  }
  return { total: opts.length, hittable, labels, clipped };
}

/** The sliders sit at the bottom of the overflow popover, which is capped at
 *  `max-h-80` with `overflow-auto`: on a short pane they can be below the
 *  scroll fold. Scroll each into the popover's view before hit-testing — a
 *  scrollable-but-reachable control is "usable". */
function slidersHittable(): { total: number; hittable: number } {
  const ranges = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="range"]'));
  let hittable = 0;
  for (const s of ranges) {
    s.scrollIntoView({ block: "center" });
    const r = s.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (r.width > 0 && r.height > 0 && el && (el === s || s.contains(el) || el.contains(s))) hittable++;
  }
  return { total: ranges.length, hittable };
}

window.__toolbarHarness = { isFolded, openOverflow, openMenu, hitTestOptions, slidersHittable };

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  try {
    render();
    // Let the ResizeObserver-driven fold settle, then drive the sequence with
    // real pointer events + short settles between React state flushes.
    await wait(250);
    let ok = true;

    report(isFolded(), `[0] toolbar is folded at ${container.clientWidth}px (single "⋯" trigger)`);
    ok = ok && isFolded();

    ok = openOverflow() && ok;
    await wait(60);
    report(overflowBtn()?.getAttribute("aria-expanded") === "true", "[1] overflow popover opens");

    // --- MODE menu: every option fully visible + hit-testable (the bug) ---
    ok = openMenu("Compare / diff mode") && ok;
    await wait(60);
    let hr = hitTestOptions();
    const modeOk = hr.total >= 5 && hr.hittable === hr.total;
    report(modeOk, `[2] MODE: ${hr.hittable}/${hr.total} options usable${hr.clipped.length ? ` — CLIPPED: ${hr.clipped.join(", ")}` : ""}`);
    ok = ok && modeOk;

    // --- COLORMAP menu ---
    ok = openMenu("Colormap") && ok;
    await wait(60);
    hr = hitTestOptions();
    const cmapOk = hr.total >= 4 && hr.hittable === hr.total;
    report(cmapOk, `[3] COLORMAP: ${hr.hittable}/${hr.total} options usable${hr.clipped.length ? ` — CLIPPED: ${hr.clipped.join(", ")}` : ""}`);
    ok = ok && cmapOk;

    const sh = slidersHittable();
    const slidersOk = sh.total === 2 && sh.hittable === sh.total;
    report(slidersOk, `[4] SLIDERS: ${sh.hittable}/${sh.total} range inputs usable (scrolled into popover view)`);
    ok = ok && slidersOk;

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
