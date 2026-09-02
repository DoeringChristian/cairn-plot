# Proposal: automatic display mapping for image comparisons

**Status:** API-verified proposal; not yet implemented.

## Problem

Comparison fields and source images have different display semantics, but the
current viewport stores one concrete `image.encoding`. `defaultImageSettings()`
always seeds that key, and the WebGPU pane deliberately freezes its initial
encoding across image/diff transitions. Entering FLIP from an sRGB source can
therefore show the scalar FLIP field in grayscale.

The current runtime also casts `image.encoding` to a comparison colormap even
when it contains a curve such as `srgb` or `aces`. A source-image curve is not a
scalar-error mapping.

## Verified existing API

The design should extend, rather than duplicate, these APIs:

- `PlotSettings` is the single, flat, namespaced settings object.
- `MountedPlot.patchSettings()` and `PlotSessionController.patchCellSettings()`
  apply shallow patches to every active cell.
- `ImageOperationDefinition.output` already provides an `ImageFieldSchema` with
  output arity and domain (`light`, `signed`, `nonnegative`, or `unbounded`).
- `DisplayOperationDefinition` already declares mapping category, supported
  arities, parameters, and default reduction.
- CPU and WebGPU already use the shared `usePaneEncoding()` projection.
- The SSIM kernel already emits the error field `1 - SSIM`; presentation must
  not invert it again.

A nested set of source/per-operation profiles would require transactional deep
merge semantics that the public settings API does not provide. It is not
necessary to solve the reported problem.

## Minimum coherent API change

Add one optional flat setting:

```ts
interface PlotSettings {
  // Existing source and Split display selection.
  "image.encoding"?: string;

  // Explicit error-field mapping. Absence means Automatic.
  "compare.encoding"?: string;
}
```

Semantics:

- Ordinary source images and Split use `image.encoding` exactly as today.
- Difference/error fields use `compare.encoding` when it is explicitly set and
  applicable.
- When `compare.encoding` is absent, the active operation's output schema
  determines the automatic mapping.
- Selecting **Automatic** deletes `compare.encoding`.
- One explicit comparison mapping follows all error operations. Automatic mode
  reevaluates on every operation transition.

This preserves source appearance without moving or migrating any existing
`image.*` settings.

## Automatic resolver

Add a pure synchronous resolver, shared by CPU and WebGPU:

```ts
interface ResolvedComparisonDisplay {
  id: string;
  automatic: boolean;
  requested?: string;
  fallback?: string;
  warning?: string;
}

function defaultComparisonDisplayOperation(
  field: ImageFieldSchema | undefined,
): string;

function resolveComparisonDisplayOperation(args: {
  field: ImageFieldSchema | undefined;
  explicit?: string;
  available: readonly string[];
}): ResolvedComparisonDisplay;
```

Initial defaults:

| Output semantics | Automatic mapping |
| --- | --- |
| Signed and relative-signed error | Red-blue diverging |
| Absolute, squared, and relative magnitude | Magma |
| SDR-FLIP and HDR-FLIP | Magma |
| SSIM error (`1 - SSIM`) | Magma |
| Unknown/light fallback | Existing comparison fallback |

These defaults can initially derive from `ImageFieldSchema.domain`. If a future
operation cannot be classified by domain, add an optional
`defaultDisplayOperation` to `ImageOperationDefinition`; do not introduce a
parallel output-descriptor hierarchy.

Red-green remains available but should not be the automatic signed default
because it performs poorly for common color-vision deficiencies.

## Encoding projection

Refactor `usePaneEncoding()` to accept resolved intent explicitly:

```ts
interface PaneEncodingConfig {
  // Existing arity, surface, curve, and authored-seed fields...
  selectedEncoding?: string;
  automaticEncoding?: string;
}
```

Resolution is:

```text
applicable explicit selection
→ applicable automatic recommendation
→ authored source seed
→ renderer fallback
```

For a source/Split face:

```ts
selectedEncoding = settings["image.encoding"]
automaticEncoding = undefined
```

For an error face:

```ts
selectedEncoding = settings["compare.encoding"]
automaticEncoding = defaultComparisonDisplayOperation(operation.output)
```

The automatic comparison value must not be captured in the current immutable
initial-encoding ref. It is a pure derivation of the active operation and must
change synchronously when that operation changes.

An unsupported explicit selection remains stored. The resolver renders a
deterministic applicable fallback and reports, for example, “Magma unavailable
in the CPU backend; showing grayscale.” It must not rewrite user intent.

## Runtime changes required

### Settings and public types

- Add `compare.encoding` to `ui/src/settings/schema.ts`.
- Add it to the image setting vocabulary where settings are enumerated.
- Export the resolver and its result type through the supported public API if a
  host needs to display `Automatic — Magma`.
- Do **not** seed `compare.encoding` in `defaultImageSettings()`; absence is the
  automatic state.

### Image runtime

- Remove the cast of `image.encoding` to comparison `Colormap` in
  `ui/src/plots/image/runtime/view.tsx`.
