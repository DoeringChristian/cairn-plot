import { createEndpointDataSource, mountPlot, type PlotSpec } from "../index.ts";
import { createHarness, sleep, waitFor } from "../../testing/harness.ts";

const { report, setOverallStatus } = createHarness({ title: "PUBLIC HOST" });
let passed = true;
const check = (condition: boolean, message: string) => {
  passed = passed && condition;
  report(condition, message);
};

function imageUrl(color: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 4, 4);
  return canvas.toDataURL("image/png");
}

const spec: PlotSpec = {
  root: {
    kind: "plot",
    type: "image",
    data: { kind: "image", hash: "same-hash" },
    props: { toolbar: false },
  },
};

// ---------------------------------------------------------------------------
// DOM probes. The CPU backend paints ONE viewport-sized presentation canvas
// (`canvas[data-cpu-image-canvas]`, spec §3) — there is no `<img>` and no
// CSS-transformed wrapper any more — so "which source is on screen" is read
// back from that canvas's pixels instead of an `img.src` string. The image
// quad is centred in the viewport at the home view, so the canvas centre is
// always inside it.
// ---------------------------------------------------------------------------
/** The pane's ONE presentation canvas (or null before it mounts). */
function paneCanvas(root: HTMLElement): HTMLCanvasElement | null {
  return root.querySelector<HTMLCanvasElement>("[data-cpu-image-pane] canvas[data-cpu-image-canvas]");
}
/** RGBA at a fractional position of the presentation canvas (default: centre). */
function paneRgba(root: HTMLElement, fx = 0.5, fy = 0.5): [number, number, number, number] | null {
  const canvas = paneCanvas(root);
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  const px = canvas
    .getContext("2d")
    ?.getImageData(Math.floor(canvas.width * fx), Math.floor(canvas.height * fy), 1, 1).data;
  return px ? [px[0]!, px[1]!, px[2]!, px[3]!] : null;
}
/** Is the pane centre showing a RED source? (opaque, red channel dominant) */
function centreIsRed(root: HTMLElement): boolean {
  const p = paneRgba(root);
  return !!p && p[3] > 0 && p[0] > 128 && p[0] > p[2] + 64 && p[0] > p[1] + 64;
}
/** Is the pane centre showing a BLUE source? (opaque, blue channel dominant) */
function centreIsBlue(root: HTMLElement): boolean {
  const p = paneRgba(root);
  return !!p && p[3] > 0 && p[2] > 128 && p[2] > p[0] + 64 && p[2] > p[1] + 64;
}

