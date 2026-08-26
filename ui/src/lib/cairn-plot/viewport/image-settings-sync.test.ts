/**
 * Unit tests for the OBJECT-MODEL settings core (`image-settings-sync.ts`):
 * stateless group channels + the frame applier discipline. A "viewport" here
 * is modelled exactly as the React frame holds it — a plain object box + an
 * applier with patch-identity dedupe — proving fan-out into members' OWN
 * objects, PERSISTENCE after leaving (the 2026-08-26 ruling), key-scoped
 * memberships, and writer-applies-exactly-once. Node-runnable.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  __resetImageSettingsStoresForTest,
  publishSettingsPatch,
  scopeSettingsPatch,
  subscribeSettingsPatches,
  type SettingsKey,
  type ViewportSettings,
} from "./image-settings-sync.ts";

beforeEach(() => {
  __resetImageSettingsStoresForTest();
});

/** The frame's applier, verbatim in miniature: own object + identity dedupe. */
function makeViewport(memberships: Array<{ id: string; keys?: readonly SettingsKey[] }>) {
  const vp = {
    settings: null as ViewportSettings | null,
    applies: 0,
    unsubs: [] as Array<() => void>,
    lastApplied: null as ViewportSettings | null,
    apply(patch: ViewportSettings) {
      if (vp.lastApplied === patch) return;
      vp.lastApplied = patch;
      vp.settings = { ...(vp.settings ?? {}), ...patch };
      vp.applies++;
    },
    set(patch: ViewportSettings) {
      vp.apply(patch);
      for (const m of memberships) publishSettingsPatch(m.id, patch);
    },
    leave() {
      vp.unsubs.forEach((u) => u());
      vp.unsubs = [];
    },
  };
  for (const m of memberships) {
    vp.unsubs.push(
      subscribeSettingsPatches(m.id, (patch) => {
        const scoped = scopeSettingsPatch(patch, m.keys);
        if (scoped) vp.apply(scoped);
      }),
    );
  }
  return vp;
}

test("a set() fans into every member's OWN object; the writer applies exactly once", () => {
  const a = makeViewport([{ id: "g" }]);
  const b = makeViewport([{ id: "g" }]);
  a.set({ encoding: "turbo" });
  assert.deepEqual(a.settings, { encoding: "turbo" });
  assert.deepEqual(b.settings, { encoding: "turbo" });
  assert.equal(a.applies, 1); // direct apply + own subscription deduped by identity
  assert.equal(b.applies, 1);
});

test("edits PERSIST after leaving the group (ruling reversal)", () => {
  const a = makeViewport([{ id: "g" }]);
  const b = makeViewport([{ id: "g" }]);
  a.set({ encoding: "magma", exposureEV: 1.5 });
  a.leave();
  b.leave();
  assert.deepEqual(b.settings, { encoding: "magma", exposureEV: 1.5 });
  a.set({ exposureEV: 3 }); // no members left — writer only
  assert.equal(b.settings!.exposureEV, 1.5);
  assert.equal(a.settings!.exposureEV, 3);
});

test("key-scoped memberships apply ONLY their keys (authored grid view sync)", () => {
  const a = makeViewport([{ id: "grid", keys: ["view"] }]);
  const b = makeViewport([{ id: "grid", keys: ["view"] }]);
  a.set({ encoding: "magma", view: { zoom: 2, pan: { x: 1, y: 1 } } });
  // The writer always takes its full patch; the peer only the scoped keys.
  assert.equal(a.settings!.encoding, "magma");
  assert.deepEqual(b.settings, { view: { zoom: 2, pan: { x: 1, y: 1 } } });
});

test("a viewport in an unscoped AND a scoped group applies the full patch once each way", () => {
  const a = makeViewport([{ id: "sel" }, { id: "grid", keys: ["view"] }]);
  const b = makeViewport([{ id: "sel" }, { id: "grid", keys: ["view"] }]);
  a.set({ encoding: "x", view: { zoom: 3, pan: { x: 0, y: 0 } } });
  assert.equal(b.settings!.encoding, "x"); // via the unscoped channel
  assert.equal(b.settings!.view!.zoom, 3);
});

test("channels are stateless: a late subscriber receives nothing until the next publish", () => {
  const a = makeViewport([{ id: "g" }]);
  a.set({ encoding: "turbo" });
  const late = makeViewport([{ id: "g" }]);
  assert.equal(late.settings, null); // converge-on-join is a peer DEREF, not channel state
  a.set({ peak: 4 });
  assert.deepEqual(late.settings, { peak: 4 });
});

test("scopeSettingsPatch returns null when nothing survives (skip empty applies)", () => {
  assert.equal(scopeSettingsPatch({ encoding: "x" }, ["view"]), null);
  assert.deepEqual(scopeSettingsPatch({ encoding: "x" }, undefined), { encoding: "x" });
});

test("explicit undefined survives the merge as a mask (infoPanel back-to-auto)", () => {
  const a = makeViewport([{ id: "g" }]);
  a.set({ infoPanel: true });
  a.set({ infoPanel: undefined });
  assert.ok("infoPanel" in a.settings!);
  assert.equal(a.settings!.infoPanel, undefined);
});

test("unsubscribing the last member drops the channel (no leaks)", () => {
  const a = makeViewport([{ id: "gone" }]);
  a.leave();
  // Publishing to a dead channel is a no-op (nothing throws, nothing applies).
  publishSettingsPatch("gone", { encoding: "x" });
  assert.equal(a.settings, null);
});
