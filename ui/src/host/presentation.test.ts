import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { leafPresentation, withoutSettingsPlumbing } from "./presentation.ts";

test("typed backend presentations cannot carry settings plumbing", () => {
  const semantic = withoutSettingsPlumbing({
    source: { id: "image" },
    label: "result",
    syncedSettings: { "image.encoding": "turbo" },
    setSyncedSettings: () => {},
    applySyncedSettings: () => {},
    resetSettings: () => {},
  });
  assert.deepEqual(semantic, { source: { id: "image" }, label: "result" });
});

test("image backend receives settings and commands explicitly and cannot initialize on mount", () => {
  const register = readFileSync(new URL("../plots/image/runtime/register.ts", import.meta.url), "utf8");
  assert.match(register, /presentation:\s*input\.presentation/);
  assert.match(register, /settings:\s*input\.settings/);
  assert.match(register, /commands:\s*input\.commands/);
  assert.doesNotMatch(register, /syncedSettings:\s*input/);

  const adapter = readFileSync(new URL("../plots/inline-register.ts", import.meta.url), "utf8");
  assert.match(adapter, /ReactPlotViewProps<TPresentation, TSettings>/);
  assert.match(adapter, /presentation:\s*input\.presentation/);
  assert.match(adapter, /settings:\s*input\.settings/);
  assert.match(adapter, /commands:\s*input\.commands/);

  for (const relative of [
    "../plots/image/webgpu/view.tsx",
    "../plots/image/cpu/view.tsx",
    "../plots/image/runtime/contracts.ts",
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /applySyncedSettings/);
    assert.doesNotMatch(source, /initialSettingsSnapshot/);
  }
});

test("leaf presentation assembly does not manufacture settings props", () => {
  // This test used to locate a `const mergedProps = useMemo` block in
  // PlotNodeView.tsx with a bare `indexOf`. That block was removed by a
  // refactor, `indexOf` returned -1, and the assertions then ran against a
  // near-empty slice and passed for free — which is how the leaf merge went
  // missing unnoticed. Assert against the real exported helper instead, and
  // keep the source probe only as a guard that the call site still exists.
  const host = readFileSync(new URL("./PlotNodeView.tsx", import.meta.url), "utf8");
  assert.match(host, /presentation=\{leafPresentation\(/,
    "the leaf must assemble its backend props through leafPresentation");

  const assembled = leafPresentation(
    {
      colormap: "red-blue",
      syncedSettings: { "image.encoding": "turbo" },
      setSyncedSettings: () => {},
      resetSettings: () => {},
    },
    { matrix: [[1]] },
  );
  assert.deepEqual(assembled, { colormap: "red-blue", matrix: [[1]] });
});

test("authored node props reach the backend — the dropped-props bug", () => {
  // `cp.Heatmap(z, colormap="red-blue", zmin=-1, value_label="v")` emits those
  // as node `props`; only `matrix` lives in the resolved data. Before the fix
  // the backend saw the data alone, so `view.tsx`'s `?? "turbo"` fallback won
  // and every authored option was silently ignored.
  const assembled = leafPresentation(
    { colormap: "red-blue", min: -1, max: 5, valueLabel: "v", xLabel: "X" },
    { matrix: [[1, 2]] },
  );
  assert.equal(assembled.colormap, "red-blue");
  assert.equal(assembled.min, -1);
  assert.equal(assembled.max, 5);
  assert.equal(assembled.valueLabel, "v");
  assert.deepEqual(assembled.matrix, [[1, 2]]);
});

test("RESOLVED content wins a collision, and a missing props object is fine", () => {
  // The resolved payload is what the plot type validated; an authored prop must
  // never displace it.
  assert.deepEqual(
    leafPresentation({ matrix: "not-the-data" }, { matrix: [[7]] }).matrix,
    [[7]],
  );
  assert.deepEqual(leafPresentation(undefined, { table: { a: [1] } }), {
    table: { a: [1] },
  });
});
