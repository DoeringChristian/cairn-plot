/**
 * The pane's DISPLAY-encoding decision, tested behaviourally.
 *
 * `usePaneEncoding` folds three facts into what a pane renders, and each one
 * used to be reachable only through a React tree (so only a source-regex could
 * "test" it):
 *
 *   1. WHAT THE STORE SAYS (`image.encoding`) — the RAW id. "Modified" and every
 *      write callback reason about it; a read-time capability projection must
 *      never leak into it.
 *   2. WHAT HOME MEANS — the authored seed, resolved against the CATALOGUE, not
 *      against the active backend: the same authored node must seed the same
 *      encoding on the CPU and the WebGPU pane.
 *   3. WHAT THE ACTIVE BACKEND CAN RENDER — an id it lacks is projected onto the
 *      core fallback (colormap → turbo, everything else → srgb) for RENDERING
 *      only, and reported as a chip.
 *
 * `resolvePaneEncoding` and `seedDisplayOperation` are the pure halves of that
 * decision, so these cases pin it without mounting a pane.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/components/pane-encoding.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { defineImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { seedDisplayOperation } from "./display-operation.ts";
import { resolvePaneEncoding } from "./pane-encoding.ts";

/** A backend advertising the FULL public catalogue (both real backends do). */
const FULL = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});

/** A hypothetical backend without `plasma`/`aces` — the fallback cases. */
const REDUCED = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS.filter((id) => id !== "plasma" && id !== "aces"),
});

test("a supported id renders itself; equal to the seed it is NOT modified", () => {
  const encoding = resolvePaneEncoding({ rawId: "magma", seedId: "magma", capabilities: FULL });
  assert.equal(encoding.effective, "magma");
  assert.equal(encoding.fallback, null);
  assert.equal(encoding.modified, false);
});

test("a supported id that differs from the seed IS modified", () => {
  const encoding = resolvePaneEncoding({ rawId: "magma", seedId: "srgb", capabilities: FULL });
  assert.equal(encoding.effective, "magma");
  assert.equal(encoding.fallback, null);
  assert.equal(encoding.modified, true);
});

test("an unsupported colormap renders turbo and reports the substitution", () => {
  const encoding = resolvePaneEncoding({ rawId: "plasma", seedId: "plasma", capabilities: REDUCED });
  assert.equal(encoding.effective, "turbo");
  assert.deepEqual(encoding.fallback, { kind: "display", requested: "plasma", effective: "turbo" });
  // The projection is read-time only: HOME is still HOME.
  assert.equal(encoding.modified, false);
});

test("`modified` compares the RAW id to the seed, never the projected one", () => {
  // `aces` is unsupported here and falls back onto `srgb` — which happens to BE
  // the seed. Comparing the projection would call this pane unmodified while the
  // store holds a user selection.
  const encoding = resolvePaneEncoding({ rawId: "aces", seedId: "srgb", capabilities: REDUCED });
  assert.equal(encoding.effective, "srgb");
  assert.deepEqual(encoding.fallback, { kind: "display", requested: "aces", effective: "srgb" });
  assert.equal(encoding.modified, true);
});

test("seeding is catalogue-level: an authored plasma seeds plasma on a backend without it", () => {
  const seedId = seedDisplayOperation({
    mode: "arity",
    arity: 1,
    curveSet: DISPLAY_OPERATION_IDS,
    propColormap: "plasma",
    defaultCurve: "srgb",
  });
  // The seed does not consult the backend — the authored node means the same
  // thing on every pane…
  assert.equal(seedId, "plasma");
  // …and only the RENDER is projected, so the cell is still at HOME.
  const encoding = resolvePaneEncoding({ rawId: seedId, seedId, capabilities: REDUCED });
  assert.equal(encoding.effective, "turbo");
  assert.deepEqual(encoding.fallback, { kind: "display", requested: "plasma", effective: "turbo" });
  assert.equal(encoding.modified, false);
});

test("with no authored colormap the seed is the pane's default curve", () => {
  const seedId = seedDisplayOperation({
    mode: "arity",
    arity: 3,
    curveSet: DISPLAY_OPERATION_IDS,
    propColormap: null,
    defaultCurve: "aces",
  });
  assert.equal(seedId, "aces");
});
