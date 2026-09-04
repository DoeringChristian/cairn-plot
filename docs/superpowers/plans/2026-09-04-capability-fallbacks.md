# Capability Fallbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The display-encoding menu is catalogue ∩ active backend, every backend must declare a core subset, and an authored/saved id the active backend does not support is projected at read time to a declared fallback with a small chip.

**Architecture:** One pure module `definition/core.ts` holds the core ids, the fallback rules and the two projection functions. `defineImageBackendCapabilities` enforces the core. The pane encoding hook filters its menu through capabilities and projects the raw store id; the host adapter projects the comparison operation. `ImagePaneShell` renders a `FallbackChip` per fallback record. The settings store is never rewritten by a projection.

**Tech Stack:** TypeScript, React, node:test with `--experimental-strip-types` (run from `ui/`: `npm test`), `npm run typecheck` in `ui/`.

**Spec:** `docs/superpowers/specs/2026-09-04-capability-fallbacks-design.md`

## Global Constraints

- Capabilities are id lists only; no parameter-level capability anywhere.
- Projection is read-time only: never write the effective id into the settings store; HOME resets to the authored seed.
- Seeding stays catalogue-level: `seedFor` in `usePaneEncoding` and `defaultImageSettings` are unchanged in meaning.
- No kernel id outside `ui/src/plots/image/webgpu/` (`runtime/no-kernel-ids.test.ts` stays green).
- Unit tests are `node:test` files named `*.test.ts` under `ui/src`; no React test runner exists, so hook logic must live in pure functions.
- Commit trailers: every commit ends with
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.

---

### Task 1: Catalogue core, projection functions, capability enforcement

**Files:**
- Create: `ui/src/plots/image/definition/core.ts`
- Create: `ui/src/plots/image/definition/core.test.ts`
- Modify: `ui/src/plots/image/backend.ts:34-52` (`defineImageBackendCapabilities`)
- Modify: `ui/src/plots/image/runtime/backend-capabilities.test.ts`

**Interfaces:**
- Consumes: `getDisplayOperation(id)` from `definition/display-operations.ts` (returns `{ category: "curve" | "colormap" | "remap", ... } | undefined`); `ImageBackendCapabilities` from `backend.ts`.
- Produces (used by Tasks 2 and 3):
  ```ts
  export const CORE_IMAGE_OPERATION_IDS: readonly ["identity", "split"];
  export const CORE_DISPLAY_OPERATION_IDS: readonly ["srgb", "turbo"];
  export const FALLBACK_COMPARISON_OPERATION = "split";
  export function fallbackDisplayOperation(requestedId: string): "turbo" | "srgb";
  export interface CapabilityFallback { readonly kind: "display" | "comparison"; readonly requested: string; readonly effective: string; }
  export interface Projection { readonly effective: string; readonly fallback: CapabilityFallback | null; }
  export function projectDisplayOperation(requestedId: string, capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">): Projection;
  export function projectComparisonOperation(requestedId: string, capabilities: Pick<ImageBackendCapabilities, "supportsImageOperation">): Projection;
  ```

- [ ] **Step 1: Write the failing tests**

