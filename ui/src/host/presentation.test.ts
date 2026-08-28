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
    resetViewportSettings: () => {},
  });
  assert.deepEqual(semantic, { source: { id: "image" }, label: "result" });
});

test("image backend receives settings and commands explicitly and cannot initialize on mount", () => {
  const register = readFileSync(new URL("../plots/image/register.ts", import.meta.url), "utf8");
  assert.match(register, /syncedSettings:\s*input\.settings/);
  assert.match(register, /setSyncedSettings:\s*input\.commands\.patch/);
  assert.match(register, /resetViewportSettings:\s*input\.commands\.reset/);

  for (const relative of [
    "../lib/cairn-plot/renderers/GpuImagePane.tsx",
    "../lib/cairn-plot/renderers/CpuImagePane.tsx",
    "../lib/cairn-plot/renderers/image-backend.ts",
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /applySyncedSettings/);
    assert.doesNotMatch(source, /initialSettingsSnapshot/);
  }
});

test("leaf presentation assembly does not manufacture settings props", () => {
  const host = readFileSync(new URL("../plot-node.tsx", import.meta.url), "utf8");
  const mergeStart = host.indexOf("const mergedProps = useMemo");
  const mergeEnd = host.indexOf("// Wait-for-registration", mergeStart);
  const merge = host.slice(mergeStart, mergeEnd);
  assert.doesNotMatch(merge, /\.syncedSettings\s*=/);
  assert.doesNotMatch(merge, /\.setSyncedSettings\s*=/);
  assert.doesNotMatch(merge, /resetViewportSettings\s*=/);
});
