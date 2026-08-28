import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { claimPlotKind } from "../kind-ownership.ts";
import { clearPlotTypesForTest, requirePlotType } from "../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../react-registry.ts";
import { ensureImagePlotType } from "./register.ts";

const View = () => null;

test("image is exclusively owned by the typed plot registry", () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureImagePlotType(View, async () => ({}));
  assert.equal(requirePlotType("image").kind, "image");
  assert.ok(getReactPlotType("image"));
  assert.throws(() => claimPlotKind("image", "legacy-renderer"), /already owned by definition/);

  const legacySource = readFileSync(new URL("../../plot-renderers.tsx", import.meta.url), "utf8");
  const coreMap = legacySource.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bimage\s*:/, "image must not remain in CORE_RENDERERS");
});
