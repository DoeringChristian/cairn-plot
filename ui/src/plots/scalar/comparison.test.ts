import assert from "node:assert/strict";
import test from "node:test";

import type { ComparisonRequest } from "../contracts.ts";
import { overlayScalarPresentations, planScalarComparison } from "./comparison.ts";

const request: ComparisonRequest = {
  renderer: "scalar",
  presentation: "overlay",
  operands: [
    { kind: "inline", props: { series: [] } },
    { kind: "inline", props: { series: [] } },
  ],
  strategy: "all",
  props: { labelA: "train", labelB: "validation" },
};

test("scalar comparison overlays uniquely keyed, labelled series", () => {
  const plan = planScalarComparison(request).outputs[0]!.plan;
  const result = overlayScalarPresentations(
    plan,
    [
      { series: [{ key: "loss", label: "Loss", color: "#fff", points: [] }], xAxis: "step" },
      { series: [{ key: "loss", label: "Loss", color: "#000", points: [] }] },
    ],
  );
  assert.equal(result.xAxis, "step");
  assert.deepEqual(result.series, [
    { key: "0:loss", label: "train · Loss", color: "#fff", points: [] },
    { key: "1:loss", label: "validation · Loss", color: "#000", points: [] },
  ]);
});

test("scalar comparison owns its presentation and operand validation", () => {
  assert.throws(
    () => planScalarComparison({ ...request, presentation: "difference" }),
    /does not support "difference"/,
  );
  assert.throws(
    () => planScalarComparison({
      ...request,
      operands: [request.operands[0]!, { kind: "image", hash: "x" }],
    }),
    /requires inline data/,
  );
});
