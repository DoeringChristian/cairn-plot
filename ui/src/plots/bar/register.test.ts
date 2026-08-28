import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureBarPlotType } from "./register.ts";

test("bar is a typed inline plot with chart-only settings", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureBarPlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("bar");
  assert.ok(getReactPlotType("bar"));
  const context = {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  };
  const content = await definition.resolve({
    kind: "plot",
    type: "bar",
    data: { kind: "inline", props: { bars: [{ id: "r", label: "run", value: 2 }] } },
  }, context);
  assert.equal((definition.present(content) as { bars: unknown[] }).bars.length, 1);
  await assert.rejects(() => definition.resolve({
    kind: "plot",
    type: "bar",
    data: { kind: "inline", props: { bars: [{ id: "bad", value: "2" }] } },
  }, context), /typed bars array/);

  const source = readFileSync(new URL("../register-core.tsx", import.meta.url), "utf8");
  const coreMap = source.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bbar\s*:/);
});
