// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataSpec } from "../../../packages/spec/src/spec.ts";
import type { PlotBackend } from "../backends/contracts.ts";
import { definePlot, type SettingsRecord } from "./contracts.ts";
import {
  clearPlotTypesForTest,
  onPlotTypeRegister,
  planComparison,
  registerPlotType,
  requirePlotType,
} from "./registry.ts";

type InlineSpec = Extract<DataSpec, { kind: "inline" }>;
type TestSettings = SettingsRecord & { value: number };

const backend: PlotBackend<number, TestSettings> = {
  id: "test",
  family: "test",
  technology: "dom",
  supports: () => ({ supported: true }),
  canReuse: () => true,
  mount: () => ({ update() {}, destroy() {} }),
};

function testDefinition() {
  return definePlot<InlineSpec, number, TestSettings, number>({
    kind: "test",
    data: {
      validate(value) {
        if (value.kind !== "inline") throw new Error("expected inline data");
        return value;
      },
    },
    settings: {
      defaults: () => ({ value: 1 }),
      project: (settings) => ({ value: typeof settings.value === "number" ? settings.value : 1 }),
    },
    resolve: async (spec) => Number(spec.props.value ?? 0),
    present: (content) => content,
    backends: [backend],
  });
}

function comparableDefinition(accepted = true) {
  const definition = testDefinition();
  return {
    ...definition,
    comparison: {
      presentations: [{ id: "overlay", label: "Overlay", minOperands: 2, maxOperands: 2 }],
      accepts: () => accepted
        ? { accepted: true }
        : { accepted: false, reason: "operands do not align" },
      plan: () => ({ operation: "overlay" }),
      resolve: async () => 0,
    },
  };
}

const comparisonNode = {
  kind: "compare" as const,
  renderer: "test",
  mode: "split" as const,
  a: { kind: "inline" as const, props: { value: 1 } },
  b: { kind: "inline" as const, props: { value: 2 } },
};

test("plot registry contains type erasure at one checked adapter", async () => {
  clearPlotTypesForTest();
  registerPlotType(testDefinition());
  const registered = requirePlotType("test");
  assert.deepEqual(registered.defaults(), { value: 1 });
  const content = await registered.resolve(
    { kind: "plot", renderer: "test", data: { kind: "inline", props: { value: 4 } } },
    {
      source: {
        artifactUrl: () => null,
        bytes: async () => new ArrayBuffer(0),
      },
      signal: new AbortController().signal,
    },
  );
  assert.equal(registered.present(content), 4);
});

test("duplicate plot kinds fail instead of silently replacing behavior", () => {
  clearPlotTypesForTest();
  registerPlotType(testDefinition());
  assert.throws(() => registerPlotType(testDefinition()), /duplicate plot type/);
});

test("registration subscriptions support lazy plot definitions", () => {
  clearPlotTypesForTest();
  let notifications = 0;
  const unsubscribe = onPlotTypeRegister(() => notifications++);
  registerPlotType(testDefinition());
  unsubscribe();
  assert.equal(notifications, 1);
});

test("comparison planning is selected by the authored plot kind", () => {
  clearPlotTypesForTest();
  registerPlotType(comparableDefinition());
  const planned = planComparison(comparisonNode);
  assert.equal(planned.renderer, "test");
  assert.deepEqual(planned.plan, { operation: "overlay" });
});

test("legacy comparisons select the image plot kind", () => {
  clearPlotTypesForTest();
  registerPlotType({ ...comparableDefinition(), kind: "image" });
  assert.equal(planComparison({ ...comparisonNode, renderer: undefined }).renderer, "image");
});

test("comparison planning reports missing and rejected capabilities", () => {
  clearPlotTypesForTest();
  registerPlotType(testDefinition());
  assert.throws(() => planComparison(comparisonNode), /does not support comparison/);
  clearPlotTypesForTest();
  registerPlotType(comparableDefinition(false));
  assert.throws(() => planComparison(comparisonNode), /operands do not align/);
});
