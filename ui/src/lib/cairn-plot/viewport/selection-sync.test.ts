/**
 * Integration test tying the SELECTION store to the NOSTACK settings registry
 * through the SAME `paneSyncGroups` derivation the React layer
 * (`plot-node.tsx`'s `PaneSelectionFrame`) uses. Node-runnable proof:
 * two SELECTED panes share settings (incl. the folded `view` transform), an
 * UNSELECTED third does not, a newly-added member CONVERGES on join, the
 * anchor's formation seed converges the group, and everything PERSISTS after
 * deselection (the 2026-08-26 ruling reversal).
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/selection-sync.test.ts
 *
 * Each pane is modelled as: its stable entry id (`vp-st-<paneId>`) + a group
 * membership derived from `paneSyncGroups` — exactly the plumbing a real pane
 * gets via `useViewportSettings`, minus React.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SelectionStore, paneSyncGroups } from "./selection-store.ts";
import {
  __resetImageSettingsStoresForTest,
  getViewportSettings,
  joinSettingsGroup,
  publishViewportSettings,
} from "./image-settings-sync.ts";

let n = 0;
const freshBase = () => `sel-int-${n++}`;
const entry = (paneId: string) => `vp-st-${paneId}`;

beforeEach(() => {
  __resetImageSettingsStoresForTest();
});

/** Join a pane into whatever settings group its selection implies (what the
 *  React hook's membership effect does). Returns the groups + leave. */
function wirePane(store: SelectionStore, paneId: string, base: string) {
  const groups = paneSyncGroups(store, paneId, base);
  const leave = groups ? joinSettingsGroup(groups.settingsGroupId, entry(paneId)) : () => {};
  return { groups, leave };
}

test("two SELECTED panes share settings + view; an unselected third does not; edits PERSIST after deselect", () => {
  const base = freshBase();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle"); // {A, B} — A is anchor

  const A = wirePane(store, "A", base);
  const B = wirePane(store, "B", base);
  const C = wirePane(store, "C", base);

  assert.ok(A.groups && B.groups, "A and B are active members");
  assert.equal(A.groups!.settingsGroupId, B.groups!.settingsGroupId);
  assert.equal(C.groups, null, "the unselected third pane is not in any sync group");
  assert.equal(A.groups!.isAnchor, true, "A (first-selected) is the anchor");
  assert.equal(B.groups!.isAnchor, false);

  // An edit on A (colormap AND zoom — view is a setting now) fans into B's
  // OWN entry; C is untouched.
  publishViewportSettings(entry("A"), {
    encoding: "magma",
    view: { zoom: 3, pan: { x: 5, y: 6 } },
  });
  assert.equal(getViewportSettings(entry("B"))!.encoding, "magma");
  assert.deepEqual(getViewportSettings(entry("B"))!.view, { zoom: 3, pan: { x: 5, y: 6 } });
  assert.equal(getViewportSettings(entry("C")), null, "unselected pane untouched");

  // DESELECT: members leave — everything they mirrored PERSISTS (reversal),
  // and further edits no longer fan out.
  A.leave();
  B.leave();
  assert.equal(getViewportSettings(entry("B"))!.encoding, "magma");
  publishViewportSettings(entry("A"), { encoding: "srgb" });
  assert.equal(getViewportSettings(entry("B"))!.encoding, "magma");
});

test("formation seed converges the group; a newly-ADDED member converges on join", () => {
  const base = freshBase();
  const store = new SelectionStore();
  // B has its own pre-selection look.
  publishViewportSettings(entry("B"), { encoding: "own-b", exposureEV: -1 }, { fanOut: false });
  store.select("A", "replace");
  store.select("B", "toggle"); // {A, B} — A is anchor

  const gA = paneSyncGroups(store, "A", base)!;
  const gB = paneSyncGroups(store, "B", base)!;
  joinSettingsGroup(gA.settingsGroupId, entry("A"));
  joinSettingsGroup(gB.settingsGroupId, entry("B"));

  // The ANCHOR's formation seed (what `useSeedGroupOnFormation` publishes):
  // its full effective snapshot — converges every member (persistent).
  publishViewportSettings(entry("A"), {
    encoding: "turbo",
    exposureEV: 1,
    view: { zoom: 2, pan: { x: 1, y: 2 } },
  });
  assert.equal(getViewportSettings(entry("B"))!.encoding, "turbo");
  assert.equal(getViewportSettings(entry("B"))!.exposureEV, 1);

  // C is shift-clicked in later → joins the SAME group and CONVERGES on join
  // (adopts an existing member's entry).
  store.select("C", "toggle");
  const gC = paneSyncGroups(store, "C", base)!;
  assert.equal(gC.settingsGroupId, gA.settingsGroupId, "C joins the same episode group");
  assert.equal(gC.isAnchor, false, "a newly-added member is never the anchor");
  joinSettingsGroup(gC.settingsGroupId, entry("C"));
  assert.equal(getViewportSettings(entry("C"))!.encoding, "turbo");
  assert.deepEqual(getViewportSettings(entry("C"))!.view, { zoom: 2, pan: { x: 1, y: 2 } });
});

test("selectable:false is not modelled as an active member (helper sees no such id)", () => {
  const base = freshBase();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle");
  assert.equal(paneSyncGroups(store, "NON_SELECTABLE", base), null);
});
