import assert from "node:assert/strict";
import test from "node:test";

import { turboDataIndex } from "./display-math.ts";

test("turboDataIndex preserves tev's additive 2^-5 log offset", () => {
  assert.equal(turboDataIndex(0), 0);
  assert.ok(Math.abs(turboDataIndex(0.03125) - 0.1) < 1e-12);
  assert.ok(Math.abs(turboDataIndex(1) - (Math.log2(1.03125) / 10 + 0.5)) < 1e-12);
  assert.equal(turboDataIndex(31.96875), 1);
});
