# Architecture

Cairn Plot has one production path:

```text
PlotSpec -> PlotHost -> layout -> PlotCell -> backend -> engine
```

## Durable specification

`packages/spec` contains the one JSON-safe recursive descriptor shared by the
Python builders, JavaScript builders, standalone reports and browser host. It
does not contain cell ids, mounted state, decoded data, selections or GPU
resources. A stacked grid describes several content children; layout interprets
them as slots of one persistent cell.

## Plot cells

A plot cell is private cairn-plot machinery, not a public authored object. A
normal grid creates one cell per child. A stacked grid creates one cell and
switches its content slot. Only the cell owns mutable visual settings. Backends
consume those settings and publish intent through the cell command port; they do
not keep fallback copies.

Settings updates have two explicit forms: patch and replace. HOME replaces the
current cell settings with the active content defaults. Selection and
authored links propagate through the same settings channels.

For compatible image slots, a stack retains one backend instance and render
surface. Slot changes prepare content off the committed path and swap it
atomically, so navigation cannot recreate the canvas, flicker, or alter visual
settings.

## Plot definitions and backends

A typed plot definition is the internal extension unit. It owns data and
presentation validation, settings defaults and projection, resolution, optional
comparison planning, and compatible backends. All React views receive one
standard input: semantic `presentation`, readonly effective `settings`, and a
`commands` port for patch/reset operations.

Backends own rendering lifecycle. Engines provide plot-agnostic reusable
machinery such as the shared WebGPU device/RHI or Three resource primitives.
Layout never interprets image, chart, table, or 3D semantics. See
[Authoring plot types](plot-type-authoring.md).

## Browser host

The supported browser API is `ui/src/public`:

```tsx
<PlotHost descriptor={descriptor} dataSource={dataSource} />
```

The imperative `mountPlot` function mounts the same React host; it is not a
second runtime. Renderer registration, viewport stores, selection, stage and
resource machinery remain private.

## Repository packages

- `packages/spec`: canonical recursive wire types.
- `packages/python`: Python authoring, reports and bundled browser assets.
- `ui`: the single browser implementation and public host.

The former controller/plugin/React package experiment was removed because it
did not drive production and duplicated the descriptor, settings and renderer
models. Optional figure and Three bundles install backends on core-owned typed
definitions; there is no second renderer registry.
