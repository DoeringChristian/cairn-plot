# cairn-plot Host API — the public interface for embedding hosts (v1 DRAFT)

Status: DRAFT v1 (2026-08-26) — under adversarial review; do not implement yet.
Owner: cairn-plot. Primary consumer: cairn-track's UI cards (`cairn/ui`).

## 1. Motivation

cairn-track's cards currently consume cairn-plot as a parts bin: 65 import
statements across 27 files reach into internal modules (`three/*`,
`media-compare/*`, `viewport/*`, `renderers/*`, `primitives/*`, `image/*`,
`hooks`), compiled first-party through a vite alias on the git submodule.
Every internal refactor in cairn-plot breaks cairn-track's typecheck; every
submodule bump is adoption work. Meanwhile the Python surface (`cairn.plot`)
consumes cairn-plot through a narrow, seam-based contract (descriptor +
resolver registration) and never breaks.

This spec defines the equivalent narrow contract for JS/TS hosts: the
**descriptor-driven Host API**. A host authors plots as data (the existing
`cairnPlot.*` builder), mounts them, and exchanges **settings** — plain
serializable objects — with the mounted viewports. Internals (chart
components, colormap LUTs, decoders, sync machinery) return to being private.

## 2. Current state (what already exists)

- **JS builder** (`lib/cairn-plot/builder/builders.ts`): `cairnPlot.line/
  scatter/bar/histogram/heatmap/parallelCoordinates/image/table/compare/grid/
  mesh/pointcloud/volume/boxes` + `registerRuntime`. React-free; returns
  `PlotHandle` (descriptor + runtime data + `mount(el)`/`toElement()`).
  Unit-tested (`builders.test.ts`) and smoke-gated (`smoke-js-api.mjs`).
- **Mounter seam** (`builder/handle.ts`): rendering is behind a `Mounter`
  installed by the core bundle (`plot-bootstrap.tsx`), so builder modules are
  ESM-importable without React.
- **Settings system** (`viewport/image-settings-sync.ts` + per-kind stores):
  each viewport owns ONE settings object resolved through an ordered **stack
  of layer references** (bottom→top: `[viewport-local, selection-episode?,
  stage-layer?]`), shared-by-reference across viewports, read as a cached
  top-shadows merge, writes to the topmost layer, transient per layer.
  Primitives: `pushSettingsLayer`/`popSettingsLayer` (pure, stack values).
- **Subscribable resolve cache** (`plot-node.tsx`): descriptor leaves resolve
  content-keyed and cached; resolution state is a pure function of the
  resolve key; the CHANNEL-PICK HOLD keeps the same pane mounted across a
  re-resolve of the same base source (payload swaps in place; ruling: a data
  change never creates a new pane).
- **Runtime store** (`viewport/runtime-store.ts`): in-memory data entries
  referenced by descriptors by hash — the builder's data-by-reference path.
- **Endpoint data mode** (Python `data_mode="endpoint"`): descriptors that
  reference server data resolved client-side.
- **Viewport module contract** (`viewport/types.ts` + mesh/pointcloud/volume/
  boxes kits): the pluggable per-content-kind bundle cairn-track's
  `VisualContentCard` consumes today via deep imports.

## 3. Goals / non-goals

Goals:
1. One public API that covers everything cairn-track's cards need; deep
   imports become lint errors.
2. The settings system is the host boundary: plain data in/out, layers as
   first-class shareable handles, composing with in-page selection/stage
   transients by construction.
3. Live data as a first-class concern (cairn-track is a live tracker).
4. In-place updates: data/descriptor changes NEVER create new panes
   (generalizing the channel-pick ruling).
5. Incremental migration: cards convert one at a time; both worlds coexist
   until the last card converts.

Non-goals:
- Publishing cairn-plot as a versioned npm package (consumption stays
  source-compiled via the submodule for now; the API boundary is enforced by
  entry points + lint, not packaging).
- A stable API for building custom chart RENDERERS (the `registerViewport`
  escape hatch is deliberately minimal and marked experimental).
- Server/protocol design for cairn-track's data endpoints (the adapter is
  host-owned).

## 4. Public entry points

Exactly three module entry points (plus the Python-facing bundles, unchanged):

| Entry | Contents | Consumers |
| --- | --- | --- |
| `cairn-plot` | builder (`cairnPlot`), `PlotHandle`, `MountedPlot`, `Viewport`, settings layer API, data-source registration, descriptor types, settings types + migrations | all hosts |
| `cairn-plot/react` | `<Plot>`, `useSettingsLayer`, `usePlotHandle` | React hosts (cairn-track) |
| `cairn-plot/viewport` | `registerViewport` + the `ViewportModule` contract types (EXPERIMENTAL) | hosts with app-only panes |

