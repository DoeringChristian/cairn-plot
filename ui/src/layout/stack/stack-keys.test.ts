/**
 * Unit tests for the stacked-grid key mapping (`stack-keys.ts`).
 *   node --experimental-strip-types --test src/layout/stack/stack-keys.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { stackKeyAction, applyStackAction, stackTabBadge } from "./stack-keys.ts";

const N = 6;
const noMods = {};

test("arrows and hjkl step prev/next", () => {
  for (const k of ["ArrowLeft", "ArrowUp", "h", "k", "H", "K"]) {
    assert.deepEqual(stackKeyAction(k, noMods, N), { type: "prev" }, `${k} → prev`);
  }
  for (const k of ["ArrowRight", "ArrowDown", "l", "j", "L", "J"]) {
    assert.deepEqual(stackKeyAction(k, noMods, N), { type: "next" }, `${k} → next`);
  }
});

test("hjkl WIN over letter-jump (do not jump to tabs 8/10/11/12)", () => {
  // In a big stack, 'h' is the 8th letter but must still STEP, not jump.
  assert.deepEqual(stackKeyAction("h", noMods, 20), { type: "prev" });
  assert.deepEqual(stackKeyAction("j", noMods, 20), { type: "next" });
});

test("number jump 1-9 → tabs, 0 → tab 10", () => {
  assert.deepEqual(stackKeyAction("1", noMods, N), { type: "jump", index: 0 });
  assert.deepEqual(stackKeyAction("6", noMods, N), { type: "jump", index: 5 });
  assert.equal(stackKeyAction("7", noMods, N), null, "out of range → null");
  assert.deepEqual(stackKeyAction("0", noMods, 10), { type: "jump", index: 9 });
});

test("letter jump a-z (excluding the hjkl step keys)", () => {
  assert.deepEqual(stackKeyAction("a", noMods, N), { type: "jump", index: 0 });
  assert.deepEqual(stackKeyAction("c", noMods, N), { type: "jump", index: 2 });
  assert.deepEqual(stackKeyAction("g", noMods, 26), { type: "jump", index: 6 });
  assert.deepEqual(stackKeyAction("z", noMods, 26), { type: "jump", index: 25 });
  assert.equal(stackKeyAction("g", noMods, 3), null, "out of range → null");
});

test("modified keys never navigate (Shift reserved for compare slide-flip)", () => {
  for (const m of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    assert.equal(stackKeyAction("ArrowLeft", m, N), null);
    assert.equal(stackKeyAction("2", m, N), null);
  }
});

test("non-nav keys and empty stacks → null", () => {
  assert.equal(stackKeyAction("Enter", noMods, N), null);
  assert.equal(stackKeyAction(" ", noMods, N), null);
  assert.equal(stackKeyAction("a", noMods, 0), null);
});

test("applyStackAction wraps prev/next and clamps jumps", () => {
  assert.equal(applyStackAction({ type: "next" }, 5, 6), 0, "wrap forward");
  assert.equal(applyStackAction({ type: "prev" }, 0, 6), 5, "wrap back");
  assert.equal(applyStackAction({ type: "jump", index: 3 }, 0, 6), 3);
  assert.equal(applyStackAction({ type: "jump", index: 99 }, 0, 6), 5, "clamp");
  assert.equal(applyStackAction(null, 2, 6), 2);
});

test("tab badge: letter where free, number where the letter is a step key", () => {
  assert.equal(stackTabBadge(0), "a");
  assert.equal(stackTabBadge(6), "g");
  assert.equal(stackTabBadge(7), "8", "8th tab's letter 'h' is a step key → number");
  assert.equal(stackTabBadge(9), "10", "'j' is a step key");
  assert.equal(stackTabBadge(12), "m");
});
