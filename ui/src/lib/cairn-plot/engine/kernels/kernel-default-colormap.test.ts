/**
 * Node test: the PER-KERNEL DEFAULT COLORMAPS follow-up — every registered diff
 * kernel declares a `defaultColormap` matching its OUTPUT RANGE (`displayRange`),
 * and the pure resolution (`resolveDiffColormap`) applies that default UNLESS the
 * user has explicitly overridden (a pick that STICKS across kernel switches; a
 * `null` override = "follow the kernel default").
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/engine/kernels/kernel-default-colormap.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listDiffKernels, kernelDefaultColormap, resolveDiffColormap } from "./index.ts";
import { COLORMAP_NAMES, DIVERGING_COLORMAPS } from "../../colormaps/lut.ts";

/** The requested defaults the directive specifies (per kernel id). */
const EXPECTED: Record<string, string> = {
  absolute: "turbo",
  squared: "turbo",
  relative_absolute: "turbo",
  relative_squared: "turbo",
  signed: "red-green",
  relative_signed: "red-green",
  flip: "magma",
  "flip-ldr-forced": "magma",
  "hdr-flip": "magma",
  ssim: "magma",
};

test("every kernel declares a defaultColormap that is a real colormap name", () => {
  for (const k of listDiffKernels()) {
    assert.ok(
      (COLORMAP_NAMES as readonly string[]).includes(k.defaultColormap),
      `kernel "${k.id}" defaultColormap ${JSON.stringify(k.defaultColormap)} is not a registered colormap`,
    );
  }
});

test("defaultColormap matches the directive's per-kernel mapping", () => {
  for (const k of listDiffKernels()) {
    const want = EXPECTED[k.id];
    assert.ok(want !== undefined, `unexpected kernel "${k.id}" — add its default to the test`);
    assert.equal(k.defaultColormap, want, `kernel "${k.id}" default should be ${want}`);
  }
});

test("defaultColormap matches the OUTPUT RANGE (displayRange): signed → diverging, unit → sequential", () => {
  for (const k of listDiffKernels()) {
    if (k.displayRange === "signed" || k.displayRange === "relative") {
      // ℝ signed error → a DIVERGING map (red-green).
      assert.ok(
        DIVERGING_COLORMAPS.has(k.defaultColormap),
        `signed/relative kernel "${k.id}" should default to a diverging map, got ${k.defaultColormap}`,
      );
    } else {
      // ℝ⁺ magnitude → a SEQUENTIAL map (turbo / magma).
      assert.ok(
        !DIVERGING_COLORMAPS.has(k.defaultColormap),
        `unit kernel "${k.id}" should default to a sequential map, got ${k.defaultColormap}`,
      );
    }
  }
});

test("kernelDefaultColormap resolves the kernel's default (turbo fallback for unknown ids)", () => {
  assert.equal(kernelDefaultColormap("signed"), "red-green");
  assert.equal(kernelDefaultColormap("absolute"), "turbo");
  assert.equal(kernelDefaultColormap("flip"), "magma");
  assert.equal(kernelDefaultColormap("does-not-exist"), "turbo", "unknown id → turbo fallback");
});

test("resolveDiffColormap: null override follows the kernel default", () => {
  assert.equal(resolveDiffColormap("absolute", null), "turbo");
  assert.equal(resolveDiffColormap("signed", null), "red-green");
  assert.equal(resolveDiffColormap("flip", null), "magma");
  assert.equal(resolveDiffColormap("ssim", null), "magma");
});

test("resolveDiffColormap: an EXPLICIT override STICKS across kernel switches", () => {
  // The same explicit pick resolves to itself no matter which kernel is selected.
  for (const kernel of ["absolute", "signed", "flip", "ssim", "relative_squared"]) {
    assert.equal(resolveDiffColormap(kernel, "magma"), "magma", `pick must stick on ${kernel}`);
    assert.equal(resolveDiffColormap(kernel, "none"), "none", `explicit raw (none) must stick on ${kernel}`);
  }
});

test("switch simulation: default follows the kernel until an override is set, then sticks; clearing follows again", () => {
  // Start on `absolute`, no override → turbo (the ℝ⁺ default).
  let override: string | null = null;
  assert.equal(resolveDiffColormap("absolute", override), "turbo");
  // Switch to `signed`, still no override → the NEW kernel's default (red-green).
  assert.equal(resolveDiffColormap("signed", override), "red-green");
  // User picks magma explicitly → override set.
  override = "magma";
  assert.equal(resolveDiffColormap("signed", override), "magma");
  // Switch to `squared` → the pick STICKS (does not revert to turbo).
  assert.equal(resolveDiffColormap("squared", override), "magma");
  // HOME clears the override → follow the current kernel's default again.
  override = null;
  assert.equal(resolveDiffColormap("squared", override), "turbo");
});
