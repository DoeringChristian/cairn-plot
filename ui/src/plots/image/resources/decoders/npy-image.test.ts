import { test } from "node:test";
import assert from "node:assert/strict";
import { npyArrayToDecoded, isU8Dtype } from "./npy-image.ts";

test("isU8Dtype", () => {
  assert.equal(isU8Dtype("|u1"), true); assert.equal(isU8Dtype("|i1"), true); assert.equal(isU8Dtype("|b1"), true);
  assert.equal(isU8Dtype("<f4"), false); assert.equal(isU8Dtype("<u2"), false);
});
test("npyArrayToDecoded maps u8 and float arrays", () => {
  const u8 = npyArrayToDecoded({ dtype: "|u1", shape: [1, 2, 3], fortranOrder: false, data: Float64Array.from([1, 2, 3, 4, 5, 6]) });
  assert.equal(u8.kind, "u8"); assert.equal(u8.width, 2); assert.equal(u8.height, 1);
  const f = npyArrayToDecoded({ dtype: "<f4", shape: [2, 2], fortranOrder: false, data: Float64Array.from([0.5, 1, 2, 4]) });
  assert.equal(f.kind, "f32"); if (f.kind === "f32") { assert.equal(f.channels, 1); assert.equal(f.precision, "f32"); }
  assert.throws(() => npyArrayToDecoded({ dtype: "<f4", shape: [4], fortranOrder: false, data: new Float64Array(4) }), /2D|3D/);
});
