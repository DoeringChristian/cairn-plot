import test from "node:test";
import assert from "node:assert/strict";
import { textureByteLength } from "./texture-bytes.ts";

test("textureByteLength accounts exactly by dimensions and format", () => {
  assert.equal(textureByteLength(10, 20, "rgba8unorm"), 800);
  assert.equal(textureByteLength(10, 20, "rgba16float"), 1600);
  assert.equal(textureByteLength(10, 20, "rgba32float"), 3200);
  assert.equal(textureByteLength(10, 20, "r32float"), 800);
});

test("textureByteLength rejects invalid dimensions", () => {
  assert.throws(() => textureByteLength(-1, 2, "rgba8unorm"));
  assert.throws(() => textureByteLength(1.5, 2, "rgba8unorm"));
});
