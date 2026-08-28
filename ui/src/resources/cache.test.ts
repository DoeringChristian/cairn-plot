// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import { RuntimeResourceCache, derivedCacheKey } from "./cache.ts";

test("concurrent callers share preparation but receive independent leases", async () => {
  const cache = new RuntimeResourceCache({ budgetBytes: 100 });
  let loads = 0;
  const load = async () => ({ value: { ready: true }, bytes: 20 });
  const [a, b] = await Promise.all([
    cache.getOrCreate("image:a", async () => { loads++; return load(); }),
    cache.getOrCreate("image:a", async () => { loads++; return load(); }),
  ]);
  assert.equal(loads, 1);
  assert.equal(a.value, b.value);
  a.release();
  assert.equal(cache.has("image:a"), true, "the second visible lease still pins it");
  b.release();
});

test("visible leases may exceed the soft budget", async () => {
  const cache = new RuntimeResourceCache({ budgetBytes: 10 });
  const lease = await cache.getOrCreate("large", async () => ({ value: "visible", bytes: 50 }));
  assert.equal(cache.bytes, 50);
  assert.equal(cache.has("large"), true);
  lease.release();
  assert.equal(cache.has("large"), false, "it becomes evictable after release");
});

test("least-recently-used unleased entries are evicted first", async () => {
  const cache = new RuntimeResourceCache({ budgetBytes: 20 });
  const a = await cache.getOrCreate("a", async () => ({ value: "a", bytes: 10 }));
  a.release();
  const b = await cache.getOrCreate("b", async () => ({ value: "b", bytes: 10 }));
  b.release();
  cache.peek("a");
  const c = await cache.getOrCreate("c", async () => ({ value: "c", bytes: 10 }));
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.has("c"), true);
  c.release();
});

test("failed preload work is not cached and foreground work can retry", async () => {
  const cache = new RuntimeResourceCache({ budgetBytes: 100 });
  await assert.rejects(cache.getOrCreate("x", async () => {
    throw new Error("preload failed");
  }));
  const lease = await cache.getOrCreate("x", async () => ({ value: 42, bytes: 1 }));
  assert.equal(lease.value, 42);
  lease.release();
});

test("derived keys are global, ordered by operands, and canonicalize settings", () => {
  const a = derivedCacheKey({
    comparison: "image.signed",
    version: "1",
    operands: ["left", "right"],
    settings: { z: 2, a: 1 },
  });
  const same = derivedCacheKey({
    comparison: "image.signed",
    version: "1",
    operands: ["left", "right"],
    settings: { a: 1, z: 2 },
  });
  const reversed = derivedCacheKey({
    comparison: "image.signed",
    version: "1",
    operands: ["right", "left"],
    settings: { a: 1, z: 2 },
  });
  assert.equal(a, same);
  assert.notEqual(a, reversed);
});