`ui/src/plots/image/definition/core.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { defineImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "./display-operations.ts";
import { IMAGE_OPERATION_IDS } from "./image-operations.ts";
import {
  CORE_DISPLAY_OPERATION_IDS,
  CORE_IMAGE_OPERATION_IDS,
  FALLBACK_COMPARISON_OPERATION,
  fallbackDisplayOperation,
  projectComparisonOperation,
  projectDisplayOperation,
} from "./core.ts";

const full = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});
// A backend that lacks plasma, aces, normal and flip-hdr but has the core.
const partial = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS.filter((id) => id !== "flip-hdr"),
  displayOperations: DISPLAY_OPERATION_IDS.filter((id) => !["plasma", "aces", "normal"].includes(id)),
});

test("core ids are catalogue entries and the fallbacks are core", () => {
  for (const id of CORE_IMAGE_OPERATION_IDS) assert.ok(IMAGE_OPERATION_IDS.includes(id), id);
  for (const id of CORE_DISPLAY_OPERATION_IDS) assert.ok(DISPLAY_OPERATION_IDS.includes(id), id);
  assert.ok((CORE_IMAGE_OPERATION_IDS as readonly string[]).includes(FALLBACK_COMPARISON_OPERATION));
  assert.ok((CORE_DISPLAY_OPERATION_IDS as readonly string[]).includes(fallbackDisplayOperation("plasma")));
  assert.ok((CORE_DISPLAY_OPERATION_IDS as readonly string[]).includes(fallbackDisplayOperation("aces")));
});

test("display fallback follows the requested category", () => {
  assert.equal(fallbackDisplayOperation("plasma"), "turbo");
  assert.equal(fallbackDisplayOperation("magma"), "turbo");
  assert.equal(fallbackDisplayOperation("aces"), "srgb");
  assert.equal(fallbackDisplayOperation("normal"), "srgb");
  assert.equal(fallbackDisplayOperation("not-a-display-op"), "srgb");
});

test("projection is the identity when the backend supports the id", () => {
  assert.deepEqual(projectDisplayOperation("plasma", full), { effective: "plasma", fallback: null });
  assert.deepEqual(projectDisplayOperation("aces", partial), {
    effective: "srgb",
    fallback: { kind: "display", requested: "aces", effective: "srgb" },
  });
  assert.deepEqual(projectDisplayOperation("plasma", partial), {
    effective: "turbo",
    fallback: { kind: "display", requested: "plasma", effective: "turbo" },
  });
  assert.deepEqual(projectDisplayOperation("turbo", partial), { effective: "turbo", fallback: null });
});

test("unsupported comparison operations project to split", () => {
  assert.deepEqual(projectComparisonOperation("flip-hdr", full), { effective: "flip-hdr", fallback: null });
  assert.deepEqual(projectComparisonOperation("flip-hdr", partial), {
    effective: "split",
    fallback: { kind: "comparison", requested: "flip-hdr", effective: "split" },
  });
  assert.deepEqual(projectComparisonOperation("split", partial), { effective: "split", fallback: null });
});
```

Append to `ui/src/plots/image/runtime/backend-capabilities.test.ts` (add the import `import { CORE_DISPLAY_OPERATION_IDS, CORE_IMAGE_OPERATION_IDS } from "../definition/core.ts";`):

```ts
test("capabilities must advertise the core subset the fallbacks rely on", () => {
  assert.throws(
    () => defineImageBackendCapabilities({
      imageOperations: IMAGE_OPERATION_IDS,
      displayOperations: DISPLAY_OPERATION_IDS.filter((id) => id !== "turbo"),
    }),
    /core display operation turbo/,
  );
  assert.throws(
    () => defineImageBackendCapabilities({
      imageOperations: IMAGE_OPERATION_IDS.filter((id) => id !== "split"),
      displayOperations: DISPLAY_OPERATION_IDS,
    }),
    /core image operation split/,
  );
  for (const advertised of capabilities) {
    for (const id of CORE_IMAGE_OPERATION_IDS) assert.ok(advertised.supportsImageOperation(id), id);
    for (const id of CORE_DISPLAY_OPERATION_IDS) assert.ok(advertised.supportsDisplayOperation(id), id);
  }
});

test("the union of backend declarations is the catalogue (hull)", () => {
  const union = (pick: (c: (typeof capabilities)[number]) => readonly string[]) =>
    sorted([...new Set(capabilities.flatMap((c) => [...pick(c)]))]);
  assert.deepEqual(union((c) => c.imageOperations), sorted(IMAGE_OPERATION_IDS));
  assert.deepEqual(union((c) => c.displayOperations), sorted(DISPLAY_OPERATION_IDS));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `ui/`): `node --experimental-strip-types --test src/plots/image/definition/core.test.ts src/plots/image/runtime/backend-capabilities.test.ts`
Expected: FAIL (module `./core.ts` not found; the two new capability tests fail).

- [ ] **Step 3: Create `definition/core.ts`**

```ts
// ---------------------------------------------------------------------------
// The catalogue's REQUIRED CORE and the read-time fallback projection.
//
// `definition/` states what is generally supported (the hull the authoring
// side validates against). A backend advertises a subset of it by id. The
// authored settings are the default state; when the ACTIVE backend cannot
// render one of them, the view projects it — at read time, never into the
// settings store — onto a fallback that every backend must declare:
//   colormap  → turbo        curve / remap → srgb
//   comparison operation → split
// `defineImageBackendCapabilities` refuses a declaration missing the core, so
// the projection always lands on something the backend renders.
// ---------------------------------------------------------------------------

