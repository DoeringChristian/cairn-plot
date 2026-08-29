import assert from "node:assert/strict";
import test from "node:test";

import type { CompareNode, PlotLeafNode } from "../../../../../packages/spec/src/spec.ts";
import { defaultImageSettings } from "./register.ts";

const image: PlotLeafNode = {
  kind: "plot",
  type: "image",
  data: { kind: "url", src: "image.png" },
};

const compare = (presentation: "split" | "difference"): CompareNode => ({
  kind: "compare",
  type: "image",
  presentation,
  operands: [
    { kind: "url", src: "reference.png" },
    { kind: "url", src: "prediction.png" },
  ],
  strategy: "reference",
  referenceIndex: 0,
});

test("image definition owns neutral HOME settings", () => {
  const settings = defaultImageSettings(image);
  assert.equal(settings["image.encoding"], "srgb");
  assert.deepEqual(settings["image.view"], { zoom: 1, pan: { x: 0, y: 0 } });
});

test("comparison presentation selects an operation but never a colormap", () => {
  const split = defaultImageSettings(compare("split"));
  const difference = defaultImageSettings(compare("difference"));
  assert.equal(split["compare.operation"], "split");
  assert.equal(difference["compare.operation"], "absolute");
  assert.equal(split["image.encoding"], difference["image.encoding"]);
});
