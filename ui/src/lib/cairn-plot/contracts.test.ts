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
import { SDR_TONEMAP_OPERATORS, HDR_TONEMAP_OPERATORS } from "./image/tonemap.ts";
import { listDiffKernelPublicNames } from "./engine/kernels/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
// ui/src/lib/cairn-plot/ → repo root is four levels up.
const contractPath = resolve(here, "../../../../schema/cairn-plot-contracts.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
  colormaps: string[];
  tonemapOperators: string[];
  compareKernelPublicNames: string[];
};

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

test("colormaps: COLORMAP_NAMES matches the contract", () => {
  assert.deepEqual(sorted(COLORMAP_NAMES), sorted(contract.colormaps));
});

test("tonemapOperators: SDR + HDR group arrays match the contract", () => {
  const ts = [...SDR_TONEMAP_OPERATORS, ...HDR_TONEMAP_OPERATORS];
  assert.deepEqual(sorted(ts), sorted(contract.tonemapOperators));
});

test("compareKernelPublicNames: listDiffKernelPublicNames() matches the contract", () => {
  assert.deepEqual(
    sorted(listDiffKernelPublicNames()),
    sorted(contract.compareKernelPublicNames),
  );
});
