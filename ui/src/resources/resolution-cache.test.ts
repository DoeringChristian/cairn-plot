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
