# Comparison operations as backend capabilities

Status: v1 DRAFT (2026-09-04). Follows the viewport work on branch
`cpu-viewport-canvas`; implemented on a branch off it. Follow-up:
`2026-09-04-capability-fallbacks-design.md`.
Owner: cairn-plot. Consumer: cairn (submodule `vendor/cairn-plot`).

## 1. Problem

The image plot has three layers that each carry a notion of "which comparison
operations exist", and they disagree:

- `definition/image-operations.ts` mixes semantic operations (pointwise errors,
  FLIP, SSIM) with backend kernel identifiers (`hdr-flip`, `flip-sdr`).
- `definition/comparison-operations.ts` maps the public `flip` selection plus a
  runtime `compare.flipMode` setting to a kernel id. A semantic module hands
  out implementation ids, and its "auto-dispatch only" list names a public name
  (`flip_hdr`) that no definition carries.
- `ImageBackendCapabilities.imageOperations` is a list of definitions, filled
  inconsistently: the WebGPU backend lists its kernel table (including
  `hdr-flip` and `flip-sdr`); the CPU backend lists public operations and
  handles HDR FLIP privately.

`runtime/view.tsx` builds the user's comparison menu from the capability list,
so with WebGPU active the internal kernels appear as menu entries. That was the
visible symptom; the cause is that the capability contract exposes
implementation.

User rulings (2026-09-04):

1. SDR FLIP and HDR FLIP are two public comparison operations. There is no mode
   selector inside FLIP and no `compare.flipMode` setting.
2. Backends advertise which public image operations and display operations
   they support; how they implement them is opaque to everything outside the
   backend.
3. Both backends declare and implement the identical set. The CPU backend
   already computes SDR FLIP, HDR FLIP and SSIM through its reference
   implementations, so this is a declaration change, not new numerics.

## 2. Goals and non-goals

Goals:

- One registry of public image operations; no kernel ids outside backends.
- `ImageBackendCapabilities` names public operation ids and public display
  operation ids only; a unit test pins that both backends declare the same set
  and that the set equals the registry.
- The comparison menu is decided by the active backend's capabilities; the
  registry only supplies labels and ordering. Same code path on both backends.
- Cross-language contract updated once: `flip_hdr` joins the public names in
  `schema/cairn-plot-contracts.json`, the TypeScript builder, and Python.
- Saved settings and descriptors that carry `compare.flipMode` keep rendering
  through a read-side migration.

Non-goals:

- No change to the FLIP, HDR-FLIP, or SSIM numerics or shaders.
- No change to the viewport geometry work.
- No new display operations; the display sets are already identical (curves
  linear/srgb/gamma/reinhard/aces, remap normal, colormaps turbo/plasma/magma/
  red-green/red-blue on both backends).

## 3. Design

### 3.1 Registry: public operations only

`definition/image-operations.ts` becomes:

| id | label | publicName | inputs | parameters |
|---|---|---|---|---|
| identity | Identity | | 1 | |
| absolute … relative_squared | (unchanged) | abs … rel_square | 2 | |
| split | Split | | 2 | split |
| flip | FLIP | flip | 2 | ppd |
| flip-hdr | HDR-FLIP | flip_hdr | 2 | ppd, exposure-min, exposure-max |
| ssim | SSIM | ssim | 2 | |

`hdr-flip` and `flip-sdr` are removed. The `flip-mode` parameter is removed
from `ImageOperationParameter`. Every public 2-input operation except `split`
has a `publicName`; `identity` and `split` are structural.

`definition/comparison-operations.ts` is deleted. Its two registry helpers
move into `image-operations.ts`:

```ts
listComparisonOperationPublicNames(): string[]    // publicName of every 2-input non-split op (contract pin)
operationIdForPublicName(publicName): string | undefined   // builders lower mode= to a registry id
```

`listComparisonOperationOptions`, `resolveComparisonOperationId`, `FlipMode`,
and `AUTO_DISPATCH_ONLY_PUBLIC_NAMES` are deleted. The registry is the universe
of meaning; it never decides what is shown.

### 3.2 Capabilities: ids, identical on both backends

```ts
export interface ImageBackendCapabilities {
  readonly imageOperations: readonly string[];    // public operation ids
  readonly displayOperations: readonly string[];  // public display operation ids
  supportsImageOperation(id: string): boolean;
  supportsDisplayOperation(id: string): boolean;
}
```

`defineImageBackendCapabilities` validates every id against the registries and
throws at definition time on an unknown id, so a backend cannot advertise a
kernel. Both backends declare `IMAGE_OPERATION_IDS` and `DISPLAY_OPERATION_IDS`
exported from the definitions (the full registries). A unit test asserts:
`cpu.capabilities.imageOperations` equals `webgpu.capabilities.imageOperations`
equals the registry ids, and the same for display operations. If a future
backend cannot implement an operation it declares a subset and the test for
that backend states the exception explicitly.

