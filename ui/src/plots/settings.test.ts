/**
 * SEED-SIDE settings migration.
 *
 * `defaultSettingsForNode` merges authored `node.settings` OVER the plot's
 * defaults, so a definition that migrates only inside `defaults()` still lets a
 * retired key survive into the seeded record. That is not cosmetic: the cell
 * store merges later patches into the seeded object
 * (`state/settings/use-cell-settings.ts`), so a surviving `compare.flipMode:
 * "hdr"` would sit next to a freshly chosen `compare.operation: "flip"` and the
 * read-side migration would keep rewriting it back to `flip-hdr` — making SDR
 * FLIP unselectable for that cell. The migration therefore runs LAST, over the
 * fully merged seed, through the definition's optional `migrateSettings` hook.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import type { CompareNode, DataSpec } from "../../../packages/spec/src/spec.ts";
import { definePlot, type SettingsRecord } from "./contracts.ts";
import { clearPlotTypesForTest, registerPlotType, requirePlotType } from "./registry.ts";
import { defaultSettingsForNode } from "./settings.ts";
import { migrateCompareSettings } from "./image/definition/settings.ts";
import { defaultImageSettings } from "./image/runtime/register.ts";

type InlineSpec = Extract<DataSpec, { kind: "inline" }>;

/** The image plot's real settings schema, without its React views. */
function imageLikeDefinition(withMigration: boolean) {
  return definePlot<InlineSpec, number, SettingsRecord, number>({
    kind: "image",
    data: { validate: (value) => value as InlineSpec },
    settings: {
      defaults: defaultImageSettings,
      project: (settings) => migrateCompareSettings({ ...settings }),
      ...(withMigration ? { migrateSettings: migrateCompareSettings } : {}),
    },
    resolve: async () => 0,
    present: (content) => content,
  });
}

/** A compare node authored before HDR FLIP became its own public operation. */
const legacyNode: CompareNode = {
  kind: "compare",
  type: "image",
  presentation: "difference",
  operands: [
    { kind: "url", src: "reference.png" },
    { kind: "url", src: "prediction.png" },
  ],
  strategy: "reference",
  referenceIndex: 0,
  settings: { "compare.operation": "flip", "compare.flipMode": "hdr" },
};

test("a retired setting key never reaches the seeded record", () => {
  clearPlotTypesForTest();
  registerPlotType(imageLikeDefinition(true));
  const seeded = defaultSettingsForNode(legacyNode);
  assert.equal(seeded["compare.operation"], "flip-hdr");
  assert.equal("compare.flipMode" in seeded, false);
});

test("the seed migration also runs over shared settings merged on top", () => {
  clearPlotTypesForTest();
  registerPlotType(imageLikeDefinition(true));
  const plain: CompareNode = { ...legacyNode, settings: undefined };
  const seeded = defaultSettingsForNode(plain, {
    settings: { "compare.operation": "flip", "compare.flipMode": "hdr" },
  } as never);
  assert.equal(seeded["compare.operation"], "flip-hdr");
  assert.equal("compare.flipMode" in seeded, false);
});

test("a later choice of SDR FLIP is not coerced back by the read-side migration", () => {
  clearPlotTypesForTest();
  registerPlotType(imageLikeDefinition(true));
  const definition = requirePlotType("image");
  // The cell store merges patches into the seeded object, exactly like this.
  const stored = { ...defaultSettingsForNode(legacyNode), "compare.operation": "flip" };
  assert.equal(definition.projectSettings(stored)["compare.operation"], "flip");
});

test("a definition without a migration seeds its authored settings unchanged", () => {
  clearPlotTypesForTest();
  registerPlotType(imageLikeDefinition(false));
  const seeded = defaultSettingsForNode(legacyNode);
  assert.equal(seeded["compare.operation"], "flip");
  assert.equal(seeded["compare.flipMode"], "hdr");
});
