// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataSpec } from "../../../packages/spec/src/spec.ts";
import type { PlotBackend } from "../backends/contracts.ts";
import { definePlot, type SettingsRecord } from "./contracts.ts";
import {
  clearPlotTypesForTest,
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

test("plot registry contains type erasure at one checked adapter", async () => {
  clearPlotTypesForTest();
  registerPlotType(testDefinition());
  const registered = requirePlotType("test");
  assert.deepEqual(registered.defaults(), { value: 1 });
  const content = await registered.resolve(
    { kind: "plot", renderer: "test", data: { kind: "inline", props: { value: 4 } } },
    { source: {}, signal: new AbortController().signal },
  );
  assert.equal(registered.present(content), 4);
});

test("duplicate plot kinds fail instead of silently replacing behavior", () => {
  clearPlotTypesForTest();
  registerPlotType(testDefinition());
  assert.throws(() => registerPlotType(testDefinition()), /duplicate plot type/);
});

