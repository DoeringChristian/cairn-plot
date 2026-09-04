# Catalogue, capabilities and fallbacks for image display and comparison

Status: v1 (2026-09-04). Extends
`2026-09-04-comparison-capabilities-design.md`; implemented on branch
`comparison-capabilities`.
Owner: cairn-plot. Consumer: cairn (submodule `vendor/cairn-plot`).

## 1. Problem

After the comparison-capabilities work the comparison menu is built from the
active backend's capabilities, but two seams still read the global catalogue
directly:

- The display-encoding menu (`components/display-operation.ts`:
  `resolveDisplayOperationIds`, `usePaneEncoding`, `displayToolbarButton`)
  lists every registry entry regardless of what the active backend declares.
- Nothing defines what happens when a descriptor or a saved setting names an
  operation the active backend does not support. Today both backends declare
  the full catalogue, so the case never arises, but the contract is unstated
  and a future backend (or a backend that loses an operation) would render an
  unsupported id.

User rulings (2026-09-04):

1. One global catalogue (`definition/`) states what is generally supported and
   the defaults used when nothing is selected. It lives outside the backends.
2. Backends reference catalogue ids only. Every backend is assumed to support
   every parameter the catalogue declares for an id it advertises. No
   parameter narrowing in capabilities.
3. Toolbars are built from what the active backend supports.
4. The authored (Python/JS) settings are the default state; HOME resets to
   them. If they are not achievable on the active backend, a declared fallback
   subset is used at read time: `turbo` for an unsupported colormap, `split`
   for an unsupported comparison operation. A small indicator shows the
   substitution.
5. The authoring side validates against the hull (the catalogue).
6. Backend selection stays priority-based with failure fallback.

## 2. Goals and non-goals

Goals:

- Encoding menu = catalogue ∩ active backend display capabilities, same shape
  as the comparison menu. Seeding and HOME stay catalogue-level.
- A required core subset that every backend must declare, so the fallbacks are
  always achievable: image `identity`, `split`; display `srgb`, `turbo`.
  `defineImageBackendCapabilities` rejects a declaration missing any of them.
- One pure projection module, `definition/core.ts`, that maps a requested id to
  the effective id plus an optional fallback record. Read-time only; the
  settings store is never rewritten by a projection.
- A small chip in the pane that names the substitution, with a data attribute
  for tests.
- Hull check: the union of the backends' declarations equals the catalogue
  (already pinned as equality per backend; the test is restated as a hull
  test so a future partial backend fails for the right reason).

Non-goals:

- No parameter-level capabilities.
- No change to seeding (`recommendedImageEncoding`), HOME, migration, cairn
  helpers, the cross-language contract, or backend selection.
- No fallback for the diff kernels' parameters (`ppd`, exposure): assumed
  supported per ruling 2.

## 3. Design

### 3.1 Catalogue core and projection (`definition/core.ts`)

```ts
export const CORE_IMAGE_OPERATION_IDS = ["identity", "split"] as const;
export const CORE_DISPLAY_OPERATION_IDS = ["srgb", "turbo"] as const;

export const FALLBACK_COMPARISON_OPERATION = "split";
/** Colormaps fall back to turbo; curves and the normal remap to srgb. */
export function fallbackDisplayOperation(requestedId: string): "turbo" | "srgb";

export interface CapabilityFallback {
  readonly kind: "display" | "comparison";
  readonly requested: string;
  readonly effective: string;
}

export function projectDisplayOperation(
  requestedId: string,
  capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">,
): { effective: string; fallback: CapabilityFallback | null };

export function projectComparisonOperation(
  requestedId: string,
  capabilities: Pick<ImageBackendCapabilities, "supportsImageOperation">,
): { effective: string; fallback: CapabilityFallback | null };
```

`projectDisplayOperation` returns the requested id unchanged when the backend
supports it; otherwise the category-based fallback. An id unknown to the
catalogue is treated as unsupported (fallback `srgb`). `projectComparisonOperation`
returns `split` for any unsupported id; `split` itself is always supported
because it is core.

### 3.2 Capabilities require the core

`defineImageBackendCapabilities` throws `image backend must advertise core
image operation <id>` / `... core display operation <id>` when a core id is
missing. Both backends already declare the full catalogue, so no backend
change is needed beyond the test.

### 3.3 Encoding menu and projection in the pane hook

`resolveDisplayOperationIds` gains a required `capabilities` argument and
filters `curveIds`, `lutIds`, `remapIds` through
`supportsDisplayOperation`. `usePaneEncoding` gains `capabilities` in its
config and:

- builds the menu ids from the filtered resolution (`ids`);
- seeds from the unfiltered catalogue (`seedFor` is catalogue-level, so the
  bootstrap seed equals what `defaultImageSettings` seeds into the store);
- projects the raw store id: `displayOperationId` is the effective id,
  `fallback` is the record or `null`;
- computes `displayOperationModified` from the raw store id against the seed,
  so a substituted encoding does not show as user-modified.

`PaneEncoding` gains `fallback: CapabilityFallback | null`. The three callers
(`cpu/view.tsx` SDR and arity panes, `webgpu/view.tsx`) pass their backend's
capability object (`CPU_CAPABILITIES`, `WEBGPU_CAPABILITIES`).

### 3.4 Comparison projection in the host adapter

`runtime/view.tsx` projects `selectedComparisonOperation` through
`projectComparisonOperation(id, activeBackend.capabilities)` before building
`ImageComparisonInput`. `operationId`, `mode` use the effective id; the write
callbacks and `compareModified` keep using the raw selection. `ImageComparisonInput`
gains `fallback?: CapabilityFallback | null`.

### 3.5 Fallback chip

`components/FallbackChip.tsx` renders one small chip per fallback, pinned
top-right inside the viewport (the label chips own the bottom corners, the
reference badge the top-left):

```
<span data-cairn-capability-fallback="display:plasma:turbo" title="…">
  plasma unavailable · turbo
</span>
```

`ImagePaneShell` gains `fallbacks?: readonly CapabilityFallback[]` and renders
`FallbackChip` for each. The backend views pass
`[enc.fallback, compareSource?.fallback].filter(Boolean)`.

### 3.6 Hull

`runtime/backend-capabilities.test.ts` keeps the per-backend equality and adds:
the union of all backend declarations equals the catalogue (image and
display), and every backend declares the core subset.

## 4. Testing

- `definition/core.test.ts`: fallback category mapping; projection identity
  when supported; projection to turbo/srgb/split when not; unknown id →
  srgb; fallback record shape.
- `runtime/backend-capabilities.test.ts`: rejects a declaration missing
  `turbo` / `split`; hull equality.
- `components/display-operation.test.ts`: `resolveDisplayOperationIds` on a
  narrowed capability object omits the unsupported ids in every section and
  keeps registry order.
- Browser harness `webgpu/__tests__/capability-fallback` is out of scope: no
  shipped backend is partial, so the chip is exercised by a unit test of
  `FallbackChip`'s markup only if a React test runner exists (it does not;
  the shell prop is covered by type-checking and the live path).

## 5. Compatibility

No public API change. No settings change. Both shipped backends declare the
full catalogue, so no user-visible change today.
