# Proposal: operation-aware image display defaults

**Status:** API-verified design; not yet implemented.

## Decision

Use the existing image display setting for source images and computed comparison
fields alike:

```ts
interface PlotSettings {
  "image.encoding"?: string;
  "compare.operation"?: string;
}
```

A diff result is an image field consumed by the same display-operation pipeline.
There is no `compare.encoding`, intent object, nested profile, per-operation
memory, or per-stack-tab mapping.

The missing behavior is operation-aware **defaulting and transition policy**, not
a second settings namespace.

## Existing API this design extends

- Each physical `PlotCell` owns one flat `PlotSettings` object.
- `MountedPlot.patchSettings()` and renderer `commands.patch()` apply shallow
  namespaced patches.
- `ImageOperationDefinition.output` already provides `ImageFieldSchema` arity
  and domain semantics.
- `DisplayOperationDefinition` already provides mapping category, supported
  arities, parameters, and reduction defaults.
- CPU and WebGPU already consume the shared `usePaneEncoding()` projection.
- A stack already owns one physical cell and one shared settings object.
- HOME already replaces that shared object with the active node's defaults.
- The SSIM kernel already emits `1 - SSIM`; it must not be inverted again.

## Operation-aware defaults

Add one pure synchronous recommendation function:

```ts
function recommendedImageEncoding(args: {
  operation?: string;
  field?: ImageFieldSchema;
  authoredSourceEncoding?: string;
  available?: readonly string[];
}): string;
```

Initial recommendations:

| Operation/output | Default `image.encoding` |
| --- | --- |
| Source or Split | Authored source encoding, normally sRGB |
| Signed and relative-signed error | Red-blue diverging |
| Absolute, squared, and relative magnitude | Magma |
| SDR-FLIP and HDR-FLIP | Magma |
| SSIM error (`1 - SSIM`) | Magma |
| Unknown/light fallback | Existing source/comparison fallback |

The implementation should derive these from the existing
`ImageFieldSchema.domain` where possible. If a future operation cannot be
classified by domain, add only an optional `defaultDisplayOperation` to
`ImageOperationDefinition`; do not create a parallel field schema.

Red-green remains available but is not the default signed map because it is not
robust for common color-vision deficiencies.

## Complete node defaults

Every image or image-comparison node must produce a complete default settings
object containing a concrete `image.encoding`.

`defaultImageSettings(node)` should inspect the node's effective authored
comparison operation:

```ts
const operation =
  node.settings?.["compare.operation"] ??
  (node.kind === "compare"
    ? node.presentation === "split" ? "split" : "absolute"
    : undefined);

return {
  // existing defaults...
  "compare.operation": operation,
  "image.encoding": recommendedImageEncoding({
    operation,
    field: getImageOperation(resolveOperation(operation))?.output,
    authoredSourceEncoding,
  }),
};
```

Authored `node.settings["image.encoding"]` remains the highest-precedence
explicit default when the host merges node settings after plot defaults.

This gives initial mounts, session seeding, stack creation, and HOME a complete
mapping without a special adoption mechanism.

## Operation transitions

Changing comparison operation is one semantic action and must patch operation
and, when appropriate, its recommended display together.

Add a pure helper:

```ts
function comparisonOperationSettingsPatch(args: {
  previousOperation?: string;
  nextOperation: string;
  currentEncoding?: string;
  authoredSourceEncoding?: string;
}): Pick<PlotSettings, "compare.operation" | "image.encoding">;
```

Policy:

1. Compute the previous operation's recommended encoding.
2. Compute the next operation's recommended encoding.
3. Always patch `compare.operation`.
4. Patch `image.encoding` to the next recommendation when:
   - no current encoding exists; or
   - the current encoding equals the previous recommendation.
5. Otherwise preserve the current encoding as a user customization.

Examples:

```text
Split + sRGB(default) → FLIP
=> FLIP + Magma

FLIP + Magma(default) → signed
=> signed + red-green

FLIP + Turbo(custom) → signed
=> signed + Turbo
```

