/**
 * Unit tests for the bounded LRU map backing the image render-result and
 * decoded-load caches. Locks the property a plain FIFO lacked: a key that keeps
 * being READ survives newer arrivals (bump-on-get), and eviction/overwrite fire
 * `onEvict`.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/image/lru-map.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLruMap } from "./lru-map.ts";

test("evicts the least-recently-INSERTED key when nothing was read", () => {
  const evicted: string[] = [];
  const m = createLruMap<number>(2, { onEvict: (k) => evicted.push(k) });
  m.set("a", 1);
  m.set("b", 2);
  m.set("c", 3); // over capacity → evicts "a" (oldest)
  assert.equal(m.has("a"), false);
  assert.deepEqual(evicted, ["a"]);
  assert.equal(m.size, 2);
});

test("get() BUMPS a key so it survives a later eviction (FIFO would drop it)", () => {
  const evicted: string[] = [];
  const m = createLruMap<number>(2, { onEvict: (k) => evicted.push(k) });
  m.set("a", 1);
  m.set("b", 2);
  // Read "a" — now "b" is the least-recently-used.
  assert.equal(m.get("a"), 1);
  m.set("c", 3); // over capacity → evicts "b", NOT the freshly-read "a"
  assert.equal(m.has("a"), true, "hot key survived");
  assert.equal(m.has("b"), false, "cold key evicted");
  assert.deepEqual(evicted, ["b"]);
});

test("get() on a miss returns undefined and does not resurrect a key", () => {
  const m = createLruMap<number>(2);
  assert.equal(m.get("nope"), undefined);
  assert.equal(m.size, 0);
});

test("overwriting an existing key notifies onEvict and re-marks it most-recent", () => {
  const evicted: Array<[string, number]> = [];
  const m = createLruMap<number>(2, { onEvict: (k, v) => evicted.push([k, v]) });
  m.set("a", 1);
  m.set("b", 2);
  m.set("a", 10); // overwrite → releases old value 1, "a" now most-recent
  assert.deepEqual(evicted, [["a", 1]]);
  assert.equal(m.get("a"), 10);
  m.set("c", 3); // evicts "b" (a was refreshed by the overwrite)
  assert.equal(m.has("b"), false);
  assert.equal(m.has("a"), true);
});

test("a repeatedly-read key never ages out under churn", () => {
  const m = createLruMap<number>(3);
  m.set("hot", 0);
  for (let i = 0; i < 20; i++) {
    assert.equal(m.get("hot"), 0); // keep it warm
    m.set(`k${i}`, i); // constant churn of fresh keys
  }
  assert.equal(m.has("hot"), true);
  assert.equal(m.size, 3);
});
