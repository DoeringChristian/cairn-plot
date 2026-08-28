// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sourceKey,
  resolutionKey,
  peekResolved,
  peekResolveError,
  resolveCached,
  prefetchResolved,
  estimateResolvedBytes,
  __resetResolveCacheForTest,
} from "./resolution-cache.ts";

test("resolution keys include DataSource identity", () => {
  const node = {};
  const firstSource = {};
  const secondSource = {};
  assert.equal(resolutionKey(firstSource, node), resolutionKey(firstSource, node));
  assert.notEqual(resolutionKey(firstSource, node), resolutionKey(secondSource, node));
});

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
  assert.equal(await resolveCached(k, async () => "recovered"), "recovered");
  assert.equal(peekResolved(k), "recovered", "foreground selection retries a failed preload/resolve");
  assert.equal(peekResolveError(k), undefined);
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

test("preload failure stays silent and foreground selection retries", async () => {
  __resetResolveCacheForTest();
  prefetchResolved([{ key: "cold", run: async () => { throw new Error("preload failed"); } }]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(peekResolveError("cold"), undefined);
  assert.equal(await resolveCached("cold", async () => "ready"), "ready");
});

test("resolved byte estimates count buffers once and tolerate cycles", () => {
  const pixels = new Float32Array(16);
  const value: { pixels: Float32Array; alias: Float32Array; self?: unknown } = { pixels, alias: pixels };
  value.self = value;
  assert.ok(estimateResolvedBytes(value) >= pixels.byteLength);
  assert.ok(estimateResolvedBytes(value) < pixels.byteLength * 2 + 64);
});
