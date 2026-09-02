import test from "node:test";
import assert from "node:assert/strict";

import {
  comparisonOperationSettingsPatch,
  recommendedImageEncoding,
} from "./operation-display-defaults.ts";

test("comparison operations receive semantic display defaults", () => {
  assert.equal(recommendedImageEncoding({ operation: "split", authoredSourceEncoding: "srgb" }), "srgb");
  assert.equal(recommendedImageEncoding({ operation: "signed" }), "red-green");
  assert.equal(recommendedImageEncoding({ operation: "relative_signed" }), "red-green");
  for (const operation of ["absolute", "squared", "relative_absolute", "relative_squared", "flip", "ssim"]) {
    assert.equal(recommendedImageEncoding({ operation }), "magma", operation);
  }
  assert.equal(recommendedImageEncoding({ operation: "flip", flipMode: "hdr" }), "magma");
});

test("operation transitions follow defaults but preserve custom encodings", () => {
  assert.deepEqual(comparisonOperationSettingsPatch({
    previousOperation: "split",
    nextOperation: "flip",
    currentEncoding: "srgb",
  }), { "compare.operation": "flip", "image.encoding": "magma" });

  assert.deepEqual(comparisonOperationSettingsPatch({
    previousOperation: "flip",
    nextOperation: "signed",
    currentEncoding: "magma",
  }), { "compare.operation": "signed", "image.encoding": "red-green" });

  assert.deepEqual(comparisonOperationSettingsPatch({
    previousOperation: "flip",
    nextOperation: "signed",
    currentEncoding: "turbo",
  }), { "compare.operation": "signed", "image.encoding": "turbo" });
});
