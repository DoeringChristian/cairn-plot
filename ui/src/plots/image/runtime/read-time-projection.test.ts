/**
 * Source-assertion guard for the READ-TIME-ONLY split (capability-fallbacks):
 * a store id the active backend can't render is projected onto a fallback
 * for RENDERING only — the raw selection stays the one the write callbacks
 * and the "modified" checks compare against, and the store itself is never
 * rewritten by a projected value. Backend `.tsx` can't be imported under
 * `--experimental-strip-types` (see `toolbar-seam.test.ts`), so this asserts
 * the contract at the SOURCE level, the same way that guard does.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/runtime/read-time-projection.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../../..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const view = read("plots/image/runtime/view.tsx");
const compositor = read("plots/image/runtime/compare-compositor.tsx");
const displayOperation = read("plots/image/components/display-operation.ts");

// --- runtime/view.tsx: the host adapter -----------------------------------

test("view.tsx: operationId and mode render the EFFECTIVE (projected) operation", () => {
  assert.match(
    view,
    /operationId: effectiveComparisonOperation === "split"/,
    "operationId must be derived from effectiveComparisonOperation, not the raw store selection",
  );
  assert.match(
    view,
    /mode: effectiveComparisonOperation === "split" \? "split" : "diff"/,
    "mode must be derived from effectiveComparisonOperation, not the raw store selection",
  );
});

test("view.tsx: write callbacks and compareModified read the RAW selection", () => {
  const previousOperationDecls = view.match(/previousOperation: selectedComparisonOperation/g) ?? [];
  assert.ok(
    previousOperationDecls.length >= 2,
    "both onComparisonOperationChange and onCompareModeChange must patch from the raw selectedComparisonOperation, never the projected value",
  );
  assert.match(
    view,
    /compareModified:\s*\n\s*selectedComparisonOperation !==/,
    "compareModified must compare the raw selectedComparisonOperation against the authored default, not the projected operation",
  );
});

test("view.tsx: a projected mode selection never rewrites the store", () => {
  assert.match(
    view,
    /if \(mode === rawMode\) return/,
    "onCompareModeChange must guard on the RAW mode and bail before patching, so re-selecting the mode the menu already shows (because it was PROJECTED) cannot overwrite the authored operation",
  );
});

// --- runtime/compare-compositor.tsx: the offscreen/legacy compositor seam --

test("compare-compositor.tsx: projects the requested kernel through the shared rule", () => {
  assert.match(
    compositor,
    /projectComparisonOperation\(/,
    "the compositor must project its requested comparison operation through the same projectComparisonOperation used by the host adapter, not pass the raw id straight through",
  );
  assert.match(
    compositor,
    /fallback: proj\.fallback/,
    "the compositor must report the projection's fallback on its compareSource, so the pane can render the FallbackChip",
  );
});

// --- components/display-operation.ts: the encoding projection --------------

test("display-operation.ts: displayOperationModified compares the RAW store id against the seed", () => {
  assert.match(
    displayOperation,
    /displayOperationModified = rawEncodingId !== seedFor\(arity\)/,
    "displayOperationModified must be computed from the raw store id, not the projected displayOperationId, so a substituted encoding does not show as user-modified",
  );
});

test("display-operation.ts: idsFor seeds from the catalogue, not the active backend", () => {
  assert.match(
    displayOperation,
    /capabilities: CATALOGUE/,
    "idsFor must resolve seeding ids against the catalogue-level pseudo-capability, so the authored seed is identical regardless of which backend is active",
  );
});
