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

test("getLastImageSettings merges compare-only shared keys for a late joiner (mode/split/blend persist)", () => {
  const g = freshGroup();
  // A compare anchor seeds BOTH the shared look and its compare-only settings.
  // compareMode / splitPosition / blendAlpha PERSIST (a split/blend joiner must
  // align to the group's mode + divider/alpha).
  publishImageSettings(g, "anchor", {
    colormap: "turbo",
    tonemap: "aces",
    compareMode: "split",
    splitPosition: 0.25,
    blendAlpha: 0.75,
  });
  assert.deepEqual(getLastImageSettings(g), {
    colormap: "turbo",
    tonemap: "aces",
    compareMode: "split",
    splitPosition: 0.25,
    blendAlpha: 0.75,
  });
});

test("diffKernel is EPHEMERAL: live-broadcast to peers but NOT persisted into the snapshot", () => {
  // The M2 viewport-owned model: a diff kernel is a per-viewport content-op choice
  // (distinct diffs legitimately hold distinct kernels). An explicit pick mirrors
  // to already-selected peers, but re-forming/joining a selection must NOT collapse
  // distinct kernels onto the anchor's metric — so the kernel never accumulates.
  const g = freshGroup();
  const live: ImageSyncSettings[] = [];
  const off = subscribeImageSettings(g, "peer", (p) => live.push(p));
  publishImageSettings(g, "anchor", { colormap: "turbo", diffKernel: "ssim" });
  off();
  // LIVE: an already-selected peer mirrors the full patch, kernel included.
  assert.deepEqual(live, [{ colormap: "turbo", diffKernel: "ssim" }]);
  // SNAPSHOT (what a late joiner / re-formed selection reads): the shared colormap
  // persists, the ephemeral kernel does NOT — so no kernel collapse on join.
  assert.deepEqual(getLastImageSettings(g), { colormap: "turbo" });
});

// --- M3: mode-aware snapshot merge (the `compareMode` FACE tag) --------------

test("M3: a later image colormap CLEARS a prior diff's compareMode tag (no poisoned replay)", () => {
  const g = freshGroup();
  // A diff anchor seeds its scalar-error face, tagged diff.
  publishImageSettings(g, "diff", {
    encoding: "magma",
    colormap: "magma",
    tonemap: "srgb",
    compareMode: "diff",
  });
  // An image then publishes its colormap (no compareMode — image writes carry no tag).
  publishImageSettings(g, "image", { encoding: "turbo", colormap: "turbo", tonemap: "srgb" });
  // A late joiner must read EXACTLY what a live listener saw: turbo, UNTAGGED — so a
  // light pane adopts it (pre-fix the flat merge left {colormap:turbo, compareMode:diff}
  // and a light joiner refused it / adopted the diff's magma = the orange-frame class).
  const snap = getLastImageSettings(g)!;
  assert.equal(snap.colormap, "turbo");
  assert.equal("compareMode" in snap, false);
});

test("M3: a BARE compareMode (mode switch) does NOT re-tag stale display keys", () => {
  const g = freshGroup();
  // An image seeds an untagged colormap.
  publishImageSettings(g, "image", { encoding: "turbo", colormap: "turbo", tonemap: "srgb" });
  // Some pane switches compare mode — a bare compareMode patch, no display key.
  publishImageSettings(g, "mode", { compareMode: "diff" });
  // The snapshot's display keys keep their (image) face — the bare switch must not
  // poison them into looking like a diff's scalar-error face.
  const snap = getLastImageSettings(g)!;
  assert.equal(snap.colormap, "turbo");
  assert.equal("compareMode" in snap, false);
});

test("M3: a diff face tag PERSISTS while the diff's scoped display keys stand", () => {
  const g = freshGroup();
  publishImageSettings(g, "diff", { encoding: "magma", colormap: "magma", compareMode: "diff" });
  // A non-scoped update (exposure) must not disturb the face tag.
  publishImageSettings(g, "diff", { exposureEV: 1.5 });
  const snap = getLastImageSettings(g)!;
  assert.equal(snap.colormap, "magma");
  assert.equal(snap.compareMode, "diff"); // still diff-scoped (a light joiner refuses magma)
  assert.equal(snap.exposureEV, 1.5);
});

test("M3: a compositor (split) face tags the LIGHT curve as split — a light peer still adopts it", () => {
  const g = freshGroup();
  publishImageSettings(g, "split", {
    encoding: "srgb",
    colormap: "none",
    tonemap: "srgb",
    compareMode: "split",
    splitPosition: 0.3,
  });
  const snap = getLastImageSettings(g)!;
  assert.equal(snap.compareMode, "split"); // tagged split (NOT diff) → light peers adopt
  assert.equal(snap.splitPosition, 0.3);
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
