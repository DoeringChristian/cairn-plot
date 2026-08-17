// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sourceKey,
  peekResolved,
  peekResolveError,
  resolveCached,
  prefetchResolved,
  __resetResolveCacheForTest,
} from "./resolve-cache.ts";

test("sourceKey is stable per object and distinct across objects", () => {
  const a = {};
  const b = {};
  assert.equal(sourceKey(a), sourceKey(a));
  assert.notEqual(sourceKey(a), sourceKey(b));
});

test("resolveCached runs once; repeat callers share the result", async () => {
  __resetResolveCacheForTest();
  let runs = 0;
  const run = async () => {
    runs++;
    return { v: 42 };
  };
  const k = "k1";
  const [r1, r2] = await Promise.all([resolveCached(k, run), resolveCached(k, run)]);
  assert.equal(runs, 1, "concurrent callers share one run");
  assert.deepEqual(r1, r2);
  const r3 = await resolveCached(k, run);
  assert.equal(runs, 1, "a later caller hits the cache");
  assert.deepEqual(r3, { v: 42 });
});

test("peekResolved is undefined before resolve, the payload after", async () => {
  __resetResolveCacheForTest();
  const k = "k2";
  assert.equal(peekResolved(k), undefined);
  await resolveCached(k, async () => "hi");
  assert.equal(peekResolved<string>(k), "hi");
});

test("a failed resolve records an error and does not cache a payload", async () => {
  __resetResolveCacheForTest();
  const k = "k3";
  await assert.rejects(resolveCached(k, async () => {
    throw new Error("boom");
  }));
  assert.equal(peekResolved(k), undefined);
  assert.equal(peekResolveError(k), "boom");
});

test("prefetchResolved warms entries so a later peek is synchronous", async () => {
  __resetResolveCacheForTest();
  const entries = [
    { key: "p1", run: async () => 1 },
    { key: "p2", run: async () => 2 },
  ];
  prefetchResolved(entries);
  // let the microtasks settle
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(peekResolved<number>("p1"), 1);
  assert.equal(peekResolved<number>("p2"), 2);
});