### 3.3 Backends map public ids to private implementations

WebGPU: `webgpu/image-operations.ts` keys its table by public id. `flip` maps
to the linear-clamp LDR program (today's `flipLdrForcedProgram`; operands are
already scene-linear floats), `flip-hdr` maps to `hdrFlipProgram`. The
sRGB-front-end `flipProgram` has no remaining caller and is deleted together
with its `YCXCZ_SHADER` variant unless a parity harness imports it, in which
case it stays exported from the kernel module as reference code only. Cache
keys, pixel samplers, and readback labels use the public id (`flip`,
`flip-hdr`, `ssim`); no `flipMode` input anywhere in `webgpu/`.

CPU: `cpu/source-metrics.ts` accepts the public ids (`"flip" | "flip-hdr" |
"ssim" | pointwise`); `cpu/view.tsx` passes `compareSource.operationId`
through unchanged. `cpu/backend.ts` declares the shared id lists.

### 3.4 Menu and display defaults

`runtime/view.tsx` builds the menu from the capabilities, in registry order
with registry labels:

```ts
operationOptions: listImageOperations()
  .filter((o) => o.inputs === 2 && o.id !== "split")
  .filter((o) => activeBackend.capabilities.supportsImageOperation(o.id))
  .map((o) => ({ id: o.id, label: o.label })),
```

Both views drop their own fallback lists; the adapter always supplies the
list, so CPU and WebGPU can never disagree.
`operation-display-defaults.ts` resolves `getImageOperation(operation)`
directly; `flipMode` leaves its options. The FLIP-mode toolbar segment in the
WebGPU view is deleted.

### 3.5 Settings and descriptors

- `settings/schema.ts` and `definition/settings.ts` drop `compare.flipMode`
  (and its "FLIP range" control).
- Read-side migration, one function `migrateCompareSettings(settings)` in
  `definition/settings.ts`, applied where the host adapter reads cell settings:
  `compare.operation === "flip"` with `compare.flipMode === "hdr"` becomes
  `compare.operation: "flip-hdr"`; the `compare.flipMode` key is dropped. A
  unit test covers both directions.
- Descriptors: `cp.Compare(mode="flip_hdr")` is the HDR entry; the
  `flip_mode` keyword is removed from Python (`TypeError` like any unknown
  keyword) and `flipMode` from the JS builder options and `validate.ts`. A
  descriptor prop `flipMode: "hdr"` from an older page is honoured by the same
  migration when the settings seed from props.
- `schema/cairn-plot-contracts.json`: `comparisonOperationPublicNames` gains
  `flip_hdr`; `comparisonOperationModes` gains `"flip_hdr": "flip-hdr"`; the
  comment about a runtime flip-mode setting is replaced. Python
  `_COMPARE_OPERATION_MODES` and TS `COMPARE_OPERATION_MODES` mirror it; the
  existing contract tests pin all three.

### 3.6 cairn

- `CairnPlotCard.tsx`: `COMPARE_OPTIONS` gains `["flip-hdr", "HDR-FLIP"]` (the
  card stores registry ids in `compare.operation`, not public names); the
  FLIP range `Select` and the two `flipMode:` fields in the compare source are
  removed; a one-shot settings migration (the existing
  `encodingDefaultsVersion` pattern) rewrites saved `compare.flipMode: "hdr"`
  into `compare.operation: "flip_hdr"`.
- Submodule bump, `cairn/ui` build, `tests/unit/test_plot_components.py`
  updates for any `flip_mode` usage.

## 4. Testing

- `image-operations` / `comparison-operations` unit tests: public projection
  lists FLIP and HDR-FLIP as separate entries; no id without a public name
  appears; `operationIdForPublicName("flip_hdr") === "flip-hdr"`.
- `backend-capabilities.test.ts`: the two backends' capability sets are equal
  and equal the registries; `defineImageBackendCapabilities` rejects an
  unknown id.
- Contract tests (`testing/contracts.test.ts`, `tests/test_contracts.py`)
  pass against the updated JSON.
- `operation-display-defaults.test.ts`: `flip-hdr` resolves to its declared
  default display operation without a mode argument.
- Settings migration unit test.
- Browser: `webgpu/__tests__/hdr-flip` and `flip` parity harnesses keep
  passing (numerics unchanged); `cpu-compare-fallback` case 3 uses
  `[data-cpu-comparison-result="flip-hdr"]` for an HDR-FLIP compare;
  `gpu-compare-split-numbers` / `gpu-cached-error-numbers` updated if they
  select `flip` plus a mode.

## 5. Compatibility

- Public API change: `cp.Compare(mode="flip_hdr")` replaces
  `cp.Compare(mode="flip", flip_mode="hdr")`; the old keyword raises.
- Saved viewer settings migrate on read; descriptors migrate at seed time.
- Menu labels: "FLIP" and "HDR-FLIP".