Everything else under `lib/cairn-plot/**` is private. cairn-track adds an
ESLint `no-restricted-imports` rule per migrated directory.

## 5. Core API

### 5.1 Authoring (exists; unchanged surface)

```ts
import { cairnPlot } from "cairn-plot";
const h: PlotHandle = cairnPlot.grid(
  [cairnPlot.image(f32, { shape, tonemap: "aces" }),
   cairnPlot.compare(a, b, { mode: "diff", kernel: "flip" })],
  { cols: 2 },
);
```

`PlotHandle` stays pure data: `{ descriptor, node, store, runtime,
mount(target), toElement() }`.

### 5.2 Mounting

```ts
const m: MountedPlot = h.mount(el);

interface MountedPlot {
  readonly element: Element;
  /** All viewports (descriptor-tree order). Stable identity across update(). */
  readonly viewports: readonly Viewport[];
  /** Shortcut when exactly one viewport exists; throws otherwise. */
  readonly viewport: Viewport;
  /** Re-render IN PLACE from a new handle. Panes whose node identity is
   *  preserved keep their instances, settings, zoom, and GPU resources; the
   *  new payload swaps in as a prop change (never a remount). */
  update(next: PlotHandle): void;
  /** Whole-mount screenshot (composited PNG). */
  screenshot(opts?: ScreenshotOpts): Promise<Blob>;
  unmount(): void;
}
```

`update()` semantics: node correspondence is positional by tree path with the
node's `kind`/`renderer` as a tiebreaker. A leaf whose (path, renderer) is
unchanged keeps its viewport (settings intact) and receives the new data via
the hold discipline (previous frame shown until the new payload resolves —
no loading flash). A leaf whose renderer changes at a path is a remount at
that path only.

### 5.3 Viewports

```ts
interface Viewport {
  /** Stable within the mount: the descriptor tree path (e.g. "root.1"). */
  readonly id: string;
  /** The renderer kind ("image" | "mesh" | ...). */
  readonly kind: string;
  /** Resolved settings — the top-shadows merge of the full stack. */
  getSettings(): ViewportSettings;
  /** Write as a user gesture would: into the TOPMOST layer. */
  setSettings(patch: Partial<ViewportSettings>): void;
  /** Fires on any resolved-settings change (gesture, layer push/pop, sync). */
  onSettingsChange(cb: (s: ViewportSettings) => void): () => void;
  /** Push/remove a host-owned layer (see 5.4). */
  pushLayer(layer: SettingsLayer): void;
  removeLayer(layer: SettingsLayer): void;
  /** Per-pane screenshot. */
  screenshot(opts?: ScreenshotOpts): Promise<Blob>;
}
```

`ViewportSettings` is a discriminated union by `kind` (image settings, mesh
view state, ...) — plain JSON-serializable data, the SAME shapes the settings
stores hold internally, with the existing wire-compat discipline (deprecated
keys readable, `migrateLegacyMode` etc. applied on ingest).

### 5.4 Settings layers (the host grouping primitive)

```ts
const layer: SettingsLayer = createSettingsLayer(initial?: Partial<ViewportSettings>);
layer.set(patch);            // write host-side; propagates to all attached viewports
layer.get();                 // current contents (only this layer's keys)
layer.onChange(cb): () => void; // fires on writes INTO this layer (host or gesture)
```

Semantics (all inherited from the internal model):
- A layer pushed onto multiple viewports is SHARED: one write drives all.
- Stack order per viewport: `[viewport-local, ...host layers in push order,
  ...in-page transients (selection episode, enlarge stage)]`. In-page
  transients always sit ABOVE host layers.
- Reads are the cached top-shadows merge.
- **Write routing**: gestures write the topmost layer. While a host layer is
  topmost, a gesture on ANY attached viewport writes the shared host layer
  (group semantics — by design; this is how card settings get persisted from
  gestures). While an in-page selection is active, gestures write the
  transient episode layer and revert on deselect — host layers are never
  contaminated by transient sessions.
- **Removal is by handle** (`removeLayer(layer)`), mid-stack capable — NOT
  pop-top. (The internal primitives gain handle-based removal; this is the
  one known extension, anticipated in the sync design notes.)
- Layer lifetime is host-owned. Unmount detaches all layers (the layer object
  survives and can be re-pushed on a later mount — persistence = serialize
  `layer.get()`).

### 5.5 Live data

Tier 1 (M1): snapshots + `update()`. The host fetches, authors a new handle,
calls `m.update(h2)`. Sufficient for scalar cards at ~Hz rates.

Tier 2 (M2): registered data sources behind the descriptor:

