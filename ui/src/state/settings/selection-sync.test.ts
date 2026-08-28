/**
 * Integration test tying the SELECTION store to the OBJECT-MODEL settings
 * (channels + frame-owned objects) through the SAME `paneSyncGroups`
 * derivation the React layer uses. Node-runnable proof: two SELECTED panes
 * share settings (incl. the folded `view`), an UNSELECTED third does not,
 * the anchor's formation seed converges the group, a late joiner converges
 * by PEER DEREF, and everything PERSISTS after deselection (2026-08-26
 * ruling reversal).
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/selection-sync.test.ts
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SelectionStore, paneSyncGroups } from "../../state/selection/selection-store.ts";
import {
  __resetSettingsChannelsForTest,
  publishSettingsPatch,
  subscribeSettingsPatches,
  type ViewportSettings,
} from "./viewport-settings.ts";

let n = 0;
const freshBase = () => `sel-int-${n++}`;

beforeEach(() => {
  __resetSettingsChannelsForTest();
});

/** A pane modelled as the frame holds it: own object + membership from
 *  `paneSyncGroups` + a registry-style deref for peers. */
function wirePane(store: SelectionStore, paneId: string, base: string, registry: Map<string, () => ViewportSettings | null>) {
  const groups = paneSyncGroups(store, paneId, base);
  const vp = {
    groups,
    settings: null as ViewportSettings | null,
    lastApplied: null as ViewportSettings | null,
    off: () => {},
    apply(patch: ViewportSettings) {
      if (vp.lastApplied === patch) return;
      vp.lastApplied = patch;
      vp.settings = { ...(vp.settings ?? {}), ...patch };
    },
    set(patch: ViewportSettings) {
      vp.apply(patch);
      if (groups) publishSettingsPatch(groups.settingsGroupId, patch);
    },
  };
  registry.set(paneId, () => vp.settings);
  if (groups) vp.off = subscribeSettingsPatches(groups.settingsGroupId, (p) => vp.apply(p));
  // LATE-JOIN CONVERGENCE (what the frame's effect does): a NON-anchor member
  // entering a live group adopts a peer's current settings by deref.
  if (groups && !groups.isAnchor) {
    for (const peerId of store.getSelected()) {
      if (peerId === paneId) continue;
      const peer = registry.get(peerId)?.();
      if (peer) {
        vp.apply({ ...peer });
        break;
      }
    }
  }
  return vp;
}

test("two SELECTED panes share settings + view; unselected third untouched; PERSISTS after deselect", () => {
  const base = freshBase();
  const registry = new Map<string, () => ViewportSettings | null>();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle"); // {A, B} — A anchor

  const A = wirePane(store, "A", base, registry);
  const B = wirePane(store, "B", base, registry);
  const C = wirePane(store, "C", base, registry);
  assert.ok(A.groups && B.groups && A.groups!.isAnchor && !B.groups!.isAnchor);
  assert.equal(C.groups, null);

  A.set({ encoding: "magma", view: { zoom: 3, pan: { x: 5, y: 6 } } });
  assert.equal(B.settings!.encoding, "magma");
  assert.deepEqual(B.settings!.view, { zoom: 3, pan: { x: 5, y: 6 } });
  assert.equal(C.settings, null);

  // DESELECT: memberships end — the mirrored values PERSIST; edits stop fanning.
  A.off();
  B.off();
  assert.equal(B.settings!.encoding, "magma");
  A.set({ encoding: "srgb" });
  assert.equal(B.settings!.encoding, "magma");
});

test("anchor formation seed converges; a late-added member converges by peer deref", () => {
  const base = freshBase();
  const registry = new Map<string, () => ViewportSettings | null>();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle");

  const A = wirePane(store, "A", base, registry);
  const B = wirePane(store, "B", base, registry);
  // The anchor's formation seed (useSeedGroupOnFormation): full effective
  // snapshot, published like any edit — persistent.
  A.set({ encoding: "turbo", exposureEV: 1, view: { zoom: 2, pan: { x: 1, y: 2 } } });
  assert.equal(B.settings!.encoding, "turbo");

  // C shift-clicked in later: joins the SAME episode group, converges by deref.
  store.select("C", "toggle");
  const C = wirePane(store, "C", base, registry);
  assert.equal(C.groups!.settingsGroupId, A.groups!.settingsGroupId);
  assert.equal(C.groups!.isAnchor, false);
  assert.equal(C.settings!.encoding, "turbo");
  assert.deepEqual(C.settings!.view, { zoom: 2, pan: { x: 1, y: 2 } });
  // And from now on it mirrors live.
  A.set({ peak: 8 });
  assert.equal(C.settings!.peak, 8);
});

test("selectable:false derives to no groups", () => {
  const base = freshBase();
  const store = new SelectionStore();
  store.select("A", "replace");
  store.select("B", "toggle");
  assert.equal(paneSyncGroups(store, "NON_SELECTABLE", base), null);
});
