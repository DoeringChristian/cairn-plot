# Proposal: semantic display profiles for image comparisons

**Status:** proposal; no implementation is implied by this document.

## Problem

A comparison field and its presentation are different things. FLIP, SSIM, signed
differences, and ordinary images do not share the same display semantics, but today
one concrete `image.encoding` value follows the viewport through every transition.
Consequently, entering FLIP from an sRGB image can render a scalar FLIP field as
grayscale. Applying an sRGB or ACES curve to an error field is also semantically
misleading: those curves describe source-image display, not scalar-error mapping.

We need operation-sensitive defaults without surprising users, losing explicit
choices, recomputing cached fields, or adding a second settings owner.

## Goals

1. FLIP and other scalar fields receive useful defaults immediately.
2. Leaving an error field restores the source image's prior appearance.
3. Explicit user choices are sticky and scoped to the context in which they apply.
4. Defaults are extensible through the comparison-operation registry rather than a
   UI switch statement.
5. Resolution is pure and synchronous; a warm cached field can reach the next paint.
6. CPU and WebGPU resolve the same effective presentation.
7. Display choices never participate in comparison-field cache identity.

## Proposed model

### 1. Describe comparison output semantics

Each registered comparison operation should expose a presentation-independent output
descriptor:

```ts
interface ComparisonFieldDescriptor {
  kind: "source" | "signed-error" | "magnitude-error" | "similarity";
  channels: "scalar" | "source-arity";
  domain:
    | { kind: "fixed"; min: number; max: number }
    | { kind: "unbounded"; center?: number }
    | { kind: "data-derived"; center?: number };
  goodValue?: "low" | "high" | number;
  recommendedDisplay: DisplayRecommendation;
}

interface DisplayRecommendation {
  mapping: DisplayOperationId;
  transform?: "identity" | "one-minus";
  range?: { min: number; max: number };
  reduce?: ReduceMode;
  invalidColor?: string;
}
```

The descriptor belongs to operation registration, next to the kernel. Custom future
operations therefore bring their own semantic default. It describes the field; it
does not change field computation or cache identity.

Initial recommendations:

| Operation class | Automatic presentation |
| --- | --- |
| Ordinary image and Split | Authored/source representation default |
| Signed and relative-signed error | accessible diverging red-blue, centered at zero |
| Absolute, squared, relative magnitude | Magma sequential mapping |
| SDR-FLIP and HDR-FLIP | Magma, fixed `[0, 1]` |
| SSIM | sequential mapping of dissimilarity (`1 - SSIM`) while retaining raw SSIM values |

Red-green remains available but is not the automatic signed default because it is
not robust for common color-vision deficiencies.

SSIM needs particular care: metric labels and pixel inspection should continue to
report raw SSIM, while the presentation transform may show `1 - SSIM`. The colorbar
must say `1 − SSIM`; it must not claim that the transformed display is raw SSIM.
The descriptor's domain must match the actual registered SSIM kernel (including any
clamping), rather than assuming a mathematical domain in UI code.

### 2. Store user intent, not a resolved default

Add one structured setting owned by the normal plot session:

```ts
type DisplayProfileScope =
  | { kind: "source" }
  | { kind: "comparison"; operation: string };

interface ImageDisplayProfile {
  mapping?: DisplayOperationId;       // absent means automatic
  transform?: "identity" | "one-minus";
  range?: { min: number; max: number } | null;
  exposureEV?: number;
  offset?: number;
  gamma?: number;
  peak?: number;
  reduce?: ReduceMode;
}

interface ImageDisplayProfiles {
  source?: ImageDisplayProfile;
  comparisons?: Record<string, ImageDisplayProfile>;
}

interface PlotSettings {
  "image.displayProfiles"?: ImageDisplayProfiles;
}
```

`source` applies to ordinary images and Split. Comparison profiles are keyed by the
resolved operation id. SDR/HDR is an algorithm option within `flip`, so both share
the `flip` display profile unless they become distinct public operations later.

An absent property means **automatic**. The settings layer should provide a public
merge helper rather than requiring hosts to shallow-patch nested objects:

```ts
patchImageDisplayProfile(scope, patch)
resetImageDisplayProfile(scope)
resetAllImageDisplayProfiles()
```

`null` in a patch clears an override; it is not a display value. This avoids losing
another operation's profile during synchronized or concurrent patches.

### 3. Resolve one effective presentation

Expose a pure public resolver used by both CPU and WebGPU:

```ts
interface DisplayContext {
  face: "source" | "comparison";
  operation?: string;
  field: ComparisonFieldDescriptor | SourceFieldDescriptor;
  authoredDefaults?: Partial<ImageDisplayProfile>;
  capabilities: DisplayCapabilities;
}

interface ResolvedImageDisplay {
  mapping: DisplayOperationId;
  transform: "identity" | "one-minus";
  range: { min: number; max: number } | null;
  exposureEV: number;
  offset: number;
  gamma?: number;
  peak?: number;
  reduce?: ReduceMode;
  provenance: Partial<Record<keyof ImageDisplayProfile,
    "user" | "authored" | "operation-default" | "source-default" | "fallback">>;
  warnings: readonly DisplayResolutionWarning[];
}

resolveImageDisplay(context, profiles): ResolvedImageDisplay
```

Resolution is per property, in this order:

1. Applicable explicit override in the active profile.
2. Applicable authored default for that scope.
3. Registered operation recommendation.
4. Source-representation default (source/Split only).
5. Renderer capability fallback.

A saved but temporarily unsupported choice remains stored. The resolver uses a
fallback and returns a warning such as “Magma unavailable in this backend; showing
grayscale.” When the capability returns, the explicit choice becomes active again.
The resolver never silently rewrites user intent.

The settings UI should show `Automatic — Magma` (or the current resolved value), not
pretend that Magma is an explicit selection. Choosing **Automatic** clears the active
profile override.

## Transition rules

- **Source → FLIP:** resolve `comparisons.flip`; absent override selects Magma.
- **FLIP → source/Split:** restore the source profile, including its earlier
  sRGB/ACES, exposure, range, and channel choices.
- **FLIP → SSIM:** resolve the independent SSIM profile and semantic transform.
- **Signed ↔ magnitude:** switch profiles; do not carry a diverging map into a
  magnitude field unless the user explicitly chose it for both.
- **SDR-FLIP ↔ HDR-FLIP:** retain the FLIP display profile. Only computation inputs
  change.
- **Reference/iteration changes:** retain the active profile.
- **Warm cached operation switch:** resolve and present synchronously in the same
  React commit. Persistence may remain debounced.
- **Manual mapping change:** modify only the active profile.
- **Home:** reset the active profile. Provide a distinct “Reset all image display”
  action.
- **Multiple synchronized panes:** publish profile intent through the existing
  settings synchronization channel. Every pane resolves locally against identical
  semantics/capabilities; capability warnings may differ by backend.
- **Entering comparison before operands resolve:** resolve from operation metadata,
  not image statistics, so the default is available before the field arrives.

## Edge cases

### Multichannel pointwise fields

Pointwise operations may retain source arity. The field descriptor must say whether
mapping needs reduction and recommend one deterministic reduction. The UI must show
that reduction. Channel subset and alpha inclusion remain content choices where they
change the computed field; changing only the display reduction remains presentation.
Do not silently use luminance for non-color scientific channels.

### Range selection and unbounded fields

FLIP has a fixed range. Other errors can be unbounded. Phase one should use stable
registry defaults and explicit user ranges. If robust percentile auto-ranging is
added later, its statistics need a separate content-addressed cache. Locating or
presenting a cached diff texture must never wait for a percentile scan or readback;
a stable fallback should paint first.

### NaN, infinity, masks, and missing pixels

Invalid values need a visible, backend-consistent color/pattern and a legend entry.
They must not be clamped into “no error.” Masked pixels should be distinct from valid
zero error. The output descriptor may later advertise mask semantics.

### Explicit but inapplicable settings

