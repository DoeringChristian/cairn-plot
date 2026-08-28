import assert from "node:assert/strict";
import test from "node:test";

import type { CompareNode } from "../../../../packages/spec/src/spec.ts";
import { planImageComparison } from "./comparison-plan.ts";

const image = (hash: string) => ({ kind: "image" as const, hash });

test("image comparison planning owns baseline ordering and presentation", () => {
  const node: CompareNode = {
    kind: "compare",
    mode: "diff",
    a: image("a"),
    b: image("b"),
    baselineIndex: 1,
    props: { labelA: "candidate", labelB: "reference" },
  };
  const plan = planImageComparison(node);
  assert.equal(plan.presentation, "difference");
  assert.equal((plan.reference as { hash: string }).hash, "b");
  assert.equal((plan.foreground as { hash: string }).hash, "a");
  assert.equal(plan.referenceLabel, "reference");
  assert.equal(plan.foregroundLabel, "candidate");
  assert.equal(plan.leaf.data, plan.reference);
});

test("image comparison plans are identity-stable for cache-safe stack flips", () => {
  const node: CompareNode = { kind: "compare", mode: "split", a: image("a"), b: image("b") };
  assert.equal(planImageComparison(node), planImageComparison(node));
  assert.equal(planImageComparison(node).leaf, planImageComparison(node).leaf);
});
