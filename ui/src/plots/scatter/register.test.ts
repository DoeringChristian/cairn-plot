import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureScatterPlotType } from "./register.ts";

test("scatter is a typed inline plot with chart-only settings", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureScatterPlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("scatter");
  assert.ok(getReactPlotType("scatter"));
  assert.deepEqual(definition.defaults(), {});
  const content = await definition.resolve({
    kind: "plot",
    type: "scatter",
    data: {
      kind: "inline",
      props: { points: [{ id: "p", x: 1, y: 2, color: null }] },
    },
  }, {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  });
  assert.equal((definition.present(content) as { points: unknown[] }).points.length, 1);
  await assert.rejects(() => definition.resolve({
    kind: "plot",
    type: "scatter",
    data: { kind: "inline", props: { points: [{ id: "bad" }] } },
  }, {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  }), /typed points array/);

  const legacySource = readFileSync(new URL("../register-core.tsx", import.meta.url), "utf8");
  const coreMap = legacySource.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bscatter\s*:/);
});
