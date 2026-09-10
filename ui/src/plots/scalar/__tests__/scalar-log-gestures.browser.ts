/**
 * `scalar-log-gestures.browser.ts` — the log-axis gesture contract for the
 * scalar plot.
 *
 * ## The bug this pins
 * Every gesture (wheel zoom, drag pan, box zoom) used to interpolate the RAW
 * data bounds linearly, while the axis renders `scale="log"`. Screen space is
 * uniform in log10, so:
 *   - the value under the cursor was not the value the zoom anchored on (the
 *     plot jumped away from the pointer), and
 *   - a zoom-out or a pan walked a bound to <= 0, which a log axis cannot
 *     place at all — the plot broke.
 * `chart/axis-space.ts` unit-tests the arithmetic; this page pins the WIRING:
 * which screen fraction feeds which axis, and with which sign.
 *
 * ## What it pins (log Y over a decade-spanning series, plus a linear control)
 *  1. A wheel zoom keeps the value under the cursor pinned (log Y) and shrinks
 *     the span in DECADES.
 *  2. A wheel zoom-out never emits a non-positive bound.
 *  3. A drag pan moves the window the way the pointer moved (content follows
 *     the hand) and stays strictly positive.
 *  4. On a LINEAR axis the same gestures behave exactly as before (no
 *     regression from routing through the axis mapping).
 *
 * RUNNING: `npm run test:harness --only scalar-log-gestures`, or the whole
 * suite (this page is self-driving).
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ScalarPlot from "../backends/svg/ScalarPlot";
import type { AxisScale, ChartViewState, Series } from "../../types";
import { createHarness } from "../../../testing/harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({
  title: "SCALAR-LOG",
  resultFlag: "__scalarLogResult",
});

let ok = true;
function gate(cond: boolean, label: string) {
  if (!cond) ok = false;
  report(cond, label);
}
const note = (msg: string) => report(true, msg);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One series spanning four decades in y, so a log axis has real range. */
function decadeSeries(): Series[] {
  const points = [];
  for (let i = 1; i <= 200; i++) {
    points.push({ step: i, value: Math.pow(10, -1 + (4 * i) / 200) });
  }
  return [{ key: "s0", label: "s0", color: "#6cf", points }];
}

interface Mounted {
  host: HTMLElement;
  view: () => ChartViewState;
  setView: (v: ChartViewState) => void;
  gridRect: () => DOMRect;
  wheel: (x: number, y: number, deltaY: number) => void;
  drag: (from: { x: number; y: number }, to: { x: number; y: number }) => void;
}

function mount(hostId: string, yScale: AxisScale): Mounted {
  const host = document.getElementById(hostId) as HTMLElement;
  let current: ChartViewState = { xMin: null, xMax: null, yMin: null, yMax: null };
  let setViewExternal: ((v: ChartViewState) => void) | null = null;
  const series = decadeSeries();

  function Harness(): React.ReactElement {
    const [view, setView] = useState<ChartViewState>({
      xMin: null, xMax: null, yMin: null, yMax: null,
    });
    current = view;
    setViewExternal = setView;
    return h(ScalarPlot, {
      series,
      xAxis: "step",
      xScale: "linear",
      yScale,
      xRange: [null, null],
      yRange: [null, null],
      view,
      onViewChange: setView,
    });
  }
  createRoot(host).render(h(Harness));

  const box = () =>
    host.querySelector<HTMLElement>('div[aria-label^="Scalar plot"]') ?? host;

  return {
    host,
    view: () => current,
    setView: (v) => setViewExternal?.(v),
    gridRect: () =>
      (host.querySelector(".recharts-cartesian-grid") as SVGGraphicsElement | null)
        ?.getBoundingClientRect() ?? host.getBoundingClientRect(),
    wheel: (x, y, deltaY) => {
      box().dispatchEvent(
        new WheelEvent("wheel", {
          deltaY, clientX: x, clientY: y, ctrlKey: true, bubbles: true, cancelable: true,
        }),
      );
    },
    drag: (from, to) => {
      const el = box();
      const opts = { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, button: 0, pointerType: "mouse" };
      // Alt-drag always pans, whatever the toolbar's base drag mode is.
      el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientX: from.x, clientY: from.y, altKey: true }));
      el.dispatchEvent(new PointerEvent("pointermove", { ...opts, clientX: to.x, clientY: to.y, altKey: true }));
      el.dispatchEvent(new PointerEvent("pointerup", { ...opts, clientX: to.x, clientY: to.y, altKey: true }));
    },
  };
}

