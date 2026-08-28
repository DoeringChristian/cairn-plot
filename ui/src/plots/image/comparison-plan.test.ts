import assert from "node:assert/strict";
import test from "node:test";

import type { ComparisonRequest } from "../contracts.ts";
import { planImageComparison } from "./comparison-plan.ts";

const image = (hash: string) => ({ kind: "image" as const, hash });

test("image comparison planning owns baseline ordering and presentation", () => {
  const request: ComparisonRequest = {
    renderer: "image",
    operands: [image("a"), image("b")],
    strategy: "reference",
    referenceIndex: 1,
    presentation: "difference",
    props: { labelA: "candidate", labelB: "reference" },
  };
  const plan = planImageComparison(request).outputs[0]!.plan;
  assert.equal(plan.presentation, "difference");
  assert.equal((plan.reference as { hash: string }).hash, "b");
  assert.equal((plan.foreground as { hash: string }).hash, "a");
  assert.equal(plan.referenceLabel, "reference");
  assert.equal(plan.foregroundLabel, "candidate");
  assert.equal(plan.leaf.data, plan.reference);
});

test("image reference comparison plans one output per non-reference operand", () => {
  const result = planImageComparison({
    renderer: "image",
    operands: [image("a"), image("b"), image("c")],
    strategy: "reference",
    referenceIndex: 1,
    presentation: "split",
    props: {},
  });
  assert.equal(result.layout, "grid");
  assert.deepEqual(result.outputs.map(({ plan }) => (plan.foreground as { hash: string }).hash), ["a", "c"]);
  assert.deepEqual(result.outputs.map(({ operandIndices }) => operandIndices), [[1, 0], [1, 2]]);
  assert.ok(result.outputs.every(({ plan }) => plan.reference === result.outputs[0]!.plan.reference));
});
