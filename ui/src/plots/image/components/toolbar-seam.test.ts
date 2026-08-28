/**
 * Contract guard for the `toolbar` HOST SEAM shared by all three image panes.
 *
 * The feature: a host (cairn) hides the pane's `PlotToolbar` (`toolbar={false}`)
 * while settings continue to flow through the viewport store. No DOM/renderer is
 * configured in this package (JSX can't be imported under
 * `--experimental-strip-types` — see ref-badge.test.ts), so this asserts the
 * contract at the SOURCE level. It also guards the two invariants that make the
 * seam correct:
 *   1. the shell gates the toolbar (and only the toolbar, keeping the floating
 *      notation toggle) on the `toolbar` flag, so the hidden-toolbar convention
 *      is identical on every pane;
 *   2. toolbar visibility never changes settings ownership.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/components/toolbar-seam.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const shell = read("plots/image/components/ImagePaneShell.tsx");
const backend = read("plots/image/backend/contracts.ts");
const cpu = read("plots/image/backend/cpu.tsx");
const gpu = read("plots/image/backend/gpu.tsx");
const standalone = read("plots/image/view.tsx");

// --- the shared contract: the shape carries `toolbar` ---------------------

test("image-backend: both pane prop shapes declare the `toolbar` host seam", () => {
  // Present on both HdrImageProps and SdrImageProps so a single flag flows
  // through the whole ImageBackend union (and the resolveImageRenderer seam).
  const decls = backend.match(/toolbar\?: boolean/g) ?? [];
  assert.ok(decls.length >= 2, "toolbar?: boolean must be on both HDR + SDR shapes");
  // Base EV/offset — the controlled EV/offset surface, additive with the
  // runtime sliders (docs/API.md host-menu table).
  assert.match(backend, /offset\?: number/, "HDR/SDR shapes must carry a base `offset`");
});

// --- the shell: the hidden-toolbar convention -----------------------------

test("ImagePaneShell: the toolbar (and hover group) is gated on `toolbar`", () => {
  // The ONLY PlotToolbar render is `{toolbar && <PlotToolbar …/>}`.
  assert.match(
    shell,
    /\{toolbar && <PlotToolbar/,
    "PlotToolbar must render only when toolbar is true",
  );
  // The hover-reveal `group` class is also gated (no toolbar ⇒ no hover chrome).
  assert.match(shell, /toolbar \? " group" : ""/, "the `group` class must be gated on toolbar");
});

test("ImagePaneShell: hidden toolbar keeps ONLY the floating notation toggle", () => {
  // The chosen convention: with the toolbar hidden the pane still shows the
  // pixel-notation toggle chip while the TEV overlay is active — and nothing else.
  assert.match(
    shell,
    /\{!toolbar && overlayActive && \(\s*<PixelNotationToggle/,
    "the floating PixelNotationToggle must render only when !toolbar && overlayActive",
  );
});

// --- every pane forwards `toolbar` to the shell ---------------------------

for (const [name, src] of [
  ["CpuImagePane", cpu],
  ["GpuImagePane", gpu],
] as const) {
  test(`${name}: forwards a resolved toolbar flag to ImagePaneShell`, () => {
    assert.match(src, /toolbar=\{toolbar\}/, `${name} must pass toolbar={toolbar} to the shell`);
    // Default true at the pane boundary (host opts OUT, never in).
    assert.match(
      src,
      /toolbar = true|toolbar = props\.toolbar \?\? true/,
      `${name} must default toolbar to true`,
    );
  });
}

// --- settings ownership is independent of toolbar visibility --------------

test("GpuImagePane: encoding is initialized into the viewport settings store", () => {
  assert.match(gpu, /usePaneEncoding\(\{/, "the pane must own its encoding via usePaneEncoding");
  assert.match(
    gpu,
    /propColormap:\s*initialEncSeedRef\.current/,
    "descriptor colormap must be captured as an initial seed",
  );
  assert.match(
    gpu,
    /settings:\s*synced,/,
    "usePaneEncoding must be handed the settings store (its `encoding` rules)",
  );
  assert.doesNotMatch(gpu, /toolbar === false \|\| disableStackShared/);
});

test("display-encoding: one immutable bootstrap seed, then the viewport store", () => {
  const de = read("plots/image/components/display-encoding.ts");
  assert.match(
    de,
    /const storeId = config\.settings\?\.\["image\.encoding"\]/,
    "the hook must read the settings store's unified encoding id",
  );
  assert.match(
    de,
    /initialSeedRef\.current = seedFor\(arity\)/,
    "the descriptor seed must be captured once",
  );
  assert.match(de, /storeId \?\? initialSeedRef\.current/);
  assert.doesNotMatch(de, /useState/);
  assert.doesNotMatch(de, /controlledSurface/);
});

test("GpuImagePane: base exposure/offset feed the render (additive with sliders)", () => {
  assert.match(gpu, /baseExposure \+ displayEV/, "render EV = base + slider adjustment");
  assert.match(gpu, /baseOffset \+ displayOffset/, "render offset = base + slider adjustment");
});

// NOTE: the separate "GpuComparePane: peak + gamma re-seed" guard is gone —
// `GpuComparePane` is deleted (content-op unification, Phase 4). The unified
// pane's controlled re-seed (peak/encoding, and — in compare mode — mode/kernel
// via `compareSource`) is covered by the `GpuImagePane` re-seed test above.

test("CpuImagePane HDR: base offset is additive with the runtime OFF slider", () => {
  assert.match(cpu, /baseOffset \+ displayOffset/, "CPU HDR offset = base + slider adjustment");
});

test("ImageStandalone forwards the viewport-owned HOME command", () => {
  assert.match(standalone, /resetSettings=\{commands\.reset\}/);
});

test("image renderers do not own sync membership or anchor adoption", () => {
  for (const source of [backend, cpu, gpu, standalone]) {
    assert.doesNotMatch(source, /useSeedGroupOnFormation/);
    assert.doesNotMatch(source, /settingsSyncGroupId/);
    assert.doesNotMatch(source, /syncIsAnchor/);
  }
});
