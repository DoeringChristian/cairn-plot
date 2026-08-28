import assert from "node:assert/strict";
import { test } from "node:test";
import { getWebGpuDisplayOperation } from "../../display.ts";
import { buildCompareWGSL } from "./compare.wgsl.ts";
import { buildImageWGSL } from "./image.wgsl.ts";

test("image shaders specialize to one display operation", () => {
  const aces = buildImageWGSL(getWebGpuDisplayOperation("aces")!);
  const reinhard = buildImageWGSL(getWebGpuDisplayOperation("reinhard")!);

  assert.notEqual(aces, reinhard);
  assert.match(aces, /let numerator = normalized \* \(2\.51 \* normalized \+ 0\.03\)/);
  assert.doesNotMatch(reinhard, /let numerator = normalized/);
  assert.doesNotMatch(aces, /operatorId|OPERATOR_ID/);
  assert.doesNotMatch(reinhard, /operatorId|OPERATOR_ID/);
});

test("split and blend shaders use the same operation specialization seam", () => {
  const operation = getWebGpuDisplayOperation("magma")!;
  for (const mode of ["split", "blend"] as const) {
    const shader = buildCompareWGSL(mode, operation);
    assert.match(shader, /fn applyDisplayIndex/);
    assert.doesNotMatch(shader, /operatorId|OPERATOR_ID/);
  }
});
