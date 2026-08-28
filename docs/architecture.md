# Architecture

Cairn Plot has one production path:

```text
recursive PlotDescriptor -> PlotHost -> internal viewports -> renderers
```

## Durable specification

`packages/spec` contains the one JSON-safe recursive descriptor shared by the
Python builders, JavaScript builders, standalone reports and browser host. It
does not contain viewport ids, mounted state, decoded data, selections or GPU
resources. A stacked grid describes several content children; the host
interprets them as slots of one internal viewport.

## Internal viewports

A viewport is private cairn-plot machinery. A normal grid creates one viewport
per child. A stacked grid creates one viewport and switches its content slot.
Only the viewport owns mutable visual settings. Renderers consume those settings
and publish intent through the viewport callback; they do not keep fallback
copies.

Settings updates have two explicit forms: patch and replace. HOME replaces the
current viewport settings with the active content defaults. Selection and
authored links propagate through the same settings channels.

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
models.