import type { ImageBackendCapabilities } from "../backend.ts";
import { getDisplayOperation } from "./display-operations.ts";

export const CORE_IMAGE_OPERATION_IDS = ["identity", "split"] as const;
export const CORE_DISPLAY_OPERATION_IDS = ["srgb", "turbo"] as const;

export const FALLBACK_COMPARISON_OPERATION = "split";

/** Colormaps fall back to turbo; curves, the normal remap and unknown ids to srgb. */
export function fallbackDisplayOperation(requestedId: string): "turbo" | "srgb" {
  return getDisplayOperation(requestedId)?.category === "colormap" ? "turbo" : "srgb";
}

/** One substitution the view made because the active backend lacks `requested`. */
export interface CapabilityFallback {
  readonly kind: "display" | "comparison";
  readonly requested: string;
  readonly effective: string;
}

export interface Projection {
  readonly effective: string;
  readonly fallback: CapabilityFallback | null;
}

export function projectDisplayOperation(
  requestedId: string,
  capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">,
): Projection {
  if (capabilities.supportsDisplayOperation(requestedId)) return { effective: requestedId, fallback: null };
  const effective = fallbackDisplayOperation(requestedId);
  return { effective, fallback: { kind: "display", requested: requestedId, effective } };
}

export function projectComparisonOperation(
  requestedId: string,
  capabilities: Pick<ImageBackendCapabilities, "supportsImageOperation">,
): Projection {
  if (capabilities.supportsImageOperation(requestedId)) return { effective: requestedId, fallback: null };
  const effective = FALLBACK_COMPARISON_OPERATION;
  return { effective, fallback: { kind: "comparison", requested: requestedId, effective } };
}
```

- [ ] **Step 4: Enforce the core in `backend.ts`**

In `defineImageBackendCapabilities`, after the two unknown-id loops, add (import `CORE_DISPLAY_OPERATION_IDS`, `CORE_IMAGE_OPERATION_IDS` from `./definition/core.ts`; check for an import cycle: `core.ts` imports only the *type* from `backend.ts`, so use `import type` there):

```ts
  for (const id of CORE_IMAGE_OPERATION_IDS) {
    if (!options.imageOperations.includes(id)) throw new Error(`image backend must advertise core image operation ${id}`);
  }
  for (const id of CORE_DISPLAY_OPERATION_IDS) {
    if (!options.displayOperations.includes(id)) throw new Error(`image backend must advertise core display operation ${id}`);
  }
```

Update the `ImageBackendCapabilities` doc comment in `backend.ts` to say the lists are public catalogue ids, must include the core, and that parameters declared by the catalogue are assumed supported.

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `ui/`): `npm test` and `npm run typecheck`.
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/plots/image/definition/core.ts ui/src/plots/image/definition/core.test.ts ui/src/plots/image/backend.ts ui/src/plots/image/runtime/backend-capabilities.test.ts
git commit -m "Add catalogue core and read-time fallback projection"
```

---

### Task 2: Encoding menu = catalogue ∩ backend; projection in the pane hook

**Files:**
- Modify: `ui/src/plots/image/components/display-operation.ts` (`resolveDisplayOperationIds`, `PaneEncodingConfig`, `PaneEncoding`, `usePaneEncoding`)
- Create: `ui/src/plots/image/components/display-operation.test.ts`
- Modify: `ui/src/plots/image/cpu/view.tsx:395-402` and `:733-740` (the two `usePaneEncoding` calls)
- Modify: `ui/src/plots/image/webgpu/view.tsx:561-575` (the `usePaneEncoding` call)

**Interfaces:**
- Consumes: `projectDisplayOperation`, `CapabilityFallback` from `../definition/core.ts` (Task 1); `CPU_CAPABILITIES` from `../cpu/capabilities.ts`; `WEBGPU_CAPABILITIES` from `../webgpu/capabilities.ts`.
- Produces:
  ```ts
  export function resolveDisplayOperationIds(opts: {
    mode: "sdr" | "arity"; arity: number; curveSet: readonly string[];
    capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">;
  }): DisplayOperationIds;
  // PaneEncodingConfig gains: capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">;
  // PaneEncoding gains:        fallback: CapabilityFallback | null;
  ```

