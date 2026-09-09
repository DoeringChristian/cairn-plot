/**
 * `scalar-render-cost.browser.ts` — the render-cost gate for the scalar plot
 * (spec §4 of `2026-09-09-scalar-render-performance-design.md`).
 *
 * ## Why a browser harness and not a `*.test.ts`
 * Everything measured here is *cost on a real main thread with real layout*:
 * how long the first paint of 1 000 000 points takes, whether an append or a
 * wheel step re-enters the whole prepare→reduce→path-string pipeline, and
 * whether hovering a line touches the geometry at all. jsdom has no layout, no
 * `PerformanceObserver("longtask")` and no rendering, so none of that is
 * observable there. This page mounts the real `ScalarPlot` in an 800 × 320 host
 * and drives it with real events; the runner
 * (`node scripts/test-harness.mjs --only scalar-render-cost`) polls `#status`.
 *
 * ## What it pins (spec §4)
 *   1. first mount → painted paths                       < 400 ms
 *   2. append 100 points to every series, re-render       < 30 ms long-task total
 *   3. one wheel zoom step                                < 30 ms long-task total
 *   4. 20 synthetic mouse moves        no long task > 50 ms AND the first
 *                                      series' path `d` byte-identical
 *   5. points per drawn path                              ≤ 5 × columns + 2
 *
 * ## How the numbers are taken
 * Long tasks (the spec's unit) are only *reported* by the platform at ≥ 50 ms,
 * so a "< 30 ms long-task total" budget is in practice "no long task at all" —
 * which is exactly the regression these budgets exist to catch (a re-render
 * that rebuilds 1 M points blocks for hundreds of ms). Because that unit is
 * blind below 50 ms, every window is ALSO sampled with a `MessageChannel`
 * ticker (~0 ms clamp, unlike `setTimeout`): gaps between ticks longer than
 * `BLOCK_GAP_MS` are summed into a "busy" estimate with ~1 ms resolution, and
 * the wall clock is printed next to it. Those two are reported for the record;
 * the PASS/FAIL gate is the spec's long-task budget, so the harness cannot fail
 * on scheduler noise.
 *
 * The 100-point extension arrays are built BEFORE the measured window opens:
 * copying ten 100 000-element point arrays is host data plumbing (what a run
 * poller does), not scalar render cost, and folding it in would measure the
 * fixture instead of the plot.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ScalarPlot from "../backends/svg/ScalarPlot";
import type { Series, SeriesPoint, ChartViewState } from "../../types";
import { PreparedSeriesCache } from "../prepared-series";
import { buildRenderRows } from "../render-rows";
import { createHarness, sleep, waitFor } from "../../../testing/harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({
  title: "SCALAR RENDER COST",
  colors: { pass: "#6f6", fail: "#f66" },
});

// ── Fixture ────────────────────────────────────────────────────────────────
const SERIES_COUNT = 10;
const POINTS_PER_SERIES = 100_000;
const APPEND_PER_SERIES = 100;
const SMOOTHING = 0.6;
const OUTLIER_PCT: [number, number] = [0, 100];
const HOVER_MOVES = 20;

// Budgets (spec §4).
const MOUNT_BUDGET_MS = 400;
const APPEND_LONGTASK_BUDGET_MS = 30;
const WHEEL_LONGTASK_BUDGET_MS = 30;
const HOVER_LONGTASK_MAX_MS = 50;
/** Points a path may carry per screen column (M4 keeps ≤ 4) plus the endpoints. */
const POINTS_PER_COLUMN = 5;

