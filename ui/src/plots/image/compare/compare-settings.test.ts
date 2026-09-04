/**
 * Compare-settings enumeration + option-list contract (the pure half absorbed
 * from `card-kit/CompareSettingsPanel.tsx` + `visual-compare-settings.ts`).
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/compare/compare-settings.test.ts
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

test("CORE_COMPARE_MODE_OPTIONS covers exactly the three core kinds", () => {
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
  // The two native-diff colormaps are exactly red-green + turbo.
  assert.deepEqual(
    DIFF_COLORMAP_OPTIONS.map((o) => o.value).sort(),
    ["red-green", "turbo"],
  );
});

test("enumerate: no native modes → the three core kinds, all enabled", () => {
  const opts = enumerateCompareModeOptions({ nativeModes: [], topologyOk: true });
  assert.equal(opts.length, 3);
  assert.ok(opts.every((o) => !o.native && !o.disabled));
  assert.deepEqual(opts.map((o) => o.value).sort(), [...MEDIA_COMPARE_MODE_KINDS].sort());
});

test("enumerate: core kinds always precede native and are never disabled", () => {
  const nativeModes = [
    { value: "diff-property", label: "Diff (property)" },
    { value: "diff-geometry", label: "Diff (geometry)" },
  ] as const;

  const ok = enumerateCompareModeOptions({ nativeModes, topologyOk: true });
  assert.equal(ok.length, 5, "3 core + 2 native");
  // First three are core, enabled, non-native.
  assert.ok(ok.slice(0, 3).every((o) => !o.native && !o.disabled));
  // Trailing native modes enabled when topology holds.
  assert.ok(ok.slice(3).every((o) => o.native && !o.disabled));
  assert.deepEqual(ok.slice(3).map((o) => o.value), ["diff-property", "diff-geometry"]);
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
  { value: "flip-hdr", label: "HDR-FLIP" },
  { value: "ssim", label: "SSIM" },
] as const;

test("enumerate: no engine operations → the core+native list is unchanged", () => {
  const withoutExtras = enumerateCompareModeOptions({ nativeModes: [], topologyOk: true });
  const withEmpty = enumerateCompareModeOptions({ nativeModes: [], topologyOk: true }, {});
  assert.deepEqual(withEmpty, withoutExtras);
  assert.ok(withEmpty.every((o) => !o.operation));
});

test("enumerate: engine operations append after core+native, GPU-enabled by default", () => {
  const opts = enumerateCompareModeOptions(
    { nativeModes: [], topologyOk: true },
    { engineKernels: ENGINE_KERNELS },
  );
  assert.equal(opts.length, 3 + ENGINE_KERNELS.length);
  const operations = opts.filter((o) => o.operation);
  assert.equal(operations.length, ENGINE_KERNELS.length);
  // Kernels trail the three core kinds and are enabled (GPU assumed available).
  assert.deepEqual(opts.slice(3).map((o) => o.value), ["absolute", "flip-hdr", "ssim"]);
  assert.ok(operations.every((o) => o.operation && !o.native && !o.disabled));
});

test("enumerate: engine operations are DISABLED when the GPU is unavailable", () => {
  const opts = enumerateCompareModeOptions(
    { nativeModes: [], topologyOk: true },
    { engineKernels: ENGINE_KERNELS, gpuAvailable: false },
  );
  const operations = opts.filter((o) => o.operation);
  assert.ok(operations.every((o) => o.disabled), "engine operations gated off without WebGPU");
  // Core kinds stay enabled regardless of GPU.
  assert.ok(opts.filter((o) => !o.operation).every((o) => !o.disabled));
});

test("enumerate: core, native, and engine operations coexist in order", () => {
  const nativeModes = [{ value: "diff-geometry", label: "Diff (geometry)" }] as const;
  const opts = enumerateCompareModeOptions(
    { nativeModes, topologyOk: true },
    { engineKernels: ENGINE_KERNELS },
  );
  assert.equal(opts.length, 3 + 1 + ENGINE_KERNELS.length);
  assert.ok(opts.slice(0, 3).every((o) => !o.native && !o.operation));
  assert.equal(opts[3]!.native, true);
  assert.ok(opts.slice(4).every((o) => o.operation));
});

test("DEFAULT_MEDIA_COMPARE_SETTINGS carries neutral compare baselines", () => {
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.mode, "split");
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.diffMode, "none");
  assert.equal(DEFAULT_MEDIA_COMPARE_SETTINGS.splitPosition, 0.5);
  // The default diff colormap is a valid native-diff colormap option.
  assert.ok(
    DIFF_COLORMAP_OPTIONS.some((o) => o.value === DEFAULT_MEDIA_COMPARE_SETTINGS.diffColormap),
  );
});