- [ ] **Step 1: Write the failing test**

`ui/src/plots/image/components/display-operation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { defineImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { resolveDisplayOperationIds } from "./display-operation.ts";

const full = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});
const partial = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS.filter((id) => !["plasma", "aces", "normal"].includes(id)),
});

test("the encoding menu is the catalogue intersected with the backend, in registry order", () => {
  const all = resolveDisplayOperationIds({ mode: "arity", arity: 3, curveSet: DISPLAY_OPERATION_IDS, capabilities: full });
  const some = resolveDisplayOperationIds({ mode: "arity", arity: 3, curveSet: DISPLAY_OPERATION_IDS, capabilities: partial });
  assert.ok(all.curveIds.includes("aces"));
  assert.ok(all.lutIds.includes("plasma"));
  assert.deepEqual(all.remapIds, ["normal"]);
  assert.deepEqual(some.curveIds, all.curveIds.filter((id) => id !== "aces"));
  assert.deepEqual(some.lutIds, all.lutIds.filter((id) => id !== "plasma"));
  assert.deepEqual(some.remapIds, []);
  assert.deepEqual(some.all, [...some.curveIds, ...some.lutIds, ...some.remapIds]);
});

test("sdr mode filters the same way", () => {
  const some = resolveDisplayOperationIds({ mode: "sdr", arity: 1, curveSet: DISPLAY_OPERATION_IDS, capabilities: partial });
  assert.ok(!some.lutIds.includes("plasma"));
  assert.ok(some.lutIds.includes("turbo"));
  assert.ok(!some.curveIds.includes("aces"));
  assert.ok(some.curveIds.includes("srgb"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `ui/`): `node --experimental-strip-types --test src/plots/image/components/display-operation.test.ts`
Expected: FAIL (the `capabilities` argument is ignored, so `some` equals `all`; TypeScript excess-property is not checked by the stripper, so the assertion on `curveIds` fails).

- [ ] **Step 3: Filter `resolveDisplayOperationIds` through capabilities**

Replace the function with:

```ts
export function resolveDisplayOperationIds(opts: {
  mode: "sdr" | "arity";
  arity: number;
  curveSet: readonly string[];
  /** The ACTIVE backend's declaration: the menu is catalogue ∩ backend. */
  capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">;
}): DisplayOperationIds {
  const { mode, arity, curveSet, capabilities } = opts;
  const supported = (id: string) => capabilities.supportsDisplayOperation(id);
  const curveIds = curveSet.filter((id) => getDisplayOperation(id)?.category === "curve").filter(supported);
  const hasNormal = curveSet.some((id) => getDisplayOperation(id)?.category === "remap") && supported("normal");
  let lutIds: string[];
  let remapIds: string[];
  if (mode === "sdr") {
    lutIds = allLutIds().filter(supported);
    remapIds = hasNormal ? ["normal"] : [];
  } else {
    lutIds = lutIdsForArity(arity).filter(supported);
    remapIds = arity === 3 && hasNormal ? ["normal"] : [];
  }
  return { curveIds, lutIds, remapIds, all: [...curveIds, ...lutIds, ...remapIds] };
}
```

Add `import type { ImageBackendCapabilities } from "../backend.ts";` and `import { projectDisplayOperation, type CapabilityFallback } from "../definition/core.ts";`. Keep the existing doc comment, adding one sentence: "Seeding stays catalogue-level; only the offered menu is intersected with the backend."

- [ ] **Step 4: Thread capabilities and the projection through `usePaneEncoding`**

In `PaneEncodingConfig` add:

```ts
  /** The ACTIVE backend's display capability. The menu is catalogue ∩ backend;
   *  a store id the backend lacks is PROJECTED (read-time, never written back)
   *  onto the core fallback and reported through {@link PaneEncoding.fallback}. */
  capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">;
```

In `PaneEncoding` add:

```ts
  /** The substitution in effect when the raw store id is unsupported here, else `null`. */
  fallback: CapabilityFallback | null;
