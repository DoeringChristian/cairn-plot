import assert from "node:assert/strict";
import test from "node:test";

import { createPlotSessionController } from "./PlotSessionController.ts";
import { connectSessionPersistence } from "./session-persistence.ts";

test("persistence restores before allowing session writes", async () => {
  const controller = createPlotSessionController();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const saves: unknown[] = [];
  const connection = connectSessionPersistence(controller, {
    async load() {
      await gate;
      return { cells: { a: { settings: { "image.encoding": "magma" } } }, grids: {} };
    },
    save(session) { saves.push(session); },
  });
  controller.recordCell("a", { "image.encoding": "turbo" });
  await Promise.resolve();
  assert.equal(saves.length, 0);
  release();
  await connection.ready;
  assert.equal(controller.getSession().cells.a.settings["image.encoding"], "magma");
  connection.dispose();
});

test("persistence serializes saves and keeps the latest pending snapshot", async () => {
  const controller = createPlotSessionController();
  const saved: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const connection = connectSessionPersistence(controller, {
    load: () => null,
    async save(session) {
      saved.push(session.cells.a?.settings["image.encoding"] ?? "none");
      if (saved.length === 1) await gate;
    },
  });
  await connection.ready;
  controller.recordCell("a", { "image.encoding": "magma" });
  await Promise.resolve();
  controller.recordCell("a", { "image.encoding": "gray" });
  controller.recordCell("a", { "image.encoding": "turbo" });
  await Promise.resolve();
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(saved, ["magma", "turbo"]);
  connection.dispose();
});
