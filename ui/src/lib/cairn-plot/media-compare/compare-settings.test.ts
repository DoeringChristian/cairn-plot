/**
 * Compare-settings enumeration + option-list contract (the pure half absorbed
 * from `card-kit/CompareSettingsPanel.tsx` + `visual-compare-settings.ts`).
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/media-compare/compare-settings.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CORE_COMPARE_MODE_OPTIONS,
  DIFF_SUBMODE_OPTIONS,
  PIXEL_DIFF_COLORMAP_OPTIONS,
  DIFF_COLORMAP_OPTIONS,
  DEFAULT_MEDIA_COMPARE_SETTINGS,
  enumerateCompareModeOptions,
} from "./compare-settings.ts";
import { MEDIA_COMPARE_MODE_KINDS } from "./mode.ts";

test("CORE_COMPARE_MODE_OPTIONS covers exactly the four core kinds", () => {
  const values = CORE_COMPARE_MODE_OPTIONS.map((o) => o.value).sort();
  assert.deepEqual(values, [...MEDIA_COMPARE_MODE_KINDS].sort());
  for (const o of CORE_COMPARE_MODE_OPTIONS) {
    assert.ok(o.label.length > 0, `${o.value} has a label`);
  }
});

test("diff option lists are non-empty and well-formed", () => {
  for (const list of [DIFF_SUBMODE_OPTIONS, PIXEL_DIFF_COLORMAP_OPTIONS, DIFF_COLORMAP_OPTIONS]) {
    assert.ok(list.length > 0);
    for (const o of list) assert.ok(o.value && o.label);
  }
  // The two native-diff colormaps are exactly red-green + viridis.
  assert.deepEqual(
    DIFF_COLORMAP_OPTIONS.map((o) => o.value).sort(),
    ["red-green", "viridis"],
  );
});

test("enumerate: no native modes → the four core kinds, all enabled", () => {
  const opts = enumerateCompareModeOptions({ nativeModes: [], topologyOk: true });
  assert.equal(opts.length, 4);
  assert.ok(opts.every((o) => !o.native && !o.disabled));
  assert.deepEqual(opts.map((o) => o.value).sort(), [...MEDIA_COMPARE_MODE_KINDS].sort());
});

test("enumerate: core kinds always precede native and are never disabled", () => {
  const nativeModes = [
    { value: "diff-property", label: "Diff (property)" },
    { value: "diff-geometry", label: "Diff (geometry)" },
  ] as const;

  const ok = enumerateCompareModeOptions({ nativeModes, topologyOk: true });
  assert.equal(ok.length, 6, "4 core + 2 native");
  // First four are core, enabled, non-native.
  assert.ok(ok.slice(0, 4).every((o) => !o.native && !o.disabled));
  // Trailing native modes enabled when topology holds.
  assert.ok(ok.slice(4).every((o) => o.native && !o.disabled));
  assert.deepEqual(ok.slice(4).map((o) => o.value), ["diff-property", "diff-geometry"]);
});

test("enumerate: native modes are disabled when topology mismatches; core stay enabled", () => {
  const nativeModes = [{ value: "diff-position", label: "Diff (position)" }] as const;
  const bad = enumerateCompareModeOptions({ nativeModes, topologyOk: false });
  const core = bad.filter((o) => !o.native);
  const native = bad.filter((o) => o.native);
  assert.ok(core.every((o) => !o.disabled), "core kinds never gated on topology");
  assert.ok(native.every((o) => o.disabled), "native kinds disabled on topology mismatch");
});

const ENGINE_KERNELS = [
  { value: "absolute", label: "Absolute" },
  { value: "hdr-flip", label: "FLIP (perceptual)" },
  { value: "ssim", label: "SSIM" },
] as const;

test("enumerate: no engine kernels → the core+native list is unchanged", () => {
  const withoutExtras = enumerateCompareModeOptions({ nativeModes: [], topologyOk: true });
  const withEmpty = enumerateCompareModeOptions({ nativeModes: [], topologyOk: true }, {});
  assert.deepEqual(withEmpty, withoutExtras);
  assert.ok(withEmpty.every((o) => !o.kernel));
});

test("enumerate: engine kernels append after core+native, GPU-enabled by default", () => {
  const opts = enumerateCompareModeOptions(
    { nativeModes: [], topologyOk: true },
    { engineKernels: ENGINE_KERNELS },
  );
  assert.equal(opts.length, 4 + ENGINE_KERNELS.length);
  const kernels = opts.filter((o) => o.kernel);
  assert.equal(kernels.length, ENGINE_KERNELS.length);
  // Kernels trail the four core kinds and are enabled (GPU assumed available).
  assert.deepEqual(opts.slice(4).map((o) => o.value), ["absolute", "hdr-flip", "ssim"]);
  assert.ok(kernels.every((o) => o.kernel && !o.native && !o.disabled));
});

test("enumerate: engine kernels are DISABLED when the GPU is unavailable", () => {
  const opts = enumerateCompareModeOptions(
    { nativeModes: [], topologyOk: true },
    { engineKernels: ENGINE_KERNELS, gpuAvailable: false },
  );
  const kernels = opts.filter((o) => o.kernel);
  assert.ok(kernels.every((o) => o.disabled), "engine kernels gated off without WebGPU");
  // Core kinds stay enabled regardless of GPU.
  assert.ok(opts.filter((o) => !o.kernel).every((o) => !o.disabled));
});

test("enumerate: core, native, and engine kernels coexist in order", () => {
  const nativeModes = [{ value: "diff-geometry", label: "Diff (geometry)" }] as const;
  const opts = enumerateCompareModeOptions(
    { nativeModes, topologyOk: true },
    { engineKernels: ENGINE_KERNELS },
  );
  assert.equal(opts.length, 4 + 1 + ENGINE_KERNELS.length);
  assert.ok(opts.slice(0, 4).every((o) => !o.native && !o.kernel));
  assert.equal(opts[4]!.native, true);
  assert.ok(opts.slice(5).every((o) => o.kernel));
});

test("DEFAULT_MEDIA_COMPARE_SETTINGS carries neutral compare baselines", () => {
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.mode, "split");
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.diffMode, "none");
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.splitPosition, 0.5);
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.blendAlpha, 0.5);
  // The default diff colormap is a valid native-diff colormap option.
  assert.ok(
    DIFF_COLORMAP_OPTIONS.some((o) => o.value === DEFAULT_MEDIA_COMPARE_SETTINGS.diffColormap),
  );
});
