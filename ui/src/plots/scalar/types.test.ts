import assert from "node:assert/strict";
import test from "node:test";

import { projectScalarSettings, scalarPresentation } from "./types.ts";

test("scalar presentation validates its typed series boundary", () => {
  const value = {
    series: [{ key: "loss", label: "Loss", color: "#fff", points: [] }],
    xAxis: "step",
  };
  assert.equal(scalarPresentation(value).series[0]?.key, "loss");
  assert.throws(() => scalarPresentation({ series: [{ key: "loss" }] }), /typed series array/);
});

test("scalar settings projection keeps only valid chart domains", () => {
  assert.deepEqual(projectScalarSettings({
    "chart.domainX": [1, 2],
    "chart.domainY": null,
    "image.encoding": "magma",
  }), {
    "chart.domainX": [1, 2],
    "chart.domainY": null,
  });
  assert.deepEqual(projectScalarSettings({ "chart.domainX": [1, Number.NaN] }), {});
});