async function run() {
  window.__cairnPlotRenderMode = "cpu";
  const element = document.getElementById("mount")!;
  const red = imageUrl("red");
  const blue = imageUrl("blue");
  const darkReference = imageUrl("#202020");
  const darkForeground = imageUrl("#404040");
  const mounted = mountPlot(element, {
    spec,
    dataSource: createEndpointDataSource(() => red),
    autoHeight: false,
  });

  await waitFor(() => centreIsRed(element), 3_000);
  check(centreIsRed(element), `public mount renders through the supplied DataSource (centre ${paneRgba(element)})`);
  check(document.querySelectorAll("[data-cairn-selection-overlay-host]").length === 1, "one overlay host is acquired");

  mounted.restoreSession({
    cells: { "cell:root": { settings: { "panel.info": false } } },
    grids: {},
  });
  check(
    mounted.getSession().cells["cell:root"]?.settings["panel.info"] === false,
    "imperative session restore updates the mounted cell",
  );
  let sessionNotifications = 0;
  const unsubscribe = mounted.subscribeSession(() => sessionNotifications++);
  mounted.restoreSession({
    cells: { "cell:root": { settings: { "panel.info": true } } },
    grids: {},
  });
  await sleep(0);
  unsubscribe();
  check(sessionNotifications >= 1, "imperative session subscriptions receive restored state");

  mounted.update({ dataSource: createEndpointDataSource(() => blue) });
  await waitFor(() => centreIsBlue(element), 3_000);
  check(
    centreIsBlue(element),
    `DataSource update cannot reuse stale resolved content (centre ${paneRgba(element)})`,
  );

  // Regression: the production descriptor path must route a CPU backend into
  // comparison presentation, not pass compareSource to a single-image pane.
  const compareSpec: PlotSpec = {
    root: {
      kind: "compare",
      type: "image",
      presentation: "split",
      operands: [
        { kind: "image", hash: "reference" },
        { kind: "image", hash: "foreground" },
      ],
      strategy: "reference",
      referenceIndex: 0,
      settings: { "compare.operation": "split" },
      props: { labelA: "reference", labelB: "foreground" },
    },
  };
  mounted.update({
    spec: compareSpec,
    dataSource: createEndpointDataSource((hash) => hash === "reference" ? darkReference : darkForeground),
  });
  // Real split mode is now ONE pane compositing both operands into ONE
  // presentation canvas (the two `<img>`s are gone): the split chrome is the
  // divider plus the two per-side, clipped TEV overlays.
  const splitChrome = () => ({
    panes: element.querySelectorAll("[data-cpu-image-pane]").length,
    canvases: element.querySelectorAll("[data-cpu-image-pane] canvas[data-cpu-image-canvas]").length,
    overlays: element.querySelectorAll("canvas[data-pixel-value-overlay]").length,
    divider: element.querySelectorAll(".cairn-plot-split-divider").length,
  });
  const splitUp = () => {
    const c = splitChrome();
    return c.panes === 1 && c.canvases === 1 && c.overlays === 2 && c.divider === 1;
  };
  await waitFor(splitUp, 3_000);
  check(
    splitUp(),
    `CPU public comparison enters real split mode (${JSON.stringify(splitChrome())})`,
  );
  // FOLD-AWARE. The split composite is framed to the REFERENCE aspect now (both
  // operands are clipped into ONE viewport instead of sitting side by side), so
  // this square 4x4 pair frames to a ~312px-wide pane inside the 640px mount and
  // `PlotToolbar` collapses its leading row into the "⋯" overflow. The control
  // must still be REACHABLE from the shared toolbar — expanded or folded — which
  // is what the assertion has always been about.
  const compareModeControlReachable = async (): Promise<boolean> => {
    if (element.querySelector('[aria-label="Compare / diff mode"]')) return true;
    const overflow = element.querySelector<HTMLButtonElement>(
      '[role="toolbar"] button[aria-label="More controls"]',
    );
    if (!overflow) return false;
    overflow.click();
    await waitFor(() => !!document.querySelector('div[role="menu"]'), 2_000);
    const popover = document.querySelector<HTMLElement>('div[role="menu"]');
    const found = !!popover?.querySelector('[aria-label="Compare / diff mode"]');
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => !document.querySelector('div[role="menu"]'), 2_000);
    return found;
  };
  check(
    await compareModeControlReachable(),
    "CPU public comparison exposes the shared toolbar mode control",
  );
  const toolbar = element.querySelector<HTMLElement>('[role="toolbar"][aria-label="Plot controls"]');
  check(toolbar?.style.right === "6px" && toolbar.style.left === "", "CPU comparison uses the shared top-right toolbar placement");
  // The separate `[data-cpu-compare-pane]` root is gone — split is composited
  // into the ordinary CPU image pane — and `useSplitFlipKeys` is wired to the ONE
  // viewport element (`viewportRef` = `[data-cpu-image-surface]`), so that is the
  // element the shared keyboard layer makes focusable.
  const cpuComparePane = element.querySelector<HTMLElement>("[data-cpu-image-surface]");
  cpuComparePane?.focus();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await waitFor(() => mounted.getSession().cells["cell:root"]?.settings["compare.split"] === 1, 3_000);
  check(
    mounted.getSession().cells["cell:root"]?.settings["compare.split"] === 1,
    "CPU split uses the shared keyboard interaction layer",
  );
  // Both operands are composited into the ONE presentation canvas now (there is
  // no per-side 4x4 `<canvas>` to inspect), so "applied to BOTH surfaces" is read
  // as: the reference half (left of the divider) AND the foreground half (right)
  // both brighten. Put the divider back at the middle so both halves are visible.
  mounted.patchSettings({ "compare.split": 0.5 });
  const LEFT = 0.4; // inside the quad, reference side of the divider
  const RIGHT = 0.6; // inside the quad, foreground side of the divider
  await waitFor(() => {
    const l = paneRgba(element, LEFT);
    const r = paneRgba(element, RIGHT);
    return !!l && !!r && l[3] > 0 && r[3] > 0;
  }, 3_000);
  const beforeLeft = paneRgba(element, LEFT);
  const beforeRight = paneRgba(element, RIGHT);
  mounted.patchSettings({ "image.exposureEV": 1 });
  const brighter = () => {
    const l = paneRgba(element, LEFT);
    const r = paneRgba(element, RIGHT);
    if (!l || !r || !beforeLeft || !beforeRight) return false;
    return l[0] > beforeLeft[0] + 4 && r[0] > beforeRight[0] + 4;
  };
  const exposed = await waitFor(brighter, 3_000);
  check(
    exposed,
    `CPU split applies shared exposure settings to both surfaces (${beforeLeft}/${beforeRight} → ${paneRgba(element, LEFT)}/${paneRgba(element, RIGHT)})`,
  );
  mounted.patchSettings({ "image.exposureEV": 0, "compare.operation": "absolute" });
  const diffUp = () => {
    const result = element.querySelector('[data-cpu-comparison-result="absolute"]');
    const canvas = result?.querySelector<HTMLCanvasElement>("canvas[data-cpu-image-canvas]");
    return !!canvas && canvas.width > 0 && (paneRgba(element)?.[3] ?? 0) > 0;
  };
  await waitFor(diffUp, 3_000);
  check(diffUp(), "CPU public comparison switches from split to diff mode");
  mounted.patchSettings({ "compare.operation": "flip" });
  await waitFor(() => !!element.querySelector('[data-cpu-comparison-result="flip"]'), 5_000);
  check(!!element.querySelector('[data-cpu-comparison-result="flip"]'), "CPU public comparison renders a cached FLIP field");
  mounted.patchSettings({ "compare.operation": "ssim" });
  await waitFor(() => !!element.querySelector('[data-cpu-comparison-result="ssim"]'), 5_000);
  check(!!element.querySelector('[data-cpu-comparison-result="ssim"]'), "CPU public comparison renders a cached SSIM field");
  check((element.textContent ?? "").includes("SSIM"), "CPU SSIM exposes its exact scalar metric");

  mounted.destroy();
  mounted.destroy();
  await sleep(0);
  check(element.childElementCount === 0, "destroy is idempotent and unmounts the plot");
  check(document.querySelectorAll("[data-cairn-selection-overlay-host]").length === 0, "last destroy releases the overlay host");
  let rejected = false;
  try {
    mounted.update({ spec });
  } catch {
    rejected = true;
  }
  check(rejected, "updates after destroy fail clearly");
  let sessionRejected = false;
  try {
    mounted.getSession();
  } catch {
    sessionRejected = true;
  }
  check(sessionRejected, "session access after destroy fails clearly");
  setOverallStatus(passed);
}

void run().catch((error) => {
  report(false, error instanceof Error ? error.stack ?? error.message : String(error));
  setOverallStatus(false);
});
