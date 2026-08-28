import assert from "node:assert/strict";
import test from "node:test";

import { createPlotSessionController } from "./PlotSessionController.ts";
import { emptyPlotSession, parsePlotSession, PlotSessionError } from "./plot-session.ts";

test("plot sessions round-trip and migrate old compare keys", () => {
  const parsed = parsePlotSession({
    version: 1,
    viewports: { a: { settings: { "compare.mode": "diff", "compare.kernel": "signed-error" } } },
    grids: { g: { mode: "stacked", activeSlot: 2 } },
  });
  assert.deepEqual(parsed.viewports.a.settings, { "compare.operation": "signed-error" });
  assert.deepEqual(parsePlotSession(parsed), parsed);
});

test("plot sessions reject future versions and non-finite values", () => {
  assert.throws(() => parsePlotSession({ version: 2, viewports: {}, grids: {} }), PlotSessionError);
  assert.throws(() => parsePlotSession({ version: 1, viewports: { a: { settings: { x: Infinity } } }, grids: {} }), PlotSessionError);
});

test("controller retains unmounted topology records and prunes stale paths", () => {
  const controller = createPlotSessionController();
  controller.setTopology({ viewportIds: new Set(["cell:root/0", "stack:root"]), grids: new Map() });
  controller.recordViewport("cell:root/0", { "image.encoding": "turbo" });
  controller.recordViewport("stack:root", { "image.encoding": "magma" });
  controller.setTopology({ viewportIds: new Set(["stack:root"]), grids: new Map() });
  assert.deepEqual(Object.keys(controller.getSession().viewports), ["stack:root"]);
});

test("restore updates live bindings and notifications are coalesced", async () => {
  const controller = createPlotSessionController(emptyPlotSession());
  controller.setTopology({ viewportIds: new Set(["cell:root"]), grids: new Map() });
  let applied = {};
  controller.registerViewport("cell:root", (value) => { applied = value; }, {});
  let notifications = 0;
  controller.subscribe(() => notifications++);
  controller.recordViewport("cell:root", { "image.encoding": "magma" });
  controller.recordViewport("cell:root", { "image.encoding": "turbo" });
  controller.restoreSession({ version: 1, viewports: { "cell:root": { settings: { "image.encoding": "gray" } } }, grids: {} });
  assert.deepEqual(applied, { "image.encoding": "gray" });
  await Promise.resolve();
  assert.equal(notifications, 1);
});

test("destroyed controllers reject operations", () => {
  const controller = createPlotSessionController();
  controller.destroy();
  assert.throws(() => controller.getSession(), /destroyed/);
});
