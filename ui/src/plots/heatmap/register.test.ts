import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureHeatmapPlotType } from "./register.ts";

test("heatmap is a typed inline plot with a rectangular numeric matrix", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureHeatmapPlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("heatmap");
  assert.ok(getReactPlotType("heatmap"));
  const context = {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  };
  const content = await definition.resolve({
    kind: "plot",
    type: "heatmap",
    data: { kind: "inline", props: { matrix: [[1, 2], [3, 4]] } },
  }, context);
  assert.equal((definition.present(content) as { matrix: unknown[] }).matrix.length, 2);
  await assert.rejects(() => definition.resolve({
    kind: "plot",
    type: "heatmap",
    data: { kind: "inline", props: { matrix: [[1], [2, 3]] } },
  }, context), /equal length/);

  const source = readFileSync(new URL("../register-core.tsx", import.meta.url), "utf8");
  const coreMap = source.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bheatmap\s*:/);
});
