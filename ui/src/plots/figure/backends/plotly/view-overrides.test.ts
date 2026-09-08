import test from "node:test";
import assert from "node:assert/strict";
import { applyViewOverrides, mergeRelayout } from "./view-overrides.ts";

/** Recursively freeze so any in-place write throws in strict mode (ESM). */
function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

test("applyViewOverrides leaves the input layout untouched", () => {
  const layout = deepFreeze({
    title: "t",
    xaxis: { title: "x", range: [0, 10] },
    yaxis: { range: [0, 1] },
    scene: { camera: { eye: { x: 1, y: 1, z: 1 } } },
  });
  const before = JSON.parse(JSON.stringify(layout));

  const merged = applyViewOverrides(layout as Record<string, unknown>, {
    "xaxis.range[0]": 2,
    "xaxis.range[1]": 4,
    "yaxis.autorange": true,
    "scene.camera.eye.x": 9,
  });

  assert.deepEqual(layout, before, "input layout must be deep-equal to before");
  assert.deepEqual((merged.xaxis as Record<string, unknown>).range, [2, 4]);
  assert.equal((merged.xaxis as Record<string, unknown>).title, "x");
  assert.equal((merged.yaxis as Record<string, unknown>).autorange, true);
  assert.equal(
    ((merged.scene as any).camera.eye as Record<string, unknown>).x,
    9,
  );
});

test("bracket keys build a new array without mutating the source array", () => {
  const range: unknown[] = [0, 10];
  const layout = { xaxis: { range } };
  const merged = applyViewOverrides(layout, { "xaxis.range[1]": 5 });
  assert.deepEqual(range, [0, 10]);
  assert.deepEqual((merged.xaxis as Record<string, unknown>).range, [0, 5]);
  assert.notEqual((merged.xaxis as Record<string, unknown>).range, range);
  assert.notEqual(merged.xaxis, layout.xaxis);
});

test("bracket keys create an array when the layout has none", () => {
  const merged = applyViewOverrides({}, { "xaxis.range[0]": 1, "xaxis.range[1]": 3 });
  assert.deepEqual((merged.xaxis as Record<string, unknown>).range, [1, 3]);
});

test("a nested scene override deep-merges without mutating the input", () => {
  const layout = deepFreeze({ scene: { camera: { eye: { x: 1 } }, aspectmode: "cube" } });
  const merged = applyViewOverrides(layout as Record<string, unknown>, {
    scene: { camera: { eye: { x: 7 } } },
  });
  assert.equal(((layout as any).scene.camera.eye as Record<string, unknown>).x, 1);
  assert.equal(((merged.scene as any).camera.eye as Record<string, unknown>).x, 7);
  assert.equal((merged.scene as any).aspectmode, "cube");
});

test("mergeRelayout replaces an axis's autorange with a later range", () => {
  const prev = mergeRelayout({}, { "xaxis.autorange": true, "yaxis.autorange": true });
  const next = mergeRelayout(prev, { "xaxis.range[0]": 1, "xaxis.range[1]": 2 });
  assert.deepEqual(next, {
    "yaxis.autorange": true,
    "xaxis.range[0]": 1,
    "xaxis.range[1]": 2,
  });
  assert.equal("xaxis.autorange" in next, false);
});

test("mergeRelayout replaces an axis's range with a later autorange", () => {
  const prev = { "xaxis.range[0]": 1, "xaxis.range[1]": 2, "yaxis.range[0]": 0 };
  const next = mergeRelayout(prev, { "xaxis.autorange": true });
  assert.deepEqual(next, { "yaxis.range[0]": 0, "xaxis.autorange": true });
});

test("mergeRelayout replaces the previous scene keys on a camera override", () => {
  const prev = {
    "scene.camera.eye.x": 1,
    "scene.camera.eye.y": 1,
    "xaxis.range[0]": 3,
  };
  const next = mergeRelayout(prev, { "scene.camera.eye.z": 5 });
  assert.deepEqual(next, { "xaxis.range[0]": 3, "scene.camera.eye.z": 5 });
});

test("mergeRelayout keys a nested scene object on the same prefix", () => {
  const prev = { "scene.camera.eye.x": 1, "scene2.camera.eye.x": 2 };
  const next = mergeRelayout(prev, { scene: { camera: { eye: { x: 9 } } } });
  assert.deepEqual(next, { "scene2.camera.eye.x": 2, scene: { camera: { eye: { x: 9 } } } });
});

test("mergeRelayout does not mutate its inputs", () => {
  const prev = deepFreeze({ "xaxis.autorange": true });
  const incoming = deepFreeze({ "xaxis.range[0]": 1 });
  const next = mergeRelayout(prev as Record<string, unknown>, incoming as Record<string, unknown>);
  assert.deepEqual(prev, { "xaxis.autorange": true });
  assert.deepEqual(next, { "xaxis.range[0]": 1 });
});
