import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureParallelPlotType } from "./register.ts";

test("parallel validates aligned typed columns, rows, and domains", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureParallelPlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("parallel");
  assert.ok(getReactPlotType("parallel"));
  assert.deepEqual(definition.defaults(), {});
  const context = {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  };
  const base = {
    columns: [{ key: "loss", source: "metric" }],
    rows: [{ id: "r", values: [1], raw: ["1"] }],
    columnDomains: [{ min: 0, max: 2, isNumeric: true }],
  };
  const content = await definition.resolve({
    kind: "plot", renderer: "parallel", data: { kind: "inline", props: base },
  }, context);
  assert.equal((definition.present(content) as { rows: unknown[] }).rows.length, 1);
  await assert.rejects(() => definition.resolve({
    kind: "plot",
    renderer: "parallel",
    data: { kind: "inline", props: { ...base, columnDomains: [] } },
  }, context), /match the column count/);

  const source = readFileSync(new URL("../register-core.tsx", import.meta.url), "utf8");
  const coreMap = source.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bparallel\s*:/);
});
