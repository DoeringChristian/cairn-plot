import assert from "node:assert/strict";
import test from "node:test";

import type { PlotSpec } from "../../spec/src/spec.ts";
import { createPlotController } from "./controller.ts";

const SPEC: PlotSpec = {
  version: 1,
  layout: {
    kind: "grid",
    children: [
      { kind: "pane", pane: "a" },
      { kind: "pane", pane: "b" },
      { kind: "pane", pane: "c" },
    ],
  },
  panes: {
    a: { id: "a", kind: "image", sources: [], settings: { "image.exposureEV": 1 } },
    b: { id: "b", kind: "image", sources: [] },
    c: { id: "c", kind: "image", sources: [] },
  },
  links: [{ id: "images", panes: ["a", "b"], keys: ["image.*"] }],
};

test("authored settings and session overrides have distinct lifetimes", () => {
  const controller = createPlotController({ spec: SPEC });
  assert.equal(controller.getSettings("a")["image.exposureEV"], 1);
  controller.dispatch({
    type: "settings.patch",
    panes: ["a"],
    patch: { "image.exposureEV": 3 },
  });
  assert.equal(controller.getSettings("a")["image.exposureEV"], 3);
  assert.equal(controller.getSpec().panes.a.settings?.["image.exposureEV"], 1);

  controller.dispatch({ type: "settings.reset", panes: ["a"], keys: ["image.exposureEV"] });
  assert.equal(controller.getSettings("a")["image.exposureEV"], 1);
});

test("named links expand a settings command atomically", () => {
  const controller = createPlotController({ spec: SPEC });
  const changes: string[][] = [];
  controller.subscribe((change) => changes.push(change.affectedPanes));
  controller.dispatch({
    type: "settings.patch",
    panes: ["a"],
    patch: { "image.offset": 0.25 },
  });
  assert.equal(controller.getSettings("a")["image.offset"], 0.25);
  assert.equal(controller.getSettings("b")["image.offset"], 0.25);
  assert.equal(controller.getSettings("c")["image.offset"], 0);
  assert.deepEqual(changes, [["a", "b"]]);
});

test("spec replacement preserves valid overrides and prunes removed panes", () => {
  const controller = createPlotController({ spec: SPEC });
  controller.dispatch({ type: "settings.patch", panes: ["a", "c"], patch: { "image.offset": 2 } });
  const next: PlotSpec = {
    ...SPEC,
    layout: { kind: "pane", pane: "a" },
    panes: { a: SPEC.panes.a },
    links: [],
  };
  controller.updateSpec(next);
  assert.equal(controller.getSession().overrides.a["image.offset"], 2);
  assert.equal(controller.getSession().overrides.c, undefined);
});

test("selection and reference remain session-only", () => {
  const controller = createPlotController({ spec: SPEC });
  controller.dispatch({ type: "selection.set", panes: ["a", "b"] });
  assert.deepEqual(controller.getSession().selection, { order: ["a", "b"], reference: "b" });
  controller.dispatch({ type: "reference.set", pane: "a" });
  assert.equal(controller.getSession().selection.reference, "a");
  assert.equal("selection" in controller.getSpec(), false);
});

test("settings changes publish renderer-neutral invalidation", () => {
  const controller = createPlotController({ spec: SPEC });
  const seen: string[] = [];
  controller.subscribe((change) => seen.push(change.invalidation));
  controller.dispatch({ type: "settings.patch", panes: ["a"], patch: { "image.exposureEV": 2 } });
  controller.dispatch({ type: "settings.patch", panes: ["a"], patch: { "panel.info": true } });
  assert.deepEqual(seen, ["presentation", "layout"]);
});

test("stage is ephemeral session state", () => {
  const controller = createPlotController({ spec: SPEC });
  controller.dispatch({ type: "stage.open", mode: "compare", panes: ["a", "b"] });
  assert.deepEqual(controller.getSession().stage, { mode: "compare", panes: ["a", "b"] });
  controller.dispatch({ type: "stage.close" });
  assert.equal(controller.getSession().stage, null);
});