Without storing provenance, an explicit user selection equal to the previous
default is indistinguishable from the default itself. It will follow the next
operation's recommendation. This is the accepted trade-off for keeping one
concrete settings value and no intent field.

All operation controls must use this helper:

- cairn-plot toolbar;
- public host controls;
- Cairn's Diff mode selector;
- keyboard or programmatic operation changes.

A host must not patch only `compare.operation`, because that recreates the FLIP
sRGB problem.

## Stack semantics

A stack is one viewport used to flip between sources. Its tabs may change only
source/content identity.

The stack owns one shared copy of:

- `image.encoding`;
- `compare.operation`;
- exposure, range, reduction, and channels;
- viewport and information-panel state.

Consequences:

- Stack formation seeds one complete settings object from the selected pane or
  existing first-pane fallback.
- Changing Split → FLIP may atomically change sRGB → Magma.
- Changing tab A → tab B never changes operation, encoding, exposure, range,
  channels, or viewport.
- Child-authored operations and mappings are not adopted during tab navigation.
- There is no per-tab settings memory.
- A heterogeneous legacy slot that cannot support the stack's shared operation
  reports the capability problem instead of silently changing settings.

This is enforced structurally by the existing single stack `PlotCell`. The
encoding resolver must read its concrete shared settings and must not derive a
new mapping from the active child.

## HOME

HOME needs no stack-specific behavior.

The existing rule remains:

> HOME replaces the viewport or stack settings with the active node's complete
> authored/default settings.

Because those defaults now contain the operation-appropriate
`image.encoding`, HOME always leaves the stack with a valid concrete mapping.
After HOME, every tab uses the same reset settings. Ordinary tab navigation
continues to change only content.

If scoped resets are ever wanted, expose separately named actions. Do not change
HOME or add dormant source/comparison profiles.

## Encoding projection

`usePaneEncoding()` continues to project one concrete `image.encoding` into the
active curve/LUT/remap and applicable controls.

Required cleanup:

- Remove the invalid cast of `image.encoding` to a comparison-only `Colormap` in
  `ui/src/plots/image/runtime/view.tsx`.
- Pass the shared concrete encoding through the normal display-operation path for
  both source and error fields.
- Validate it against `DisplayOperationDefinition.arities`.
- If temporarily unsupported, preserve the setting, render a deterministic
  fallback, and expose a warning. Do not rewrite settings.
- Remove any face-switch logic that reseeds/freeze-captures encoding from the
  newly active source. Initial capture may establish node defaults only before
  the cell settings owner exists.

CPU and WebGPU must call the same applicability/fallback resolver.

## Colorbars

Colorbars consume the concrete shared `image.encoding` and active range.

For stacks, the colorbar belongs to the viewport settings, not the active child.
It remains stable during tab navigation and changes only after an explicit
settings action, HOME, or operation transition patch.

A layout-level colorbar that currently reads static authored shared settings
must instead consume the live viewport settings.

## Cairn integration

Cairn already exposes one live-patched **Diff mode** selector containing Split
and every error operation.

Change its operation handler to use the public transition helper and apply the
returned patch immediately:

```ts
const patch = comparisonOperationSettingsPatch({
  previousOperation: liveSettings["compare.operation"],
  nextOperation,
  currentEncoding: liveSettings["image.encoding"],
  authoredSourceEncoding,
});

mounted.patchSettings(patch);
```

Persist the same effective settings after the normal debounce. Cairn must not
carry its own operation-to-colormap table.

The Encoding control remains one field bound to `image.encoding` in every mode.

## Other display parameters

Exposure, offset, range, and reduction remain the same shared settings across
source and error fields. This matches stack semantics: tabs alter only content.
Operation-aware defaults for those parameters can be added to the same complete
node-default and transition helpers if a concrete need appears. No parallel
`compare.*` display namespace is introduced.

## Edge cases

### Multichannel pointwise fields

