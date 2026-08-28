/**
 * Cross-face CONTRACT guard (TS side). Asserts the TypeScript sources of the
 * cross-language string enums match the committed canonical contract
 * `schema/cairn-plot-contracts.json`:
 *
 *   - colormaps                → `colormaps/lut.ts`'s `COLORMAP_NAMES`
 *                                (derived from the `COLORMAP_STOPS` registry)
 *   - tonemapOperators         → `image/tonemap.ts`'s SDR + HDR group arrays
 *   - compareKernelPublicNames → `engine/kernels/index.ts`'s
 *                                `listDiffKernelPublicNames()`
 *   - compareViewModes/Aligns/Fits, pixelValueNotations
 *                              → `builder/validate.ts` (audit M5)
 *   - compareKernelModes       → `builder/validate.ts`'s `COMPARE_KERNEL_MODES`
 *                                mapping; every emitted `diffSubmode` VALUE is
 *                                additionally resolved through the kernel
 *                                registry so a kernel-id rename can't drift the
 *                                hand-mirrored tables (audit M6)
 *
 * The Python side is pinned to the SAME JSON by `tests/test_contracts.py`, so
 * neither language can drift the sets without failing a guard. Comparisons are
 * order-insensitive (set equality) — the JSON's order is documentation only.
 *
 *   node --experimental-strip-types --test \
 *     src/testing/contracts.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { COLORMAP_NAMES } from "../settings/colormaps/lut.ts";
import {
  SDR_TONEMAP_OPERATORS,
  SDR_DISPLAY_TRANSFER_OPERATORS,
} from "../plots/image/model/tonemap.ts";
import {
  listDiffKernelPublicNames,
  resolveDiffKernelId,
} from "../plots/image/engine/kernels/index.ts";
import { getImageOperation } from "../plots/image/model/content-ops/index.ts";
import {
  COMPARE_VIEW_MODES,
  COMPARE_ALIGNS,
  COMPARE_FITS,
  PIXEL_VALUE_NOTATIONS,
  COMPARE_KERNEL_MODES,
} from "../public/builder/validate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = resolve(here, "../../../schema/cairn-plot-contracts.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
  colormaps: string[];
  tonemapOperators: string[];
  displayTransfers: string[];
  compareKernelPublicNames: string[];
  compareKernelModes: Record<string, string>;
  compareViewModes: string[];
  compareAligns: string[];
  compareFits: string[];
  pixelValueNotations: string[];
};

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

test("colormaps: COLORMAP_NAMES matches the contract", () => {
  assert.deepEqual(sorted(COLORMAP_NAMES), sorted(contract.colormaps));
});

test("tonemapOperators: the canonical 5-operator menu set matches the contract", () => {
  // UNIFIED model: the single operator group IS the contract's canonical set.
  assert.deepEqual(sorted(SDR_TONEMAP_OPERATORS), sorted(contract.tonemapOperators));
});

test("displayTransfers: SDR_DISPLAY_TRANSFER_OPERATORS matches the contract", () => {
  assert.deepEqual(sorted(SDR_DISPLAY_TRANSFER_OPERATORS), sorted(contract.displayTransfers));
});

test("compareKernelPublicNames: listDiffKernelPublicNames() matches the contract", () => {
  assert.deepEqual(
    sorted(listDiffKernelPublicNames()),
    sorted(contract.compareKernelPublicNames),
  );
});

// --- audit M5: the four previously-unguarded validation enums ---------------

test("compareViewModes: COMPARE_VIEW_MODES matches the contract", () => {
  assert.deepEqual(sorted(COMPARE_VIEW_MODES), sorted(contract.compareViewModes));
});

test("compareAligns: COMPARE_ALIGNS matches the contract", () => {
  assert.deepEqual(sorted(COMPARE_ALIGNS), sorted(contract.compareAligns));
});

test("compareFits: COMPARE_FITS matches the contract", () => {
  assert.deepEqual(sorted(COMPARE_FITS), sorted(contract.compareFits));
});

test("pixelValueNotations: PIXEL_VALUE_NOTATIONS matches the contract", () => {
  assert.deepEqual(sorted(PIXEL_VALUE_NOTATIONS), sorted(contract.pixelValueNotations));
});

// --- audit M6: the public-mode → diffSubmode mapping, guarded by VALUE -------

test("compareKernelModes: COMPARE_KERNEL_MODES matches the contract mapping", () => {
  // Full key→value equality (not just keys): pins the TS `diffSubmode` table.
  assert.deepEqual({ ...COMPARE_KERNEL_MODES }, contract.compareKernelModes);
});

test("compareKernelModes: keys equal compareKernelPublicNames (internal consistency)", () => {
  assert.deepEqual(
    sorted(Object.keys(contract.compareKernelModes)),
    sorted(contract.compareKernelPublicNames),
  );
});

test("compareKernelModes: every emitted diffSubmode resolves to a registered kernel", () => {
  // The derivation guard M6 asks for: a kernel-id rename in the registry that
  // isn't mirrored into the tables makes at least one value fail to resolve.
  // `flip`/`flip_ldr` are menu tokens auto-dispatched per source dtype, so check
  // both u8 (false) and float (true) resolutions.
  for (const [publicName, submode] of Object.entries(contract.compareKernelModes)) {
    for (const sourcesAreFloat of [false, true]) {
      const kernelId = resolveDiffKernelId(submode, sourcesAreFloat);
      assert.ok(
        getImageOperation(kernelId),
        `diffSubmode ${JSON.stringify(submode)} (mode ${publicName}, float=${sourcesAreFloat}) → operation id ${JSON.stringify(kernelId)} is not registered`,
      );
    }
  }
});
