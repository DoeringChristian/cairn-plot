/**
 * PlotHost `sizing="fill"` — LIVE, self-driving browser harness.
 *
 * WHAT IT GUARDS. An embedding host (Cairn's cards) mounts inline charts through
 * `PlotHost` inside a FIXED-HEIGHT card: a flex column with a header and a
 * `flex-1 min-h-0` plot cell. `ChartBox` has no way to know that, so it falls
 * back to its standalone `DEFAULT_CHART_HEIGHT` (400px) and the chart overflows
 * every card shorter than ~400px. `sizing="fill"` is the seam that fixes it: the
 * surface fills the host cell and publishes `ChartFillContext`, so `ChartBox`
 * takes the cell's height instead of 400px, and `useEmitAutoHeight` goes quiet
 * (a host that already sized the box is not asking for a `cairn:resize`).
 *
 * jsdom has no layout — `getBoundingClientRect()` is all zeros there, so the
 * whole point (a REAL percentage-height chain through the flex cell) cannot be a
 * `*.test.ts` unit test. This is a Chromium page, SELF-DRIVING (declared via
 * `data-cairn-harness="self-driving"` in the HTML) so `npm run test:harness`
 * runs it in the DEFAULT set. It needs no GPU: the histogram leaf is a DOM/SVG
 * renderer.
 *
 * The page gives each mount a 220px card with a 40px header, leaving a DEFINITE
 * 180px plot cell. Asserted:
 *   1. `sizing="fill"` → `.cairn-plot-chartbox` is 180±2px (it FILLS the cell);
 *   2. `sizing="fill"` posts NO `cairn:resize` to `window.parent`;
 *   3. the default (`sizing` omitted) still measures 400px — the standalone
 *      behaviour every existing page depends on is untouched.
 */
import { mountPlot, type PlotSpec } from "../../../public/index.ts";
import { createHarness, waitFor } from "../../harness.ts";

const { report, setOverallStatus } = createHarness({
  title: "INLINE FILL SIZING",
  colors: { pass: "#6f6", fail: "#f66" },
});
let passed = true;
const check = (condition: boolean, message: string) => {
  passed = passed && condition;
  report(condition, message);
};

const BINS = 32;

/** A 32-bin inline histogram leaf — no data source, no GPU, pure DOM/SVG. */
function histogramSpec(): PlotSpec {
  const counts = Array.from({ length: BINS }, (_, i) => 1 + (i % 7));
  const edges = Array.from({ length: BINS + 1 }, (_, i) => i / BINS);
  return {
    root: {
      kind: "plot",
      type: "histogram",
      data: { kind: "inline", props: { view: "bars", counts, edges } },
    },
  };
}

/** The data source is never consulted by an inline leaf; PlotHost still wants one. */
const unusedSource = {
  artifactUrl: (hash: string) => hash,
  bytes: () => Promise.reject(new Error("inline leaves never fetch")),
};

function chartBox(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(".cairn-plot-chartbox");
}
function boxHeight(root: HTMLElement): number {
  return chartBox(root)?.getBoundingClientRect().height ?? 0;
}

// ---------------------------------------------------------------------------
// `cairn:resize` spy. `useEmitAutoHeight` posts to `window.parent`, which IS
// `window` on this top-level harness page — so patching `window.parent.postMessage`
// patches the exact function the hook calls.
// ---------------------------------------------------------------------------
const resizeMessages: unknown[] = [];
const originalPostMessage = window.parent.postMessage.bind(window.parent);
window.parent.postMessage = function (message: unknown, ...rest: unknown[]) {
  if (
    message !== null &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === "cairn:resize"
  ) {
    resizeMessages.push(message);
  }
  return (originalPostMessage as (...args: unknown[]) => unknown)(message, ...rest);
} as typeof window.postMessage;

async function run() {
  // Mount everything immediately — this harness measures layout, not lazy gating.
  window.__cairnPlotEagerMount = true;

  // ── 1. fill: the chart takes the card's 180px cell ────────────────────────
  const fillMount = document.getElementById("mount-fill")!;
  const fillCell = fillMount.getBoundingClientRect().height;
  const fill = mountPlot(fillMount, {
    spec: histogramSpec(),
    dataSource: unusedSource,
    className: "",
    sizing: "fill",
  });
  await waitFor(() => boxHeight(fillMount) > 0, 5_000);
  const fillHeight = boxHeight(fillMount);
  check(
    Math.abs(fillCell - 180) < 2,
    `the card leaves a 180px plot cell (measured ${fillCell.toFixed(1)}px)`,
  );
  check(
    Math.abs(fillHeight - 180) <= 2,
    `sizing="fill" sizes the chart to its cell: ${fillHeight.toFixed(1)}px (want 180±2)`,
  );

  // ── 2. fill posts no auto-height message ─────────────────────────────────
  // Give the ResizeObserver several frames to fire if it were still armed.
  await waitFor(() => resizeMessages.length > 0, 500);
  check(
    resizeMessages.length === 0,
    `sizing="fill" posts no cairn:resize (${resizeMessages.length} seen)`,
  );

  // ── 3. the default is unchanged: the standalone 400px box ────────────────
  const autoMount = document.getElementById("mount-auto")!;
  const auto = mountPlot(autoMount, {
    spec: histogramSpec(),
    dataSource: unusedSource,
    className: "",
  });
  await waitFor(() => boxHeight(autoMount) > 0, 5_000);
  const autoHeight = boxHeight(autoMount);
  check(
    Math.abs(autoHeight - 400) < 1,
    `the default sizing keeps the standalone 400px box: ${autoHeight.toFixed(1)}px`,
  );
  check(
    await waitFor(() => resizeMessages.length > 0, 2_000),
    "the default sizing still posts cairn:resize (the spy is real)",
  );

  fill.destroy();
  auto.destroy();
  setOverallStatus(passed);
}

void run().catch((error) => {
  report(false, error instanceof Error ? error.stack ?? error.message : String(error));
  setOverallStatus(false);
});