/** Deterministic LCG — a fixed fixture, so a regression is the only variable. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const COLORS = [
  "#4493f8", "#f85149", "#3fb950", "#d29922", "#a371f7",
  "#db61a2", "#39c5cf", "#ff7b72", "#7ee787", "#e3b341",
];

function makePoints(rng: () => number, from: number, count: number): SeriesPoint[] {
  const pts: SeriesPoint[] = new Array(count);
  for (let k = 0; k < count; k++) {
    const i = from + k;
    pts[k] = { x: i, y: Math.sin(i / 500) + (rng() - 0.5) * 0.4 };
  }
  return pts;
}

function makeSeries(): Series[] {
  const out: Series[] = [];
  for (let s = 0; s < SERIES_COUNT; s++) {
    const rng = makeRng(1234 + s * 7919);
    out.push({
      key: `s${s}`,
      label: `series ${s}`,
      color: COLORS[s % COLORS.length]!,
      points: makePoints(rng, 0, POINTS_PER_SERIES),
    });
  }
  return out;
}

// ── The two hover rules from `public/theme/plot.css` ────────────────────────
// The runner's esbuild has no CSS loader, so the real stylesheet cannot be
// imported; these are the rules verbatim (see `plot.css`, "Scalar line hover
// emphasis"). They exist here so a hover really does restyle the DOM — the
// point of assertion 4 is that it does so WITHOUT touching path geometry.
function injectHoverCss(): void {
  const style = document.createElement("style");
  style.textContent = `
.recharts-line path[data-emph="on"] { stroke-width: 2.5; stroke-opacity: 1; }
[data-emph="dim"] { stroke-opacity: .15; }
`;
  document.head.appendChild(style);
}

// A React render error would otherwise leave an empty page and a mystery
// timeout; surface it as a failing line instead.
const pageErrors: string[] = [];
window.addEventListener("error", (e) => pageErrors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) =>
  pageErrors.push(`unhandled rejection: ${String((e as PromiseRejectionEvent).reason)}`),
);

// ── Measurement ────────────────────────────────────────────────────────────
interface LongTask { start: number; duration: number }
const longTasks: LongTask[] = [];
let longTaskObserverOk = false;
try {
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      longTasks.push({ start: e.startTime, duration: e.duration });
    }
  });
  obs.observe({ type: "longtask", buffered: true });
  longTaskObserverOk = true;
} catch {
  longTaskObserverOk = false;
}

/** Long tasks OVERLAPPING [t0, t1], summed and maxed (durations, ms). */
function longTasksIn(t0: number, t1: number): { total: number; max: number; count: number } {
  let total = 0;
  let max = 0;
  let count = 0;
  for (const t of longTasks) {
    if (t.start + t.duration <= t0 || t.start >= t1) continue;
    total += t.duration;
    if (t.duration > max) max = t.duration;
    count++;
  }
  return { total, max, count };
}

/**
 * A `MessageChannel` ticker: `postMessage` round-trips are not clamped (a
 * nested `setTimeout(0)` is, to 4 ms), so a gap between consecutive ticks is
 * main-thread blocking to ~1 ms. Sub-long-task cost is invisible to the
 * platform's long-task stream; this is how the printed "busy" numbers are got.
 */
const BLOCK_GAP_MS = 3;
class BusySampler {
  private readonly channel = new MessageChannel();
  private running = false;
  private last = 0;
  busy = 0;
  maxGap = 0;
  start(): void {
    this.running = true;
    this.busy = 0;
    this.maxGap = 0;
    this.last = performance.now();
    this.channel.port1.onmessage = () => {
      if (!this.running) return;
      const now = performance.now();
      const gap = now - this.last;
      this.last = now;
      if (gap > BLOCK_GAP_MS) {
        this.busy += gap;
        if (gap > this.maxGap) this.maxGap = gap;
      }
      this.channel.port2.postMessage(0);
    };
    this.channel.port2.postMessage(0);
  }
  stop(): void {
    this.running = false;
    this.channel.port1.onmessage = null;
  }
}

interface Measurement { wall: number; longTotal: number; longMax: number; longCount: number; busy: number; busyMax: number }

/** Run `fn` (awaited) with the clock, the long-task stream and the ticker on. */
async function measure(fn: () => Promise<void>): Promise<Measurement> {
  const sampler = new BusySampler();
  // Settle first so work queued by the PREVIOUS step is not billed to this one.
  await nextFrame();
  await sleep(30);
  sampler.start();
  const t0 = performance.now();
  await fn();
  const t1 = performance.now();
  sampler.stop();
  // Long-task entries are delivered asynchronously; give the observer a turn.
  await sleep(30);
  const lt = longTasksIn(t0, t1);
  return {
    wall: t1 - t0,
    longTotal: lt.total,
    longMax: lt.max,
    longCount: lt.count,
    busy: sampler.busy,
    busyMax: sampler.maxGap,
  };
}

const fmt = (n: number) => n.toFixed(1);
const describe = (w: Measurement) =>
  `long-task total ${fmt(w.longTotal)} ms (max ${fmt(w.longMax)} ms, ${w.longCount} task(s)); ` +
  `sampled busy ${fmt(w.busy)} ms (longest block ${fmt(w.busyMax)} ms); wall ${fmt(w.wall)} ms`;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// ── Mount ──────────────────────────────────────────────────────────────────