/** The y value under a client-y position, given the current view + scale. */
function valueAtClientY(m: Mounted, clientY: number, scale: AxisScale): number {
  const r = m.gridRect();
  const v = m.view();
  const lo = v.yMin!;
  const hi = v.yMax!;
  const frac = (r.bottom - clientY) / r.height;
  if (scale === "log") {
    return Math.pow(10, Math.log10(lo) + frac * (Math.log10(hi) - Math.log10(lo)));
  }
  return lo + frac * (hi - lo);
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

/**
 * Client coords at a fraction of the CURRENT plot rect. Read fresh for every
 * gesture: the rect moves whenever the axis tick labels change width/height,
 * and a stale point lands outside the plot, where the handlers correctly
 * ignore it (which would make every later assertion vacuous).
 */
function pointAt(m: Mounted, fx: number, fyFromTop: number): { x: number; y: number } {
  const r = m.gridRect();
  return { x: r.left + r.width * fx, y: r.top + r.height * fyFromTop };
}

async function main() {
  try {
    const log = mount("log", "log");
    const lin = mount("linear", "linear");
    await wait(400);

    // ── Seed an explicit view so the arithmetic is exactly known ──
    log.setView({ xMin: 1, xMax: 200, yMin: 0.1, yMax: 1000 });
    lin.setView({ xMin: 1, xMax: 200, yMin: 0, yMax: 1000 });
    await wait(200);
    gate(log.view().yMin === 0.1 && log.view().yMax === 1000, "[log] seeded view");

    // ── 1. Wheel zoom pins the value under the cursor ──
    // A point in the UPPER quarter of the plot — deliberately not the center,
    // where the linear and log answers would coincide.
    const p1 = pointAt(log, 0.5, 0.25);
    const before = valueAtClientY(log, p1.y, "log");
    log.wheel(p1.x, p1.y, -120); // zoom in
    await wait(200);
    const after = valueAtClientY(log, p1.y, "log");
    note(`[log] value under cursor: ${before.toPrecision(6)} -> ${after.toPrecision(6)}`);
    gate(rel(after, before) < 0.02, "[log] wheel zoom keeps the value under the cursor pinned");

    const decadesBefore = 4; // log10(1000) - log10(0.1)
    const decadesAfter = Math.log10(log.view().yMax!) - Math.log10(log.view().yMin!);
    gate(decadesAfter < decadesBefore, `[log] the span shrank in decades (${decadesAfter.toFixed(3)} < 4)`);
    gate(log.view().yMin! > 0, "[log] zoom-in kept the lower bound positive");

    // ── 2. Zoom OUT never produces a non-positive bound ──
    log.setView({ xMin: 1, xMax: 200, yMin: 0.1, yMax: 1000 });
    await wait(120);
    for (let i = 0; i < 6; i++) {
      const p = pointAt(log, 0.5, 0.25);
      log.wheel(p.x, p.y, 120); // zoom out, repeatedly
      await wait(90);
    }
    const outView = log.view();
    note(`[log] after 6 zoom-outs: y = [${outView.yMin}, ${outView.yMax}]`);
    gate(outView.yMin! > 0, "[log] zoom-out never emits a non-positive lower bound");
    gate(outView.yMax! > outView.yMin!, "[log] bounds stay ordered");
    // Not a vacuous pass: the window must actually have widened.
    const outDecades = Math.log10(outView.yMax!) - Math.log10(outView.yMin!);
    gate(outDecades > 4, `[log] zoom-out widened the window (${outDecades.toFixed(3)} > 4 decades)`);

    // ── 3. Drag pan follows the hand and stays positive ──
    log.setView({ xMin: 1, xMax: 200, yMin: 0.1, yMax: 1000 });
    await wait(120);
    const grab = pointAt(log, 0.5, 0.5);
    const dragPx = log.gridRect().height * 0.25;
    const grabbed = valueAtClientY(log, grab.y, "log");
    // Drag DOWN by a quarter of the plot: the content follows the pointer, so
    // the grabbed value ends up a quarter-height lower on screen.
    log.drag({ x: grab.x, y: grab.y }, { x: grab.x, y: grab.y + dragPx });
    await wait(200);
    const panned = log.view();
    const atNewPlace = valueAtClientY(log, grab.y + dragPx, "log");
    note(`[log] grabbed ${grabbed.toPrecision(6)}, after pan the same pixel-offset holds ${atNewPlace.toPrecision(6)}`);
    gate(rel(atNewPlace, grabbed) < 0.05, "[log] pan moves the content with the pointer");
    gate(panned.yMin! > 0, "[log] pan never emits a non-positive lower bound");
    gate(
      rel(Math.log10(panned.yMax!) - Math.log10(panned.yMin!), 4) < 0.02,
      "[log] pan preserves the span (in decades)",
    );

    // ── 4. Linear axes are unchanged ──
    const lp = pointAt(lin, 0.5, 0.25);
    const linBefore = valueAtClientY(lin, lp.y, "linear");
    lin.wheel(lp.x, lp.y, -120);
    await wait(200);
    const linAfter = valueAtClientY(lin, lp.y, "linear");
    note(`[linear] value under cursor: ${linBefore.toPrecision(6)} -> ${linAfter.toPrecision(6)}`);
    gate(
      Math.abs(linAfter - linBefore) < 0.02 * 1000,
      "[linear] wheel zoom still pins the value under the cursor",
    );
    gate(lin.view().yMax! - lin.view().yMin! < 1000, "[linear] the span still shrank");

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
