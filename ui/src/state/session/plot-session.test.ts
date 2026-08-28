import assert from "node:assert/strict";
import test from "node:test";

import { createPlotSessionController } from "./PlotSessionController.ts";
import { emptyPlotSession, parsePlotSession, PlotSessionError } from "./plot-session.ts";

test("plot sessions round-trip canonical cell settings", () => {
  const parsed = parsePlotSession({
    cells: { a: { settings: { "compare.operation": "signed-error" } } },
    grids: { g: { layout: "stack", activeSlot: 2 } },
  });
  assert.deepEqual(parsed.cells.a.settings, { "compare.operation": "signed-error" });
  assert.deepEqual(parsePlotSession(parsed), parsed);
});

test("plot sessions reject malformed and non-finite values", () => {
  assert.throws(() => parsePlotSession({ cells: {}, grids: [] }), PlotSessionError);
  assert.throws(() => parsePlotSession({ cells: { a: { settings: { x: Infinity } } }, grids: {} }), PlotSessionError);
});

test("controller retains unmounted topology records and prunes stale paths", () => {
  const controller = createPlotSessionController();
  controller.setTopology({ cellIds: new Set(["cell:root/0", "stack:root"]), grids: new Map() });
  controller.recordCell("cell:root/0", { "image.encoding": "turbo" });
  controller.recordCell("stack:root", { "image.encoding": "magma" });
  controller.setTopology({ cellIds: new Set(["stack:root"]), grids: new Map() });
  assert.deepEqual(Object.keys(controller.getSession().cells), ["stack:root"]);
});

test("restore updates live bindings and notifications are coalesced", async () => {
  const controller = createPlotSessionController(emptyPlotSession());
  controller.setTopology({ cellIds: new Set(["cell:root"]), grids: new Map() });
  let applied = {};
  controller.registerCell("cell:root", (value) => { applied = value; }, {});
  let notifications = 0;
  controller.subscribe(() => notifications++);
  controller.recordCell("cell:root", { "image.encoding": "magma" });
  controller.recordCell("cell:root", { "image.encoding": "turbo" });
  controller.restoreSession({ cells: { "cell:root": { settings: { "image.encoding": "gray" } } }, grids: {} });
  assert.deepEqual(applied, { "image.encoding": "gray" });
  await Promise.resolve();
  assert.equal(notifications, 1);
});

test("cell seeding initializes once and retains the independent branch", () => {
  const controller = createPlotSessionController();
  controller.seedCell("stack:root", { "image.encoding": "magma" });
  controller.seedCell("stack:root", { "image.encoding": "turbo" });
  assert.deepEqual(controller.getSession().cells["stack:root"].settings, {
    "image.encoding": "magma",
  });
});

test("destroyed controllers reject operations", () => {
  const controller = createPlotSessionController();
  controller.destroy();
  assert.throws(() => controller.getSession(), /destroyed/);
});
