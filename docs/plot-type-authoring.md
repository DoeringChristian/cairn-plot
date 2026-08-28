# Authoring plot types

Plot types are internal, typed extension units. Adding one must not require a
change to layout, cells, selection, stage, or Cairn. Runtime third-party plugin
registration is intentionally out of scope.

## Definition boundary

A definition owns six things:

1. validation of authored data;
2. a settings schema, defaults, and projection;
3. source resolution into a semantic presentation;
4. optional comparison acceptance, planning, and resolution;
5. controls derived from its settings;
6. one or more compatible rendering backends.

Use `definePlot` to preserve concrete types inside the definition while limiting
heterogeneous type erasure to the registry boundary. A React-backed backend view
always receives the same shape:

```ts
type PlotViewProps<TPresentation, TSettings> = {
  presentation: TPresentation;
  settings: Readonly<TSettings>;
  commands: {
    patch(patch: Partial<TSettings>): void;
    reset(keys?: readonly (keyof TSettings)[]): void;
  };
};
```

Presentations describe resolved plot meaning, not host plumbing. Do not put
settings callbacks, cell identity, selection state, renderer handles, caches,
or GPU resources in them.

## Settings ownership

The cell is the sole owner of mutable visual settings. Backends read effective
settings and request changes through `commands`. They must not initialize
settings on mount, derive a second fallback store from props, or rewrite
settings when content changes. HOME is one cell-level reset to the active
presentation's defaults.

This rule is what makes stack navigation safe: all slots in one stack use the
same settings object, while ordinary grid cells stay independent.

## Comparison capability

Comparison is plot-defined. A capability declares accepted operands and
strategies, plans one or more outputs, then resolves each output into the same
semantic presentation family used by ordinary rendering.

- Image `reference` comparison plans N-1 pairwise split/difference outputs.
- Scalar `all` comparison plans one N-way overlay presentation.
- A future plot may support either strategy, both, or neither.

The generic host only supplies ordered operands, optional reference, strategy,
and requested presentation. It never constructs plot-specific pairs or knows
what a difference operation means. Derived results use stable, versioned cache
keys and the global lease-aware LRU.

## Backends and engines

A backend implements semantic presentation with DOM, Canvas 2D, WebGPU, or
Three. Alternate backends consume identical presentation and settings types;
backend selection cannot change semantics.

An engine is reusable and plot-agnostic. The WebGPU engine owns shared device
acquisition, recovery, surfaces, RHI objects, submission, and readback. The
Three engine owns reusable Three lifecycle/resource machinery. Image decode,
exposure, colormaps, difference modes, chart domains, and mesh semantics belong
to plot definitions or their backends, never to an engine.

Optional bundle loading follows the same rule: core registers the typed plot
definition, and the addon installs a backend through
`__cairnPlotRegisterBackends`. Addons do not register untyped renderer
components or redefine plot semantics.

## Review checklist

- The data and resolved-presentation validators reject malformed input.
- Settings have one owner and no renderer-local semantic fallback.
- Content changes and stack flips perform no settings writes.
- The backend implements the standard presentation/settings/commands contract.
- Comparison behavior, if any, is declared by the plot definition.
- Expensive resolved or derived values use leases and stable cache keys.
- Browser identity tests cover retained surfaces when seamless flipping matters.
- Boundary and bundle checks prove optional dependencies stay out of core.