```ts
registerDataSource("track", {
  get(ref: string, opts: { signal: AbortSignal }): Promise<DataPayload>;
  subscribe?(ref: string, onInvalidate: () => void): () => void;
});

cairnPlot.line({ src: "track://run/17/loss" });          // grows live
cairnPlot.image({ src: "track://run/17/render@step=1200" });
```

- Refs are opaque to cairn-plot; the adapter defines the vocabulary
  (`@latest` etc. are adapter conventions).
- Resolution feeds the existing content-keyed subscribable resolve cache:
  unchanged content = no re-decode/re-upload; scrubbing warm steps is
  instant; invalidations coalesce latest-wins per ref.
- On invalidation the pane holds its current frame until the new payload is
  decoded, then swaps in place (the channel-pick hold, generalized).
- `DataPayload` mirrors the runtime-store entry union (float image, u8 url,
  npy array, table blob, mesh/pointcloud/volume/boxes payloads).

### 5.6 React adapter (`cairn-plot/react`)

```tsx
<Plot
  handle={h}                       // identity change → mount.update(h)
  layers={[hostLayer]}             // diffed to pushLayer/removeLayer
  onSettingsChange={(vp, s) => ...}
  onReady={(m) => ...}
/>
const layer = useSettingsLayer(initialFromCardSpec);
```

- Own React root inside the host tree (host context does NOT cross; theme via
  DOM `data-theme`, sizing via container box — both existing behaviors).
- StrictMode-safe (idempotent mount/unmount; effects guard double-invoke).
- ESM import — one React copy when the host bundles cairn-plot source.

### 5.7 `registerViewport` (EXPERIMENTAL)

```ts
import { registerViewport, type ViewportModule } from "cairn-plot/viewport";
registerViewport("track-trace", module);
// descriptors may then use { kind: "plot", renderer: "track-trace", ... }
```

The module shape is today's `ViewportModule` (data resolve, view-state type +
defaults + migration, single view, native diff pane, capabilities, colorbar).
Marked experimental: the contract may evolve; hosts pin the submodule.

## 6. What becomes private again

Everything cairn-track deep-imports today that is not in §4: chart components
(`ScalarPlot`, `BarChart`, ...), `ImageViewportPane` + item resolvers,
colormap LUT internals, `parseNpy`/`parseNpz`/`parseOverlay`,
`fetch*Arrays`, series utils (`emaSmooth`, `filterOutliers`, ...),
`OffscreenComparePanes`, `plotToPng`, `table-diff`, `three/*` viewers,
`viewport/*` kits, tonemap constants, `useContainerSize`/`useEmitAutoHeight`.
Their capabilities re-enter through descriptors (components), settings
(options/enumerations render in pane toolbars), `screenshot()` (export), and
data sources (fetching/parsing).

## 7. Migration plan

M0. Land the API additions in cairn-plot (viewport objects, layers,
    update, screenshot, react adapter). Gates: typecheck, unit, harness.
M1. Migrate ScalarPlotCard (simplest + most live) on Tier-1 live data.
M2. Land Tier-2 data sources; re-base ScalarPlotCard; migrate the media/
    compare cards (image galleries, VisualContentCard's image path).
M3. Migrate the 3D cards (mesh/pointcloud/volume/boxes) — descriptor leaves
    replace the viewport-kit composition; `registerViewport` only if a card
    proves genuinely app-specific.
M4. Migrate Table/Figure/Histogram/ParallelCoords cards; enable the
    repo-wide deep-import lint; delete dead card plumbing.

Each milestone keeps both worlds compiling (same underlying library).

## 8. Versioning & compatibility

- The descriptor schema and `ViewportSettings` shapes are THE wire contract;
  changes follow the existing discipline: additive keys, deprecated keys
  readable with migrations, never repurposed.
- The API entry points are semver-minor stable within the submodule pinning
  workflow; `cairn-plot/viewport` is exempt (experimental).

## 9. Open questions (for the adversarial review)

1. `update()` node correspondence: is positional-by-path sufficient, or do we
   need author-supplied keys for reordering grids?
2. Settings addressing across `update()`s that change tree shape: what
   happens to a `Viewport` object whose path disappears?
3. Layer conflicts: two hosts layers setting the same key — is push-order
   precedence enough, or do we need priorities?
4. `onSettingsChange` granularity/coalescing (per-key? batched per frame?).
5. Screenshot composition for WebGPU panes (readback timing; HDR surfaces).
6. Tier-2 `DataPayload` union completeness vs the runtime-store entry union.
7. Should `setSettings` write topmost (gesture-like) or into a dedicated
   host layer? (Current draft: topmost.)
8. SSR/no-DOM environments (jsdom tests in the host).
9. Error surfaces: decode failures on live refs; adapter retry policy.
10. Multiple mounts sharing runtime data (dedup, memory).
