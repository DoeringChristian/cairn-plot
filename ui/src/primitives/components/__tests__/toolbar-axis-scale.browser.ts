/**
 * `toolbar-axis-scale.browser.ts` — contract harness for the toolbar's per-axis
 * LOG/LINEAR toggle. Browser (not jsdom) for the same reason as its siblings:
 * `<PlotToolbar>` is rendered live and probed through the real DOM.
 *
 * ## What it pins
 *  1. The toggle appears only when the controller BOTH advertises
 *     `axisScaleToggle` AND exposes the `getAxisScale`/`setAxisScale` pair —
 *     the toolbar never shows a control whose current state it cannot read.
 *  2. Each button's pressed state reflects the controller's CURRENT scale, and
 *     clicking it asks for the opposite scale on that axis alone.
 *  3. The state is read from the controller on every render (not latched), so
 *     a host that accepts the change sees the button follow.
 *
 * RUNNING: same as the other toolbar harnesses (bundle with esbuild, serve the
 * directory, open the .html) — `npm run test:harness` does all of it.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import PlotToolbar from "../PlotToolbar";
import type {
  AxisScale,
  ControllerAxis,
  ControllerCapabilities,
  PlotController,
} from "../../controls/types";
import { createHarness } from "../../../testing/harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({ title: "AXIS-SCALE", resultFlag: "__axisScaleResult" });

const caps = (axisScaleToggle: boolean): ControllerCapabilities => ({
  zoom: true, pan: true, boxZoom: true, select: false, lasso: false,
  autoscale: true, reset: true, screenshot: true, hover: false, spikelines: false,
  hoverModes: false, legend: false, axisScaleToggle, perAxisDrag: false,
  brush: false, reorder: false,
});

// The host's state — exactly the shape a scalar card owns.
const scales: Record<ControllerAxis, AxisScale> = { x: "linear", y: "linear" };
const setCalls: Array<[ControllerAxis, AxisScale]> = [];

function baseController(): PlotController {
  return {
    capabilities: caps(true), dragMode: "pan", hoverMode: "closest", spikelines: false,
    isModified: false, setDragMode() {}, setHoverMode() {}, toggleSpikelines() {},
    zoomIn() {}, zoomOut() {}, autoscale() {}, reset() {},
    toPNG: () => Promise.resolve(new Blob()),
  };
}

/** Advertises the capability AND implements the pair (the scalar plot's case). */
function fullController(): PlotController {
  return {
    ...baseController(),
    getAxisScale: (axis) => scales[axis],
    setAxisScale: (axis, scale) => {
      setCalls.push([axis, scale]);
      scales[axis] = scale;
      renderAll();
    },
  };
}

/** Advertises the capability but implements nothing (a stub adapter). */
function capsOnlyController(): PlotController {
  return baseController();
}

/** Implements the pair but does NOT advertise the capability. */
function unadvertisedController(): PlotController {
  return {
    ...baseController(),
    capabilities: caps(false),
    getAxisScale: () => "linear",
    setAxisScale: () => {},
  };
}

const roots = new Map<string, ReturnType<typeof createRoot>>();
function rootFor(id: string) {
  const el = document.getElementById(id)!;
  let r = roots.get(id);
  if (!r) { r = createRoot(el); roots.set(id, r); }
  return r;
}
function renderAll() {
  rootFor("full").render(h(PlotToolbar, { controller: fullController(), config: { visibility: "always" } }));
  rootFor("capsonly").render(h(PlotToolbar, { controller: capsOnlyController(), config: { visibility: "always" } }));
  rootFor("unadvertised").render(h(PlotToolbar, { controller: unadvertisedController(), config: { visibility: "always" } }));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buttonIn(hostId: string, titlePrefix: string): HTMLButtonElement | null {
  const host = document.getElementById(hostId)!;
  const all = [...host.querySelectorAll("button")] as HTMLButtonElement[];
  return all.find((b) => (b.getAttribute("title") ?? "").startsWith(titlePrefix)) ?? null;
}

let ok = true;
function gate(cond: boolean, label: string) {
  if (!cond) ok = false;
  report(cond, label);
}

async function main() {
  try {
    renderAll();
    await wait(60);

    // 1. Presence gating.
    gate(!!buttonIn("full", "X axis"), "[full] X toggle rendered");
    gate(!!buttonIn("full", "Y axis"), "[full] Y toggle rendered");
    gate(!buttonIn("capsonly", "X axis"), "[caps-only] no toggle without get/setAxisScale");
    gate(!buttonIn("unadvertised", "X axis"), "[unadvertised] no toggle when the capability is false");

    // 2. State reflects the controller, and a click flips only that axis.
    const x = buttonIn("full", "X axis")!;
    gate(x.getAttribute("title")!.includes("linear (click for log)"), "[full] X starts linear");
    x.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(60);
    gate(
      setCalls.length === 1 && setCalls[0]![0] === "x" && setCalls[0]![1] === "log",
      `[full] click asks for x -> log (got ${JSON.stringify(setCalls)})`,
    );
    gate(scales.y === "linear", "[full] the other axis is untouched");

    // 3. The button follows the host's accepted state.
    const xAfter = buttonIn("full", "X axis")!;
    gate(xAfter.getAttribute("title")!.includes("log (click for linear)"), "[full] X now reads log");
    gate(xAfter.getAttribute("aria-pressed") === "true" || xAfter.className.includes("accent"),
      "[full] X renders pressed while log");
    xAfter.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(60);
    gate(scales.x === "linear", "[full] clicking again returns to linear");

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
