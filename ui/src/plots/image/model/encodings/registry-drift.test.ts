/**
 * REGISTRY ⟷ CONTRACT ⟷ PYTHON drift guard (Phase 5) — pure Node, no GPU/DOM:
 *   node --experimental-strip-types --test \
 *     src/plots/image/model/encodings/registry-drift.test.ts
 *
 * The display-encoding registry (`image/encodings`) is the SINGLE SOURCE OF TRUTH
 * for the colormap + tone-map operator ID sets. Two hand-maintained surfaces echo
 * those sets across the language boundary:
 *   - the cross-face contract `schema/cairn-plot-contracts.json` (`colormaps` +
 *     `tonemapOperators`), which the TS builder (`contracts.test.ts`) and the
 *     Python builder (`tests/test_contracts.py`) both already pin to; and
 *   - the Python validation tuples in `packages/python/src/cairn_plot/components.py`
 *     (`_COLORMAPS` + `_TONEMAP_OPERATORS`).
 *
 * This test asserts BOTH echoes equal the REGISTRY's ids, so neither the contract
 * nor Python can drift from the entries without a red test.
 *
 * ## Generation choice (documented)
 * The task asked to "extend the generator so the enums derive from the registry".
 * The committed JSON *schema* (`cairn-plot-spec.schema.json`) types `colormap` /
 * `tonemap` as plain `string` — it carries NO enum — so there is nothing in the
 * schema to generate from the registry; the enum authority is the CONTRACT JSON +
 * the Python tuples. Wiring the Python package to import a TS-generated file at
 * import time is invasive (it would couple the pure-Python builder to a Node build
 * step). Per the task's explicit escape hatch, this DRIFT TEST is the chosen
 * "can't drift" mechanism instead: the registry is the source, and both echoes are
 * asserted against it here. To add a colormap/operator you touch the registry;
 * this test then tells you exactly which mirrors to update.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { listEncodings, listEncodingsByKind } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
// ui/src/plots/image/model/encodings/ → repo root is six levels up.
const repoRoot = resolve(here, "../../../../../..");
const contractPath = resolve(repoRoot, "schema/cairn-plot-contracts.json");
const componentsPath = resolve(repoRoot, "packages/python/src/cairn_plot/components.py");

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

/** The public tone-map operator ID set the registry defines: the non-HDR light
 *  CURVES plus the structural REMAPS (the `normal` map). Internal HDR execution
 *  curves are not menu operators. Mirrors `SDR_TONEMAP_OPERATORS`
 *  in `image/tonemap.ts`, but computed here straight from the registry. */
const registryTonemapOperators = (): string[] => [
  ...listEncodingsByKind("curve").filter((e) => !e.needsHdrSurface),
  ...listEncodingsByKind("remap"),
].map((e) => e.id);

/** The colormap ID set the registry defines: every `kind:"lut"` entry. */
const registryColormaps = (): string[] => listEncodingsByKind("lut").map((e) => e.id);

/** Extract a Python module-level tuple of string literals, e.g.
 *  `_COLORMAPS = ("viridis", "plasma", ...)`. `#` line comments are stripped
 *  FIRST — comment prose can contain `)`, which would otherwise truncate the
 *  non-greedy tuple match early. */
function pyStringTuple(src: string, name: string): string[] {
  const clean = src.replace(/#[^\n]*/g, "");
  const m = new RegExp(`${name}\\s*=\\s*\\(([\\s\\S]*?)\\)`).exec(clean);
  assert.ok(m, `Python tuple ${name} not found in components.py`);
  return [...m![1]!.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]!);
}

const contract = JSON.parse(readFileSync(contractPath, "utf8")) as {
  colormaps: string[];
  tonemapOperators: string[];
};
const pySrc = readFileSync(componentsPath, "utf8");

test("registry tonemap operators === contract.tonemapOperators", () => {
  assert.deepEqual(sorted(registryTonemapOperators()), sorted(contract.tonemapOperators));
});

test("registry colormaps === contract.colormaps", () => {
  assert.deepEqual(sorted(registryColormaps()), sorted(contract.colormaps));
});

test("registry tonemap operators === Python _TONEMAP_OPERATORS", () => {
  assert.deepEqual(sorted(registryTonemapOperators()), sorted(pyStringTuple(pySrc, "_TONEMAP_OPERATORS")));
});

test("registry colormaps === Python _COLORMAPS", () => {
  assert.deepEqual(sorted(registryColormaps()), sorted(pyStringTuple(pySrc, "_COLORMAPS")));
});

test("every registry lut id is a real, unique encoding", () => {
  const luts = listEncodingsByKind("lut");
  assert.ok(luts.length > 0, "no lut encodings registered");
  const all = new Set(listEncodings().map((e) => e.id));
  for (const id of registryColormaps()) assert.ok(all.has(id), `lut ${id} not in registry`);
});
