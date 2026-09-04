/**
 * RESTORE-SIDE settings migration.
 *
 * `defaultSettingsForNode` migrates retired keys out of the SEED, but a session
 * snapshot bypasses the seed entirely: `PlotSessionController.restoreSession`
 * (and `registerCell`, and the host `patchSettings` fan-out) replays the saved
 * record verbatim into each cell's registered `replace`. A snapshot written
 * before `compare.flipMode` was retired therefore reintroduces it into the
 * store, where the read-side `project` renders `flip-hdr` AND keeps coercing
 * every later `compare.operation: "flip"` back to HDR FLIP — the exact defect
 * the seed-side migration removed.
 *
 * The controller must not learn plot semantics; the cell owns its plot type, so
 * the cell's registered `replace` is the seam (see `host/PlotCell.tsx`). The
 * cell also records the healed record back, because `replaceLocal` deliberately
 * reports no user change — without that, the stale key would survive in the
 * session and re-poison the next `patchCellSettings`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { CompareNode, DataSpec } from "../../../../packages/spec/src/spec.ts";
import { definePlot, type SettingsRecord } from "../../plots/contracts.ts";
import { migrateCompareSettings } from "../../plots/image/definition/settings.ts";
import { clearPlotTypesForTest, registerPlotType, requirePlotType } from "../../plots/registry.ts";
import { defaultSettingsForNode, migrateSettingsForNode } from "../../plots/settings.ts";
import type { PlotSettings } from "../../settings/schema.ts";
import { createPlotSessionController, type PlotSessionController } from "./PlotSessionController.ts";

type InlineSpec = Extract<DataSpec, { kind: "inline" }>;

/** The image plot's real settings schema (incl. its real migration), no views. */
function registerImageLike(): void {
  clearPlotTypesForTest();
  registerPlotType(
    definePlot<InlineSpec, number, SettingsRecord, number>({
      kind: "image",
      data: { validate: (value) => value as InlineSpec },
      settings: {
        defaults: () => ({ "compare.operation": "abs" }),
        project: (settings) => migrateCompareSettings({ ...settings }),
        migrateSettings: migrateCompareSettings,
      },
      resolve: async () => 0,
      present: (content) => content,
    }),
  );
}

const compareNode: CompareNode = {
  kind: "compare",
  type: "image",
  presentation: "difference",
  operands: [
    { kind: "url", src: "reference.png" },
    { kind: "url", src: "prediction.png" },
  ],
  strategy: "reference",
  referenceIndex: 0,
};

/** A cell saved before HDR FLIP became its own public operation. */
const LEGACY_SAVED = { "compare.operation": "flip", "compare.flipMode": "hdr" };

/** Mirrors the binding `host/PlotCell.tsx` registers: the plot definition's
 *  migration runs before the settings reach the cell's own store. */
function mountCell(controller: PlotSessionController, id: string) {
  const cell = { settings: defaultSettingsForNode(compareNode) };
  const replace = (settings: PlotSettings) => {
    const migrated = migrateSettingsForNode(compareNode, settings);
    cell.settings = migrated;
    if (migrated !== settings) controller.recordCell(id, migrated);
  };
  controller.registerCell(id, replace, cell.settings);
  return cell;
}

test("a restored legacy snapshot never reintroduces the retired compare key", () => {
  registerImageLike();
  const controller = createPlotSessionController();
  controller.setTopology({ cellIds: new Set(["cell:root"]), grids: new Map() });
  const cell = mountCell(controller, "cell:root");

  controller.restoreSession({ cells: { "cell:root": { settings: LEGACY_SAVED } }, grids: {} });

  assert.deepEqual(cell.settings, { "compare.operation": "flip-hdr" });
  assert.equal("compare.flipMode" in cell.settings, false);
  assert.deepEqual(controller.getSession().cells["cell:root"].settings, {
    "compare.operation": "flip-hdr",
  });
});

test("SDR FLIP stays selectable after a legacy snapshot is restored", () => {
  registerImageLike();
  const controller = createPlotSessionController();
  controller.setTopology({ cellIds: new Set(["cell:root"]), grids: new Map() });
  const cell = mountCell(controller, "cell:root");
  controller.restoreSession({ cells: { "cell:root": { settings: LEGACY_SAVED } }, grids: {} });

  controller.patchCellSettings({ "compare.operation": "flip" } as never);

  const project = requirePlotType("image").projectSettings;
  assert.equal(project(cell.settings)["compare.operation"], "flip");
  assert.equal("compare.flipMode" in cell.settings, false);
});

test("a cell registered against a legacy snapshot is migrated on mount", () => {
  registerImageLike();
  const controller = createPlotSessionController({
    cells: { "cell:root": { settings: LEGACY_SAVED } },
    grids: {},
  });
  controller.setTopology({ cellIds: new Set(["cell:root"]), grids: new Map() });

  const cell = mountCell(controller, "cell:root");

  assert.deepEqual(cell.settings, { "compare.operation": "flip-hdr" });
  assert.deepEqual(controller.getSession().cells["cell:root"].settings, {
    "compare.operation": "flip-hdr",
  });
});
