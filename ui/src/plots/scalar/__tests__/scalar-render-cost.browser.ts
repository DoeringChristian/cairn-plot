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
 * observable there. This page mounts the real `ScalarPlot` in 800 × 320 hosts
 * and drives it with real events; the runner
 * (`node scripts/test-harness.mjs --only scalar-render-cost`) polls `#status`.
 *
 * ## What it pins
 * Two scenarios on the same page, because the two things worth guarding are
 * different: the COMMON case must be genuinely interactive, and the EXTREME
 * case must not fall off a cliff.
 *
 *   A. common — 3 series x 10 000 points, the spec §4 budgets verbatim:
 *      mount < 200 ms, append < 30 ms, wheel < 30 ms.
 *   B. extreme — 10 series x 100 000 points, the SVG backend's budgets:
 *      mount < 400 ms, append <= 150 ms, wheel <= 80 ms.
 *
 * Both also pin, per scenario: 20 synthetic mouse moves cost no long task > 50
 * ms AND leave the first series' path `d` byte-identical, and no drawn path
 * carries more than 5 x columns + 2 points.
 *
 * ## Why B's budgets are not the spec's 30 ms
 * The spec's 30 ms is the target for the CANVAS backend (§3.8's seam). It is
 * not reachable through Recharts/SVG, and the floor was measured rather than
 * guessed (see the task-3 report):
 *
 *   - ~0.7 us per DRAWN point of React reconciliation, d3 path-string building,
 *     SVG parse and raster. Scenario B draws ~10 curves x 4 picks/column +
 *     10 envelopes x 2 picks/column over ~750 columns ~= 45 000 points, i.e.
 *     ~32 ms that no amount of memoisation removes;
 *   - ~10 ms of Recharts axis work, which it redoes once per graphical item
 *     (`getTicksOfAxis` inside `getFormatItems` rebuilds the x-axis' whole
 *     categorical tick array per `<Line>`);
 *   - ~8 ms of prepare + reduce over the 1 000 000 source points.
 *
 * ~50 ms is therefore the floor for one wheel step at this size, and an append
 * additionally re-prepares and re-scales against a grown domain. The budgets
 * below sit above that floor with enough headroom to survive a loaded CI box
 * while still catching the regressions they exist to catch — the quadratic
 * merged-row blow-up (was 320 ms) and any return of per-hover re-rendering.
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
 * The appended arrays are built BEFORE the measured window opens: copying ten
 * 100 000-element point arrays is host data plumbing (what a run poller does),
 * not scalar render cost, and folding it in would measure the fixture instead
 * of the plot.
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
const SMOOTHING = 0.6;
const OUTLIER_PCT: [number, number] = [0, 100];
const HOVER_MOVES = 20;
const HOVER_LONGTASK_MAX_MS = 50;
/** Points a path may carry per screen column (M4 keeps ≤ 4) plus the endpoints. */
const POINTS_PER_COLUMN = 5;

interface Scenario {
  id: string;
  hostId: string;
  label: string;
  seriesCount: number;
  pointsPerSeries: number;
  appendPerSeries: number;
  /** mount → painted paths. */
  mountMs: number;
  /** append 100 points to every series, long-task total. */
  appendMs: number;
  /** one wheel zoom step, long-task total. */
  wheelMs: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: "A", hostId: "chart-host-a", label: "common",
    seriesCount: 3, pointsPerSeries: 10_000, appendPerSeries: 100,
    // Spec §4 verbatim: this is the size the budgets were written for.
    mountMs: 200, appendMs: 30, wheelMs: 30,
  },
  {
    id: "B", hostId: "chart-host-b", label: "extreme",
    seriesCount: 10, pointsPerSeries: 100_000, appendPerSeries: 100,
    // The SVG backend's budgets — see "Why B's budgets are not the spec's
    // 30 ms" above. The spec's 30 ms stands as the canvas backend's target.
    mountMs: 400, appendMs: 150, wheelMs: 80,
  },
];

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

