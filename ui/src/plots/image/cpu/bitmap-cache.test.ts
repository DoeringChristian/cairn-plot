/**
 * The CPU backend's paint-source cache. Its whole reason to exist is the rule a
 * plain LRU does NOT give you: an entry that is already resident is NEVER
 * displaced, and nothing is ever destroyed on eviction — a mounted pane holds
 * the value it committed and will `drawImage` it again on the next viewport
 * change, so detaching it is a crash, while dropping the reference is merely a
 * re-decode.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBitmapCache } from "./bitmap-cache.ts";

test("claim stores on a miss and returns what it stored", () => {
  const cache = createBitmapCache<string>(4);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.claim("a", "first"), "first");
  assert.equal(cache.get("a"), "first");
});

test("claim NEVER displaces a resident entry — the incumbent wins", () => {
  const cache = createBitmapCache<string>(4);
  cache.claim("a", "first");
  // A duplicate producer (a second pane on the same url, a StrictMode double
  // mount, a cancelled run resolving last) must get the entry the first pane is
  // already painting, not replace it.
  assert.equal(cache.claim("a", "second"), "first");
  assert.equal(cache.get("a"), "first");
});

test("eviction is by least-recently-USED, and a read keeps a key alive", () => {
  const cache = createBitmapCache<string>(2);
  cache.claim("a", "A");
  cache.claim("b", "B");
  assert.equal(cache.get("a"), "A"); // bumps `a` to most-recently-used
  cache.claim("c", "C"); // evicts `b`, not `a`
  assert.equal(cache.get("a"), "A");
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), "C");
});

test("an evicted key is simply re-claimable — nothing is destroyed", () => {
  // The cache has no eviction hook at all, so an evicted value cannot be
  // detached out from under a pane that still holds it; the pane keeps painting
  // its bitmap and the next miss just produces a new one.
  const cache = createBitmapCache<{ id: string }>(1);
  const first = cache.claim("a", { id: "A" });
  cache.claim("b", { id: "B" }); // evicts `a`
  assert.equal(cache.get("a"), undefined);
  const second = cache.claim("a", { id: "A2" });
  assert.notEqual(second, first);
  assert.equal(second.id, "A2");
  // The evicted object is untouched — a holder can still use it.
  assert.equal(first.id, "A");
});
