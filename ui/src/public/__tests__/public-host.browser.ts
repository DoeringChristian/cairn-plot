import { createEndpointDataSource, mountPlot, type PlotDescriptor } from "../index.ts";
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

const descriptor: PlotDescriptor = {
  root: {
    kind: "plot",
    renderer: "image",
    data: { kind: "image", hash: "same-hash" },
    props: { renderMode: "cpu", toolbar: false },
  },
};

async function run() {
  const element = document.getElementById("mount")!;
  const red = imageUrl("red");
  const blue = imageUrl("blue");
  const mounted = mountPlot(element, {
    descriptor,
    dataSource: createEndpointDataSource(() => red),
    autoHeight: false,
  });

  await waitFor(() => element.querySelector("img")?.src === red, 3_000);
  check(element.querySelector("img")?.src === red, "public mount renders through the supplied DataSource");
  check(document.querySelectorAll("[data-cairn-selection-overlay-host]").length === 1, "one overlay host is acquired");

  mounted.restoreSession({
    version: 1,
    viewports: { "cell:root": { settings: { "panel.info": false } } },
    grids: {},
  });
  check(
    mounted.getSession().viewports["cell:root"]?.settings["panel.info"] === false,
    "imperative session restore updates the mounted cell",
  );
  let sessionNotifications = 0;
  const unsubscribe = mounted.subscribeSession(() => sessionNotifications++);
  mounted.restoreSession({
    version: 1,
    viewports: { "cell:root": { settings: { "panel.info": true } } },
    grids: {},
  });
  await sleep(0);
  unsubscribe();
  check(sessionNotifications >= 1, "imperative session subscriptions receive restored state");

  mounted.update({ dataSource: createEndpointDataSource(() => blue) });
  await waitFor(() => element.querySelector("img")?.src === blue, 3_000);
  check(element.querySelector("img")?.src === blue, "DataSource update cannot reuse stale resolved content");

  mounted.destroy();
  mounted.destroy();
  await sleep(0);
  check(element.childElementCount === 0, "destroy is idempotent and unmounts the plot");
  check(document.querySelectorAll("[data-cairn-selection-overlay-host]").length === 0, "last destroy releases the overlay host");
  let rejected = false;
  try {
    mounted.update({ descriptor });
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
