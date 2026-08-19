/**
 * Contract guard for the `toolbar` HOST SEAM shared by all three image panes.
 *
 * The feature: a host (cairn) hides the pane's `PlotToolbar` (`toolbar={false}`)
 * and drives the view from its OWN menu via controlled props. No DOM/renderer is
 * configured in this package (JSX can't be imported under
 * `--experimental-strip-types` — see ref-badge.test.ts), so this asserts the
 * contract at the SOURCE level. It also guards the two invariants that make the
 * seam correct:
 *   1. the shell gates the toolbar (and only the toolbar, keeping the floating
 *      notation toggle) on the `toolbar` flag, so the hidden-toolbar convention
 *      is identical on every pane;
 *   2. each view-local control the host must drive (colormap / tonemap / peak /
 *      gamma / base exposure+offset / compare mode+kernel) RE-SEEDS from its
 *      prop, so it stays controllable while the toolbar is gone.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/toolbar-seam.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, ".."); // src/lib/cairn-plot
const read = (rel: string) => readFileSync(join(LIB, rel), "utf8");

const shell = read("renderers/ImagePaneShell.tsx");
const backend = read("renderers/image-backend.ts");
const cpu = read("renderers/CpuImagePane.tsx");
const gpu = read("renderers/GpuImagePane.tsx");
const compare = read("media-compare/GpuComparePane.tsx");

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
  ["GpuComparePane", compare],
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

// --- the controlled-props companion guarantee -----------------------------

test("GpuImagePane: encoding + peak re-seed from their props (controlled while toolbar hidden)", () => {
  // Phase 3: the unified DISPLAY encoding replaces the separate colormap +
  // tonemap overrides. Its controlled-surface re-seed lives INSIDE
  // `usePaneEncoding` (`display-encoding.ts`), which the pane feeds the live
  // descriptor `propColormap` + `propTonemap`; peak keeps its own re-seed effect.
  assert.match(gpu, /usePaneEncoding\(\{/, "the pane must own its encoding via usePaneEncoding");
  assert.match(gpu, /\n\s*propColormap,/, "usePaneEncoding must be fed propColormap (controlled)");
  assert.match(gpu, /\n\s*propTonemap,/, "usePaneEncoding must be fed propTonemap (controlled)");
  assert.match(gpu, /setPeak\(seedPeak\(\)\)/, "peak must re-seed from its prop");
});

test("display-encoding: usePaneEncoding re-seeds when the descriptor props change", () => {
  // The controlled-surface guarantee now lives in the shared hook: an effect
  // keyed on the descriptor seed reseeds the single encoding id + clears the
  // per-arity override memory when the host changes colormap/tonemap.
  const de = read("renderers/display-encoding.ts");
  assert.match(de, /setEncodingId\(seedFor\(arity\)\)/, "the hook must reseed from the props");
  assert.match(de, /memoryRef\.current\.clear\(\)/, "a prop reseed must forget per-arity overrides");
});

test("GpuImagePane: base exposure/offset feed the render (additive with sliders)", () => {
  assert.match(gpu, /baseExposure \+ displayEV/, "render EV = base + slider adjustment");
  assert.match(gpu, /baseOffset \+ displayOffset/, "render offset = base + slider adjustment");
});

test("GpuComparePane: peak + gamma re-seed (controlled kernel/mode already were)", () => {
  assert.match(compare, /setPeak\(seedPeak\(\)\)/, "compare peak must re-seed from its prop");
  assert.match(
    compare,
    /if \(gammaProp && gammaProp > 0\) setTonemapGamma\(gammaProp\)/,
    "compare gamma must re-seed from its prop",
  );
  // The already-controlled pair (kept as a re-divergence guard).
  assert.match(compare, /setCompareModeState\(mode\)/, "compare mode must re-seed");
  assert.match(compare, /setDiffKernelState\(/, "diff kernel must re-seed");
});

test("CpuImagePane HDR: base offset is additive with the runtime OFF slider", () => {
  assert.match(cpu, /baseOffset \+ displayOffset/, "CPU HDR offset = base + slider adjustment");
});
