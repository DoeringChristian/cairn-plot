# Comparison Operations as Backend Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SDR FLIP and HDR FLIP two public comparison operations, make backends advertise public operation ids only (never kernels), and make both backends declare and implement the identical operation and display sets, so the comparison menu is the same on CPU and WebGPU and never shows an implementation id.

**Architecture:** The definition registry holds public operations only (`flip`, `flip-hdr`, `ssim`, six pointwise, `identity`, `split`). `ImageBackendCapabilities` becomes two validated id lists that both backends fill from the registries. Each backend maps public ids to private implementations inside its own directory. The host adapter builds the menu from the active backend's capabilities, using the registry only for labels and order; `comparison-operations.ts` is deleted. `compare.flipMode` is removed, with a read-side migration to `compare.operation: "flip-hdr"`. The cross-language contract (JSON, TS builder, Python) gains `flip_hdr`.

**Tech Stack:** TypeScript/React (ui/src), WGSL kernels unchanged, Node `node:test`, Python/pydantic + pytest, JSON contract file, cairn consumer (submodule).

**Spec:** `docs/superpowers/specs/2026-09-04-comparison-capabilities-design.md`

## Global Constraints

- Branch `comparison-capabilities` off `cpu-viewport-canvas`; `main` untouched. Commit per task with the repository trailers (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and the `Claude-Session:` line from the session reminder).
- Numerics unchanged: no edit inside `ui/src/plots/image/webgpu/kernels/*.wgsl.ts` bodies, `runtime/flip-reference.ts`, `runtime/hdr-flip-reference.ts`, `runtime/ssim-reference.ts`, or `cpu/source-metrics.ts` beyond the operation-id type and dispatch names.
- No kernel identifier (`hdr-flip`, `flip-sdr`) may exist outside `ui/src/plots/image/webgpu/` after Task 3; a source-text test pins this.
- Public ids: `flip` (label "FLIP", publicName `flip`), `flip-hdr` (label "HDR-FLIP", publicName `flip_hdr`), `ssim`. Registry ids are what settings (`compare.operation`) and cairn's option list store; public names are what `cp.Compare(mode=)` and the JS builder accept.
- `cd ui && npm test` and `npm run typecheck` green at every commit; `uv run pytest tests/ -q` green from Task 1 on.

---

### Task 1: Registry helpers and the cross-language contract

**Files:**
- Modify: `ui/src/plots/image/definition/image-operations.ts`
- Delete: `ui/src/plots/image/definition/comparison-operations.ts` and `comparison-operations.test.ts`; its two registry helpers move into `image-operations.ts` (+ new cases in `image-operations.test.ts`)
- Modify: `schema/cairn-plot-contracts.json`
- Modify: `ui/src/public/builder/validate.ts:31-48`, `ui/src/public/builder/builders.ts:223,420-426` (+ `builders.test.ts` cases mentioning `flipMode`)
- Modify: `packages/python/src/cairn_plot/components.py:132-146,242,1979-2035`
- Modify: `ui/src/plots/image/runtime/operation-display-defaults.ts` (+ test)
- Test: `ui/src/plots/image/definition/image-operations.test.ts`, `ui/src/testing/contracts.test.ts`, `tests/test_contracts.py`, `tests/` compare tests

**Interfaces:**
- Produces: registry ids `flip`, `flip-hdr`, `ssim`; from `image-operations.ts`: `listComparisonOperationPublicNames()` and `operationIdForPublicName("flip_hdr") === "flip-hdr"`; `recommendedImageEncoding({ operation })` without `flipMode`; `comparisonOperationSettingsPatch` without `flipMode`.
- Consumers in later tasks: views, cairn.

- [ ] **Step 1: Failing tests**

Delete `comparison-operations.test.ts`; add to `image-operations.test.ts` (create it if absent):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listImageOperations,
  listComparisonOperationPublicNames,
  operationIdForPublicName,
} from "./image-operations.ts";

