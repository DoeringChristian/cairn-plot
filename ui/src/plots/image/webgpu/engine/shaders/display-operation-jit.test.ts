import assert from "node:assert/strict";
import { test } from "node:test";
import { getDisplayOperation } from "../../../model/display-operations/index.ts";
import { buildCompareWGSL } from "./compare.wgsl.ts";
import { buildImageWGSL } from "./image.wgsl.ts";

test("image shaders specialize to one display operation", () => {
  const aces = buildImageWGSL(getDisplayOperation("aces")!);
  const reinhard = buildImageWGSL(getDisplayOperation("reinhard")!);

  assert.notEqual(aces, reinhard);
  assert.match(aces, /let numerator = v \* \(2\.51 \* v \+ 0\.03\)/);
  assert.doesNotMatch(reinhard, /let numerator = v \* \(2\.51 \* v \+ 0\.03\)/);
  assert.doesNotMatch(aces, /operatorId|OPERATOR_ID/);
  assert.doesNotMatch(reinhard, /operatorId|OPERATOR_ID/);
});

test("split and blend shaders use the same operation specialization seam", () => {
  const operation = getDisplayOperation("magma")!;
  for (const mode of ["split", "blend"] as const) {
    const shader = buildCompareWGSL(mode, operation);
    assert.match(shader, /fn applyDisplayIndex/);
    assert.doesNotMatch(shader, /operatorId|OPERATOR_ID/);
  }
});
