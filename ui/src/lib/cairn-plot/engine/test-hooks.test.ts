import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isOrangeSuspect,
  recordDeepColorSample,
  setDeepColorDetectorForTest,
  getHueAnomalies,
  type PaneRenderRecord,
} from "./test-hooks.ts";

// A k=1 authored-colormap scalar image's NORMAL present (the user's live repro:
// slot A = scalar float image with AUTHORED magma). channelCount === 1.
const authoredScalarMagma: PaneRenderRecord = {
  mode: "image",
  sourceKey: "img:a",
  sourceBKey: undefined,
  contentOpId: 0,
  hasSrcB: false,
  isScalar: true,
  hasColormap: true,
  channelCount: 1,
  reduce: "none",
  colormapSig: 111,
};

// The REAL mismatch class: a MULTI-channel light image collapsed through a
// scalar colormap (reduce → false-color → magma upper ramp = orange).
const lightCollapsedThroughColormap: PaneRenderRecord = {
  ...authoredScalarMagma,
  channelCount: 3,
  reduce: "luminance",
};

test("oracle FALSE-POSITIVE fix: a k=1 authored-colormap scalar pane is NOT an orange suspect", () => {
  assert.equal(isOrangeSuspect(authoredScalarMagma), false);
});

test("oracle still flags the REAL class: a k>1 light image on a scalar colormap (identity) IS a suspect", () => {
  assert.equal(isOrangeSuspect(lightCollapsedThroughColormap), true);
});

test("oracle exempts already-excluded classes (cached-diff, direct op, non-scalar, no colormap)", () => {
  // A cached diff (its scalar magma is legitimate) — different mode.
  assert.equal(isOrangeSuspect({ ...lightCollapsedThroughColormap, mode: "cached-diff" }), false);
  // A direct diff/compositor op sampling slot b.
  assert.equal(isOrangeSuspect({ ...lightCollapsedThroughColormap, contentOpId: 3, hasSrcB: true }), false);
  // A plain light image (no colormap bound).
  assert.equal(isOrangeSuspect({ ...lightCollapsedThroughColormap, isScalar: false, hasColormap: false }), false);
  // Missing channelCount is not treated as the multi-channel class.
  assert.equal(isOrangeSuspect({ ...lightCollapsedThroughColormap, channelCount: undefined }), false);
});

// ---- deep color detector -------------------------------------------------
function rec(slotKey: string): PaneRenderRecord {
  return {
    mode: "image",
    sourceKey: slotKey,
    sourceBKey: undefined,
    contentOpId: 0,
    hasSrcB: false,
    isScalar: true,
    hasColormap: true,
    channelCount: 1,
    reduce: "none",
    colormapSig: slotKey === "A" ? 10 : 20,
  };
}

test("deep detector: a color matching a settled slot is NOT a hue anomaly", () => {
  setDeepColorDetectorForTest(true);
  // Settle slot A on a dark magenta-ish color across enough presents.
  for (let i = 0; i < 8; i++) recordDeepColorSample(rec("A"), { r: 0.2, g: 0.02, b: 0.25 });
  // Another present of the SAME settled color → no anomaly.
  recordDeepColorSample(rec("A"), { r: 0.21, g: 0.03, b: 0.24 });
  assert.equal(getHueAnomalies().length, 0);
  setDeepColorDetectorForTest(false);
});

test("deep detector: a settled slot presenting a jumped color (the orange flash) IS flagged", () => {
  setDeepColorDetectorForTest(true);
  // Settle two legitimate slots — introducing a new legit slot (B) after A is
  // already settled must NOT flag (grace for a new slot signature).
  for (let i = 0; i < 8; i++) recordDeepColorSample(rec("A"), { r: 0.2, g: 0.02, b: 0.25 });
  for (let i = 0; i < 8; i++) recordDeepColorSample(rec("B"), { r: 0.7, g: 0.7, b: 0.7 });
  assert.equal(getHueAnomalies().length, 0, "a legit new/second slot must not be flagged");
  // A saturated ORANGE present arrives UNDER SLOT A's signature but with a color
  // far from A's settled magma fingerprint (a garbage/torn present under the
  // same params) — the flash.
  recordDeepColorSample(rec("A"), { r: 0.98, g: 0.55, b: 0.05 });
  const anomalies = getHueAnomalies();
  assert.equal(anomalies.length, 1);
  assert.ok(anomalies[0]!.hue > 20 && anomalies[0]!.hue < 55, `orange hue, got ${anomalies[0]!.hue}`);
  assert.ok(anomalies[0]!.distToOwnSettled > 0.35);
  // The baseline must NOT have absorbed the flash: a return to A's real color
  // is still fine, and a repeat flash is flagged again.
  recordDeepColorSample(rec("A"), { r: 0.21, g: 0.03, b: 0.24 });
  assert.equal(getHueAnomalies().length, 1, "a normal A present after the flash is fine");
  setDeepColorDetectorForTest(false);
});

test("deep detector: a held/blank (near-black) present is NOT flagged as a color anomaly", () => {
  setDeepColorDetectorForTest(true);
  for (let i = 0; i < 8; i++) recordDeepColorSample(rec("A"), { r: 0.5, g: 0.1, b: 0.6 });
  // A near-black held frame differs from the settled slot but is not the orange.
  recordDeepColorSample(rec("A"), { r: 0.01, g: 0.01, b: 0.01 });
  assert.equal(getHueAnomalies().length, 0);
  setDeepColorDetectorForTest(false);
});

test("deep detector: off by default (no sampling → no anomalies)", () => {
  setDeepColorDetectorForTest(false);
  recordDeepColorSample(rec("A"), { r: 0.98, g: 0.55, b: 0.05 });
  assert.equal(getHueAnomalies().length, 0);
});
