/**
 * Pure unit tests for the NORMAL-MAP display colorspace remap. Run under Node's
 * built-in test runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test src/lib/cairn-plot/image/normal-map.test.ts
 *
 * `normalMapEncode` is the single source of truth ported byte-identically by the
 * WebGPU shader (`engine/shaders/image.wgsl.ts`'s u_bind9 branch) and the CPU
 * pane (`renderers/CpuImagePane.tsx`'s `tonemapToImageData`), so pinning its math
 * here pins BOTH display paths.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalMapEncode,
  canonicalizeColorspace,
  COLORSPACE_MENU_OPTIONS,
  COLORSPACE_LABELS,
  DEFAULT_COLORSPACE,
} from "./tonemap.ts";

test("normalMapEncode maps the [-1,1] endpoints and midpoint to [0,1]", () => {
  assert.equal(normalMapEncode(-1), 0); // -1 -> 0
  assert.equal(normalMapEncode(0), 0.5); // 0 -> 0.5 (a flat X/Y component)
  assert.equal(normalMapEncode(1), 1); // +1 -> 1 (a flat +Z normal's blue)
});

test("normalMapEncode is the affine (v+1)/2 across the interior", () => {
  for (const v of [-0.75, -0.5, -0.25, 0.1, 0.25, 0.5, 0.9]) {
    assert.ok(Math.abs(normalMapEncode(v) - (v + 1) / 2) < 1e-12, `v=${v}`);
  }
});

test("a flat +Z normal (0,0,1) encodes to the canonical bluish (0.5,0.5,1.0)", () => {
  const [nx, ny, nz] = [0, 0, 1];
  assert.deepEqual(
    [normalMapEncode(nx), normalMapEncode(ny), normalMapEncode(nz)],
    [0.5, 0.5, 1.0],
  );
});

test("normalMapEncode clamps out-of-[-1,1] inputs to [0,1]", () => {
  assert.equal(normalMapEncode(-2), 0); // below range -> 0
  assert.equal(normalMapEncode(5), 1); // above range -> 1
  assert.equal(normalMapEncode(-1.0001), 0);
  assert.equal(normalMapEncode(1.0001), 1);
});

test("canonicalizeColorspace narrows to the known modes, else the default", () => {
  assert.equal(canonicalizeColorspace("normal"), "normal");
  assert.equal(canonicalizeColorspace("linear"), "linear");
  assert.equal(canonicalizeColorspace(undefined), DEFAULT_COLORSPACE);
  assert.equal(canonicalizeColorspace(null), DEFAULT_COLORSPACE);
  assert.equal(canonicalizeColorspace("bogus"), DEFAULT_COLORSPACE);
  assert.equal(DEFAULT_COLORSPACE, "linear");
});

test("the colorspace menu options are derived from the label map", () => {
  assert.deepEqual(
    COLORSPACE_MENU_OPTIONS,
    [
      { id: "linear", label: COLORSPACE_LABELS.linear },
      { id: "normal", label: COLORSPACE_LABELS.normal },
    ],
  );
  assert.equal(COLORSPACE_LABELS.normal, "Normal map");
});