test("SDR FLIP and HDR FLIP are two public registry entries and no kernel id exists", () => {
  const byId = new Map(listImageOperations().map((o) => [o.id, o]));
  assert.deepEqual([byId.get("flip")?.label, byId.get("flip")?.publicName], ["FLIP", "flip"]);
  assert.deepEqual([byId.get("flip-hdr")?.label, byId.get("flip-hdr")?.publicName], ["HDR-FLIP", "flip_hdr"]);
  assert.equal(byId.has("hdr-flip"), false);
  assert.equal(byId.has("flip-sdr"), false);
  for (const o of listImageOperations()) {
    if (o.inputs === 2 && o.id !== "split") assert.ok(o.publicName, `${o.id} has a public name`);
  }
});

test("public names round-trip to registry ids", () => {
  assert.equal(operationIdForPublicName("flip"), "flip");
  assert.equal(operationIdForPublicName("flip_hdr"), "flip-hdr");
  assert.equal(operationIdForPublicName("ssim"), "ssim");
  assert.deepEqual(
    [...listComparisonOperationPublicNames()].sort(),
    ["abs", "flip", "flip_hdr", "rel_abs", "rel_signed", "rel_square", "signed", "square", "ssim"],
  );
});
```

In `operation-display-defaults.test.ts` add: `assert.equal(recommendedImageEncoding({ operation: "flip-hdr" }), "magma")` and remove any `flipMode` argument.

Python (`tests/test_contracts.py` already pins the JSON; add to the compare tests file that exercises `cp.Compare`):

```python
def test_compare_flip_hdr_is_a_public_mode() -> None:
    node = cp.Compare(cp.Image(_sdr()), cp.Image(_sdr()), mode="flip_hdr").to_node()
    assert node["props"]["operation"] == "flip-hdr"
    with pytest.raises(TypeError):
        cp.Compare(cp.Image(_sdr()), cp.Image(_sdr()), mode="flip", flip_mode="hdr")  # type: ignore[call-arg]
```

(Locate how existing tests read the emitted operation from a compare node and match that key; the assertion target is the registry id.)

- [ ] **Step 2: Run to verify failure**

Run: `cd ui && node --experimental-strip-types --test src/plots/image/definition/image-operations.test.ts` and `uv run pytest tests -q -k flip_hdr`.
Expected: FAIL.

- [ ] **Step 3: Registry**

In `image-operations.ts`: delete `"flip-mode"` from `ImageOperationParameter`; replace the three flip rows with

```ts
  { id: "flip", label: "FLIP", publicName: "flip", inputs: 2, output: { arity: 1, domain: "nonnegative" }, defaultDisplayOperation: "magma", cache: "global-lru", parameters: ["ppd"] },
  { id: "flip-hdr", label: "HDR-FLIP", publicName: "flip_hdr", inputs: 2, output: { arity: 1, domain: "nonnegative" }, defaultDisplayOperation: "magma", cache: "global-lru", parameters: ["ppd", "exposure-min", "exposure-max"] },
```

and add `export const IMAGE_OPERATION_IDS: readonly string[] = IMAGE_OPERATIONS.map((o) => o.id);`.

- [ ] **Step 4: Registry helpers replace the projection module**

Append to `image-operations.ts` and delete `comparison-operations.ts` (re-point every importer: `testing/contracts.test.ts`, `public/builder/*`, `compare/compare-captions.ts` (use `getImageOperation(id)?.label`), the views in Tasks 3/4):

```ts
/** The flat public compare-mode names (`cp.Compare(mode=)`), pinned to the contract. */
export function listComparisonOperationPublicNames(): string[] {
  return IMAGE_OPERATIONS
    .filter((o) => o.inputs === 2 && o.id !== "split" && !!o.publicName)
    .map((o) => o.publicName!);
}

