import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureTablePlotType, projectTableSettings } from "./register.ts";

test("table owns validated presentation and interaction settings", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureTablePlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("table");
  assert.ok(getReactPlotType("table"));
  const context = {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  };
  const table = {
    columns: [{ name: "loss", type: "number" }],
    data: [[1], [2]],
  };
  const content = await definition.resolve({
    kind: "plot", type: "table", data: { kind: "inline", props: { table } },
  }, context);
  assert.equal((definition.present(content) as { table: { data: unknown[] } }).table.data.length, 2);
  await assert.rejects(() => definition.resolve({
    kind: "plot",
    type: "table",
    data: { kind: "inline", props: { table: { ...table, data: [[1, 2]] } } },
  }, context), /match the column count/);

  assert.deepEqual(projectTableSettings({
    "table.sort": { column: "loss", direction: "desc" },
    "table.filter": "train",
    "table.page": 3,
    "image.colormap": "turbo",
  }), {
    "table.sort": { column: "loss", direction: "desc" },
    "table.filter": "train",
    "table.page": 3,
  });
  assert.deepEqual(projectTableSettings({
    "table.sort": { column: "loss", direction: "sideways" },
    "table.page": -1,
  }), {});

  const source = readFileSync(new URL("../register-core.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /CORE_RENDERERS/);
});
