import assert from "node:assert/strict";
import test from "node:test";

import { computeCpuDisplayGeometry } from "./display-geometry.ts";

test("CPU display geometry uses one affine map for paint and texel centers", () => {
  const geometry = computeCpuDisplayGeometry(
    { width: 355, height: 402.5 },
    { width: 512, height: 512 },
    183.934,
    { x: 78.5184, y: -42_274.7 },
  )!;
  assert.deepEqual(geometry.home, { left: 0, top: 23.75, width: 355, height: 355 });
  assert.equal(geometry.quad.left, 78.5184);
  assert.equal(geometry.quad.top, -37_906.267499999994);
  assert.equal(geometry.quad.width, 65_296.57);
  assert.equal(geometry.quad.height, 65_296.57);
  const step = geometry.quad.width / geometry.grid.width;
  assert.equal(geometry.quad.left + step / 2, 142.284581640625);
});

test("CPU display geometry rejects incomplete layout", () => {
  assert.equal(computeCpuDisplayGeometry(
    { width: 0, height: 100 },
    { width: 8, height: 4 },
    1,
    { x: 0, y: 0 },
  ), null);
});
