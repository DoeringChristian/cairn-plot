/**
 * Contract for the absorbed offscreen-compare + cross-type-frame components.
 * `hasForeignFrameBridge` is pure and unit-tested directly; the two React
 * components carry no DOM/JSX runner in this package (see `split-divider.test.ts`
 * for the source-level contract precedent), so their orchestration invariants
 * are asserted at the SOURCE level.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/media-compare/offscreen-compare.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hasForeignFrameBridge, type ForeignFrameLoaders } from "./cross-type-frame.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), "utf8");

// --- hasForeignFrameBridge (pure) ------------------------------------------

test("hasForeignFrameBridge is true only for registered object types", () => {
  const loaders: ForeignFrameLoaders = {
    mesh: async () => ({ default: () => null }) as never,
    pointcloud: async () => ({ default: () => null }) as never,
  };
  assert.equal(hasForeignFrameBridge("mesh", loaders), true);
  assert.equal(hasForeignFrameBridge("pointcloud", loaders), true);
  assert.equal(hasForeignFrameBridge("image", loaders), false, "image never bridges");
  assert.equal(hasForeignFrameBridge("volume", loaders), false, "unregistered → false");
  assert.equal(hasForeignFrameBridge("mesh", {}), false, "empty registry → false");
});

// --- OffscreenComparePanes orchestration (source contract) -----------------

const offscreen = read("OffscreenComparePanes.tsx");

test("OffscreenComparePanes owns the offscreen compositor orchestration", () => {
  // Feeds the ONE shared compositor (not a fork).
  assert.match(offscreen, /CrossTypeCompositeMediaPane/, "routes through the shared compositor");
  // Snapshot lifecycle: one per side.
  assert.match(offscreen, /const primarySnap = useOffscreenSnapshot\(\)/);
  assert.match(offscreen, /const referenceSnap = useOffscreenSnapshot\(\)/);
  // Camera-sync group + interaction controller.
  assert.match(offscreen, /useCompareCameraController/, "owns the orbit/zoom controller");
  assert.match(offscreen, /publishCameraState|subscribeCameraState/, "drives the camera-sync bus");
  // Both source kinds are handled: a live hidden viewer OR a static frame.
  assert.match(offscreen, /kind === "live"/);
  assert.match(offscreen, /frameSourceToUrl\(/, "a frame side feeds its URL straight in");
});

test("OffscreenComparePanes stays app-agnostic (no app-reaching or @cairn-plot imports)", () => {
  // Parameterized by a `render` callback + FrameSource — never imports a
  // concrete app viewer or api client. All relative imports stay intra-lib.
  assert.doesNotMatch(offscreen, /@cairn-plot\//, "no self-referential package import");
  assert.doesNotMatch(offscreen, /from "\.\.\/\.\.\//, "no import escaping the cairn-plot lib root");
  assert.match(offscreen, /render:\s*\(/, "the live side is a caller-supplied render callback");
});

const crossType = read("CrossTypeForeignFrame.tsx");

test("CrossTypeForeignFrame is parameterized by an injected loader registry", () => {
  // The registry is a PROP, not a hard-coded app chunk map.
  assert.match(crossType, /loaders: ForeignFrameLoaders/, "loaders injected via props");
  assert.doesNotMatch(crossType, /import\(["']\.\.\//, "no hard-coded app chunk imports");
  assert.doesNotMatch(crossType, /MeshVisualCard|PointCloudVisualCard/, "no app card references");
  assert.match(crossType, /lazy\(/, "still lazy-mounts the foreign frame");
});
