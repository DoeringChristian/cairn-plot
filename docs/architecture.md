# Architecture

Cairn Plot is migrating from a React-owned renderer tree to a small headless
runtime with plugin renderers. The compatibility app remains operational during
the migration; new ownership follows these boundaries.

## Three lifetimes

- `PlotSpec` is authored, durable and JSON-safe. It contains layout, panes,
  source references, authored settings and named links.
- `PlotSession` contains interactive overrides, selection and transient stage
  state. HOME removes overrides, revealing authored settings again.
- `PlotRuntime` contains mounted renderers, decoded resources, signals and
  imperative handles. None of it can enter `PlotSpec` by construction.

## Packages

- `packages/spec`: JSON model, settings definitions and effective projection.
- `packages/runtime`: commands, controller, signals, resource ownership and
  renderer contracts. It imports no React or concrete renderer.
- `packages/render-core`: framework-free imperative host and core renderers.
- `packages/render-gpu`: WebGPU image/compare renderer implementation.
- `packages/render-three`: Three.js renderer implementation.
- `packages/react`: lifecycle and subscription bindings over the same
  controller used by the imperative host.
- `packages/python`: Python authoring distribution and bundled standalone
  assets. Its public wire models remain compatible during the TypeScript cut.
- `apps/standalone`: standalone browser app and temporary legacy descriptor
  adapter.
- `apps/playground`: visual fixtures and browser acceptance scenarios.

The enforced dependency direction is:

```text
spec <- runtime <- render-core/render-gpu/render-three <- react/apps
```

Concrete renderers never enter the headless runtime. React never owns a second
state model.

## Compatibility deletion gates

1. Add an explicit pane key to the Python and TypeScript descriptor schema;
   replace the standalone adapter's path-derived ids.
2. Adapt the existing image renderer as the first plugin and route all its
   settings writes through `PlotController`.
3. Convert compare, chart and Three renderers independently.
4. Move standalone entry files under `apps/standalone` and switch Cairn to the
   package exports.
5. Delete `useViewportSettings`, settings channels/peers and the recursive
   legacy renderer dispatch only after saved-descriptor and browser fixtures
   pass through the new runtime.
