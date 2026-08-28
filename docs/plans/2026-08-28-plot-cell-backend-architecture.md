# Plot cell, plot definition, backend, and engine architecture

Status: accepted design; implementation in progress

## Implementation progress

- [x] Typed plot-definition, comparison, and backend contracts.
- [x] Lease-aware soft-budget global cache and stable derived-result keys.
- [x] Foreground/preload preparation scheduler with promotion, deduplication,
  bounded concurrency, and retry after failure.
- [x] Adjacent stack preloading with keyboard-equivalent wraparound.
- [x] Extracted host contexts and `PlotCell` from the recursive plot interpreter.
- [x] Grid containers are layout-only; normal grids explicitly own one cell per
  child and stacks explicitly own one stable cell for the active slot.
- [x] Extracted renderer-agnostic `GridLayout` with render/preload callbacks.
- [x] WebGPU content-op parity tests keep difference operation and display
  encoding independent.
- [x] Adapt the production image definition and existing renderer through a
  same-root React backend; remove image from the legacy registry and enforce
  exclusive kind ownership during migration.
- [x] Replace the legacy unbounded resolution storage with the lease-aware
  runtime cache; visible leaves pin leases while adjacent preloads stay
  evictable and retry silently after background failure.
- [x] Implement versioned branch-retaining grid/stack sessions, imperative
  import/export/subscription, and opt-in external persistence.
- [x] Move shared WebGPU device acquisition/lifetime behind a reusable,
  plot-agnostic provider while retaining a compatibility export for old tests.
- [x] Introduce the WebGPU engine facade for capability discovery, shared
  acquisition, surface creation, readback, and recovery; route the production
  image pool through its acquired context.
- [x] Define a plot-agnostic WebGPU RHI for textures, samplers, pipelines, bind
  groups, surfaces, submission, and readback. Keep image diff/histogram/deep
  extensions on the transitional legacy device instead of leaking them into
  the reusable contract.
- [x] Move image comparison planning and operand resolution out of the recursive
  host into `plots/image`, including baseline ordering, labels, stable leaf
  identity, redirect/content keys, float precision, and comparison packing.
- [ ] Extract the reusable WebGPU facade and progressively flatten the remaining
  `lib/cairn-plot` tree.

## Objective

Make plot types straightforward to author and maintain while preserving the
existing behavior, especially flicker-free image stacks. The durable spec
describes plots and layout intent. Cairn-plot decides how many visible cells
exist and how they are arranged.

The implementation has no public or first-class `Viewport` object. Its concrete
runtime boundary is a persistent `PlotCell`:

```text
PlotSpec -> layout -> PlotCell -> SurfaceHost -> plot backend -> engine
```

A cell owns one settings store and one or more retained backend surfaces. A
normal grid has one cell per child. A stacked grid has one cell with multiple
slots.

## Non-negotiable invariants

1. Grid cells have independent settings.
2. Stack slots share one actual settings store; they do not synchronize copies.
3. Image-compatible stack slots share one backend instance, canvas, GPU context,
   and surface.
4. Changing a source or stack slot never initializes or changes settings.
5. HOME replaces the cell settings with the active presentation's defaults.
6. A cold switch keeps the previous committed image visible until the requested
   presentation is prepared, then commits atomically.
7. A stale asynchronous result can never overwrite a newer requested slot.
8. Backend selection changes implementation only, never semantic settings.
9. Comparison semantics belong to plot definitions, not the universal host.
10. Adding a plot type must not require changes to layout, cell, selection,
    stage, or Cairn code.

## Target source structure

```text
ui/src/
  public/       supported browser API and session persistence seam
  host/         PlotSurface, PlotCell, SurfaceHost, backend lifecycle
  layout/       grid, stack, compare placement and sizing
  state/        settings stores, links, selection, commands, sessions
  plots/        plot definitions and their concrete backends
  backends/     shared imperative backend contracts only
  engines/      reusable WebGPU and Three machinery
  resources/    data sources, resolution, global caches, leases
  settings/     schemas, defaults, validation, generated controls
  primitives/   generic presentation components
```

Concrete implementations live with their plot semantics:

```text
plots/image/backends/webgpu/
plots/image/backends/canvas/
plots/scalar/backends/svg/
plots/scatter/backends/webgpu/
plots/mesh/backends/three/
```

The current `ui/src/lib/cairn-plot` nesting is removed progressively after the
new boundaries exist. Moves must be mechanical and independently verified.

## Durable specification

The durable model remains JSON-safe authored intent. It contains plot leaves,
grids, comparisons, sources, settings patches, layout hints, and optional
stable authored keys. It contains no cells, active tabs, renderer handles,
caches, errors, decoded content, or GPU resources.

Every grid normally offers grid/stack switching. An author may disable it.

```ts
interface GridSpec {
  kind: "grid";
  children: PlotNode[];
  presentation?: {
    initial?: "grid" | "stack";
    switchable?: boolean; // default true
  };
}
```

Saved session presentation overrides authored initial presentation. The
authored value is used only when no restored session value exists.

## Plot cells and layout transitions

Layout creates cells as follows:

```text
plot                  one cell
compare(a, b)         one cell
grid in grid mode     one cell per child
grid in stack mode    one cell containing all children as slots
```

Grid to stack seeds the stack cell from the currently selected grid cell,
falling back to the first. Grid cell sessions remain retained. Stack to grid
restores each grid cell's previous settings; the stack session remains retained
for a future return.

