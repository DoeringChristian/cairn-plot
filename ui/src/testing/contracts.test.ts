/**
 * Cross-face CONTRACT guard (TS side). Asserts the TypeScript sources of the
 * cross-language string enums match the committed canonical contract
 * `schema/cairn-plot-contracts.json`:
 *
 *   - colormaps                → `colormaps/lut.ts`'s `COLORMAP_NAMES`
 *                                (derived from the `COLORMAP_STOPS` registry)
 *   - tonemapOperators         → `image/tonemap.ts`'s SDR + HDR group arrays
 *   - comparisonOperationPublicNames → `model/comparison-operations.ts`'s
 *                                `listComparisonOperationPublicNames()`
 *   - compareViewModes/Aligns/Fits, pixelValueNotations
 *                              → `builder/validate.ts` (audit M5)
 *   - comparisonOperationModes       → `builder/validate.ts`'s `COMPARE_OPERATION_MODES`
 *                                mapping; every emitted `operation` VALUE is
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
  DISPLAY_OPERATION_IDS,
  DISPLAY_TRANSFER_OPERATION_IDS,
} from "../plots/image/runtime/tonemap.ts";
import {
  listComparisonOperationPublicNames,
  resolveComparisonOperationId,
} from "../plots/image/definition/comparison-operations.ts";
import { getImageOperation } from "../plots/image/definition/image-operations.ts";
import {
  COMPARE_VIEW_MODES,
  COMPARE_ALIGNS,
  COMPARE_FITS,
  PIXEL_VALUE_NOTATIONS,
  COMPARE_OPERATION_MODES,
} from "../public/builder/validate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = resolve(here, "../../../schema/cairn-plot-contracts.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
  colormaps: string[];
  tonemapOperators: string[];
  displayTransfers: string[];
  comparisonOperationPublicNames: string[];
  comparisonOperationModes: Record<string, string>;
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
  assert.deepEqual(sorted(DISPLAY_OPERATION_IDS), sorted(contract.tonemapOperators));
});

test("displayTransfers: DISPLAY_TRANSFER_OPERATION_IDS matches the contract", () => {
  assert.deepEqual(sorted(DISPLAY_TRANSFER_OPERATION_IDS), sorted(contract.displayTransfers));
});

test("comparisonOperationPublicNames: listComparisonOperationPublicNames() matches the contract", () => {
  assert.deepEqual(
    sorted(listComparisonOperationPublicNames()),
    sorted(contract.comparisonOperationPublicNames),
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

// --- audit M6: the public-mode → operation mapping, guarded by VALUE -------

test("comparisonOperationModes: COMPARE_OPERATION_MODES matches the contract mapping", () => {
  // Full key→value equality (not just keys): pins the TS `operation` table.
  assert.deepEqual({ ...COMPARE_OPERATION_MODES }, contract.comparisonOperationModes);
});

test("comparisonOperationModes: keys equal comparisonOperationPublicNames (internal consistency)", () => {
  assert.deepEqual(
    sorted(Object.keys(contract.comparisonOperationModes)),
    sorted(contract.comparisonOperationPublicNames),
  );
});

test("comparisonOperationModes: every emitted operation resolves to a registered kernel", () => {
  // The derivation guard M6 asks for: a kernel-id rename in the registry that
  // isn't mirrored into the tables makes at least one value fail to resolve.
  // `flip` is a menu token resolved per source dtype, so check both u8 and float.
  for (const [publicName, submode] of Object.entries(contract.comparisonOperationModes)) {
    for (const sourcesAreFloat of [false, true]) {
      const operationId = resolveComparisonOperationId(submode, sourcesAreFloat);
      assert.ok(
        getImageOperation(operationId),
        `operation ${JSON.stringify(submode)} (mode ${publicName}, float=${sourcesAreFloat}) → operation id ${JSON.stringify(operationId)} is not registered`,
      );
    }
  }
});
