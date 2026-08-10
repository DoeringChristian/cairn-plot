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
