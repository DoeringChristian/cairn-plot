/**
 * Cross-face CONTRACT guard (TS side). Asserts the TypeScript sources of the
 * three cross-language string enums match the committed canonical contract
 * `schema/cairn-plot-contracts.json`:
 *
 *   - colormaps                → `colormaps/lut.ts`'s `COLORMAP_NAMES`
 *                                (derived from the `COLORMAP_STOPS` registry)
 *   - tonemapOperators         → `image/tonemap.ts`'s SDR + HDR group arrays
 *   - compareKernelPublicNames → `engine/kernels/index.ts`'s
 *                                `listDiffKernelPublicNames()`
 *
 * The Python side is pinned to the SAME JSON by `tests/test_contracts.py`, so
 * neither language can drift the sets without failing a guard. Comparisons are
 * order-insensitive (set equality) — the JSON's order is documentation only.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/contracts.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { COLORMAP_NAMES } from "./colormaps/lut.ts";
import {
  SDR_TONEMAP_OPERATORS,
  SDR_DISPLAY_TRANSFER_OPERATORS,
  DEPRECATED_TONEMAP_ALIASES,
} from "./image/tonemap.ts";
import { listDiffKernelPublicNames } from "./engine/kernels/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
// ui/src/lib/cairn-plot/ → repo root is four levels up.
const contractPath = resolve(here, "../../../../schema/cairn-plot-contracts.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
  colormaps: string[];
  tonemapOperators: string[];
  tonemapOperatorAliases: string[];
  displayTransfers: string[];
  compareKernelPublicNames: string[];
};

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

test("colormaps: COLORMAP_NAMES matches the contract", () => {
  assert.deepEqual(sorted(COLORMAP_NAMES), sorted(contract.colormaps));
});

test("tonemapOperators: the canonical 5-operator menu set matches the contract", () => {
  // UNIFIED model: the single operator group IS the contract's canonical set.
  assert.deepEqual(sorted(SDR_TONEMAP_OPERATORS), sorted(contract.tonemapOperators));
});

test("tonemapOperatorAliases: the deprecated extended* aliases match the contract", () => {
  assert.deepEqual(
    sorted(DEPRECATED_TONEMAP_ALIASES),
    sorted(contract.tonemapOperatorAliases),
  );
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
