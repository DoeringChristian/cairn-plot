/**
 * Compare-pane DISPLAY-encoding helper tests (pure, DOM/GPU-free) — run under
 * Node's built-in runner:
 *   node --experimental-strip-types --test src/testing/browser/renderers/compare-display-encoding.test.ts
 *
 * Guards the compare-pane-on-DISPLAY-conventions follow-up's two pure helpers:
 *   - `compareDisplayToolbarButton` builds the ONE mode-dependent DISPLAY menu
 *     (light = LIGHT curves; scalar = None + colormap LUTs) that replaces the
 *     pane's separate tone-map + colormap buttons.
 *   - `deriveCompareEncodingId` collapses the two mode-scoped faces into the ONE
 *     `encoding` id the settings-sync bus carries.
 * The registry is bootstrapped by importing `../display-encoding` (which imports
 * the encodings index, whose top-level registers every built-in encoding).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareDisplayToolbarButton,
  deriveCompareEncodingId,
} from "../../../plots/image/components/display-encoding.ts";
import { getEncoding, listEncodingsByKind } from "../../../plots/image/model/encodings/index.ts";

const LIGHT_CURVES = ["linear", "srgb", "gamma", "reinhard", "aces"];

test("deriveCompareEncodingId: light face → the curve id", () => {
  assert.equal(deriveCompareEncodingId("light", "aces", "turbo"), "aces");
  assert.equal(deriveCompareEncodingId("light", "srgb", "none"), "srgb");
});

test("deriveCompareEncodingId: scalar face → the lut id when a colormap is active", () => {
  assert.equal(deriveCompareEncodingId("scalar", "srgb", "turbo"), "turbo");
  assert.equal(deriveCompareEncodingId("scalar", "aces", "magma"), "magma");
});

test("deriveCompareEncodingId: scalar face with 'none' → the underlying curve (a valid registry id, never 'none')", () => {
  const id = deriveCompareEncodingId("scalar", "srgb", "none");
  assert.equal(id, "srgb");
  // Always a valid registry encoding, so an image-pane peer applying `encoding`
  // never lands on a non-registry token.
  assert.ok(getEncoding(id), "derived encoding id resolves to a registry entry");
});

test("compareDisplayToolbarButton (light): the LIGHT curves, no None, registry labels", () => {
  const spec = compareDisplayToolbarButton({
    mode: "light",
    curveIds: LIGHT_CURVES,
    curveValue: "aces",
    lutValue: "none",
    onSelectCurve: () => {},
    onSelectLut: () => {},
  });
  assert.equal(spec.id, "display");
  assert.equal(spec.title, "Display encoding");
  const opts = spec.menu!.options;
  assert.deepEqual(
    opts.map((o) => o.id),
    LIGHT_CURVES,
  );
  // Labels come from the registry entries (never drift).
  for (const o of opts) assert.equal(o.label, getEncoding(o.id)!.label);
  assert.equal(spec.menu!.value, "aces");
  // No "None" entry on the light face — a curve is always active.
  assert.ok(!opts.some((o) => o.id === "none"));
});

test("compareDisplayToolbarButton (scalar): None first, then every colormap LUT", () => {
  const spec = compareDisplayToolbarButton({
    mode: "scalar",
    curveIds: LIGHT_CURVES,
    curveValue: "srgb",
    lutValue: "turbo",
    onSelectCurve: () => {},
    onSelectLut: () => {},
  });
  const opts = spec.menu!.options;
  assert.equal(opts[0]!.id, "none");
  assert.equal(opts[0]!.label, "None");
  const lutIds = listEncodingsByKind("lut").map((e) => e.id);
  assert.deepEqual(
    opts.slice(1).map((o) => o.id),
    lutIds,
  );
  assert.equal(spec.menu!.value, "turbo");
  // No curve ids leak into the scalar (diff) face.
  assert.ok(!opts.some((o) => LIGHT_CURVES.includes(o.id)));
});

test("compareDisplayToolbarButton: onSelect routes to the mode's handler", () => {
  let curvePicked: string | null = null;
  let lutPicked: string | null = null;
  const light = compareDisplayToolbarButton({
    mode: "light",
    curveIds: LIGHT_CURVES,
    curveValue: "srgb",
    lutValue: "none",
    onSelectCurve: (id) => (curvePicked = id),
    onSelectLut: (id) => (lutPicked = id),
  });
  light.menu!.onSelect("reinhard");
  assert.equal(curvePicked, "reinhard");
  assert.equal(lutPicked, null);

  const scalar = compareDisplayToolbarButton({
    mode: "scalar",
    curveIds: LIGHT_CURVES,
    curveValue: "srgb",
    lutValue: "none",
    onSelectCurve: (id) => (curvePicked = id),
    onSelectLut: (id) => (lutPicked = id),
  });
  scalar.menu!.onSelect("magma");
  assert.equal(lutPicked, "magma");
});