```

In `usePaneEncoding`:

1. Destructure `capabilities` from config.
2. Seeding stays catalogue-level: add a constant `const CATALOGUE: Pick<ImageBackendCapabilities, "supportsDisplayOperation"> = { supportsDisplayOperation: (id) => !!getDisplayOperation(id) };` at module scope and use it in `idsFor` (which feeds `seedFor`); add a second memo for the menu:
   ```ts
   const ids = useMemo(
     () => resolveDisplayOperationIds({ mode, arity, curveSet, capabilities }),
     [mode, arity, curveSet, capabilities],
   );
   ```
   (The old `const ids = useMemo(() => idsFor(arity), …)` line is replaced by this.)
3. Replace `const displayOperationId = rawEncodingId;` with
   ```ts
   const projection = projectDisplayOperation(rawEncodingId, capabilities);
   const displayOperationId = projection.effective;
   ```
4. `displayOperationModified` must use the RAW id: `const displayOperationModified = rawEncodingId !== seedFor(arity);`
5. Return `fallback: projection.fallback` alongside the existing fields.

- [ ] **Step 5: Pass capabilities at the three call sites**

`cpu/view.tsx` (both `usePaneEncoding` calls): add `capabilities: CPU_CAPABILITIES,` and `import { CPU_CAPABILITIES } from "./capabilities";` (check the file's existing import style for the extension). `webgpu/view.tsx`: add `capabilities: WEBGPU_CAPABILITIES,` and import from `./capabilities`. Do NOT thread `enc.fallback` into the shell yet; Task 3 does that.

- [ ] **Step 6: Run tests and typecheck**

Run (from `ui/`): `npm test && npm run typecheck`.
Expected: PASS. If `typecheck` reports any other `resolveDisplayOperationIds` caller (there should be none outside `display-operation.ts`), pass the same backend capability object there.

- [ ] **Step 7: Commit**

```bash
git add ui/src/plots/image/components/display-operation.ts ui/src/plots/image/components/display-operation.test.ts ui/src/plots/image/cpu/view.tsx ui/src/plots/image/webgpu/view.tsx
git commit -m "Build the encoding menu from backend display capabilities"
```

---

### Task 3: Comparison projection in the host adapter, fallback chip, docs

**Files:**
- Modify: `ui/src/plots/image/runtime/view.tsx:54-95` (`selectedComparisonOperation`, `comparison`)
- Modify: `ui/src/plots/image/runtime/contracts.ts:241-…` (`ImageComparisonInput`)
- Create: `ui/src/plots/image/components/FallbackChip.tsx`
- Modify: `ui/src/plots/image/components/ImagePaneShell.tsx` (props near line 303, render near line 770)
- Modify: `ui/src/plots/image/cpu/view.tsx` (both `<ImagePaneShell` sites, lines 569 and 916)
- Modify: `ui/src/plots/image/webgpu/view.tsx` (`<ImagePaneShell` at line 2205)
- Modify: `docs/superpowers/specs/2026-09-04-comparison-capabilities-design.md` (status line: note the follow-up spec)
- Modify: `docs/architecture.md` (one paragraph under the image plot section: catalogue, capabilities, core, read-time projection)

**Interfaces:**
- Consumes: `projectComparisonOperation`, `CapabilityFallback` from `../definition/core.ts`; `PaneEncoding.fallback` (Task 2).
- Produces: `ImageComparisonInput.fallback?: CapabilityFallback | null`; `ImagePaneShell` prop `fallbacks?: readonly CapabilityFallback[]`; `FallbackChip({ fallback })` rendering `<span data-cairn-capability-fallback="<kind>:<requested>:<effective>">`.

- [ ] **Step 1: Project the comparison operation in `runtime/view.tsx`**

After `selectedComparisonOperation` is computed, add:

```ts
  const comparisonProjection = selectedComparisonOperation !== undefined
    ? projectComparisonOperation(selectedComparisonOperation, activeBackend.capabilities)
    : undefined;
  const effectiveComparisonOperation = comparisonProjection?.effective;
```

and in the `comparison` object replace the two uses of `selectedComparisonOperation` that DECIDE what renders (`operationId` and `mode`) by `effectiveComparisonOperation`; the callbacks (`previousOperation`) and `compareModified` keep the raw `selectedComparisonOperation`. Add `fallback: comparisonProjection?.fallback ?? null,` to the object. Import `projectComparisonOperation` from `../definition/core.ts` (match the file's import extension style).

- [ ] **Step 2: Extend `ImageComparisonInput`**

Add after `mode?`:

```ts
  /** Set when {@link operationId}/{@link mode} were PROJECTED because the active
   *  backend lacks the selected operation (read-time; the store still holds the
   *  selection). The pane shows it as a chip. */
  fallback?: CapabilityFallback | null;
