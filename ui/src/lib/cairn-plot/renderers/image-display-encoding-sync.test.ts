/**
 * Unit tests for the ONE shared content-kind display-encoding sync rule (M4).
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/image-display-encoding-sync.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldAdoptDisplayEncoding,
  adoptRemoteDisplayEncoding,
  diffFaceTag,
} from "./image-display-encoding-sync.ts";
import type { ImageSyncSettings } from "../viewport/image-settings-sync.ts";

test("scoping: a diff-tagged encoding is REFUSED by a non-diff (light) pane", () => {
  const patch: ImageSyncSettings = { encoding: "magma", compareMode: "diff" };
  assert.equal(shouldAdoptDisplayEncoding(patch, false), false); // light pane refuses
  assert.equal(shouldAdoptDisplayEncoding(patch, true), true); // a diff pane adopts
});

test("scoping: an UNTAGGED (image) encoding is adopted by EVERY face", () => {
  const patch: ImageSyncSettings = { encoding: "turbo" };
  assert.equal(shouldAdoptDisplayEncoding(patch, false), true);
  assert.equal(shouldAdoptDisplayEncoding(patch, true), true);
});

test("scoping: a split/blend (non-diff) tag is adopted by a light pane", () => {
  assert.equal(shouldAdoptDisplayEncoding({ colormap: "none", compareMode: "split" }, false), true);
  assert.equal(shouldAdoptDisplayEncoding({ colormap: "none", compareMode: "blend" }, false), true);
});

test("adopt: encoding is primary; colormap/tonemap are back-compat fallbacks", () => {
  let last = "";
  const set = (id: string) => (last = id);
  adoptRemoteDisplayEncoding(set, { encoding: "e", colormap: "c", tonemap: "t" }, false);
  assert.equal(last, "e");
  last = "";
  adoptRemoteDisplayEncoding(set, { colormap: "turbo", tonemap: "t" }, false);
  assert.equal(last, "turbo");
  last = "";
  adoptRemoteDisplayEncoding(set, { colormap: "none", tonemap: "srgb" }, false);
  assert.equal(last, "srgb"); // colormap "none" skips to tonemap
});

test("adopt: a diff-tagged encoding does NOT reach a light pane's store", () => {
  let called = false;
  adoptRemoteDisplayEncoding(() => (called = true), { encoding: "magma", compareMode: "diff" }, false);
  assert.equal(called, false);
});

test("diffFaceTag: a diff face tags 'diff', a light face carries no tag", () => {
  assert.deepEqual(diffFaceTag(true), { compareMode: "diff" });
  assert.deepEqual(diffFaceTag(false), {});
});
