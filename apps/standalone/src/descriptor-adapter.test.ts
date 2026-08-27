import assert from "node:assert/strict";
import test from "node:test";

import type { PlotDescriptor } from "../../../ui/src/plot-descriptor.ts";
import { plotSpecFromDescriptor } from "./descriptor-adapter.ts";

test("legacy descriptors become durable panes plus layout", () => {
  const descriptor: PlotDescriptor = {
    root: {
      kind: "grid",
      cols: 2,
      shared: { colormap: "magma" },
      children: [
        { kind: "plot", renderer: "image", data: { kind: "url", src: "a.png" } },
        {
          kind: "compare",
          mode: "diff",
          diffSubmode: "absolute",
          a: { kind: "url", src: "a.png" },
          b: { kind: "url", src: "b.png" },
        },
      ],
    },
  };
  const spec = plotSpecFromDescriptor(descriptor);
  assert.equal(spec.version, 1);
  assert.deepEqual(Object.keys(spec.panes), ["pane:0.0", "pane:0.1"]);
  assert.equal(spec.panes["pane:0.0"].settings?.["image.encoding"], "magma");
  assert.equal(spec.panes["pane:0.1"].settings?.["compare.operation"], "absolute");
  assert.equal(spec.panes["pane:0.1"].settings?.["compare.kernel"], undefined);
  assert.equal(spec.panes["pane:0.1"].sources.length, 2);
});
