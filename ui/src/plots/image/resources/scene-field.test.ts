import { test } from "node:test";
import assert from "node:assert/strict";

import { imageDataToSceneField } from "./scene-field.ts";

test("browser bytes normalize to a scene-linear float field", () => {
  const image = { data: new Uint8ClampedArray([0, 128, 255, 64]), width: 1, height: 1 };
  const field = imageDataToSceneField(image);
  assert.equal(field.width, 1);
  assert.equal(field.height, 1);
  assert.equal(field.pixels[0], 0);
  assert.ok(Math.abs(field.pixels[1]! - 0.2158605) < 1e-6);
  assert.equal(field.pixels[2], 1);
  assert.ok(Math.abs(field.pixels[3]! - 64 / 255) < 1e-7);
});