```

with `import type { CapabilityFallback } from "../definition/core.ts";`.

- [ ] **Step 3: Create `FallbackChip.tsx`**

```tsx
// ---------------------------------------------------------------------------
// FallbackChip — the small top-right indicator that the pane substituted a
// core fallback for an authored/saved id the ACTIVE backend does not support
// (see definition/core.ts). The bottom corners belong to the label chips and
// the top-left to the compare RefBadge, so this one takes the top-right.
// ---------------------------------------------------------------------------
import type { CapabilityFallback } from "../definition/core";

export default function FallbackChip({ fallback, index = 0 }: { fallback: CapabilityFallback; index?: number }) {
  const text = `${fallback.requested} unavailable · ${fallback.effective}`;
  return (
    <span
      className="absolute right-1 z-10 min-w-0 max-w-[calc(100%-0.5rem)] overflow-hidden truncate whitespace-nowrap rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-muted backdrop-blur-sm"
      style={{ top: `${0.25 + index * 1.25}rem` }}
      title={`This backend does not support "${fallback.requested}"; showing "${fallback.effective}". HOME keeps the authored setting.`}
      data-cairn-capability-fallback={`${fallback.kind}:${fallback.requested}:${fallback.effective}`}
    >
      {text}
    </span>
  );
}
```

- [ ] **Step 4: Render it from `ImagePaneShell`**

Add the prop (next to `extraChips`):

```ts
  /** Read-time substitutions the pane made for ids the active backend lacks. */
  fallbacks?: readonly CapabilityFallback[];
```

destructure it, and render after `{extraChips}`:

```tsx
      {fallbacks?.map((fallback, i) => (
        <FallbackChip key={`${fallback.kind}:${fallback.requested}`} fallback={fallback} index={i} />
      ))}
```

Import `FallbackChip` and the `CapabilityFallback` type.

- [ ] **Step 5: Pass fallbacks from the backend views**

At each of the three `<ImagePaneShell` sites add:

```tsx
      fallbacks={[enc.fallback, compareSource?.fallback ?? null].filter((f): f is CapabilityFallback => f !== null)}
```

using the local names in scope (`compareSource` / `compare` as the file names the comparison input; `enc` is the pane encoding). Import the `CapabilityFallback` type.

- [ ] **Step 6: Docs**

`docs/architecture.md`: in the image plot section add one paragraph:

> The image catalogue (`plots/image/definition/`) is the hull of display and comparison operations the authoring side validates against. A backend advertises catalogue ids only (`ImageBackendCapabilities`), must include the core (`identity`, `split`, `srgb`, `turbo`) and is assumed to support every parameter the catalogue declares for an id it advertises. Toolbars are the catalogue intersected with the active backend. Authored settings are the default state and HOME restores them; when the active backend lacks a selected id, the view projects it at read time onto the core fallback (`definition/core.ts`) and shows a fallback chip. The store is never rewritten by a projection.

`docs/superpowers/specs/2026-09-04-comparison-capabilities-design.md`: change the status line to add "Follow-up: `2026-09-04-capability-fallbacks-design.md`."

- [ ] **Step 7: Verify**

Run (from `ui/`): `npm test && npm run typecheck && npm run build`. Then the browser harnesses that exercise compare menus and encodings: `npm run test:harness -- --only gpu-image-diff` and `--only cpu-compare-fallback` (names as listed by `node scripts/test-harness.mjs --list` if the runner supports it; otherwise run the full `npm run test:harness` and compare failures against the known pre-existing ones: `compare-pass`, `engine-fallback`).
Expected: unit tests and typecheck PASS; build succeeds; no new harness failures.

- [ ] **Step 8: Commit**

```bash
git add ui/src/plots/image/runtime/view.tsx ui/src/plots/image/runtime/contracts.ts ui/src/plots/image/components/FallbackChip.tsx ui/src/plots/image/components/ImagePaneShell.tsx ui/src/plots/image/cpu/view.tsx ui/src/plots/image/webgpu/view.tsx docs/architecture.md docs/superpowers/specs/2026-09-04-comparison-capabilities-design.md
git commit -m "Project unsupported comparison operations to split and show fallback chips"
```
