/**
 * `toolbar-dismiss.browser.ts` — contract harness for the extracted
 * `useDismissOnOutsideOrEscape` hook (dedup wave: the outside-click+Escape
 * effect was copy-pasted verbatim in `ToolbarMenu` and `OverflowMenu`). Not a
 * jsdom unit test — the effect wires CAPTURE-phase `document` listeners, so it
 * needs a live browser (same convention as the other `*.browser.ts` harnesses).
 *
 * ## What it pins (must hold for BOTH menu variants after extraction)
 *  1. A leading MENU (`ToolbarMenu`) opens on click, closes on an OUTSIDE
 *     pointer-down, and closes on Escape. A pointer-down INSIDE it does NOT
 *     close it.
 *  2. The folded OVERFLOW popover (`OverflowMenu`) opens on the "⋯" click and
 *     likewise closes on outside pointer-down / Escape.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/lib/cairn-plot/primitives/__tests__/toolbar-dismiss.browser.ts \
 *        --bundle --format=esm --tsconfig=tsconfig.app.json \
 *        --outfile=src/lib/cairn-plot/primitives/__tests__/toolbar-dismiss.browser.bundle.js
 *   2. Serve: cd cairn/ui/src/lib/cairn-plot/primitives/__tests__ && python3 -m http.server 8943
 *   3. Open http://localhost:8943/toolbar-dismiss.browser.html in Chrome.
 * The generated `.bundle.js` is gitignored — regenerate when this harness or its
 * imports change.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import PlotToolbar from "../PlotToolbar";
import type { PlotController, ControllerCapabilities } from "../../controls/types";
import type { ToolbarConfig } from "../../controls/ToolbarConfig";
import { createHarness } from "../../testing/harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({ title: "DISMISS", resultFlag: "__dismissResult" });

const allCaps: ControllerCapabilities = {
  zoom: true, pan: true, boxZoom: true, select: true, lasso: true,
  autoscale: true, reset: true, screenshot: true, hover: true, spikelines: true,
  hoverModes: true, legend: true, axisScaleToggle: true, perAxisDrag: true,
  brush: true, reorder: true,
};
function makeController(): PlotController {
  return {
    capabilities: allCaps, dragMode: "pan", hoverMode: "closest", spikelines: false,
    isModified: true, setDragMode() {}, setHoverMode() {}, toggleSpikelines() {},
    zoomIn() {}, zoomOut() {}, autoscale() {}, reset() {},
    toPNG: () => Promise.resolve(new Blob()),
  };
}
let cmap = "turbo";
function buildConfig(): ToolbarConfig {
  return {
    visibility: "always",
    position: "top-right",
    leadingButtons: [
      {
        id: "cmap", title: "Colormap",
        menu: {
          value: cmap,
          onSelect: (id) => { cmap = id; wideRender(); },
          options: [
            { id: "turbo", label: "Turbo" },
            { id: "magma", label: "Magma" },
          ],
        },
      },
    ],
    sliders: [
      { id: "ev", label: "EV", icon: "sun", title: "Exposure", min: -4, max: 4, step: 0.1, value: 0, onChange: () => {} },
    ],
  };
}

const wideRoot = createRoot(document.getElementById("wide") as HTMLElement);
const narrowRoot = createRoot(document.getElementById("narrow") as HTMLElement);
function wideRender(): void {
  wideRoot.render(h(PlotToolbar, { controller: makeController(), config: buildConfig() }));
}
function narrowRender(): void {
  narrowRoot.render(h(PlotToolbar, { controller: makeController(), config: buildConfig() }));
}

function fire(el: Element, type: string): void {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
}
function firePointerAt(el: Element): void {
  el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, view: window }));
}
function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// The leading `ToolbarMenu` (expanded) uses the listbox a11y pattern
// (`aria-haspopup="listbox"`); the folded `OverflowMenu` uses `="menu"`.
const menuTrigger = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
const overflowTrigger = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('button[aria-label="More controls"]');
const expanded = (btn: HTMLButtonElement | null) => btn?.getAttribute("aria-expanded") === "true";

async function main(): Promise<void> {
  let ok = true;
  const gate = (cond: boolean, msg: string) => { report(cond, msg); ok = ok && cond; };
  try {
    wideRender();
    narrowRender();
    await wait(250);

    const wide = document.getElementById("wide") as HTMLElement;
    const outside = document.getElementById("outside") as HTMLElement;

    // --- ToolbarMenu (leading menu) dismissal ---
    let trg = menuTrigger(wide);
    gate(!!trg, "[menu] leading MENU trigger present");
    fire(trg!, "click");
    await wait(40);
    gate(expanded(menuTrigger(wide)), "[menu] opens on click");

    // pointer-down INSIDE must NOT close. The open list is now PORTALED to
    // document.body (it escapes the pane's isolated stacking context), so it is
    // no longer a descendant of `wide` — query the document for it.
    const listbox = document.querySelector<HTMLElement>('ul[role="listbox"]');
    gate(!!listbox && listbox.parentElement === document.body, "[menu] open list is portaled to document.body");
    if (listbox) firePointerAt(listbox);
    await wait(40);
    gate(expanded(menuTrigger(wide)), "[menu] inside pointer-down keeps it open");

    // outside pointer-down closes
    firePointerAt(outside);
    await wait(40);
    gate(!expanded(menuTrigger(wide)), "[menu] outside pointer-down closes it");

    // Escape closes
    fire(menuTrigger(wide)!, "click");
    await wait(40);
    gate(expanded(menuTrigger(wide)), "[menu] re-opens on click");
    pressEscape();
    await wait(40);
    gate(!expanded(menuTrigger(wide)), "[menu] Escape closes it");

    // --- OverflowMenu (folded "⋯") dismissal ---
    const narrow = document.getElementById("narrow") as HTMLElement;
    let ov = overflowTrigger(narrow);
    gate(!!ov, "[overflow] toolbar folded to a single '⋯' trigger");
    fire(ov!, "click");
    await wait(40);
    gate(expanded(overflowTrigger(narrow)), "[overflow] popover opens on click");
    firePointerAt(outside);
    await wait(40);
    gate(!expanded(overflowTrigger(narrow)), "[overflow] outside pointer-down closes it");
    fire(overflowTrigger(narrow)!, "click");
    await wait(40);
    gate(expanded(overflowTrigger(narrow)), "[overflow] re-opens on click");
    pressEscape();
    await wait(40);
    gate(!expanded(overflowTrigger(narrow)), "[overflow] Escape closes it");

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