/** Lower an authored public name (`abs`, `flip_hdr`, …) to its registry id. */
export function operationIdForPublicName(publicName: string): string | undefined {
  return IMAGE_OPERATIONS.find((o) => o.publicName === publicName)?.id;
}
```

- [ ] **Step 5: Display defaults**

`operation-display-defaults.ts`: remove the `FlipMode` import and option; `recommendedImageEncoding` uses `getImageOperation(operation)?.defaultDisplayOperation ?? sourceDefault`; `comparisonOperationSettingsPatch` loses `flipMode`. Update its test.

- [ ] **Step 6: Contract JSON, TS builder, Python**

`schema/cairn-plot-contracts.json`: append `"flip_hdr"` to `comparisonOperationPublicNames` (after `"flip"`), add `"flip_hdr": "flip-hdr"` to `comparisonOperationModes`, and replace the `$comment_comparisonOperationModes` sentence about `compare.flipMode` with "SDR FLIP (`flip`) and HDR FLIP (`flip_hdr`) are two public operations."
`validate.ts`: add `flip_hdr: "flip-hdr"` to `COMPARE_OPERATION_MODES`.
`builders.ts`: delete the `take("flipMode", "compare.flipMode")` line and the `opts.flipMode` block (lines 420-426); remove `flipMode` from the option type.
`components.py`: add `"flip_hdr": "flip-hdr"` to `_COMPARE_OPERATION_MODES` (replace the two comment lines with the contract sentence); delete the `flip_mode` parameter, its two validations, its `built["flipMode"]` emission, and the `"flipMode": "compare.flipMode"` entry at line 242.

- [ ] **Step 7: Verify**

Run: `cd ui && npm test && npm run typecheck && npm run check:plot-schema` (typecheck will fail in views that still import `resolveComparisonOperationId` — that is Tasks 3/4; record the exact list) and `uv run pytest tests/ -q`.
Expected: unit tests PASS, pytest PASS, schema check PASS, typecheck errors only in `webgpu/view.tsx`, `cpu/view.tsx`, `runtime/view.tsx`, `pixel-samplers.ts`.

- [ ] **Step 8: Commit**

```bash
git add ui/src/plots/image/definition ui/src/plots/image/runtime/operation-display-defaults* ui/src/public/builder schema packages/python tests
git commit -m "Make SDR and HDR FLIP two public comparison operations"
```

---

### Task 2: Capability contract as validated id lists; both backends declare the registries

**Files:**
- Modify: `ui/src/plots/image/backend.ts`
- Modify: `ui/src/plots/image/definition/display-operations.ts` (export `DISPLAY_OPERATION_IDS`)
- Modify: `ui/src/plots/image/cpu/backend.ts`, `ui/src/plots/image/webgpu/backend.ts`
- Test: `ui/src/plots/image/runtime/backend-capabilities.test.ts`

**Interfaces:**
- Produces: `ImageBackendCapabilities { imageOperations: readonly string[]; displayOperations: readonly string[]; supportsImageOperation; supportsDisplayOperation }`; `defineImageBackendCapabilities({ imageOperations: string[], displayOperations: string[] })` throws `Error("image backend advertises unknown image operation <id>")` for ids not in the registry.

- [ ] **Step 1: Failing test** (replace the first two tests in `backend-capabilities.test.ts`)

```ts
import { cpuImageBackend } from "../cpu/backend.ts";
import { webGpuImageBackend } from "../webgpu/backend.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";

test("both backends advertise the identical, registry-complete capability sets", () => {
  const sorted = (a: readonly string[]) => [...a].sort();
  assert.deepEqual(sorted(cpuImageBackend.capabilities.imageOperations), sorted(IMAGE_OPERATION_IDS));
  assert.deepEqual(sorted(webGpuImageBackend.capabilities.imageOperations), sorted(IMAGE_OPERATION_IDS));
  assert.deepEqual(sorted(cpuImageBackend.capabilities.displayOperations), sorted(DISPLAY_OPERATION_IDS));
  assert.deepEqual(sorted(webGpuImageBackend.capabilities.displayOperations), sorted(DISPLAY_OPERATION_IDS));
});

