/**
 * Unit tests for the 3D camera settings peer — the unified-viewport model's
 * last fold (no bus, no sourceId, no last-value cache): peers own settings
 * objects, share ONE channel, dedupe by patch identity, and late-join by
 * peer deref. Framework-free, so this runs under Node's test runner.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCameraSettingsPeer, type CameraState } from "./camera-settings.ts";
import { __resetSettingsChannelsForTest } from "../../state/settings/viewport-settings.ts";
import { __resetSettingsPeersForTest, peekGroupSettings } from "../../state/settings/settings-peers.ts";

let n = 0;
const freshGroup = () => `cam-group-${n++}`;
const pose = (x: number): CameraState => ({ position: [x, 0, 0], target: [0, 0, 0], zoom: 1 });

beforeEach(() => {
  __resetSettingsChannelsForTest();
  __resetSettingsPeersForTest();
});

test("set() applies to every OTHER peer's camera, never back onto the writer's", () => {
  const g = freshGroup();
  const applied: Record<string, CameraState[]> = { a: [], b: [] };
  const a = createCameraSettingsPeer(g, (s) => applied.a.push(s));
  const b = createCameraSettingsPeer(g, (s) => applied.b.push(s));
  a.set(pose(2));
  assert.equal(applied.a.length, 0); // the writer's camera IS the source
  assert.deepEqual(applied.b, [pose(2)]);
  a.dispose();
  b.dispose();
});

test("the pose lands in every member's OWN settings object (peekable group-wide)", () => {
  const g = freshGroup();
  const a = createCameraSettingsPeer(g, () => {});
  const b = createCameraSettingsPeer(g, () => {});
  a.set(pose(3));
  assert.deepEqual(peekGroupSettings(g)?.["scene3d.camera"], pose(3));
  a.dispose(); // the writer leaves — the peer's own object still has the pose
  assert.deepEqual(peekGroupSettings(g)?.["scene3d.camera"], pose(3));
  b.dispose();
  assert.equal(peekGroupSettings(g), null); // nothing outlives the viewports
});

test("seed() converges a late joiner from a live peer's object (no cached bus state)", () => {
  const g = freshGroup();
  const a = createCameraSettingsPeer(g, () => {});
  a.set(pose(5));
  const seen: CameraState[] = [];
  const late = createCameraSettingsPeer(g, (s) => seen.push(s));
  late.seed();
  assert.deepEqual(seen, [pose(5)]);
  a.dispose();
  late.dispose();
});

test("seed() into an untouched group is a no-op (default pose kept)", () => {
  const g = freshGroup();
  const a = createCameraSettingsPeer(g, () => {});
  const seen: CameraState[] = [];
  const b = createCameraSettingsPeer(g, (s) => seen.push(s));
  b.seed();
  assert.equal(seen.length, 0);
  a.dispose();
  b.dispose();
});

test("non-camera patches ride inert (mixed-kind group): absorbed, camera untouched", async () => {
  const g = freshGroup();
  const { publishSettingsPatch } = await import("../../state/settings/viewport-settings.ts");
  const seen: CameraState[] = [];
  const a = createCameraSettingsPeer(g, (s) => seen.push(s));
  publishSettingsPatch(g, { "image.encoding": "magma" });
  assert.equal(seen.length, 0);
  assert.equal(peekGroupSettings(g)?.["image.encoding"], "magma"); // carried inert
  a.dispose();
});

test("dispose() leaves the group: no further applies, no peer registration", () => {
  const g = freshGroup();
  const seen: CameraState[] = [];
  const a = createCameraSettingsPeer(g, (s) => seen.push(s));
  const b = createCameraSettingsPeer(g, () => {});
  a.dispose();
  b.set(pose(7));
  assert.equal(seen.length, 0);
  b.dispose();
});
