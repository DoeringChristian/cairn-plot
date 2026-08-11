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
  publishImageSettings(g, "peer", { colormap: "viridis" });
  off();
  assert.deepEqual(received, [{ colormap: "viridis" }]);
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
  publishImageSettings(g, "anchor", { colormap: "viridis", tonemap: "aces" });
  publishImageSettings(g, "anchor", { exposureEV: 1.5 });
  // A pane joining now should see the full merged group state.
  assert.deepEqual(getLastImageSettings(g), {
    colormap: "viridis",
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

test("getLastImageSettings merges compare-only AND shared keys for a late joiner", () => {
  const g = freshGroup();
  // A compare anchor seeds BOTH the shared look and its compare-only settings.
  publishImageSettings(g, "anchor", {
    colormap: "viridis",
    tonemap: "aces",
    compareMode: "split",
    splitPosition: 0.25,
    blendAlpha: 0.75,
  });
  publishImageSettings(g, "anchor", { diffKernel: "ssim" });
  assert.deepEqual(getLastImageSettings(g), {
    colormap: "viridis",
    tonemap: "aces",
    compareMode: "split",
    splitPosition: 0.25,
    blendAlpha: 0.75,
    diffKernel: "ssim",
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