test("capabilities reject ids that are not public registry entries", () => {
  assert.throws(() => defineImageBackendCapabilities({ imageOperations: ["hdr-flip"], displayOperations: [] }), /unknown image operation/);
  assert.throws(() => defineImageBackendCapabilities({ imageOperations: [], displayOperations: ["viridis"] }), /unknown display operation/);
});
```

Importing the WebGPU backend module in Node must not touch `navigator.gpu` at import time; if it does, the test imports `WEBGPU_CAPABILITIES` (a new export from `webgpu/backend.ts` holding the frozen capability object) instead of the backend object.

- [ ] **Step 2: Implement**

`backend.ts`: change the interface to id lists; `defineImageBackendCapabilities` checks each id with `getImageOperation` / `getDisplayOperation` and throws on a miss.
`display-operations.ts`: `export const DISPLAY_OPERATION_IDS = DISPLAY_OPERATIONS.map((o) => o.id)`.
Both backends: `capabilities: defineImageBackendCapabilities({ imageOperations: IMAGE_OPERATION_IDS, displayOperations: DISPLAY_OPERATION_IDS })`. The CPU backend also asserts at module load that every id has an implementation: `for (const id of IMAGE_OPERATION_IDS) if (!hasCpuImageOperation(id)) throw new Error(...)` where `hasCpuImageOperation` is true for `identity`, `split`, the pointwise evaluators, and `flip`/`flip-hdr`/`ssim` (metrics path); the same guard in the WebGPU backend against its kernel table (after Task 3 re-keys it).

- [ ] **Step 3: Verify and commit**

`cd ui && npm test` (the new test passes once Task 3's re-keying lands; if it fails only on the WebGPU guard, finish Task 3 before committing both together and say so).

```bash
git commit -am "Advertise public operation ids as image backend capabilities"
```

---

### Task 3: WebGPU backend keyed by public ids; no flipMode; menu from capabilities

**Files:**
- Modify: `ui/src/plots/image/webgpu/image-operations.ts:57-60`
- Modify: `ui/src/plots/image/webgpu/kernels/flip.wgsl.ts` (delete `flipProgram` and its sRGB `YCXCZ_SHADER` front-end if unused; keep `flipLdrForcedProgram` renamed `flipProgram`)
- Modify: `ui/src/plots/image/webgpu/view.tsx` (`flipMode`, `resolveComparisonOperationId`, `resolvedOperationId`, the `flip-mode` toolbar segment at ~2355, the "Mean FLIP" label at ~1873, `listComparisonOperationOptions` fallback at ~2118)
- Modify: `ui/src/plots/image/webgpu/pixel-samplers.ts:53`, `ui/src/plots/image/webgpu/pool.ts` / `diff-cache.ts` wherever `hdr-flip`/`flip-sdr` strings appear (cache keys use the public id)
- Modify: `ui/src/plots/image/runtime/view.tsx:55-61,75-81`
- Test: new `ui/src/plots/image/runtime/no-kernel-ids.test.ts`

- [ ] **Step 1: Failing source-text test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|__tests__|\.bundle\./.test(p)) out.push(p);
  }
  return out;
}

test("kernel identifiers stay private to the WebGPU backend", () => {
  const root = new URL("../", import.meta.url).pathname; // ui/src/plots/image
  for (const file of walk(root)) {
    if (file.includes("/webgpu/")) continue;
    const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(src, /"hdr-flip"|"flip-sdr"/, file);
  }
});
```

- [ ] **Step 2: Re-key the kernel table**

```ts
  multipass("flip", flipProgram),        // linear-clamp LDR FLIP (was flipLdrForcedProgram)
  multipass("flip-hdr", hdrFlipProgram),
  multipass("ssim", ssimProgram),
```

