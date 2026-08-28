/**
 * Pure unit tests for the multi-viewport SELECTION store. Runs under Node's
 * built-in test runner with TypeScript type-stripping (same harness as the
 * sync-bus tests):
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/selection-store.test.ts
 *
 * The store is React-free, so this needs no DOM/React harness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SelectionStore,
  getGlobalSelectionStore,
  nextSelectionPaneId,
  __resetGlobalSelectionStoreForTest,
} from "./selection-store.ts";

test("plain click selects ONLY that pane (replaces prior selection)", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  assert.deepEqual([...s.getSelected()], ["a"]);
  s.select("b", "replace");
  assert.deepEqual([...s.getSelected()], ["b"], "plain click on b replaces a");
  assert.equal(s.isSelected("a"), false);
});

test("plain click collapses a multi-selection down to one", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.select("c", "toggle");
  assert.equal(s.count(), 3);
  s.select("b", "replace"); // plain click on an already-in-set pane
  assert.deepEqual([...s.getSelected()], ["b"]);
});

test("shift/ctrl click ADDS a pane (additive multi-select)", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  assert.deepEqual([...s.getSelected()], ["a", "b"]);
  assert.equal(s.count(), 2);
});

test("toggle click removes an already-selected pane", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.select("a", "toggle"); // toggle a back off
  assert.deepEqual([...s.getSelected()], ["b"]);
});

test("anchor is the first-selected pane (insertion order stable)", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.select("c", "toggle");
  assert.equal(s.anchor(), "a");
  s.select("a", "toggle"); // remove the anchor
  assert.equal(s.anchor(), "b", "next-in-order becomes anchor");
});

test("reference is the LAST-selected pane by default", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  assert.equal(s.reference(), "a", "sole selection is its own reference");
  s.select("b", "toggle");
  s.select("c", "toggle");
  assert.equal(s.anchor(), "a", "anchor stays the FIRST-selected");
  assert.equal(s.reference(), "c", "reference is the LAST-selected");
});

test("reference falls back to the new last-selected when the reference is removed", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.select("c", "toggle");
  assert.equal(s.reference(), "c");
  s.select("c", "toggle"); // toggle the reference back off
  assert.equal(s.reference(), "b", "next-last-in-order becomes the reference");
  s.remove("b");
  assert.equal(s.reference(), "a");
});

test("setReference pins a selected pane as the reference (re-pick)", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.select("c", "toggle");
  assert.equal(s.reference(), "c");
  s.setReference("a");
  assert.equal(s.reference(), "a", "a is now pinned as the reference");
  assert.equal(s.anchor(), "a", "anchor unaffected");
  // A fresh add makes the new pane the reference (a subsequent add wins).
  s.select("d", "toggle");
  assert.equal(s.reference(), "d");
});

test("setReference ignores an unselected id and no-ops on the current reference", () => {
  const s = new SelectionStore();
  let fires = 0;
  s.select("a", "replace");
  s.select("b", "toggle");
  s.subscribe(() => fires++);
  s.setReference("zzz"); // not selected
  assert.equal(fires, 0, "pinning an unselected id is a no-op");
  s.setReference("b"); // b is already the (last-selected) reference
  assert.equal(fires, 0, "pinning the current reference does not emit");
  s.setReference("a"); // real change
  assert.equal(s.reference(), "a");
  assert.equal(fires, 1);
});

test("getSnapshot changes identity when the reference changes (not just the set)", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  const before = s.getSnapshot();
  assert.deepEqual([...before.selected], ["a", "b"]);
  assert.equal(before.reference, "b");
  s.setReference("a"); // set unchanged, reference moved
  const after = s.getSnapshot();
  assert.notEqual(after, before, "a reference-only change yields a new snapshot identity");
  assert.equal(after.reference, "a");
});

test("clear drops the reference", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.clear();
  assert.equal(s.reference(), null);
});

test("requestStage delivers to stage listeners; unsubscribe stops it", () => {
  const s = new SelectionStore();
  const seen: string[] = [];
  const off = s.onStageRequest((m) => seen.push(m));
  s.requestStage("enlarge");
  s.requestStage("compare");
  assert.deepEqual(seen, ["enlarge", "compare"]);
  off();
  s.requestStage("enlarge");
  assert.deepEqual(seen, ["enlarge", "compare"], "unsubscribed stage listener no longer fires");
});

test("subscribers fire on change and not on no-op", () => {
  const s = new SelectionStore();
  let fires = 0;
  const off = s.subscribe(() => {
    fires++;
  });
  s.select("a", "replace");
  assert.equal(fires, 1);
  s.select("a", "replace"); // identical sole selection → no emit
  assert.equal(fires, 1, "re-selecting the sole selection is a no-op");
  s.select("b", "toggle");
  assert.equal(fires, 2);
  off();
  s.select("c", "toggle");
  assert.equal(fires, 2, "unsubscribed listener no longer fires");
});

test("getSelected returns a stable reference between mutations", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  const snap1 = s.getSelected();
  const snap2 = s.getSelected();
  assert.equal(snap1, snap2, "same reference → safe as a useSyncExternalStore snapshot");
  s.select("b", "toggle");
  assert.notEqual(s.getSelected(), snap1, "new reference after a real change");
});

test("prune drops ids of unmounted panes", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  s.select("c", "toggle");
  s.prune(new Set(["a", "c"])); // b unmounted
  assert.deepEqual([...s.getSelected()], ["a", "c"]);
});

test("remove drops a single unmounting pane id (never adds)", () => {
  const s = new SelectionStore();
  s.select("a", "replace");
  s.select("b", "toggle");
  let fires = 0;
  s.subscribe(() => fires++);
  s.remove("a"); // a's pane unmounts
  assert.deepEqual([...s.getSelected()], ["b"]);
  assert.equal(fires, 1);
  s.remove("a"); // already gone → no-op, no emit, no re-add
  assert.deepEqual([...s.getSelected()], ["b"]);
  assert.equal(fires, 1, "removing an absent id is a no-op");
});

test("getGlobalSelectionStore returns ONE page-wide store (all mounts share it)", () => {
  __resetGlobalSelectionStoreForTest();
  const a = getGlobalSelectionStore();
  const b = getGlobalSelectionStore();
  assert.equal(a, b, "every mount obtains the same document-scoped store");
  a.select("pane-1", "replace");
  assert.deepEqual(
    [...getGlobalSelectionStore().getSelected()],
    ["pane-1"],
    "a selection made via one handle is visible through the singleton",
  );
  __resetGlobalSelectionStoreForTest();
  assert.equal(getGlobalSelectionStore().count(), 0, "reset yields a fresh empty store");
});

test("nextSelectionPaneId is process-unique across mounts (no useId collision)", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) ids.add(nextSelectionPaneId());
  assert.equal(ids.size, 100, "every generated pane id is distinct");
});
