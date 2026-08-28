import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultReduceForDisplayOperation, prepareDisplayOperation } from "./prepare-display-operation.ts";

test("all display operations prepare through one engine seam", () => {
  const linear = prepareDisplayOperation("linear", { hdrSurface: true });
  assert.deepEqual(linear, { displayOperationId: "linear", isScalar: false, hdrOut: true });

  const magma = prepareDisplayOperation("magma", { hdrSurface: true });
  assert.equal(magma.isScalar, true);
  assert.equal(magma.hdrOut, false);
  assert.ok(magma.colormap instanceof Float32Array);

  const analytic = prepareDisplayOperation("red-green", { hdrSurface: true });
  assert.equal(analytic.isScalar, true);
  assert.equal(analytic.analytic, true);
  assert.equal(analytic.hdrOut, true);
  assert.equal(analytic.colormap, undefined);
});

test("display operations own their reduction default", () => {
  assert.equal(defaultReduceForDisplayOperation("turbo", 3), "mean");
  assert.equal(defaultReduceForDisplayOperation("magma", 3), "luminance");
});

test("an unknown display operation fails at the preparation boundary", () => {
  assert.throws(
    () => prepareDisplayOperation("none", { hdrSurface: false }),
    /unknown display operation/,
  );
});