In `flip.wgsl.ts` rename `flipLdrForcedProgram` to `flipProgram`, delete the old sRGB-front-end program and any shader string only it used (grep `YCXCZ_SHADER` usages first; the parity harness `webgpu/__tests__/flip.browser.ts` must still compile: if it references the deleted program, point it at `flipProgram`).

- [ ] **Step 3: View and samplers**

In `webgpu/view.tsx`: delete the `flipMode` derivation and the `resolveComparisonOperationId` import; `resolvedOperationId = comparisonOperationId`; the "Mean FLIP" label condition becomes `resolvedOperationId === "flip" || resolvedOperationId === "flip-hdr"`; delete the `flip-mode` toolbar segment; the view's own fallback list is removed: `kernelOptions: compareSource?.operationOptions ?? []` (the adapter always supplies the list). `pixel-samplers.ts:53` comment updated; any `"hdr-flip"` string in `pool.ts`/`diff-cache.ts`/`diff-engine.ts` becomes `"flip-hdr"` (these are cache keys and multipass lookups; rename only).

- [ ] **Step 4: Host adapter menu**

`runtime/view.tsx` builds the menu from capabilities, with registry labels and order:

```ts
operationOptions: listImageOperations()
  .filter((o) => o.inputs === 2 && o.id !== "split")
  .filter((o) => activeBackend.capabilities.supportsImageOperation(o.id))
  .map((o) => ({ id: o.id, label: o.label })),
```

Add a unit test (`runtime/comparison-menu.test.ts`) that builds the list from a capability object lacking `flip-hdr` and asserts HDR-FLIP is absent while order and labels of the rest match the registry.

Delete `flipMode:` from the comparison input and from both `comparisonOperationSettingsPatch` calls. Remove `flipMode` from `ImageComparisonInput` in `runtime/contracts.ts:256`.

- [ ] **Step 5: Verify**

`cd ui && npm test && npm run typecheck` (typecheck may still fail in `cpu/view.tsx`, Task 4). Harness: `npm run test:harness -- --only hdr-flip`, `--only flip` (WebGPU parity, need an adapter), `--only gpu-compare-split-numbers`, `--only gpu-cached-error-numbers` (update their selections if they set `compare.flipMode`).

- [ ] **Step 6: Commit** `Key WebGPU comparison kernels by public operation id`

---

### Task 4: CPU backend on public ids; settings migration; remove `compare.flipMode`

**Files:**
- Modify: `ui/src/plots/image/cpu/source-metrics.ts:109,138-140,173-176,208` (rename `"hdr-flip"` → `"flip-hdr"` in the type and comparisons)
- Modify: `ui/src/plots/image/cpu/view.tsx` (~1165-1172: pass `compare.operationId` straight through; drop `flipMode`)
- Modify: `ui/src/settings/schema.ts:13`, `ui/src/plots/image/definition/settings.ts` (remove the key and the "FLIP range" row; add `migrateCompareSettings`)
- Modify: `ui/src/plots/image/runtime/view.tsx` (apply the migration to `settings` before use) and the descriptor seed path in `runtime/host-adapter.tsx` where props seed settings (grep `compare.operation` there)
- Test: `ui/src/plots/image/definition/settings.test.ts` (new), `ui/src/plots/image/cpu/source-metrics.test.ts` (rename the operation string)
- Modify: `ui/src/plots/image/compare/__tests__/cpu-compare-fallback.browser.ts` case 3 selector to `[data-cpu-comparison-result="flip-hdr"]` if it exercises HDR FLIP, else unchanged

- [ ] **Step 1: Failing migration test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateCompareSettings } from "./settings.ts";

