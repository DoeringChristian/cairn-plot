import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureHistogramPlotType } from "./register.ts";

test("histogram validates and normalizes its discriminated presentation", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureHistogramPlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("histogram");
  assert.ok(getReactPlotType("histogram"));
  const context = {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  };
  const content = await definition.resolve({
    kind: "plot",
    type: "histogram",
    data: { kind: "inline", props: { counts: [1, 2], edges: [0, 1, 2] } },
  }, context);
  assert.equal((definition.present(content) as { view: string }).view, "bars");
  await assert.rejects(() => definition.resolve({
    kind: "plot",
    type: "histogram",
    data: { kind: "inline", props: { view: "heatmap", perStep: [] } },
  }, context), /perStep data and a colormap/);

  const source = readFileSync(new URL("../register-core.tsx", import.meta.url), "utf8");
  const coreMap = source.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bhistogram\s*:/);
});