Use `ImageFieldSchema.arity` and `DisplayOperationDefinition.arities` to validate
mappings. Existing reduction remains explicit and stack-shared. Do not assume
luminance for arbitrary scientific channels.

### FLIP variants

`flip` (SDR) and `flip_hdr` (HDR) are two public operations; there is no mode
selector within FLIP. Both recommend Magma and share one encoding. Changing
`compare.operation` between `flip` and `flip-hdr` does not rewrite
`image.encoding`.

### SSIM

The kernel output is already `1 - SSIM`. Magma displays that error directly.
Pixel values/colorbars must identify it as SSIM error, while separately computed
metric chrome may report mean raw SSIM.

### Unbounded errors and ranges

This proposal does not add percentile scans. If automatic range statistics are
added later, cache them separately and never block lookup or presentation of a
cached comparison field.

### Invalid values

NaN, infinity, masks, and missing pixels must not be clamped into zero error.
CPU and WebGPU need a consistent visible invalid-value treatment.

### Unsupported backend capability

Keep the concrete requested encoding, render an applicable fallback, and report
a non-modal warning. Restore the requested mapping automatically when the
capability returns.

### Programmatic patches

Direct public callers can still patch arbitrary combinations. The convenience
helper is the supported semantic operation-change API. Patching only
`compare.operation` is allowed at the low-level settings seam but does not
request default-mapping adoption.

## Persistence and migration

No new settings key is introduced. Existing `image.encoding` remains valid.

Legacy sessions can contain `compare.operation = flip` with mechanically seeded
`sRGB`. They have no provenance. Apply a one-time versioned normalization:

- if an error operation is active; and
- encoding equals the old source default; and
- the session predates operation-aware defaults;
- replace it with the operation recommendation.

This can misclassify an old explicit choice equal to the old default. That is
the same unavoidable ambiguity accepted by the transition policy. Do not apply
the heuristic repeatedly to current sessions.

Cairn continues to migrate legacy `comparisonPresentation === "split"` into
`comparisonOperation = "split"` and stops writing the legacy field.

## Cache and performance contract

None of the following participate in comparison-field cache identity:

- `image.encoding`;
- exposure, range, offset, or reduction;
- viewport or split position;
- default-transition provenance.

They affect only the final presentation pass. Operation changes may select a
different cached/computed field; encoding changes never do. Warm stack flips
must produce zero comparison misses, uploads, or recomputations attributable to
presentation.

## Test plan

1. Recommended encoding for every registered operation/domain.
2. Complete defaults contain an applicable concrete encoding.
3. Split/default sRGB → FLIP patches Magma.
4. FLIP/default Magma → signed patches red-green.
5. Custom Turbo survives an operation transition.
6. Explicit value equal to the old default follows the documented heuristic.
7. Every operation-control surface uses the shared transition helper.
8. Source/error rendering uses the same concrete encoding path.
9. CPU/WebGPU applicability and fallback parity.
10. SSIM uses Magma without double inversion.
11. SDR/HDR FLIP does not rewrite encoding.
12. Repeated stack-tab flips change only source/content identity; the full
    settings object remains equal.
13. Stack operation changes atomically update operation/default encoding.
14. HOME installs the active node's complete defaults once; later tab flips are
    inert.
15. Stack colorbar follows live shared settings and remains stable on tab flips.
16. Grid → stack seeds once and never re-seeds during navigation.
17. Legacy session normalization is version-gated and one-shot.
18. Encoding changes produce zero diff misses/uploads/recomputations.
19. Warm stack flips remain paint-hot and do not flash child-authored mappings.

## Implementation sequence

1. Add recommendation and operation-transition helpers with registry tests.
2. Make image/comparison defaults operation-aware and complete.
3. Route all operation changes through the shared helper.
4. Remove comparison-specific encoding casts and face reseeding.
5. Ensure stack tabs consume only shared settings.
6. Make colorbars consume live viewport settings.
7. Add one-shot legacy normalization.
8. Add CPU/WebGPU, stack, HOME, Cairn, and cache-hot tests.
