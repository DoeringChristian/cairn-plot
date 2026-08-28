import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

test("the public host drives the production plot tree without exposing cells", () => {
  const host = read("PlotHost.tsx");
  const surface = read("../host/PlotSurface.tsx");
  const api = read("index.ts");

  assert.match(host, /<PlotSurface/);
  assert.match(surface, /SharedPlotContext\.Provider/);
  assert.match(surface, /PlotNodeView/);
  assert.doesNotMatch(host + surface + api, /PlotController|PlotSettings|RendererRegistry/);
  assert.match(api, /PlotHost/);
  assert.match(api, /mountPlot/);
  assert.match(api, /DataSource/);
});

test("the canonical spec is recursive and has no public viewport/pane map", () => {
  const spec = read("../../../packages/spec/src/spec.ts");

  assert.match(spec, /children: PlotNode\[\]/);
  assert.match(spec, /interface PlotSpec/);
  assert.doesNotMatch(spec, /PaneId|PaneSpec|LayoutSpec|PlotSession/);
});
