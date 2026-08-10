/**
 * Integration test tying the SELECTION store to the viewport + settings sync
 * buses through the SAME `paneSyncGroups` derivation the React layer
 * (`plot-node.tsx`'s `SelectionCell`) uses. This is the node-runnable proof of
 * the "browser/smoke" requirement: two SELECTED panes share a zoom AND a
 * colormap change, and an UNSELECTED third does not — plus a newly-added member
 * adopts the anchor's state.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/selection-sync.test.ts
 *
 * Each pane is modelled as: its group ids (from `paneSyncGroups`) + a bus
 * subscription that records what it receives — exactly the plumbing a real pane
 * gets via `useSyncedImageViewport` / `useSyncedImageSettings`, minus React.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SelectionStore, paneSyncGroups } from "./selection-store.ts";
import {
  publishImageViewportState,
  subscribeImageViewportState,
  type ImageSyncViewport,
} from "./image-viewport-sync.ts";
import {
  getLastImageSettings,
  publishImageSettings,
  subscribeImageSettings,
  type ImageSyncSettings,
} from "./image-settings-sync.ts";

let n = 0;
const freshBase = () => `sel-int-${n++}`;

/** Wire a pane into whatever viewport+settings groups its selection implies,
 *  recording every payload it receives. Returns the recorders + an unsubscribe. */
function wirePane(store: SelectionStore, paneId: string, base: string) {
  const groups = paneSyncGroups(store, paneId, base);
  const viewports: ImageSyncViewport[] = [];
  const settings: ImageSyncSettings[] = [];
  const offs: Array<() => void> = [];
  if (groups) {
    offs.push(
      subscribeImageViewportState(groups.viewportGroupId, paneId, (v) => viewports.push(v)),
      subscribeImageSettings(groups.settingsGroupId, paneId, (p) => settings.push(p)),
    );
  }
  return { groups, viewports, settings, off: () => offs.forEach((f) => f()) };
}

test("two SELECTED panes share zoom + colormap; an unselected third does not", () => {
  const base = freshBase();
  const store = new SelectionStore();
  // Select A, then shift-click B → {A, B}. C stays unselected.
  store.select("A", "replace");
  store.select("B", "toggle");

  const A = wirePane(store, "A", base);
  const B = wirePane(store, "B", base);
  const C = wirePane(store, "C", base);

  // A and B are in the SAME sync groups; C is in none.
  assert.ok(A.groups && B.groups, "A and B are active members");
  assert.equal(A.groups!.viewportGroupId, B.groups!.viewportGroupId);
  assert.equal(A.groups!.settingsGroupId, B.groups!.settingsGroupId);
  assert.equal(C.groups, null, "the unselected third pane is not in any sync group");
  assert.equal(A.groups!.isAnchor, true, "A (first-selected) is the anchor");
  assert.equal(B.groups!.isAnchor, false);

  // A zooms → B receives it; C does not.
  publishImageViewportState(A.groups!.viewportGroupId, "A", { zoom: 3, pan: { x: 5, y: 6 } });
  assert.deepEqual(B.viewports, [{ zoom: 3, pan: { x: 5, y: 6 } }]);
  assert.deepEqual(C.viewports, [], "unselected pane's viewport is untouched");

  // A changes colormap → B receives it; C does not.
  publishImageSettings(A.groups!.settingsGroupId, "A", { colormap: "magma" });
  assert.deepEqual(B.settings, [{ colormap: "magma" }]);
  assert.deepEqual(C.settings, [], "unselected pane's settings are untouched");

  A.off();
  B.off();
  C.off();
});

test("a newly-ADDED member adopts the anchor's current view + settings", () => {
  const base = freshBase();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle"); // {A, B} — A is anchor

  const g = paneSyncGroups(store, "A", base)!;
  // The anchor seeds the group (what `useSyncedImage*`'s anchor effect does).
  publishImageViewportState(g.viewportGroupId, "A", { zoom: 2, pan: { x: 1, y: 2 } });
  publishImageSettings(g.settingsGroupId, "A", { colormap: "viridis", exposureEV: 1 });

  // C is now shift-clicked in → it joins the SAME groups and adopts last state.
  store.select("C", "toggle");
  const gC = paneSyncGroups(store, "C", base)!;
  assert.equal(gC.viewportGroupId, g.viewportGroupId, "C joins the anchor's group");
  assert.equal(gC.isAnchor, false, "a newly-added member is never the anchor");
  assert.deepEqual(
    getLastImageSettings(gC.settingsGroupId),
    { colormap: "viridis", exposureEV: 1 },
    "the joiner reads the group's accumulated settings",
  );
});

test("selectable:false is not modelled as an active member (helper sees no such id)", () => {
  // The React layer never calls `store.select` for a selectable:false cell, so a
  // non-selectable pane id simply never enters the selection — it derives to no
  // groups even when others are selected.
  const base = freshBase();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle");
  assert.equal(paneSyncGroups(store, "NON_SELECTABLE", base), null);
});
