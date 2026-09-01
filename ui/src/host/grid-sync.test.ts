import assert from "node:assert/strict";
import test from "node:test";

import { gridSyncGroups } from "./grid-sync.ts";

test("authored grid settings sync links every setting through one group", () => {
  assert.deepEqual(gridSyncGroups({ settings: true }, "card"), {
    viewSettingsGroupId: null,
    settingsGroupId: "plot-grid-settings-card",
  });
});

test("view-only sync remains scoped when full settings sync is disabled", () => {
  assert.deepEqual(gridSyncGroups({ view: true }, "card"), {
    viewSettingsGroupId: "plot-grid-view-card",
    settingsGroupId: null,
  });
});
