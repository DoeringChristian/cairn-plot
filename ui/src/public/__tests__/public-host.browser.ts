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

async function run() {
  window.__cairnPlotRenderMode = "cpu";
  const element = document.getElementById("mount")!;
  const red = imageUrl("red");
  const blue = imageUrl("blue");
  const mounted = mountPlot(element, {
    spec,
    dataSource: createEndpointDataSource(() => red),
    autoHeight: false,
  });

  await waitFor(() => element.querySelector("img")?.src === red, 3_000);
  check(element.querySelector("img")?.src === red, "public mount renders through the supplied DataSource");
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
  await waitFor(() => element.querySelector("img")?.src === blue, 3_000);
  check(element.querySelector("img")?.src === blue, "DataSource update cannot reuse stale resolved content");

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
    dataSource: createEndpointDataSource((hash) => hash === "reference" ? blue : red),
  });
  await waitFor(() => element.querySelectorAll("img").length === 2, 3_000);
  check(element.querySelectorAll("img").length === 2, "CPU public comparison enters real split mode");
  check(!!element.querySelector("[data-cpu-compare-mode]"), "CPU public comparison exposes mode controls");
  mounted.patchSettings({ "compare.operation": "absolute" });
  await waitFor(() => {
    const canvas = element.querySelector("canvas");
    return !!canvas && canvas.style.display === "block";
  }, 3_000);
  check(!!element.querySelector("canvas"), "CPU public comparison switches from split to diff mode");

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