A cell owns its settings store above the active slot. Switching slots therefore
cannot recreate the store.

## Plot definitions

An internally registered plot definition is the extension unit. It owns its
data schema, settings schema and defaults, resolution, semantic presentation,
controls, compatible backends, and optional comparison capability. Runtime
third-party plugin registration is out of scope.

Definitions are strongly typed. The heterogeneous internal registry uses a
single controlled type-erasure adapter created by `definePlot`; `any` must not
spread into concrete definitions or backends.

## Backends and engines

A backend implements one plot presentation using DOM, Canvas 2D, WebGPU, or
Three. It has an imperative `mount`, `update`, and idempotent `destroy`
lifecycle even if its implementation uses React internally.

An engine is plot-agnostic reusable machinery. The shared WebGPU engine owns
one device per page, device recovery, surface configuration, texture and buffer
pools, shader and pipeline caches, command submission, scheduling, generic
passes, readback, leases, and instrumentation. It knows nothing about images,
exposure, scatter points, or difference modes.

CPU and GPU backends for the same plot consume the same semantic presentation
and typed settings projection.

## Image presentation and flicker-free stacks

Single images and image comparisons form one backend family:

```ts
type ImagePresentation =
  | SingleImagePresentation
  | SplitImagePresentation
  | DifferenceImagePresentation;
```

An image stack mounts the image backend once. A prepared slot switch calls
`update`; it never replaces the cell, canvas, context, or backend instance.

Slot activation has requested and committed identities plus a monotonically
increasing generation. The old committed presentation stays visible during a
cold preparation. Completion commits only when its generation is still current.

Mixed stacks retain backend instances by compatible family. Image backends are
preferentially retained. Expensive parked families may later be evicted without
losing cell settings.

## Comparison

A comparison contains plot operands and an optional presentation name. The
compatible plot definition decides operand compatibility and count, resolution,
composition, settings, controls, and supported presentations.

Examples:

```text
scalar x scalar -> combined series -> scalar backend
image x image   -> split/difference -> image backend
table x table   -> compared cells   -> table backend
mesh x mesh     -> overlay/distance -> mesh backend
```

Comparison presentation and difference operation are separate concepts:

```text
presentation = difference
diff mode    = signed
```

`kernel` remains a private backend implementation term. Explicit cross-type
comparisons may be registered internally. Ambiguous comparison registrations
are development errors.

## Global resource and comparison cache

There is one bounded runtime cache per page, with CPU entries globally shared
and GPU entries scoped to the page's shared WebGPU device:

```text
fetched bytes
decoded content
normalized plot content
derived comparison results
device-specific prepared resources
```

Keys are content based and include algorithm identity/version, ordered operands,
and only the settings declared to affect the result. Old training-step results
are not explicitly invalidated; they remain until LRU eviction.

Visible resources hold leases and cannot be evicted. The budget is soft: pinned
entries may exceed it. Only unleased entries participate in LRU eviction.

After slot N commits, the previous and next slots are preloaded, wrapping at the
ends like keyboard navigation. Foreground requests always outrank preload work.
A preload failure is diagnostic-only and retried as a foreground request when
selected. A foreground failure becomes visible while the previous successfully
committed content remains intact.

Future extensions that the interfaces must permit:

- retaining several computed modes for one comparison;
- wider/background stack preparation policies;
- separate CPU and GPU memory budgets;
- adaptive LRU policies and instrumentation.

Cache content is runtime-only and is never serialized.

## Session and persistence

The in-memory session currently contains cell settings, grid/stack
presentation, active stack slots, and retained grid and stack branches. It
excludes caches, errors, resolved content, backend IDs, handles, and GPU state.
Selection and stage remain page-global and ephemeral until their ownership is
scoped to an individual plot root; serializing them into one plot session now
would be incorrect. Links remain authored intent.

The public controller provides `getSession` and `restoreSession`. Persistence is
an optional injected adapter and is disabled by default. Disabling persistence
does not disable in-memory state or manual session import/export.

```ts
interface SessionPersistence {
  load(): PlotSession | null | Promise<PlotSession | null>;
  save(session: PlotSession): void | Promise<void>;
  clear?(): void | Promise<void>;
}
```

Sessions are versioned and migrated on restore. Persistence writes are
serialized, collapse to the latest pending snapshot, and never overwrite saved
state while an asynchronous load is pending.

## Migration sequence

1. Add architecture tests and typed plot/backend/comparison contracts.
2. Add the global lease-aware LRU cache and scheduling seams with unit tests.
3. Extract grid, stack, and persistent `PlotCell` ownership from
   `plot-node.tsx` without changing behavior.
4. Wrap existing renderers in imperative backend adapters; do not rewrite them.
5. Move image resolution and presentation composition into the image definition.
6. Make single/split/difference presentations reuse one image family instance,
   with browser identity and paint-atomic tests.
7. Move comparison composition into plot capabilities, starting with image and
   scalar overlay.
8. Add the public controller, versioned session, and optional persistence.
9. Extract the current WebGPU device/resource/scheduling machinery behind an
   engine facade, then decompose reusable passes incrementally.
10. Mechanically flatten `lib/cairn-plot` into the target directories, enforcing
    import boundaries after each slice.

Every slice must pass TypeScript, unit tests, browser behavior harnesses, bundle
checks, and Python descriptor/report tests before the next slice begins.