function makeSeries(sc: Scenario): Series[] {
  const out: Series[] = [];
  for (let s = 0; s < sc.seriesCount; s++) {
    const rng = makeRng(1234 + s * 7919);
    out.push({
      key: `s${s}`,
      label: `series ${s}`,
      color: COLORS[s % COLORS.length]!,
      points: makePoints(rng, 0, sc.pointsPerSeries),
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

// ── Mount and DOM probes (per scenario) ────────────────────────────────────
/** Everything one scenario's mounted chart exposes to the measurements. */
interface Mounted {
  host: HTMLElement;
  setSeries: (s: Series[]) => void;
  /** Renders of the harness wrapper — NOT of ScalarPlot's own subtree. */
  renders: () => number;
  view: () => ChartViewState;
  seriesPaths: () => SVGPathElement[];
  /** The main (non-overlay) curve of series `key`; the overlay carries
   *  `data-series-role="raw"`. */
  mainPath: (key: string) => SVGPathElement | null;
  painted: () => boolean;
  /** Plot width in CSS px = how many columns the M4 reduction was allowed. */
  columns: () => { columns: number; source: string };
  gridRect: () => DOMRect;
  wheel: (x: number, y: number) => void;
  mouseMove: (x: number, y: number) => void;
}

function mount(sc: Scenario, initial: Series[]): { mounted: Mounted; render: () => void } {
  const host = document.getElementById(sc.hostId) as HTMLElement;
  let setSeriesExternal: ((s: Series[]) => void) | null = null;
  let renderCount = 0;
  let currentView: ChartViewState = { xMin: null, xMax: null, yMin: null, yMax: null };

  function Harness(): React.ReactElement {
    const [series, setSeries] = useState<Series[]>(() => initial);
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

  const seriesPaths = () =>
    Array.from(host.querySelectorAll<SVGPathElement>("path[data-series-key]"));

  const mounted: Mounted = {
    host,
    setSeries: (next) => setSeriesExternal?.(next),
    renders: () => renderCount,
    view: () => currentView,
    seriesPaths,
    mainPath: (key) =>
      seriesPaths().find((p) => p.dataset.seriesKey === key && !p.dataset.seriesRole) ?? null,
    painted: () => seriesPaths().some((p) => (p.getAttribute("d") ?? "").length > 0),
    columns: () => {
      // Read off the rendered `.recharts-cartesian-grid` (the real drawing
      // area, ~54 px narrower than the host once the y-axis and margins are
      // taken out), which is the same rect `ScalarPlot` feeds its reducer; the
      // SVG surface width is the stated fallback if the grid has not rendered.
      const grid = host.querySelector(".recharts-cartesian-grid");
      if (grid) {
        const w = (grid as SVGGraphicsElement).getBoundingClientRect().width;
        if (w > 1) return { columns: w, source: ".recharts-cartesian-grid rect" };
      }
      const svg = host.querySelector("svg.recharts-surface");
      const w = svg ? svg.getBoundingClientRect().width : host.getBoundingClientRect().width;
      return { columns: w, source: "svg.recharts-surface width (grid not measurable)" };
    },
    gridRect: () =>
      (host.querySelector(".recharts-cartesian-grid") as SVGGraphicsElement | null)
        ?.getBoundingClientRect() ?? host.getBoundingClientRect(),
    wheel: (x, y) => {
      const box = host.querySelector<HTMLElement>('div[aria-label^="Scalar plot"]') ?? host;
      box.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -120,
          clientX: x,
          clientY: y,
          // The zoom gate is a trackpad pinch (`ctrlKey`, which arrives with no
          // keydown) or a held modifier — a PLAIN wheel deliberately does
          // nothing and scrolls the page, so it would measure an empty window.
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    mouseMove: (x, y) => {
      const target =
        host.querySelector<Element>("svg.recharts-surface") ??
        (host.firstElementChild as Element | null) ??
        host;
      target.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: x, clientY: y, bubbles: true, cancelable: true, view: window,
        }),
      );
    },
  };

  const root = createRoot(host);
  return { mounted, render: () => root.render(h(Harness)) };
}

/** Points in a path command string: every M / L / C command draws one point. */
function pathPointCount(d: string): number {
  return (d.match(/[MLC]/g) ?? []).length;
}

// ── Run ────────────────────────────────────────────────────────────────────
injectHoverCss();

const result = document.getElementById("result");
function note(msg: string): void {
  if (result) {
    const p = document.createElement("div");
    p.textContent = `INFO: ${msg}`;
    p.style.color = "#9cf";
    result.appendChild(p);
  }
  // eslint-disable-next-line no-console
  console.log(`INFO: ${msg}`);
}

/**
 * A one-line-per-scenario summary. The runner echoes `BENCH:` lines even when
 * the page PASSES (see `scripts/test-harness.mjs`), so the measured cost is
 * visible on every green run — a budget that is quietly creeping towards its
 * ceiling should be readable without having to fail first.
 */
function bench(msg: string): void {
  if (result) {
    const p = document.createElement("div");
    p.textContent = `BENCH: ${msg}`;
    p.style.color = "#fc9";
    result.appendChild(p);
  }
  // eslint-disable-next-line no-console
  console.log(`BENCH: ${msg}`);
}

async function runScenario(sc: Scenario, gate: (c: boolean, m: string) => void): Promise<void> {
  const tag = `[${sc.id}]`;
  const initialSeries = makeSeries(sc);
  const { mounted, render } = mount(sc, initialSeries);
  const total = sc.seriesCount * sc.pointsPerSeries;
  note(
    `${tag} ${sc.label}: ${sc.seriesCount} series x ${sc.pointsPerSeries.toLocaleString("en-US")} points ` +
    `(${total.toLocaleString("en-US")} total), smoothing ${SMOOTHING}, ` +
    `host ${mounted.host.clientWidth}x${mounted.host.clientHeight} px — budgets ` +
    `mount < ${sc.mountMs} ms, append < ${sc.appendMs} ms, wheel < ${sc.wheelMs} ms`,
  );

  // ── 1. mount → painted paths ────────────────────────────────────────────
  const mountStart = performance.now();
  const mountSampler = new BusySampler();
  mountSampler.start();
  render();
  const paintedOk = await waitFor(mounted.painted, 20_000, 4);
  const mountMs = performance.now() - mountStart;
  mountSampler.stop();
  const mountLong = longTasksIn(mountStart, mountStart + mountMs);
  gate(paintedOk, `${tag}[1a] paths painted (path[data-series-key] with a non-empty d)`);
  gate(
    mountMs < sc.mountMs,
    `${tag}[1b] mount-to-paint ${fmt(mountMs)} ms < ${sc.mountMs} ms budget ` +
    `(long-task total ${fmt(mountLong.total)} ms, sampled busy ${fmt(mountSampler.busy)} ms)`,
  );

  await sleep(200); // let the plot-rect correction re-render settle
  const paths = mounted.seriesPaths();
  note(
    `${tag} ${paths.length} drawn paths (${sc.seriesCount} curves + ${sc.seriesCount} raw envelopes), ` +
    `${mounted.renders()} React renders so far`,
  );

  // ── 5. points per path vs columns ───────────────────────────────────────
  const { columns, source: columnSource } = mounted.columns();
  const bound = POINTS_PER_COLUMN * columns + 2;
  let worst = 0;
  let worstKey = "";
  let curveWorst = 0;
  let rawWorst = 0;
  for (const p of paths) {
    const n = pathPointCount(p.getAttribute("d") ?? "");
    if (p.dataset.seriesRole === "raw") { if (n > rawWorst) rawWorst = n; }
    else if (n > curveWorst) curveWorst = n;
    if (n > worst) { worst = n; worstKey = `${p.dataset.seriesKey}${p.dataset.seriesRole ? " (raw)" : ""}`; }
  }
  note(`${tag} columns = ${fmt(columns)} px from ${columnSource}; bound = 5 x columns + 2 = ${fmt(bound)}`);
  gate(
    worst <= bound,
    `${tag}[5a] worst path carries ${worst} points (${worstKey}) <= ${fmt(bound)} ` +
    `(${(worst / Math.max(1, columns)).toFixed(2)} points per column)`,
  );
  // The faint overlay is an ENVELOPE (min/max per column), not a second curve:
  // it must stay at ~2 points per column, which is ~a quarter of the drawn
  // points of a ten-series chart.
  gate(
    rawWorst <= 2 * columns + 2 && rawWorst < curveWorst,
    `${tag}[5b] raw envelope carries ${rawWorst} points <= 2 x columns + 2 = ${fmt(2 * columns + 2)} ` +
    `and below the curve's ${curveWorst}`,
  );

  // ── 2. append points per series, re-render ──────────────────────────────
  // Built BEFORE the window: array copying is host plumbing, not render cost.
  const appended: Series[] = initialSeries.map((s, i) => {
    const rng = makeRng(99_000 + i);
    return { ...s, points: s.points.concat(makePoints(rng, sc.pointsPerSeries, sc.appendPerSeries)) };
  });
  const dBeforeAppend = mounted.mainPath("s0")?.getAttribute("d") ?? "";
  const rendersBeforeAppend = mounted.renders();
  const appendWindow = await measure(async () => {
    mounted.setSeries(appended);
    await waitFor(() => (mounted.mainPath("s0")?.getAttribute("d") ?? "") !== dBeforeAppend, 5000, 4);
    await nextFrame();
  });
  gate(
    appendWindow.longTotal < sc.appendMs,
    `${tag}[2] append ${sc.appendPerSeries} points x ${sc.seriesCount} series + re-render: ` +
    `${describe(appendWindow)}, ${mounted.renders() - rendersBeforeAppend} React render(s) ` +
    `— budget long-task total < ${sc.appendMs} ms`,
  );

  // ── Cost attribution (INFO, not a gate) ─────────────────────────────────
  // Where does a re-render's time actually go? Time the pure pipeline
  // (`PreparedSeriesCache.prepare` → `buildRenderRows`) on the same fixture in
  // a cache of this page's own, on the same engine, outside React. What is left
  // of the windows above is Recharts + React + style/layout/paint. The
  // component's own cache is a `useRef` it does not expose, so this probe —
  // whose `stats()` the class documents as being for this harness — is the only
  // reachable instance.
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
    buildRenderRows(prep0, () => true, 0, sc.pointsPerSeries - 1, cols, false));
  const [prep1, tPrep1] = time(() => appended.map((s) => probe.prepare(s, probeOpts)));
  const [rows1, tRows1] = time(() =>
    buildRenderRows(prep1, () => true, 0, sc.pointsPerSeries + sc.appendPerSeries - 1, cols, false));
  note(
    `${tag} pipeline cold: prepare ${fmt(tPrep0)} ms + buildRenderRows ${fmt(tRows0)} ms -> ${rows0.length} rows; ` +
    `after append: prepare ${fmt(tPrep1)} ms + buildRenderRows ${fmt(tRows1)} ms -> ${rows1.length} rows`,
  );
  note(`${tag} PreparedSeriesCache stats (this page's probe cache, not ScalarPlot's): ${JSON.stringify(probe.stats())}`);

  // ── 3. one wheel zoom step ──────────────────────────────────────────────
  const gridRect = mounted.gridRect();
  const cx = gridRect.left + gridRect.width / 2;
  const cy = gridRect.top + gridRect.height / 2;
  const viewBeforeWheel = mounted.view();
  const dBeforeWheel = mounted.mainPath("s0")?.getAttribute("d") ?? "";
  const rendersBeforeWheel = mounted.renders();
  const wheelWindow = await measure(async () => {
    mounted.wheel(cx, cy);
    // The gesture coalescer emits at most one view per frame; then React
    // re-renders and the reducer rebuilds the (now narrower) window.
    await waitFor(
      () => mounted.view() !== viewBeforeWheel &&
        (mounted.mainPath("s0")?.getAttribute("d") ?? "") !== dBeforeWheel,
      5000,
      4,
    );
    await nextFrame();
  });
  const view = mounted.view();
  gate(
    view.xMin != null && view.xMax != null,
    `${tag}[3a] the wheel step zoomed the view (x ${view.xMin == null ? "auto" : fmt(view.xMin)} … ` +
    `${view.xMax == null ? "auto" : fmt(view.xMax)})`,
  );
  gate(
    wheelWindow.longTotal < sc.wheelMs,
    `${tag}[3b] one wheel zoom step: ${describe(wheelWindow)}, ` +
    `${mounted.renders() - rendersBeforeWheel} React render(s) — budget long-task total < ${sc.wheelMs} ms`,
  );

  // ── 4. 20 mouse moves: cheap, and geometry untouched ────────────────────
  await sleep(120); // let the post-wheel render settle before the baseline
  const rect = mounted.gridRect();
  const dBeforeHover = mounted.mainPath("s0")?.getAttribute("d") ?? "";
  const rendersBeforeHover = mounted.renders();
  const hoverWindow = await measure(async () => {
    for (let i = 0; i < HOVER_MOVES; i++) {
      const x = rect.left + 4 + ((rect.width - 8) * i) / (HOVER_MOVES - 1);
      const y = rect.top + rect.height / 2;
      mounted.mouseMove(x, y);
      await nextFrame();
    }
  });
  const dAfterHover = mounted.mainPath("s0")?.getAttribute("d") ?? "";
  const emphasised = mounted.seriesPaths().filter((p) => (p.dataset.emph ?? "") !== "").length;

  gate(
    hoverWindow.longMax <= HOVER_LONGTASK_MAX_MS,
    `${tag}[4a] ${HOVER_MOVES} mouse moves: no long task > ${HOVER_LONGTASK_MAX_MS} ms — ${describe(hoverWindow)}`,
  );
  gate(
    dBeforeHover.length > 0 && dAfterHover === dBeforeHover,
    `${tag}[4b] first series' path d is byte-identical across the hover sweep ` +
    `(${dBeforeHover.length} chars before, ${dAfterHover.length} after)`,
  );
  note(
    `${tag} hover wrote data-emph on ${emphasised}/${mounted.seriesPaths().length} paths; ` +
    `${mounted.renders() - rendersBeforeHover} React render(s) of ScalarPlot's host during the sweep`,
  );

  bench(
    `${tag} ${sc.seriesCount}x${sc.pointsPerSeries.toLocaleString("en-US")} @ ${fmt(columns)} columns — ` +
    `mount ${fmt(mountMs)}/${sc.mountMs} ms, ` +
    `append ${fmt(appendWindow.longTotal)}/${sc.appendMs} ms long-task (busy ${fmt(appendWindow.busy)}), ` +
    `wheel ${fmt(wheelWindow.longTotal)}/${sc.wheelMs} ms long-task (busy ${fmt(wheelWindow.busy)}), ` +
    `hover max ${fmt(hoverWindow.longMax)}/${HOVER_LONGTASK_MAX_MS} ms, ` +
    `curve ${curveWorst} + envelope ${rawWorst} points per path`,
  );
}

async function main(): Promise<void> {
  let ok = true;
  const gate = (cond: boolean, msg: string) => { report(cond, msg); ok = ok && cond; };
  try {
    gate(longTaskObserverOk, "[0] PerformanceObserver('longtask') is available (the budgets' unit)");
    for (const sc of SCENARIOS) await runScenario(sc, gate);
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