- Keep `ImageComparisonInput.colormap` only for an authored comparison default,
  if that authored concept remains supported; it must not carry live settings.
- Resolve the selected comparison operation to its existing
  `ImageOperationDefinition.output` and feed the shared display resolver.

### WebGPU and CPU

- Remove the “one initially seeded encoding forever” rule for error faces.
- Route source/Split picks to `image.encoding`.
- Route error-face picks to `compare.encoding`.
- Use the same resolver in both backends for every operation the backend
  supports.
- Resetting error display deletes `compare.encoding`; it does not store Magma.
- Keep display selection entirely in the final presentation pass.

### Cairn

The comparison-mode UI has already been reduced to one live-patched **Diff
mode** selector. Add operation-aware display behavior:

- On Split, the Encoding field reads and writes `image.encoding`.
- On an error operation, it reads `compare.encoding`.
- When `compare.encoding` is absent, show `Automatic — <resolved mapping>`.
- Selecting Automatic patches `{ "compare.encoding": undefined }`.
- Cairn must not duplicate the operation-to-default table; use the public
  resolver/label API.

## Transition behavior

- **Source → FLIP:** source `image.encoding` remains untouched; absent
  `compare.encoding` resolves immediately to Magma.
- **FLIP → source/Split:** the previous source mapping is still present and is
  shown again.
- **FLIP → signed:** Automatic changes from Magma to red-blue.
- **FLIP → SSIM:** Automatic remains Magma; the field is already `1 - SSIM`.
- **Explicit comparison mapping:** follows error-operation transitions when
  applicable. If inapplicable, it remains stored while a fallback is rendered.
- **SDR-FLIP ↔ HDR-FLIP:** retains explicit/automatic display intent; only the
  computation changes.
- **Reference, iteration, and channel changes:** retain both settings.
- **Warm cached map switch:** resolve and present in the same React commit;
  persistence may remain debounced.
- **Home/reset on an error face:** clear `compare.encoding`. Source reset remains
  independent.
- **Synchronized panes:** broadcast the flat `compare.encoding` patch through
  the existing settings channel.

## Stack semantics

A stack is a single viewport used to flip between sources. Its tabs must change
only content identity. Display mapping, comparison operation, exposure, range,
channels, viewport, and every other interactive setting belong to the stack and
must remain unchanged when the active tab changes.

This is stronger than choosing an encoding from the active child face. In a
stack, the effective display context is derived from the stack's shared
`compare.operation`, not from the newly active node:

| Shared stack operation | Mapping used by every tab |
| --- | --- |
| absent or `split` | `image.encoding` / source default |
| error operation with explicit override | `compare.encoding` |
| error operation in Automatic | Recommendation for the shared operation |

For example, explicitly changing the shared operation from Split to FLIP may
change Automatic from sRGB to Magma. Flipping from tab A to tab B must not. If
the shared operation is signed error, every tab retains that operation and the
same red-blue Automatic mapping. A child descriptor's authored operation or
colormap is only an initialization/HOME default; it is never adopted merely
because that child becomes active.

A well-formed image stack should therefore be semantically homogeneous: slots
represent alternate sources (or alternate operand pairs), not independently
configured view modes. A legacy heterogeneous stack still uses the stack's
shared operation and display intent; if a slot cannot satisfy that operation,
the UI reports the capability problem rather than silently changing operation
or mapping.

Entering stack layout continues to seed the one shared settings object from the
selected pane (or the existing first-pane fallback). Subsequent tab flips never
re-seed it. Per-tab encoding or error-mode memories are deliberately forbidden
because they make visual differences ambiguous: the user could no longer tell
whether the source or the visualization changed.

### HOME/reset in stacks

HOME retains its existing stack-wide meaning: replace the shared viewport
settings with the active slot's authored/default settings. It may therefore
reset both `image.encoding` and `compare.encoding`; preserving a dormant scope
is not required. HOME is an explicit user reset and is the only tab-local action
allowed to adopt the active slot's authored defaults. Ordinary tab navigation
must remain inert.

If scoped resets are later useful, expose separately named actions such as
**Reset source display** and **Reset comparison display** rather than changing
HOME semantics.

### Stack colorbars and authored defaults

A layout-level colorbar currently reads authored `shared.settings.image.encoding`
and cannot represent an operation-derived `compare.encoding`. The visible
colorbar must follow the stack's shared resolved operation/mapping and must not
change during tab navigation. Either the viewport owns the colorbar, or the
active renderer publishes a resolved-display snapshot keyed by the shared
settings; the durable/session settings still store intent, not the resolved
Automatic value.

Authored source/comparison defaults are seeds and HOME targets only. Tab changes
must never apply them to the live stack.

## Other display parameters

This first change separates mapping only. Exposure, offset, range, and reduction
remain shared `image.*` settings. That is compatible with the present API and
keeps the change bounded.

