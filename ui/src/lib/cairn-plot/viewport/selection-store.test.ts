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
import { SelectionStore, getSelectionStore } from "./selection-store.ts";

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

test("getSelectionStore returns one store per grid id", () => {
  const g1 = getSelectionStore("grid-x");
  const g2 = getSelectionStore("grid-x");
  const g3 = getSelectionStore("grid-y");
  assert.equal(g1, g2, "same grid id → same store");
  assert.notEqual(g1, g3, "different grid id → different store (scoped selection)");
});
