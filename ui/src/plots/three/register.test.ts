import assert from "node:assert/strict";
import test from "node:test";

import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { ensureThreePlotTypes } from "./register.ts";

test("3D kinds own typed definitions before the optional backend addon loads", () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureThreePlotTypes();
  for (const kind of ["pointcloud", "mesh", "volume", "boxes3d"] as const) {
    const definition = requirePlotType(kind);
    assert.equal(definition.kind, kind);
    assert.equal(getReactPlotType(kind)?.backends.length, 0);
    assert.throws(
      () => definition.validateData({ kind: "npz", hash: "x", objectType: kind === "mesh" ? "volume" : "mesh", meta: {} }),
      /requires npz data/,
    );
  }
});
