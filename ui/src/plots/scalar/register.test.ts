import assert from "node:assert/strict";
import test from "node:test";

import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureScalarPlotType } from "./register.ts";

test("scalar definition registers overlay comparison through the typed registry", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureScalarPlotType(() => null, async (spec) => spec.props);
  const definition = requirePlotType("scalar");
  assert.ok(getReactPlotType("scalar"));
  assert.deepEqual(definition.comparison?.presentations.map(({ id }) => id), ["overlay"]);
  const node = {
    kind: "compare" as const,
    renderer: "scalar",
    presentation: "overlay",
    a: { kind: "inline" as const, props: { series: [] } },
    b: { kind: "inline" as const, props: { series: [] } },
  };
  const plan = definition.comparison!.plan(node);
  const result = await definition.comparison!.resolve(plan, {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  });
  assert.deepEqual(result, { series: [] });
});
