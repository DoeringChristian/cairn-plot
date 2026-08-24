/**
 * Pure unit tests for the image DISPLAY-SETTINGS sync bus. Runs under Node's
 * built-in test runner with TypeScript type-stripping (Node 19+ for the
 * `CustomEvent`/`EventTarget` globals):
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/image-settings-sync.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getLastImageSettings,
  publishImageSettings,
  subscribeImageSettings,
  type ImageSyncSettings,
} from "./image-settings-sync.ts";

let n = 0;
const freshGroup = () => `settings-group-${n++}`;

test("a subscriber receives a peer's settings patch", () => {
  const g = freshGroup();
  const received: ImageSyncSettings[] = [];
  const off = subscribeImageSettings(g, "sub", (p) => received.push(p));
  publishImageSettings(g, "peer", { colormap: "turbo" });
  off();
  assert.deepEqual(received, [{ colormap: "turbo" }]);
});

test("echo guard: a publisher never receives its own patch", () => {
  const g = freshGroup();
  const received: ImageSyncSettings[] = [];
  const off = subscribeImageSettings(g, "self", (p) => received.push(p));
  publishImageSettings(g, "self", { colormap: "magma" }); // own → ignored
  publishImageSettings(g, "other", { colormap: "plasma" }); // peer → delivered
  off();
  assert.deepEqual(received, [{ colormap: "plasma" }]);
});

test("a colormap change broadcasts to every selected member", () => {
  const g = freshGroup();
  const a: ImageSyncSettings[] = [];
  const b: ImageSyncSettings[] = [];
  const offA = subscribeImageSettings(g, "A", (p) => a.push(p));
  const offB = subscribeImageSettings(g, "B", (p) => b.push(p));
  // C (a third selected member) changes its colormap.
  publishImageSettings(g, "C", { colormap: "turbo" });
  offA();
  offB();
  assert.deepEqual(a, [{ colormap: "turbo" }]);
  assert.deepEqual(b, [{ colormap: "turbo" }]);
});

test("getLastImageSettings ACCUMULATES a merged snapshot for a late joiner", () => {
  const g = freshGroup();
  publishImageSettings(g, "anchor", { colormap: "turbo", tonemap: "aces" });
  publishImageSettings(g, "anchor", { exposureEV: 1.5 });
  // A pane joining now should see the full merged group state.
  assert.deepEqual(getLastImageSettings(g), {
    colormap: "turbo",
    tonemap: "aces",
    exposureEV: 1.5,
  });
});

test("a newly-added member adopts the group's current settings on join", () => {
  const g = freshGroup();
  // The anchor seeds its full settings snapshot when the group forms.
  publishImageSettings(g, "anchor", {
    colormap: "magma",
    tonemap: "reinhard",
    exposureEV: 2,
    offset: 0.1,
  });
  // The joiner reads the accumulated snapshot (what its adopt-on-join effect does).
  const adopted = getLastImageSettings(g);
  assert.deepEqual(adopted, {
    colormap: "magma",
    tonemap: "reinhard",
    exposureEV: 2,
    offset: 0.1,
  });
});

// --- Broadened (superset) payload: compare-only keys ride the SAME bus -------

test("the broadened payload carries compare-only keys through publish/subscribe", () => {
  const g = freshGroup();
  const received: ImageSyncSettings[] = [];
  const off = subscribeImageSettings(g, "sub", (p) => received.push(p));
  publishImageSettings(g, "peer", { compareMode: "diff", diffKernel: "hdr-flip" });
  publishImageSettings(g, "peer", { splitPosition: 0.3 });
  off();
  assert.deepEqual(received, [
    { compareMode: "diff", diffKernel: "hdr-flip" },
    { splitPosition: 0.3 },
  ]);
});

test("getLastImageSettings merges compare-only shared keys for a late joiner (mode/split persist)", () => {
  const g = freshGroup();
  // A compare anchor seeds BOTH the shared look and its compare-only settings.
  // compareMode / splitPosition PERSIST (a split joiner must align to the
  // group's mode + divider).
  publishImageSettings(g, "anchor", {
    colormap: "turbo",
    tonemap: "aces",
    compareMode: "split",
    splitPosition: 0.25,
  });
  assert.deepEqual(getLastImageSettings(g), {
    colormap: "turbo",
    tonemap: "aces",
    compareMode: "split",
    splitPosition: 0.25,
  });
});

test("diffKernel is a NORMAL synced value: broadcast live AND persisted into the snapshot", () => {
  // Settings-model simplification (ruling 3/4): the diff kernel is part of the
  // viewport's settings vocabulary and mirrors like any other field — a selected
  // group adopts the first viewport's kernel (including on formation/join). The
  // former EPHEMERAL_KEYS carve-out is gone.
  const g = freshGroup();
  const live: ImageSyncSettings[] = [];
  const off = subscribeImageSettings(g, "peer", (p) => live.push(p));
  publishImageSettings(g, "anchor", { colormap: "turbo", diffKernel: "ssim" });
  off();
  // LIVE: an already-selected peer mirrors the full patch, kernel included.
  assert.deepEqual(live, [{ colormap: "turbo", diffKernel: "ssim" }]);
  // SNAPSHOT (what a late joiner / re-formed selection reads): the kernel PERSISTS.
  assert.deepEqual(getLastImageSettings(g), { colormap: "turbo", diffKernel: "ssim" });
});

// --- Flat merge: no tag, no scoping, no special reconcile (ruling 5) ----------
// The bus stores every key by value with a plain spread. `compareMode` is the
// real composite mode, not a face tag; a value that doesn't apply to a pane's
// content is stored and simply doesn't alter that render (applicability at
// RENDER, not sync). These replace the retired M3 mode-aware-tag tests.

test("flat merge: a later colormap overwrites the field but leaves other keys (incl. compareMode) intact", () => {
  const g = freshGroup();
  // A diff seeds its scalar-error look + real diff mode.
  publishImageSettings(g, "diff", {
    encoding: "magma",
    colormap: "magma",
    tonemap: "srgb",
    compareMode: "diff",
  });
  // An image then publishes turbo (no compareMode). Flat merge: colormap becomes
  // turbo; compareMode is untouched — no tag-clearing magic. A light joiner stores
  // turbo and doesn't false-color (arity gating at render).
  publishImageSettings(g, "image", { encoding: "turbo", colormap: "turbo", tonemap: "srgb" });
  assert.deepEqual(getLastImageSettings(g), {
    encoding: "turbo",
    colormap: "turbo",
    tonemap: "srgb",
    compareMode: "diff",
  });
});

test("flat merge: compareMode / split persist for a late joiner", () => {
  const g = freshGroup();
  publishImageSettings(g, "split", {
    encoding: "srgb",
    colormap: "none",
    tonemap: "srgb",
    compareMode: "split",
    splitPosition: 0.3,
  });
  publishImageSettings(g, "split", { exposureEV: 1.5 });
  assert.deepEqual(getLastImageSettings(g), {
    encoding: "srgb",
    colormap: "none",
    tonemap: "srgb",
    compareMode: "split",
    splitPosition: 0.3,
    exposureEV: 1.5,
  });
});

// PARTIAL-APPLY contract: a subscriber APPLIES ONLY THE KEYS IT OWNS. An image
// pane's apply reads no compare-only keys, so a compare patch is a no-op for
// its compare-irrelevant state; a compare pane's apply reads both sets. Modeled
// here with the two panes' actual apply shapes (raw setters) so the property is
// asserted independent of any React harness.
test("partial-apply: a compare patch is a no-op for an image-settings consumer", () => {
  // The image pane's apply function (mirrors GpuImagePane.applyRemoteSettings):
  // it reads ONLY the shared image keys — it never looks at compareMode/etc.
  const imageState: Record<string, unknown> = { colormap: "gray", tonemap: "srgb" };
  const applyImage = (patch: ImageSyncSettings) => {
    if (patch.colormap !== undefined) imageState.colormap = patch.colormap;
    if (patch.tonemap !== undefined) imageState.tonemap = patch.tonemap;
    if (patch.tonemapGamma !== undefined) imageState.tonemapGamma = patch.tonemapGamma;
    if (patch.peak !== undefined) imageState.peak = patch.peak;
    if (patch.exposureEV !== undefined) imageState.exposureEV = patch.exposureEV;
    if (patch.offset !== undefined) imageState.offset = patch.offset;
  };

  // The compare pane's apply function (mirrors GpuComparePane.applyRemoteSettings):
  // reads the shared keys PLUS the compare-only keys.
  const compareState: Record<string, unknown> = {
    colormap: "gray",
    compareMode: "split",
    diffKernel: "absolute",
    splitPosition: 0.5,
  };
  const applyCompare = (patch: ImageSyncSettings) => {
    if (patch.colormap !== undefined) compareState.colormap = patch.colormap;
    if (patch.compareMode !== undefined) compareState.compareMode = patch.compareMode;
    if (patch.diffKernel !== undefined) compareState.diffKernel = patch.diffKernel;
    if (patch.splitPosition !== undefined) compareState.splitPosition = patch.splitPosition;
  };

  // A compare pane publishes a mode+colormap change.
  const patch: ImageSyncSettings = { compareMode: "diff", diffKernel: "ssim", colormap: "turbo" };

  applyImage(patch);
  // The image pane took the SHARED colormap but is UNTOUCHED by the compare-only
  // keys (it has no such state; the keys were a no-op for it).
  assert.equal(imageState.colormap, "turbo");
  assert.equal("compareMode" in imageState, false);
  assert.equal("diffKernel" in imageState, false);

  applyCompare(patch);
  // The compare pane took EVERYTHING it owns.
  assert.equal(compareState.colormap, "turbo");
  assert.equal(compareState.compareMode, "diff");
  assert.equal(compareState.diffKernel, "ssim");
  assert.equal(compareState.splitPosition, 0.5); // untouched (not in patch)
});