Examples include a source-only normal-map operation on a scalar field, gamma without
a gamma mapping, or a LUT unavailable in CPU fallback. Preserve the setting, issue a
non-modal warning, render with a deterministic fallback, and restore it when valid.

### Authored defaults versus user overrides

Descriptor authors may specify source and comparison defaults separately. An authored
source `srgb` must not become a comparison override. Authored comparison defaults sit
below explicit user intent but above operation recommendations. Changing references
or iterations must not reapply authored defaults over live intent.

### Unknown/custom operations

A custom operation without an output descriptor receives a conservative scalar
fallback and a developer warning. It must still render. Registry validation should
encourage every operation to declare semantics and ensure its recommended mapping is
supported by at least one backend.

### Pixel readouts, metrics, and exports

Presentation transforms affect only pixels drawn to the surface and colorbar labels.
Metric summaries, cached result values, downloadable raw fields, and pixel readouts
remain raw by default. The overlay may additionally show the displayed transformed
value, clearly labeled.

### Accessibility

Defaults should not depend on red/green discrimination. Every false-color view should
have a labeled colorbar and numeric readout. Invalid/masked values need contrast in
light and dark themes. User-selected legacy maps remain respected.

## Cache and performance contract

The diff cache key contains operands, channel/content mapping, algorithm inputs, and
operation identity. It must not contain:

- mapping/LUT;
- display transform;
- range;
- exposure/offset/gamma/peak;
- viewport or split position;
- settings provenance.

The resolved display feeds only the final presentation pass. Switching automatic or
explicit mappings on a resident field must produce zero diff misses, zero source
uploads, and zero field recomputations.

## Migration

1. Keep reading `image.encoding` during one compatibility period.
2. On migration, place legacy image display values in the **source** profile only.
   Old sessions lack provenance, so treating them as global explicit choices would
   recreate the FLIP-grayscale bug.
3. Leave comparison profiles absent, thereby selecting new automatic defaults.
4. Convert Cairn's `comparisonPresentation === "split"` to
   `comparisonOperation = "split"`; otherwise retain the operation or use
   `absolute`.
5. Keep `compare.operation` as the initial public key. A future rename to
   `compare.mode` is optional and should not be mixed into this behavioral change.
6. Persist the migrated form only when normal settings persistence next runs; loading
   an old report should not mutate it merely by viewing.

## UI proposal

- One **Diff mode** field containing Split and all error operations.
- A **Display mapping** field showing `Automatic — <resolved mapping>` plus explicit
  choices.
- Only controls applicable to the resolved mapping are shown.
- FLIP algorithm selection remains separate because SDR/HDR changes computation, not
  presentation.
- Split position appears only for Split.
- A compact explanation/colorbar identifies raw field, display transform, and range.

## Test plan

1. Pure resolver precedence and capability-fallback tests.
2. Source → FLIP → source restores source appearance.
3. FLIP → SSIM → signed selects correct automatic profiles.
4. Explicit FLIP mapping survives leaving and returning.
5. Choosing Automatic clears only the active mapping override.
6. SDR/HDR FLIP share presentation preference but not computation identity.
7. Reference, iteration, and channel transitions preserve applicable intent.
8. Legacy `image.encoding = srgb` migrates source-only; FLIP appears in Magma.
9. Synchronized panes share intent without nested-profile data loss.
10. CPU/WebGPU resolve identical supported presentations and warnings.
11. SSIM raw readout/mean remains raw while the colorbar names `1 - SSIM`.
12. Invalid/masked values remain visually distinct.
13. Warm map switches record no diff miss, upload, eviction, or recomputation.
14. Cold and warm operation changes do not flash the source profile inside an error
    view.

## Suggested implementation sequence

1. Add field descriptors and the pure resolver with unit tests.
2. Add structured profiles and merge/reset commands while retaining legacy reads.
3. Route CPU and WebGPU final presentation through the resolver.
4. Add automatic defaults and transition/browser tests.
5. Migrate Cairn's settings UI and persisted settings.
6. Remove legacy global-encoding behavior only after compatibility tests pass.