test("legacy flipMode=hdr under flip becomes the HDR FLIP operation", () => {
  assert.deepEqual(
    migrateCompareSettings({ "compare.operation": "flip", "compare.flipMode": "hdr" } as never),
    { "compare.operation": "flip-hdr" },
  );
  assert.deepEqual(
    migrateCompareSettings({ "compare.operation": "flip", "compare.flipMode": "sdr" } as never),
    { "compare.operation": "flip" },
  );
  assert.deepEqual(migrateCompareSettings({ "compare.operation": "ssim" } as never), { "compare.operation": "ssim" });
});
```

- [ ] **Step 2: Implement**

```ts
/** Read-side migration of the removed `compare.flipMode` setting. */
export function migrateCompareSettings<T extends Record<string, unknown>>(settings: T): T {
  if (!("compare.flipMode" in settings)) return settings;
  const { "compare.flipMode": flipMode, ...rest } = settings as Record<string, unknown>;
  if (rest["compare.operation"] === "flip" && flipMode === "hdr") rest["compare.operation"] = "flip-hdr";
  return rest as T;
}
```

Apply it in `runtime/view.tsx` (`const settings = migrateCompareSettings(rawSettings)`) and at the descriptor seed (`flipMode: "hdr"` prop → the same function over the seeded object). Remove the key from the schema type and the settings definition table.

- [ ] **Step 3: Verify**

`cd ui && npm test && npm run typecheck` (fully green now) and `npm run test:harness -- --only cpu-compare-fallback`.

- [ ] **Step 4: Commit** `Run CPU comparisons by public operation id and migrate compare.flipMode`

---

### Task 5: Docs, bundle, checks

- Modify `docs/plot-type-authoring.md` "Backends and engines": add "A backend advertises the public image and display operations it supports, by id. Kernel identifiers never leave the backend directory; the menu is the registry's public projection intersected with the active backend's capabilities." Update `docs/API.md` where `compare.flipMode`/`flip_mode` is documented (grep) to describe `mode="flip_hdr"`.
- Run: `cd ui && npm run check:plot-schema && npm run check:plot-boundary && npm run build:plot-inline && npm run check:plot-bundles && npm run sync:plot-assets && npm run check:plot-assets && npm run smoke:plot && npm run smoke:js && cd .. && uv run pytest tests/ -q`.
- Commit `Document backend capabilities as public operations and sync bundles` (docs + `packages/python/src/cairn_plot/_assets/plot-inline/*`).

---

### Task 6: cairn

**Files (in /Users/doeringc/workspace/cairn):** `vendor/cairn-plot` (bump), `cairn/ui/src/components/CairnPlotCard.tsx:81-86,468-492,494-509,655-680`, `tests/unit/test_plot_components.py` (any `flip_mode`), `cairn/ui/dist` (rebuilt by hand).

- [ ] `COMPARE_OPTIONS`: insert `["flip-hdr", "HDR-FLIP"]` after `["flip", "FLIP"]`.
- [ ] Delete the "FLIP evaluation" `Select` (669-676) and the two `flipMode:` arguments (482, 508).
- [ ] Extend the one-shot migration effect (468-492): when `live["compare.flipMode"] === "hdr"` and `operation === "flip"`, set `operation = "flip-hdr"` and include `"compare.operation": "flip-hdr"` in `migratedPlotSettings`, delete `"compare.flipMode"` from it, and also `updateSettings({ comparisonOperation: "flip-hdr" })`. Bump the marker to `encodingDefaultsVersion: 2` with the type widened to `1 | 2` and the guard `=== 2`.
- [ ] `cd cairn/ui && npm run typecheck && npm run build`; `uv run pytest tests/unit/test_plot_components.py tests/unit/test_ui_cairn_plot_card_contract.py -q` (the 31 pre-existing `renderer` failures are known; zero new).
- [ ] Verify live: a card with a reference tag shows "FLIP" and "HDR-FLIP" as two dropdown entries with WebGPU on and off, no "FLIP evaluation" selector, and a saved card that had HDR selected opens on HDR-FLIP.
- [ ] Commit in cairn only after the user confirms.
