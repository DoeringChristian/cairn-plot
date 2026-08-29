import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearPlotTypesForTest, planComparison, requirePlotType } from "../../registry.ts";
import { clearReactPlotTypesForTest, getReactPlotType } from "../../react-registry.ts";
import { ensureImagePlotType, imagePresentation } from "./register.ts";
import { expandImageComparison } from "./comparison-plan.ts";
import type { ImagePlotViewProps } from "./view.tsx";
import type { ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "./contracts.ts";

const View = (_props: ImagePlotViewProps) => null;
const backend: ImageBackend<ImageBackendView> = {
  id: "test",
  technology: "canvas2d",
  priority: 1,
  View: (() => null) as ImageBackendView,
  supports: () => ({ supported: true, priority: 1 }),
  capabilities: {
    imageOperations: [],
    displayOperations: [],
    supportsImageOperation: () => false,
    supportsDisplayOperation: () => false,
  },
};

test("image presentation validates its typed decoded-source boundary", () => {
  const source = { dtype: "uint8" as const, url: "data:image/png;base64," };
  assert.deepEqual(imagePresentation({ source, label: "preview" }), { source, label: "preview" });
  assert.throws(() => imagePresentation({ label: "missing" }), /requires a decoded source/);
});

test("image is exclusively owned by the typed plot registry", () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureImagePlotType(View, [backend]);
  assert.equal(requirePlotType("image").kind, "image");
  assert.ok(getReactPlotType("image"));
  const comparison = requirePlotType("image").comparison;
  assert.ok(comparison, "image definition owns comparison semantics");
  assert.deepEqual(comparison.presentations.map((entry) => entry.id), ["split", "difference"]);
  assert.equal(planComparison({
    kind: "compare",
    type: "image",
    presentation: "split",
    operands: [
      { kind: "image", hash: "a" },
      { kind: "url", src: "data:image/png;base64," },
    ],
    strategy: "reference",
  }).plan.outputs.length, 1);
  assert.throws(() => planComparison({
      kind: "compare",
      type: "image",
      presentation: "split",
      operands: [
        { kind: "image", hash: "a" },
        { kind: "npz", hash: "mesh", objectType: "mesh", meta: {} },
      ],
      strategy: "reference",
    }), /does not accept data kind/);
  const expanded = expandImageComparison({
    kind: "compare",
    type: "image",
    operands: [
      { kind: "image", hash: "a" },
      { kind: "image", hash: "reference" },
      { kind: "image", hash: "c" },
    ],
    strategy: "reference",
    referenceIndex: 1,
    presentation: "difference",
  });
  assert.equal(expanded?.children.length, 2);
  assert.ok(expanded?.children.every((child) => child.kind === "compare"));

  const legacySource = readFileSync(new URL("../../register-core.tsx", import.meta.url), "utf8");
  const coreMap = legacySource.match(/CORE_RENDERERS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  assert.doesNotMatch(coreMap, /\bimage\s*:/, "image must not remain in CORE_RENDERERS");
});
