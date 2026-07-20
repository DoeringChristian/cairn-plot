# Changelog

All notable changes to `cairn-plot` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — initial import

Initial extraction of the plotting library from the
[`cairn`](https://github.com/anthropics/cairn) monorepo into a standalone repo.

Provenance: monorepo `hdr-post` @ `270e6380`.

### Added
- **Python package** `cairn_plot` — pure-numpy/pydantic composables
  (`Line` / `Scatter` / `Bar` / `Histogram` / `Heatmap` / `ParallelCoordinates`
  / `Image` / `Table` / `Figure` / `PointCloud` / `Mesh` / `Volume` / `Boxes`,
  plus `Grid` / `Compare`), the `cp.Report` builder with Jinja2 templating
  (`cairn` + `minimal` themes), and the pure-numpy Plotly metric recipes
  (`confusion_matrix` / `roc_curve` / `pr_curve` / `bar` / `line_series`). The
  self-contained renderer bundles ship as package data.
- **TS/React renderer library** under `ui/` (`ui/src/lib/cairn-plot/**`) plus the
  `plot-*` standalone entries and the four `vite.plot-*.config.ts` builds that
  emit self-contained IIFE bundles (`core` + `figure`/`three`/`gpu-image`
  addons).
- **Self-contained local(baked) data mode**: pure serializers for the raw table
  and 3D-array paths are vendored under `cairn_plot._sdk` and registered as the
  default resolvers, so the full gallery renders offline with no `cairn-track`.
- Committed JSON schema (`schema/cairn-plot-spec.schema.json`) generated from
  the TS `PlotDescriptor`, with a drift guard.
- CI: tsc, node tests, schema + boundary guards, `build:plot-inline`, pytest,
  wheel + bare-venv quickstart, and a headless-Chromium gallery smoke.

### Notes
- The `media` extra (`plotly` + `pillow`) is optional; the core composables and
  reports work with `numpy` + `pydantic` + `jinja2` alone.
- The app-coupled tests (`cairn.sdk` / `cairn.server`) remain in the monorepo —
  they test the app shim/server, not this library.

[0.1.0]: https://github.com/doeringchristian/cairn-plot/releases/tag/v0.1.0
