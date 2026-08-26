/**
 * Pure unit tests for the chart viewport-sync bus. No test runner is configured
 * in this package, so this runs under Node's built-in test runner with
 * TypeScript type-stripping (Node 19+ for the `CustomEvent`/`EventTarget`
 * globals the bus uses):
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/viewport/chart-viewport-sync.test.ts
 *
 * The bus is deliberately React-free, so this needs no DOM/React harness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getLastChartViewport,
  makeChartViewportSyncSourceId,
  publishChartViewport,
  subscribeChartViewport,
  type ChartSyncPayload,
} from "./chart-viewport-sync.ts";

// Unique group per test so buses never bleed across cases (the module keeps a
// process-global registry keyed by groupId).
let n = 0;
const freshGroup = () => `test-group-${n++}`;

test("a subscriber receives a peer's publish", () => {
  const g = freshGroup();
  const received: ChartSyncPayload[] = [];
  const off = subscribeChartViewport(g, "sub", (p) => received.push(p));
  publishChartViewport(g, "peer", { x: [0, 10], y: [1, 2] });
  off();
  assert.deepEqual(received, [{ x: [0, 10], y: [1, 2] }]);
});

test("echo guard: a publisher never receives its own event", () => {
  const g = freshGroup();
  const received: ChartSyncPayload[] = [];
  const off = subscribeChartViewport(g, "self", (p) => received.push(p));
  publishChartViewport(g, "self", { x: [0, 1], y: [0, 1] }); // own → ignored
  publishChartViewport(g, "other", { x: [2, 3], y: [2, 3] }); // peer → delivered
  off();
  assert.deepEqual(received, [{ x: [2, 3], y: [2, 3] }]);
});

test('"home" is a valid payload and propagates to peers', () => {
  const g = freshGroup();
  const received: ChartSyncPayload[] = [];
  const off = subscribeChartViewport(g, "sub", (p) => received.push(p));
  publishChartViewport(g, "peer", "home");
  off();
  assert.deepEqual(received, ["home"]);
});

test("getLastChartViewport returns the most recent publish (late-join adoption)", () => {
  const g = freshGroup();
  assert.equal(getLastChartViewport(g), undefined);
  publishChartViewport(g, "peer", { x: [0, 5], y: [0, 5] });
  publishChartViewport(g, "peer", { x: [1, 6], y: [1, 6] });
  assert.deepEqual(getLastChartViewport(g), { x: [1, 6], y: [1, 6] });
});

test("unsubscribe stops delivery", () => {
  const g = freshGroup();
  const received: ChartSyncPayload[] = [];
  const off = subscribeChartViewport(g, "sub", (p) => received.push(p));
  off();
  publishChartViewport(g, "peer", { x: [0, 1], y: [0, 1] });
  assert.equal(received.length, 0);
});

test("a per-axis-null domain is delivered verbatim (peer keeps its own axis)", () => {
  const g = freshGroup();
  const received: ChartSyncPayload[] = [];
  const off = subscribeChartViewport(g, "sub", (p) => received.push(p));
  publishChartViewport(g, "peer", { x: [0, 10], y: null });
  off();
  assert.deepEqual(received, [{ x: [0, 10], y: null }]);
});

test("source ids are unique per call", () => {
  assert.notEqual(makeChartViewportSyncSourceId(), makeChartViewportSyncSourceId());
});

// ---------------------------------------------------------------------------
// UNIFIED-BUS pins (unified-viewport ruling, 2026-08-26): the adapter rides
// the ONE settings channel — a chart publish IS a `ViewportSettings` patch.
// ---------------------------------------------------------------------------
import { subscribeSettingsPatches, publishSettingsPatch } from "./image-settings-sync.ts";

test("a chart publish is a {'chart.domain'} patch on the unified channel; 'home' is the null mask", () => {
  const group = freshGroup();
  const raw: unknown[] = [];
  const unsub = subscribeSettingsPatches(group, (patch) => raw.push(patch));
  publishChartViewport(group, makeChartViewportSyncSourceId(), { x: [0, 1], y: null });
  publishChartViewport(group, makeChartViewportSyncSourceId(), "home");
  unsub();
  assert.deepEqual(raw, [
    { "chart.domain": { x: [0, 1], y: null } },
    { "chart.domain": null },
  ]);
});

test("the adapter ignores unified-channel patches without its key (mixed image+chart groups)", () => {
  const group = freshGroup();
  const seen: ChartSyncPayload[] = [];
  const unsub = subscribeChartViewport(group, makeChartViewportSyncSourceId(), (p) => seen.push(p));
  publishSettingsPatch(group, { "image.view": { zoom: 2, pan: { x: 0, y: 0 } } });
  publishSettingsPatch(group, { "chart.domain": { x: null, y: [3, 4] } });
  unsub();
  assert.deepEqual(seen, [{ x: null, y: [3, 4] }]);
});
