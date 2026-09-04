import { test } from "node:test";
import assert from "node:assert/strict";
import { placeBox } from "./image-overlay-placement.ts";

const quad = { left: 10, top: 20, width: 200, height: 100 };
const natural = { w: 100, h: 50 };

test("placeBox maps a fraction-domain box onto the quad", () => {
  const r = placeBox(
    { position: { minX: 0.25, minY: 0.5, maxX: 0.75, maxY: 1 }, class_id: 1 },
    quad,
    natural,
  );
  assert.deepEqual(r, { left: 60, top: 70, width: 100, height: 50 });
});

test("placeBox maps a pixel-domain box through the texel size", () => {
  const r = placeBox(
    { position: { minX: 10, minY: 5, maxX: 20, maxY: 25 }, domain: "pixel", class_id: 1 },
    quad,
    natural,
  );
  assert.deepEqual(r, { left: 30, top: 30, width: 20, height: 40 });
});
