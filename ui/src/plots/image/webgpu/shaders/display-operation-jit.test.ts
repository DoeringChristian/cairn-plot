import assert from "node:assert/strict";
import { test } from "node:test";
import { getWebGpuDisplayOperation } from "../display.ts";
import { buildImageWGSL } from "./image.wgsl.ts";
import { requireWebGpuInlineOperation } from "../image-operations.ts";

test("image shaders specialize to one display operation", () => {
  const identity = requireWebGpuInlineOperation("identity");
  const aces = buildImageWGSL(getWebGpuDisplayOperation("aces")!, identity);
  const reinhard = buildImageWGSL(getWebGpuDisplayOperation("reinhard")!, identity);

  assert.notEqual(aces, reinhard);
  assert.match(aces, /let numerator = normalized \* \(2\.51 \* normalized \+ 0\.03\)/);
  assert.doesNotMatch(reinhard, /let numerator = normalized/);
  assert.doesNotMatch(aces, /operatorId|OPERATOR_ID/);
  assert.doesNotMatch(reinhard, /operatorId|OPERATOR_ID/);
});

test("image shaders specialize to one image operation", () => {
  const display = getWebGpuDisplayOperation("linear")!;
  const identity = buildImageWGSL(display, requireWebGpuInlineOperation("identity"));
  const signed = buildImageWGSL(display, requireWebGpuInlineOperation("signed"));
  assert.notEqual(identity, signed);
  assert.match(signed, /a\.rgb - b\.rgb/);
  assert.doesNotMatch(identity, /a\.rgb - b\.rgb/);
  assert.doesNotMatch(signed, /operationId|IMAGE_OPERATION_ID/);
});

test("lut and analytic display operations reach the shader through one seam", () => {
  const identity = requireWebGpuInlineOperation("identity");
  // Both implementation kinds emit the SAME two specialization functions
  // (`applyDisplayIndex` / `applyAnalyticDisplay`, see `display-shader.ts`), so
  // the shader never branches on an operation id at runtime.
  for (const id of ["magma", "red-green"]) {
    const shader = buildImageWGSL(getWebGpuDisplayOperation(id)!, identity);
    assert.match(shader, /fn applyDisplayIndex/);
    assert.match(shader, /fn applyAnalyticDisplay/);
    assert.doesNotMatch(shader, /operatorId|OPERATOR_ID/);
  }
});
