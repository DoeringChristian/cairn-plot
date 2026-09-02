# cairn-plot design

`cairn-plot` is a standalone plotting library with two authoring faces and one
browser renderer. Python users compose plots and reports with `cairn_plot`; JS
users build the same descriptor through `window.cairnPlot` or mount a descriptor
with the React host. Both routes produce a self-contained `PlotSpec` plus an
optional content-addressed data store.

Related proposal: [semantic display profiles for image comparisons](error-map-display-profiles.md).

## Goals

- Render portable, offline HTML: no server and no CDN in the default path.
- Keep the durable plot contract JSON-safe and shared across Python, TypeScript,
  tests, and schema generation.
- Keep authored data, runtime state, layout, and rendering backends separated.
- Allow optional heavy renderers (Plotly figure passthrough, Three/WebGPU paths)
  without creating a second runtime or public plugin system.

## Repository layout

- `packages/spec` defines the canonical recursive `PlotSpec` wire types.
- `packages/python/src/cairn_plot` implements Python builders, data shaping,
  reports, and offline bundle emission.
- `ui/src/public` is the supported browser API: `PlotHost`, `mountPlot`, data
  source helpers, and re-exported spec types.
- `ui/src/host` renders the recursive spec into cells, layouts, sessions,
  selection, and backend outlets.
- `ui/src/plots` contains typed plot definitions and plot-specific backends.
- `ui/src/resources` contains content stores, data-source adapters, resolution
  caching, and runtime in-memory data references.
- `ui/src/engines` contains reusable renderer machinery such as WebGPU and
  Three context management.
- `schema` contains committed JSON schemas generated from the shared contract.

## Durable plot contract

The central artifact is `PlotSpec`:

```text
PlotSpec
└── root: PlotNode
    ├── plot    { type, data, props?, settings? }
    ├── grid    { children, layout hints, shared settings? }
    └── compare { type, operands, presentation, strategy, settings? }
```

A spec is durable authored intent. It contains data references and authored
settings, but not DOM state, decoded buffers, selections, GPU resources, mounted
cell ids, or cached presentations. Python and JS builders both lower to this
same tree shape, and the committed schema guards that contract.

## Python authoring and reports

Python components (`Line`, `Image`, `Grid`, `Compare`, `Report`, etc.) validate
user input, shape arrays/tables/images into JSON or binary blobs, and lower to
`PlotSpec`. Large binary payloads are stored by content hash in a page-level
store; small chart/table payloads remain inline in the descriptor.

`Report` interleaves markdown, raw HTML, and plot elements, then emits one
standalone HTML document. The Python package ships synchronized JS/CSS assets
from `ui/dist/plot-inline` under `cairn_plot/_assets`; the report emitter inlines
only the bundles required by the descriptor.

## Browser render path

The production path is intentionally single:

```text
PlotSpec -> PlotHost/PlotSurface -> PlotNodeView -> PlotCell -> backend -> engine
```

`PlotHost` is the supported React boundary. `mountPlot` uses the same host
imperatively; it is not a separate renderer. The host creates a `DataSource`,
sets shared context for the tree, compiles session topology, and renders each
node recursively.

`PlotCell` is the private unit of runtime ownership. It owns mutable cell
settings, selection membership, session recording, and the visible selection
frame. A normal grid renders one cell per child. A stacked grid keeps a single
cell for the active slot so view/settings state persists across slot switches.

## Data and resolution

Renderers never fetch artifacts directly. They receive a `DataSource` with:

- `artifactUrl(hash)` for URL-like consumers such as images,
- `bytes(hash)` for binary parsers such as NPY/NPZ/EXR decoders,
- optional `runtime(hash)` for JS-authored in-memory buffers.

The local data source reads `window.__cairnPlotStore`, the offline store emitted
by Python or registered by tests/bootstrap. Endpoint hosts can supply a network
source. Resolution from `DataSpec` to typed presentation data is cached by source
and content key so stacked views and repeated renders reuse decoded work.

## Plot definitions and backends

Each plot kind is implemented as a typed `PlotDefinition` with four jobs:

1. validate the `DataSpec`,
2. provide default/projected settings,
3. resolve data into typed content,
4. present content to one or more registered React backends.

The heterogeneous registry erases definitions only at the host boundary. Plot
and backend code stays typed internally. Backend selection is based on declared
support for the current presentation and environment (`webgpu`, `webgl2`, pixel
ratio), with the highest supported priority winning. Engines provide reusable
technology-specific machinery; layout code does not interpret image, chart,
table, or 3D semantics.

## Settings, sessions, and selection

Settings are plain JSON-compatible records keyed by names such as
`image.view`, `image.encoding`, `chart.domainX`, or `scene3d.camera`. The cell
owning a viewport stores the explicit settings object. Defaults are derived from
a node only until the viewport receives explicit settings.

Settings synchronization is stateless broadcast:

- a cell applies a patch to itself,
- publishes the same patch to its active groups,
- peers apply scoped patches into their own persistent settings object.

Leaving a group does not revert settings. Session state records cell settings and
grid layout/active-slot state, and can be kept runtime-only or connected to an
external persistence adapter.

Selection is page-wide by design. Selected panes share view/display settings;
the reference pane powers multi-pane compare/enlarge workflows. The selection
stage reuses the same cell and backend infrastructure rather than creating a
special renderer path.

## Layout and comparison

`GridLayout` owns renderer-agnostic layout mechanics: grid vs stacked mode,
slot labels, preloading, gaps, and sizing. Shared grid settings can synchronize
view/camera keys without knowing plot internals.

Comparison is a plot capability, not a layout guess. A `CompareNode` names the
plot type that owns comparison semantics. The registry validates operands,
selects a presentation, and returns a comparison plan. Image comparisons can use
specialized CPU/WebGPU paths for split views and diff kernels, while other plot
kinds can add comparison behavior through their own definition.

## Image rendering

Images are the richest plot family and demonstrate the separation of concerns:

- definition modules describe content, settings, display operations, comparison
  operations, channel groups, and histogram binning;
- resource modules decode PNG/JPEG/browser-native images, EXR/HDR/PFM, NPY/NPZ,
  and URL/runtime sources into canonical buffers;
- CPU and WebGPU backends consume the same presentation/settings contracts;
- compare, histogram, channel-selection, overlay, and pixel-readout components
  are shared around those backends.

WebGPU is an acceleration path, not a distinct authored API. When WebGPU is
unavailable or unsupported for a presentation, the backend registry falls back to
supported CPU/browser paths where possible.

## Bundles and assets

The UI builds self-contained IIFE bundles:

- `core`: host, core plot types, CSS, JS builder surface,
- `figure`: Plotly passthrough addon,
- `three`: 3D addon,
- `gpu-image`: WebGPU image acceleration when built as a separate payload.

Bundles are include-once guarded. Python chooses which bundles to inline by
walking the descriptor tree, then emits store and mount scripts. `npm run
sync:plot-assets` copies built assets into the Python package; CI checks the
committed schema and bundle/package synchronization.

## Design invariants

- `PlotSpec` is authored durable data; runtime-only state stays out of it.
- There is one production browser host; imperative mounting delegates to it.
- Layout owns geometry, not plot semantics.
- Plot definitions own validation, defaults, resolution, presentation, and
  comparison semantics for their kind.
- Cells own mutable viewport settings and selection membership.
- Data access goes through `DataSource`; renderers do not know whether bytes came
  from an offline store, an endpoint, or a JS runtime reference.
- Engines are plot-agnostic and reusable; backends translate typed
  presentations/settings into engine calls.