const host = document.getElementById("chart-host") as HTMLElement;

let setSeriesExternal: ((s: Series[]) => void) | null = null;
let renderCount = 0;
let currentView: ChartViewState = { xMin: null, xMax: null, yMin: null, yMax: null };

function Harness(): React.ReactElement {
  const [series, setSeries] = useState<Series[]>(() => initialSeries);
  const [view, setView] = useState<ChartViewState>({
    xMin: null, xMax: null, yMin: null, yMax: null,
  });
  setSeriesExternal = setSeries;
  currentView = view;
  renderCount++;
  return h(ScalarPlot, {
    series,
    xAxis: "step",
    xScale: "linear",
    yScale: "linear",
    xRange: [null, null],
    yRange: [null, null],
    view,
    onViewChange: setView,
    smoothing: SMOOTHING,
    outlierPct: OUTLIER_PCT,
  });
}

// ── DOM probes ─────────────────────────────────────────────────────────────
const seriesPaths = () =>
  Array.from(host.querySelectorAll<SVGPathElement>("path[data-series-key]"));
/** The main (non-overlay) curve of series `key` — the raw overlay carries
 *  `data-series-role="raw"`. */
const mainPath = (key: string) =>
  seriesPaths().find((p) => p.dataset.seriesKey === key && !p.dataset.seriesRole) ?? null;
const painted = () =>
  seriesPaths().some((p) => (p.getAttribute("d") ?? "").length > 0);

/** Points in a path command string: every M / L / C command draws one point. */
function pathPointCount(d: string): number {
  return (d.match(/[MLC]/g) ?? []).length;
}

/**
 * Plot width in CSS px = how many columns the M4 reduction was allowed. Read
 * off the rendered `.recharts-cartesian-grid` (the real drawing area, ~54 px
 * narrower than the host once the y-axis and margins are taken out), which is
 * the same rect `ScalarPlot` feeds its reducer; the SVG surface width is the
 * stated fallback if the grid has not rendered.
 */
function measureColumns(): { columns: number; source: string } {
  const grid = host.querySelector(".recharts-cartesian-grid");
  if (grid) {
    const w = (grid as SVGGraphicsElement).getBoundingClientRect().width;
    if (w > 1) return { columns: w, source: ".recharts-cartesian-grid rect" };
  }
  const svg = host.querySelector("svg.recharts-surface");
  const w = svg ? svg.getBoundingClientRect().width : host.getBoundingClientRect().width;
  return { columns: w, source: "svg.recharts-surface width (grid not measurable)" };
}

