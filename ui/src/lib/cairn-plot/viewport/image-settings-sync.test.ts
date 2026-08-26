/**
 * Unit tests for the NOSTACK viewport-settings registry
 * (`image-settings-sync.ts`): flat per-viewport entries, group fan-out
 * (transitive union, key-scoped groups), converge-on-join, PERSISTENCE on
 * leave (the 2026-08-26 ruling reversal), copy-on-create, and the
 * explicit-`undefined` mask merge. Node-runnable (framework-free module).
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  __resetImageSettingsStoresForTest,
  copyViewportSettings,
  getViewportSettings,
  joinSettingsGroup,
  publishViewportSettings,
  settingsGroupPeers,
  subscribeViewportSettings,
} from "./image-settings-sync.ts";

beforeEach(() => {
  __resetImageSettingsStoresForTest();
});

test("an entry is null until written, then identity-stable until the next write", () => {
  assert.equal(getViewportSettings("a"), null);
  publishViewportSettings("a", { encoding: "magma" });
  const first = getViewportSettings("a");
  assert.deepEqual(first, { encoding: "magma" });
  assert.equal(getViewportSettings("a"), first); // identity-stable read
  publishViewportSettings("a", { exposureEV: 2 });
  const second = getViewportSettings("a");
  assert.notEqual(second, first);
  assert.deepEqual(second, { encoding: "magma", exposureEV: 2 });
});

test("publish fans out to every group member's OWN entry (publish path == apply path)", () => {
  joinSettingsGroup("g", "a");
  joinSettingsGroup("g", "b");
  publishViewportSettings("a", { encoding: "turbo" });
  assert.deepEqual(getViewportSettings("a"), { encoding: "turbo" });
  assert.deepEqual(getViewportSettings("b"), { encoding: "turbo" });
});

test("writes PERSIST after leaving the group (ruling reversal)", () => {
  const leaveA = joinSettingsGroup("g", "a");
  const leaveB = joinSettingsGroup("g", "b");
  publishViewportSettings("a", { encoding: "magma", exposureEV: 1.5 });
  leaveA();
  leaveB();
  assert.deepEqual(getViewportSettings("b"), { encoding: "magma", exposureEV: 1.5 });
  // Post-leave writes no longer fan out.
  publishViewportSettings("a", { exposureEV: 3 });
  assert.equal(getViewportSettings("b")!.exposureEV, 1.5);
});

test("late join converges: the joiner adopts an existing member's entry", () => {
  joinSettingsGroup("g", "a");
  publishViewportSettings("a", { encoding: "viridis-like", peak: 4 });
  publishViewportSettings("c", { encoding: "own", offset: 9 }, { fanOut: false });
  joinSettingsGroup("g", "c");
  const c = getViewportSettings("c")!;
  // Adopted keys overwrite; untouched keys remain.
  assert.equal(c.encoding, "viridis-like");
  assert.equal(c.peak, 4);
  assert.equal(c.offset, 9);
});

test("fan-out is TRANSITIVE across groups (union ruling)", () => {
  // a-g1-b, b-g2-c: an edit on a reaches c through b.
  joinSettingsGroup("g1", "a");
  joinSettingsGroup("g1", "b");
  joinSettingsGroup("g2", "b");
  joinSettingsGroup("g2", "c");
  publishViewportSettings("a", { diffKernel: "flip" });
  assert.equal(getViewportSettings("c")!.diffKernel, "flip");
  assert.deepEqual([...settingsGroupPeers("a")].sort(), ["b", "c"]);
});

test("key-scoped groups fan ONLY their keys (authored grid view sync)", () => {
  joinSettingsGroup("grid", "a", ["view"]);
  joinSettingsGroup("grid", "b", ["view"]);
  publishViewportSettings("a", {
    encoding: "magma",
    view: { zoom: 2, pan: { x: 1, y: 1 } },
  });
  const b = getViewportSettings("b")!;
  assert.deepEqual(b.view, { zoom: 2, pan: { x: 1, y: 1 } });
  assert.equal(b.encoding, undefined);
  // The writer itself always takes the full patch.
  assert.equal(getViewportSettings("a")!.encoding, "magma");
});

test("scope narrowing never masks a wider path (widest patch wins per member)", () => {
  // a and b share BOTH an unscoped group and a view-scoped one - b must get
  // the full patch regardless of which group the BFS visits first.
  joinSettingsGroup("sel", "a");
  joinSettingsGroup("sel", "b");
  joinSettingsGroup("grid", "a", ["view"]);
  joinSettingsGroup("grid", "b", ["view"]);
  publishViewportSettings("a", { encoding: "magma", view: { zoom: 3, pan: { x: 0, y: 0 } } });
  const b = getViewportSettings("b")!;
  assert.equal(b.encoding, "magma");
  assert.equal(b.view!.zoom, 3);
});

test("fanOut:false writes only the local entry (reframe-style adaptation)", () => {
  joinSettingsGroup("g", "a");
  joinSettingsGroup("g", "b");
  publishViewportSettings("a", { view: { zoom: 5, pan: { x: 0, y: 0 } } }, { fanOut: false });
  assert.equal(getViewportSettings("b"), null);
});

test("explicit undefined is a MASK: present-and-undefined survives the merge", () => {
  publishViewportSettings("a", { infoPanel: true });
  publishViewportSettings("a", { infoPanel: undefined });
  const a = getViewportSettings("a")!;
  assert.ok("infoPanel" in a);
  assert.equal(a.infoPanel, undefined);
});

test("copyViewportSettings REPLACES the target (stage copy-on-create)", () => {
  publishViewportSettings("src", { encoding: "magma", peak: 2 });
  publishViewportSettings("cell", { exposureEV: 7 }, { fanOut: false });
  copyViewportSettings("src", "cell");
  assert.deepEqual(getViewportSettings("cell"), { encoding: "magma", peak: 2 });
  // Copies are independent afterwards.
  publishViewportSettings("src", { peak: 9 });
  assert.equal(getViewportSettings("cell")!.peak, 2);
});

test("subscribers are notified per written viewport (including the writer)", () => {
  joinSettingsGroup("g", "a");
  joinSettingsGroup("g", "b");
  let aNotes = 0;
  let bNotes = 0;
  subscribeViewportSettings("a", () => aNotes++);
  subscribeViewportSettings("b", () => bNotes++);
  publishViewportSettings("a", { encoding: "x" });
  assert.equal(aNotes, 1);
  assert.equal(bNotes, 1);
  publishViewportSettings("b", { encoding: "y" }, { fanOut: false });
  assert.equal(aNotes, 1);
  assert.equal(bNotes, 2);
});
