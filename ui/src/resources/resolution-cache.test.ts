// node --experimental-strip-types --test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sourceKey,
  resolutionKey,
  acquireResolved,
  clearResolveError,
  peekResolved,
  peekResolveError,
  resolveCached,
  prefetchResolved,
  estimateResolvedBytes,
  RESOLVE_ERROR_TTL_MS,
  __resetResolveCacheForTest,
  __setResolveClockForTest,
} from "./resolution-cache.ts";
import { globalResourceCache, setRuntimeCacheBudget } from "./cache.ts";
import { clearPlotTypesForTest } from "../plots/registry.ts";
import { clearReactPlotTypesForTest, registerReactPlotType } from "../plots/react-registry.ts";
import { ensureScalarPlotType } from "../plots/scalar/register.ts";

test("resolution keys include DataSource identity", () => {
  const node = {};
  const firstSource = {};
  const secondSource = {};
  assert.equal(resolutionKey(firstSource, node), resolutionKey(firstSource, node));
  assert.notEqual(resolutionKey(firstSource, node), resolutionKey(secondSource, node));
});

test("equivalent recreated descriptors reuse content-addressed resolution keys", () => {
  const source = {};
  const first = {
    kind: "plot",
    type: "image",
    data: { kind: "image", hash: "abc", format: "npy" },
    props: { label: "iteration 1" },
  };
  const recreated = {
    kind: "plot",
    type: "image",
    data: { format: "npy", hash: "abc", kind: "image" },
    props: { label: "renamed" },
    settings: { "image.exposureEV": 2 },
  };
  const otherIteration = {
    kind: "plot",
    type: "image",
    data: { kind: "image", hash: "def", format: "npy" },
  };
  assert.equal(resolutionKey(source, first), resolutionKey(source, recreated));
  assert.notEqual(resolutionKey(source, first), resolutionKey(source, otherIteration));
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

test("an unregistered plot type keys by canonical JSON and adopts its content id on registration", () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  const source = {};
  const node = {
    kind: "plot" as const,
    type: "scalar",
    data: {
      kind: "inline" as const,
      props: {
        series: [{ key: "loss", label: "Loss", color: "#000", points: [{ x: 0, y: 1 }, { x: 4, y: 9 }] }],
      },
    },
  };
  const beforeRegistration = resolutionKey(source, node);
  assert.match(beforeRegistration, /"points"/, "an unregistered type falls back to canonical JSON");
  ensureScalarPlotType(() => null);
  const afterRegistration = resolutionKey(source, node);
  assert.notEqual(afterRegistration, beforeRegistration);
  assert.match(afterRegistration, /scalar:loss\|2\|0\|4\|9\|/);
  assert.equal(resolutionKey(source, node), afterRegistration, "the content-id key is stable afterwards");
});

test("registered scalar nodes share one key across equivalent recreated descriptors", () => {
  ensureScalarPlotType(() => null);
  const source = {};
  const authored = {
    kind: "plot" as const,
    type: "scalar",
    data: {
      kind: "inline" as const,
      props: {
        series: [{
          key: "loss",
          label: "Loss",
          color: "#000",
          points: [{ x: 0, y: 1, wallTime: "t0" }, { x: 4, y: 9, wallTime: "t1" }],
        }],
      },
    },
  };
  const recreated = structuredClone(authored);
  recreated.data.props.series[0]!.points[0]!.wallTime = "later";
  const appended = structuredClone(authored);
  appended.data.props.series[0]!.points.push({ x: 5, y: 11, wallTime: "t2" });
  assert.equal(resolutionKey(source, authored), resolutionKey(source, recreated));
  assert.notEqual(resolutionKey(source, authored), resolutionKey(source, appended));
});

test("a registered type without a content id keeps the canonical JSON key", () => {
  registerReactPlotType({
    definition: {
      kind: "contentless",
      validateData: (value) => value,
      defaults: () => ({}),
      projectSettings: () => ({}),
      resolve: async () => null,
      present: (content) => content,
    },
    backends: [],
  });
  const source = {};
  const node = {
    kind: "plot" as const,
    type: "contentless",
    data: { kind: "inline" as const, props: { series: [] } },
  };
  const recreated = { kind: "plot" as const, type: "contentless", data: { props: { series: [] }, kind: "inline" as const } };
  assert.match(resolutionKey(source, node), /^src\d+\|plot:contentless:/);
  assert.equal(resolutionKey(source, node), resolutionKey(source, recreated));
});

test("two nodes of a registered type without a content id key APART, not onto one entry", () => {
  // The image plot types are all of this shape (no `contentId()`), so the
  // registry answers `{ contentId: null }` for every one of their nodes. Keying
  // on that literal would give every image in a document the SAME cache entry,
  // and each would serve the other's decode.
  registerReactPlotType({
    definition: {
      kind: "imagelike",
      validateData: (value) => value,
      defaults: () => ({}),
      projectSettings: () => ({}),
      resolve: async () => null,
      present: (content) => content,
    },
    backends: [],
  });
  const source = {};
  const first = { kind: "plot" as const, type: "imagelike", data: { kind: "image", hash: "abc" } };
  const second = { kind: "plot" as const, type: "imagelike", data: { kind: "image", hash: "def" } };
  const alsoFirst = { kind: "plot" as const, type: "imagelike", data: { hash: "abc", kind: "image" } };
  assert.notEqual(
    resolutionKey(source, first),
    resolutionKey(source, second),
    "distinct data must not collapse onto one key",
  );
  assert.equal(
    resolutionKey(source, first),
    resolutionKey(source, alsoFirst),
    "structurally equal data still shares one key",
  );
  assert.equal(resolutionKey(source, first).endsWith("plot:imagelike:null"), false);
});

// ---------------------------------------------------------------------------
// H2 — a cached resolve FAILURE is a short backoff, not a permanent wedge.
// Before the TTL, consumers guarded their resolve effect on
// `peekResolveError(key) !== undefined` and the entry was only ever cleared by a
// later SUCCESS of the same key — which the guard itself prevented.
// ---------------------------------------------------------------------------

test("a cached resolve error expires after the TTL and the key retries", async () => {
  __resetResolveCacheForTest();
  let now = 1_000_000;
  __setResolveClockForTest(() => now);
  try {
    let attempts = 0;
    const run = async () => {
      attempts++;
      if (attempts === 1) throw new Error("transient decode failure");
      return "second time lucky";
    };
    const key = "ttl-key";

    await assert.rejects(resolveCached(key, run));
    assert.equal(attempts, 1);
    assert.equal(peekResolveError(key), "transient decode failure", "the failure is visible");

    // Still inside the backoff window: the consumer must NOT retry yet.
    now += RESOLVE_ERROR_TTL_MS - 1;
    assert.equal(peekResolveError(key), "transient decode failure");

    // Past the window: the error is forgotten and the guard opens.
    now += 1;
    assert.equal(peekResolveError(key), undefined, "an expired error must not block a retry");

    assert.equal(await resolveCached(key, run), "second time lucky");
    assert.equal(attempts, 2, "the retry actually ran");
    assert.equal(peekResolved<string>(key), "second time lucky");
    assert.equal(peekResolveError(key), undefined);
  } finally {
    __setResolveClockForTest(undefined);
    __resetResolveCacheForTest();
  }
});

test("one key's cached error never suppresses another key", async () => {
  __resetResolveCacheForTest();
  try {
    await assert.rejects(resolveCached("bad", async () => { throw new Error("nope"); }));
    assert.equal(peekResolveError("bad"), "nope");
    assert.equal(peekResolveError("good"), undefined);
    assert.equal(await resolveCached("good", async () => 1), 1);
  } finally {
    __resetResolveCacheForTest();
  }
});

test("clearResolveError forgets a failure immediately", async () => {
  __resetResolveCacheForTest();
  let now = 0;
  __setResolveClockForTest(() => now);
  try {
    const key = "clear-key";
    await assert.rejects(resolveCached(key, async () => { throw new Error("boom"); }));
    assert.equal(peekResolveError(key), "boom");
    clearResolveError(key);
    assert.equal(peekResolveError(key), undefined, "no need to wait out the TTL");
    assert.equal(await resolveCached(key, async () => "fresh"), "fresh");
  } finally {
    __setResolveClockForTest(undefined);
    __resetResolveCacheForTest();
  }
});

// ---------------------------------------------------------------------------
// H12 — the resolver holds a grace lease until the consumer acquires, so a
// tight budget cannot evict a payload in the gap between resolution and the
// pane's passive lease effect (which caused a resolve → evict → resolve loop).
// ---------------------------------------------------------------------------

test("a just-resolved entry survives a tight budget until the consumer acquires", async () => {
  __resetResolveCacheForTest();
  const originalBudget = globalResourceCache.budgetBytes;
  try {
    // Budget fits ONE payload; two resolved back-to-back must both survive.
    setRuntimeCacheBudget(1024);
    const payload = () => new Uint8Array(768);
    const first = "handoff-a";
    const second = "handoff-b";

    await resolveCached(first, async () => payload());
    await resolveCached(second, async () => payload());

    assert.notEqual(peekResolved(first), undefined, "the earlier entry must not be evicted");
    assert.notEqual(peekResolved(second), undefined);

    // The consumers' passive effects run a commit later; both still find their
    // payload and take over the lease.
    const leaseA = acquireResolved(first);
    const leaseB = acquireResolved(second);
    assert.ok(leaseA && leaseB, "both consumers acquire the payload they asked for");

    // Handing over is not a leak: once the consumers release, the budget bites.
    leaseA.release();
    leaseB.release();
    assert.ok(
      globalResourceCache.bytes <= 1024,
      `retained ${globalResourceCache.bytes} bytes must fall back inside the budget`,
    );
  } finally {
    setRuntimeCacheBudget(originalBudget);
    __resetResolveCacheForTest();
  }
});

test("the resolver's grace lease is dropped exactly once per key", async () => {
  __resetResolveCacheForTest();
  const originalBudget = globalResourceCache.budgetBytes;
  try {
    setRuntimeCacheBudget(1024);
    const key = "handoff-once";
    await resolveCached(key, async () => new Uint8Array(768));
    // Two acquires: the second must not double-release the resolver's lease.
    const a = acquireResolved(key);
    const b = acquireResolved(key);
    assert.ok(a && b);
    a.release();
    assert.notEqual(peekResolved(key), undefined, "still leased by the second consumer");
    b.release();
    // Only now is it evictable; a fresh over-budget entry pushes it out.
    await resolveCached("handoff-other", async () => new Uint8Array(900));
    assert.equal(peekResolved(key), undefined, "an unleased entry is evictable again");
  } finally {
    setRuntimeCacheBudget(originalBudget);
    __resetResolveCacheForTest();
  }
});