function dispatchWheel(x: number, y: number): void {
  const box = host.querySelector<HTMLElement>('div[aria-label^="Scalar plot"]') ?? host;
  box.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY: -120,
      clientX: x,
      clientY: y,
      // The zoom gate is a trackpad pinch (`ctrlKey`, which arrives with no
      // keydown) or a held modifier — a PLAIN wheel deliberately does nothing
      // and scrolls the page, so it would measure an empty window.
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function dispatchMouseMove(x: number, y: number): void {
  const target =
    host.querySelector<Element>("svg.recharts-surface") ??
    (host.firstElementChild as Element | null) ??
    host;
  target.dispatchEvent(
    new MouseEvent("mousemove", {
      clientX: x, clientY: y, bubbles: true, cancelable: true, view: window,
    }),
  );
}

// ── Run ────────────────────────────────────────────────────────────────────
injectHoverCss();
const initialSeries = makeSeries();

async function main(): Promise<void> {
  let ok = true;
  const gate = (cond: boolean, msg: string) => { report(cond, msg); ok = ok && cond; };
  const note = (msg: string) => {
    const el = document.getElementById("result");
    if (el) {
      const p = document.createElement("div");
      p.textContent = `INFO: ${msg}`;
      p.style.color = "#9cf";
      el.appendChild(p);
    }
    // eslint-disable-next-line no-console
    console.log(`INFO: ${msg}`);
  };

  try {
    note(
      `fixture: ${SERIES_COUNT} series x ${POINTS_PER_SERIES.toLocaleString("en-US")} points ` +
      `(${(SERIES_COUNT * POINTS_PER_SERIES).toLocaleString("en-US")} total), smoothing ${SMOOTHING}, ` +
      `host ${host.clientWidth}x${host.clientHeight} px`,
    );
    gate(longTaskObserverOk, "[0] PerformanceObserver('longtask') is available (the budgets' unit)");

    // ── 1. mount → painted paths ──────────────────────────────────────────
    const root = createRoot(host);
    const mountStart = performance.now();
    const mountSampler = new BusySampler();
    mountSampler.start();
    root.render(h(Harness));
    const paintedOk = await waitFor(painted, 20_000, 4);
    const mountMs = performance.now() - mountStart;
    mountSampler.stop();
    const mountLong = longTasksIn(mountStart, mountStart + mountMs);
    gate(paintedOk, "[1a] paths painted (path[data-series-key] with a non-empty d)");
    gate(
      mountMs < MOUNT_BUDGET_MS,
      `[1b] mount-to-paint ${fmt(mountMs)} ms < ${MOUNT_BUDGET_MS} ms budget ` +
      `(long-task total ${fmt(mountLong.total)} ms, sampled busy ${fmt(mountSampler.busy)} ms)`,
    );

    await sleep(200); // let the plot-rect correction re-render settle
    const paths = seriesPaths();
    note(`${paths.length} drawn paths (${SERIES_COUNT} curves + ${SERIES_COUNT} raw overlays), ${renderCount} React renders so far`);

    // ── 5. points per path vs columns ─────────────────────────────────────
    const { columns, source: columnSource } = measureColumns();
    const bound = POINTS_PER_COLUMN * columns + 2;
    let worst = 0;
    let worstKey = "";
    for (const p of paths) {
      const n = pathPointCount(p.getAttribute("d") ?? "");
      if (n > worst) { worst = n; worstKey = `${p.dataset.seriesKey}${p.dataset.seriesRole ? " (raw)" : ""}`; }
    }
    note(`columns = ${fmt(columns)} px from ${columnSource}; bound = 5 x columns + 2 = ${fmt(bound)}`);
    gate(
      worst <= bound,
      `[5] worst path carries ${worst} points (${worstKey}) <= ${fmt(bound)} ` +
      `(${(worst / Math.max(1, columns)).toFixed(2)} points per column)`,
    );

    // ── 2. append 100 points per series, re-render ────────────────────────
    // Built BEFORE the window: array copying is host plumbing, not render cost.
    const appended: Series[] = initialSeries.map((s, i) => {
      const rng = makeRng(99_000 + i);
      return { ...s, points: s.points.concat(makePoints(rng, POINTS_PER_SERIES, APPEND_PER_SERIES)) };
    });
    const dBeforeAppend = mainPath("s0")?.getAttribute("d") ?? "";
    const rendersBeforeAppend = renderCount;
    const appendWindow = await measure(async () => {
      setSeriesExternal?.(appended);
      await waitFor(() => (mainPath("s0")?.getAttribute("d") ?? "") !== dBeforeAppend, 5000, 4);
      await nextFrame();
    });
    gate(
      appendWindow.longTotal < APPEND_LONGTASK_BUDGET_MS,
      `[2] append ${APPEND_PER_SERIES} points x ${SERIES_COUNT} series + re-render: ` +
      `${describe(appendWindow)}, ${renderCount - rendersBeforeAppend} React render(s) ` +
      `— budget long-task total < ${APPEND_LONGTASK_BUDGET_MS} ms`,
    );

    // ── Cost attribution (INFO, not a gate) ───────────────────────────────
    // Where does a re-render's time actually go? Time the pure pipeline
    // (`PreparedSeriesCache.prepare` → `buildRenderRows`) on the same fixture
    // in a cache of this page's own, on the same engine, outside React. What is
    // left of the windows above is Recharts + React + style/layout/paint. The
    // component's own cache is a `useRef` it does not expose, so this probe —
    // whose `stats()` the class documents as being for this harness — is the
    // only reachable instance.
    const probe = new PreparedSeriesCache();
    const probeOpts = { smoothing: SMOOTHING, outlierPct: OUTLIER_PCT, logX: false };
    const cols = Math.max(64, Math.round(columns));
    const time = <T,>(fn: () => T): [T, number] => {
      const t = performance.now();
      const v = fn();
      return [v, performance.now() - t];
    };
    const [prep0, tPrep0] = time(() => initialSeries.map((s) => probe.prepare(s, probeOpts)));
    const [rows0, tRows0] = time(() =>
      buildRenderRows(prep0, () => true, 0, POINTS_PER_SERIES - 1, cols, false));
    const [prep1, tPrep1] = time(() => appended.map((s) => probe.prepare(s, probeOpts)));
    const [rows1, tRows1] = time(() =>
      buildRenderRows(prep1, () => true, 0, POINTS_PER_SERIES + APPEND_PER_SERIES - 1, cols, false));
    note(
      `pipeline cold: prepare ${fmt(tPrep0)} ms + buildRenderRows ${fmt(tRows0)} ms -> ${rows0.length} rows; ` +
      `after append: prepare ${fmt(tPrep1)} ms + buildRenderRows ${fmt(tRows1)} ms -> ${rows1.length} rows`,
    );
    note(`PreparedSeriesCache stats (this page's probe cache, not ScalarPlot's): ${JSON.stringify(probe.stats())}`);

    // ── 3. one wheel zoom step ────────────────────────────────────────────
    const gridRect = (host.querySelector(".recharts-cartesian-grid") as SVGGraphicsElement | null)
      ?.getBoundingClientRect() ?? host.getBoundingClientRect();
    const cx = gridRect.left + gridRect.width / 2;
    const cy = gridRect.top + gridRect.height / 2;
    const viewBeforeWheel = currentView;
    const dBeforeWheel = mainPath("s0")?.getAttribute("d") ?? "";
    const rendersBeforeWheel = renderCount;
    const wheelWindow = await measure(async () => {
      dispatchWheel(cx, cy);
      // The gesture coalescer emits at most one view per frame; then React
      // re-renders and the reducer rebuilds the (now narrower) window.
      await waitFor(
        () => currentView !== viewBeforeWheel &&
          (mainPath("s0")?.getAttribute("d") ?? "") !== dBeforeWheel,
        5000,
        4,
      );
      await nextFrame();
    });
    gate(
      currentView.xMin != null && currentView.xMax != null,
      `[3a] the wheel step zoomed the view (x ${currentView.xMin == null ? "auto" : fmt(currentView.xMin)} … ` +
      `${currentView.xMax == null ? "auto" : fmt(currentView.xMax)})`,
    );
    gate(
      wheelWindow.longTotal < WHEEL_LONGTASK_BUDGET_MS,
      `[3b] one wheel zoom step: ${describe(wheelWindow)}, ` +
      `${renderCount - rendersBeforeWheel} React render(s) — budget long-task total < ${WHEEL_LONGTASK_BUDGET_MS} ms`,
    );

    // ── 4. 20 mouse moves: cheap, and geometry untouched ──────────────────
    await sleep(120); // let the post-wheel render settle before the baseline
    const rect = (host.querySelector(".recharts-cartesian-grid") as SVGGraphicsElement | null)
      ?.getBoundingClientRect() ?? host.getBoundingClientRect();
    const dBeforeHover = mainPath("s0")?.getAttribute("d") ?? "";
    const rendersBeforeHover = renderCount;
    const hoverWindow = await measure(async () => {
      for (let i = 0; i < HOVER_MOVES; i++) {
        const x = rect.left + 4 + ((rect.width - 8) * i) / (HOVER_MOVES - 1);
        const y = rect.top + rect.height / 2;
        dispatchMouseMove(x, y);
        await nextFrame();
      }
    });
    const dAfterHover = mainPath("s0")?.getAttribute("d") ?? "";
    const emphasised = seriesPaths().filter((p) => (p.dataset.emph ?? "") !== "").length;

    gate(
      hoverWindow.longMax <= HOVER_LONGTASK_MAX_MS,
      `[4a] ${HOVER_MOVES} mouse moves: no long task > ${HOVER_LONGTASK_MAX_MS} ms — ${describe(hoverWindow)}`,
    );
    gate(
      dBeforeHover.length > 0 && dAfterHover === dBeforeHover,
      `[4b] first series' path d is byte-identical across the hover sweep ` +
      `(${dBeforeHover.length} chars before, ${dAfterHover.length} after)`,
    );
    note(
      `hover wrote data-emph on ${emphasised}/${seriesPaths().length} paths; ` +
      `${renderCount - rendersBeforeHover} React render(s) of ScalarPlot's host during the sweep`,
    );

    // A render that threw would leave half the assertions trivially "passing"
    // on an empty DOM, so an error on the page is itself a failure.
    gate(pageErrors.length === 0, `[6] no page errors (${pageErrors.join(" | ") || "none"})`);

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
