import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./rhi.ts", import.meta.url), "utf8");

test("the reusable WebGPU RHI has no image or comparison semantics", () => {
  for (const forbidden of [
    "computeHistogram",
    "computeDepthHistogram",
    "renderDiff",
    "ensureSsim",
    "setSource",
    "colormap",
    "exposure",
  ]) {
    assert.equal(source.includes(forbidden), false, `RHI must not expose ${forbidden}`);
  }
});
