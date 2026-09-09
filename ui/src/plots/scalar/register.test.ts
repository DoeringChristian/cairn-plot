import assert from "node:assert/strict";
import test from "node:test";

import type { JsonValue } from "../../../../packages/spec/src/json.ts";
import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { RegisteredPlotDefinition } from "../contracts.ts";
import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureScalarPlotType } from "./register.ts";

function scalarDefinition(): RegisteredPlotDefinition {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureScalarPlotType(() => null);
  return requirePlotType("scalar");
}

function inlineScalar(points: JsonValue[], props: Record<string, JsonValue> = {}): DataSpec {
  return {
    kind: "inline",
    props: {
      series: [{ key: "loss", label: "Loss", color: "#000", points }],
      ...props,
    },
  };
}

test("scalar definition registers overlay comparison through the typed registry", async () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureScalarPlotType(() => null);
  const definition = requirePlotType("scalar");
  assert.ok(getReactPlotType("scalar"));
  assert.deepEqual(definition.comparison?.presentations.map(({ id }) => id), ["overlay"]);
  const node = {
    kind: "compare" as const,
    type: "scalar",
    presentation: "overlay",
    operands: [
      { kind: "inline" as const, props: { series: [] } },
      { kind: "inline" as const, props: { series: [] } },
    ],
    strategy: "all" as const,
  };
  const request = {
    type: "scalar",
    operands: node.operands,
    strategy: "all" as const,
    presentation: "overlay",
    props: {},
  };
  const plan = definition.comparison!.plan(request);
  const result = await definition.comparison!.resolve(plan.outputs[0]!.plan, {
    source: { artifactUrl: () => null, bytes: async () => new ArrayBuffer(0) },
    signal: new AbortController().signal,
  });
  assert.deepEqual(result, { series: [] });
});

test("scalar content id summarises two deep copies of the same samples identically", () => {
  const definition = scalarDefinition();
  const points = [
    { x: 0, y: 1, wallTime: "2026-01-01T00:00:00Z", context: "train" },
    { x: 1, y: 2, wallTime: "2026-01-01T00:00:01Z", context: "train" },
    { x: 2, y: 3, wallTime: "2026-01-01T00:00:02Z", context: "train" },
  ];
  const first = inlineScalar(points, { smoothing: 0.5 });
  const copy = structuredClone(first);
  assert.equal(definition.contentId!(first), definition.contentId!(copy));
});

test("scalar content id changes when a point is appended", () => {
  const definition = scalarDefinition();
  const before = definition.contentId!(inlineScalar([{ x: 0, y: 1 }, { x: 1, y: 2 }]));
  const after = definition.contentId!(inlineScalar([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }]));
  assert.notEqual(before, after);
});

test("scalar content id ignores wallTime and context", () => {
  const definition = scalarDefinition();
  const bare = definition.contentId!(inlineScalar([{ x: 0, y: 1 }, { x: 1, y: 2 }]));
  const annotated = definition.contentId!(inlineScalar([
    { x: 0, y: 1, wallTime: "2026-01-01T00:00:00Z", context: "eval" },
    { x: 1, y: 2, wallTime: "2026-01-01T00:00:09Z", context: null },
  ]));
  assert.equal(bare, annotated);
});

test("scalar content id includes the non-series props", () => {
  const definition = scalarDefinition();
  const points = [{ x: 0, y: 1 }, { x: 1, y: 2 }];
  const smoothed = definition.contentId!(inlineScalar(points, { smoothing: 0.5 }));
  const raw = definition.contentId!(inlineScalar(points, { smoothing: 0 }));
  const none = definition.contentId!(inlineScalar(points));
  assert.notEqual(smoothed, raw);
  assert.notEqual(smoothed, none);
});

test("scalar content id is null for data kinds the scalar plot cannot summarise", () => {
  const definition = scalarDefinition();
  assert.equal(definition.contentId!({ kind: "image", hash: "abc" }), null);
  assert.equal(definition.contentId!({ kind: "inline", props: { series: "not an array" } }), null);
});

test("scalar content id summarises 10 x 100k points without serialising them", () => {
  const definition = scalarDefinition();
  const series: JsonValue[] = Array.from({ length: 10 }, (_unused, index) => ({
    key: `series-${index}`,
    label: `Series ${index}`,
    color: "#000",
    points: Array.from({ length: 100_000 }, (_point, step) => ({ x: step, y: step * 0.5 })),
  }));
  const data: DataSpec = { kind: "inline", props: { series, smoothing: 0.5 } };
  const started = performance.now();
  const id = definition.contentId!(data);
  const elapsed = performance.now() - started;
  assert.ok(id?.startsWith("scalar:series-0|100000|0|99999|49999.5"), `unexpected id ${id}`);
  assert.ok(elapsed < 20, `contentId took ${elapsed.toFixed(2)}ms for 10 x 100k points`);
});
