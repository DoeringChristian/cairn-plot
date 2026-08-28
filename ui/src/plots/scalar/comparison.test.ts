import assert from "node:assert/strict";
import test from "node:test";

import type { CompareNode } from "../../../../packages/spec/src/spec.ts";
import { overlayScalarPresentations, planScalarComparison } from "./comparison.ts";

const node: CompareNode = {
  kind: "compare",
  renderer: "scalar",
  presentation: "overlay",
  a: { kind: "inline", props: { series: [] } },
  b: { kind: "inline", props: { series: [] } },
  props: { labelA: "train", labelB: "validation" },
};

test("scalar comparison overlays uniquely keyed, labelled series", () => {
  const plan = planScalarComparison(node);
  const result = overlayScalarPresentations(
    plan,
    { series: [{ key: "loss", label: "Loss", points: [] }], xAxis: "step" },
    { series: [{ key: "loss", label: "Loss", points: [] }] },
  );
  assert.equal(result.xAxis, "step");
  assert.deepEqual(result.series, [
    { key: "a:loss", label: "train · Loss", points: [] },
    { key: "b:loss", label: "validation · Loss", points: [] },
  ]);
});

test("scalar comparison owns its presentation and operand validation", () => {
  assert.throws(
    () => planScalarComparison({ ...node, presentation: "difference" }),
    /does not support "difference"/,
  );
  assert.throws(
    () => planScalarComparison({ ...node, b: { kind: "image", hash: "x" } }),
    /requires inline data/,
  );
});
