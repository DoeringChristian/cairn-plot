import assert from "node:assert/strict";
import test from "node:test";

import { initialViewportSettings } from "./viewport-initial-settings.ts";
import type { CompareNode } from "../../host/descriptor-resolver.ts";

const compare = (colormap: string, kernel: string): CompareNode => ({
  kind: "compare",
  mode: "diff",
  diffSubmode: kernel,
  a: { kind: "url", src: "a.png" },
  b: { kind: "url", src: "b.png" },
  props: { colormap },
});

test("a viewport materializes an authored colormap before its renderer mounts", () => {
  assert.equal(
    initialViewportSettings(compare("red-blue", "signed"), undefined)?.["image.encoding"],
    "red-blue",
  );
  assert.equal(
    initialViewportSettings(compare("viridis", "absolute"), undefined)?.["image.encoding"],
    "turbo",
  );
});

test("difference operation never chooses a colormap default", () => {
  const signed = initialViewportSettings(compare("none", "signed"), undefined)["image.encoding"];
  const absolute = initialViewportSettings(compare("none", "absolute"), undefined)["image.encoding"];
  assert.equal(signed, absolute);
  assert.notEqual(signed, "turbo");
});
