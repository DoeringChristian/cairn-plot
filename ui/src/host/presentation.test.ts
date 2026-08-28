import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { withoutSettingsPlumbing } from "./presentation.ts";

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
  const register = readFileSync(new URL("../plots/image/register.ts", import.meta.url), "utf8");
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
    "../plots/image/backends/webgpu.tsx",
    "../plots/image/backends/canvas.tsx",
    "../plots/image/backends/contracts.ts",
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /applySyncedSettings/);
    assert.doesNotMatch(source, /initialSettingsSnapshot/);
  }
});

test("leaf presentation assembly does not manufacture settings props", () => {
  const host = readFileSync(new URL("./PlotNodeView.tsx", import.meta.url), "utf8");
  const mergeStart = host.indexOf("const mergedProps = useMemo");
  const mergeEnd = host.indexOf("// Wait-for-registration", mergeStart);
  const merge = host.slice(mergeStart, mergeEnd);
  assert.doesNotMatch(merge, /\.syncedSettings\s*=/);
  assert.doesNotMatch(merge, /\.setSyncedSettings\s*=/);
  assert.doesNotMatch(merge, /resetSettings\s*=/);
});