If concrete UX failures show that these parameters also contaminate source/error
transitions, add corresponding optional flat keys such as
`compare.colorRange` and `compare.reduce`. Do not introduce nested profiles
unless a transactional per-cell merge API is designed first.

## Edge cases

### Multichannel pointwise fields

`ImageFieldSchema.arity` already reports scalar versus source arity. Validate
an explicit/automatic mapping against `DisplayOperationDefinition.arities`.
Existing deterministic reduction remains visible in the toolbar. Do not assume
luminance for arbitrary scientific channels.

### Range and unbounded fields

FLIP has a stable unit range. Other errors can be unbounded. This proposal does
not add percentile scanning. If automatic range statistics are added later,
cache them separately and never make them a prerequisite for locating or
presenting a cached diff texture.

### SSIM

The current kernel emits `1 - SSIM`. Colorbars and pixel readouts should label
that value as SSIM error. Metric chrome may continue to report mean raw SSIM if
that scalar is computed separately. No presentation-time inversion is needed.

### NaN, infinity, masks, and missing pixels

Invalid values must not be clamped into zero error. CPU and WebGPU should use a
consistent visible invalid-value treatment and colorbar legend. This is
orthogonal to the encoding-state split.

### Unknown/custom operations

Operations without a recognized domain receive the existing conservative
fallback and a developer warning. A later optional operation-level default can
override the domain recommendation.

### Unsupported backend capability

Keep the requested `compare.encoding`, use an applicable fallback, surface a
non-modal warning, and restore the request automatically when capabilities
return. CPU's smaller operation set must not cause settings migration.

### Accessibility and interpretation

False-color fields need a labeled colorbar and numeric readout. Automatic
signed mapping should not depend on red/green discrimination. Explicit legacy
choices remain respected.

## Cache and performance contract

The following remain excluded from diff-cache identity:

- `image.encoding` and `compare.encoding`;
- LUT/mapping, exposure, offset, range, and reduction;
- viewport, split position, and display provenance.

They feed only the final presentation pass. Switching mapping on a resident
field must produce zero diff misses, source uploads, and field recomputations.

## Compatibility

No general session migration is required:

- Existing `image.encoding` remains source/Split state and preserves appearance.
- Old sessions have no `compare.encoding`, so error fields gain Automatic
  behavior immediately.
- New clients can persist `compare.encoding`; old clients safely ignore it.
- Legacy error-map mapping intent cannot be distinguished from source intent;
  do not guess based on whether `image.encoding` happens to name a colormap.
- Cairn continues to read legacy `comparisonPresentation`, migrates Split to
  `comparisonOperation = "split"`, and stops writing the legacy field.

Per-operation explicit memories are deliberately deferred. If later required,
first add an atomic/transactional per-cell settings update API. Building nested
profiles over shallow `patchSettings()` would risk overwriting concurrent or
pane-specific state.

## Test plan

1. Resolver defaults for every existing `ImageFieldSchema.domain`.
2. Explicit applicable selection wins over Automatic.
3. Unsupported explicit selection remains stored and renders a fallback.
4. Source → FLIP → source preserves source encoding.
5. FLIP → signed changes Automatic from Magma to red-blue.
6. FLIP → SSIM uses Magma without double inversion.
7. SDR/HDR FLIP retain one comparison mapping preference.
8. Selecting Automatic deletes `compare.encoding` through shallow
   `MountedPlot.patchSettings()`.
9. Settings synchronization propagates set and delete operations.
10. CPU/WebGPU resolve identical supported mappings.
11. Legacy `image.encoding = srgb` keeps the source sRGB and displays FLIP with
    automatic Magma.
12. Reference, iteration, and channel changes preserve both settings.
13. Repeated stack-tab flips change only source/content identity; operation,
    mapping, range, exposure, channels, and viewport remain byte-for-byte stable.
14. Automatic mapping follows the stack's shared operation, not the active
    child's authored operation or domain.
15. An explicit comparison mapping remains shared across every stack slot.
16. HOME retains its explicit stack-wide reset behavior; ordinary navigation
    never adopts active-child defaults.
17. Grid → stack seeding carries both keys once and does not re-seed on tab flips.
18. The stack colorbar follows shared resolved settings and remains stable on
    tab flips.
19. Warm mapping and stack-tab switches record zero diff misses, uploads, or
    recomputations.
20. Cold and warm operation changes do not flash a tab's authored encoding.

## Suggested implementation sequence

1. Add `compare.encoding` and the pure domain-based resolver.
2. Refactor `usePaneEncoding()` to accept explicit and automatic inputs.
3. Route CPU/WebGPU source and comparison faces to their respective keys.
4. Remove the invalid runtime colormap cast.
5. Resolve stack display from shared viewport settings, never active-child
   defaults, and retain existing stack-wide HOME semantics.
6. Make stack colorbars consume the shared resolved display rather than static
   authored `image.encoding`.
7. Add Automatic to Cairn and renderer display controls.
8. Add transition, source-only stack, synchronization, compatibility, and
   warm-cache tests.
