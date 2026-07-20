# cairn-plot

Standalone, Plotly-shaped plotting library with **two faces** — a Python
library and an HTML/JS library — that render plots **self-contained**: one
offline HTML file, no server and no CDN.

- **Python** (`pip install cairn-plot` → `import cairn_plot as cp`): compose
  plots and reports from plain in-memory data and `.save()` a portable HTML doc.
- **HTML / JS**: the same renderers ship as self-contained IIFE bundles
  (`core` + `figure`/`three`/`gpu-image` addons) the Python emit inlines — so a
  saved page renders with zero runtime dependencies, even from `file://`.

`cairn-plot` is the rendering core of
[`cairn`](https://github.com/anthropics/cairn) (the experiment tracker); the
full tracker layers `run[tag]` integration on this exact surface via
`import cairn.plot as cp`.

## Python quickstart

```python
import numpy as np
import cairn_plot as cp

report = (
    cp.report("My report")
    .md("# Results")
    .add(cp.Line({"loss": np.random.rand(50).cumsum()}))
    .add(cp.Image(np.random.rand(64, 64)))
)
report.save("report.html")   # one self-contained, offline HTML file
```

Every plot type is a composable: `cp.Line` / `cp.Scatter` / `cp.Bar` /
`cp.Histogram` / `cp.Heatmap` / `cp.ParallelCoordinates` / `cp.Image` /
`cp.Table` / `cp.Figure` (Plotly passthrough) / `cp.PointCloud` / `cp.Mesh` /
`cp.Volume` / `cp.Boxes`, plus the `cp.Grid` compositor and `cp.Compare`.
`cp.Report` interleaves markdown, raw HTML, and components into one document.

The `media` extra (`pip install cairn-plot[media]`) adds Plotly (for the
`cp.Figure` passthrough and the `confusion_matrix` / `roc_curve` / `pr_curve`
recipes) and Pillow (for raw-image baking). The core 2D/3D composables and
reports work with numpy + pydantic alone.

## Examples

**Pre-rendered pages are committed in
[`examples/rendered/`](examples/rendered/)** — download one and open it in a
browser to see every feature live, no install needed (each file is fully
self-contained):

**View them rendered in your browser right now** (served via raw.githack, so
the link opens the live page, not the file's source):

- [**Gallery** — every plot type](https://raw.githack.com/doeringchristian/cairn-plot/main/examples/rendered/gallery.html)
  (2D charts, tables, SDR/HDR images, compare modes, WebGL 3D viewers)
  · [source file](examples/rendered/gallery.html)
- [**Feature report** — themed `cp.Report`](https://raw.githack.com/doeringchristian/cairn-plot/main/examples/rendered/report.html)
  (compare/diff kernels, FLIP + HDR-FLIP validation, synced viewports)
  · [source file](examples/rendered/report.html)
- [**URL images** — client-side EXR decoding](https://raw.githack.com/doeringchristian/cairn-plot/main/examples/rendered/url-images.html)
  (needs network when viewed) · [source file](examples/rendered/url-images.html)

Three runnable, self-documenting examples live in [`examples/`](examples/) —
each renders a single offline HTML file (pass `--open` to view it immediately):

```bash
python examples/demo_cairn_plot.py --open     # every plot type, one gallery page
python examples/report_cairn_plot.py --open   # the full cp.Report feature report
python examples/demo_url_images.py --open     # URL-referenced EXR images (needs network)
```

- [`demo_cairn_plot.py`](examples/demo_cairn_plot.py) — the kitchen-sink
  gallery: all 2D charts, tables, images (SDR + true-float HDR), compare
  modes, and the WebGL 3D viewers (point cloud / mesh / volume / boxes).
- [`report_cairn_plot.py`](examples/report_cairn_plot.py) — dogfoods
  `cp.Report`: markdown + components in the themed report layout, every
  `cp.Compare` mode and diff kernel (incl. FLIP validated against NVIDIA's
  official `flip-evaluator`, shown side by side in magma), HDR-FLIP, and
  viewport-synced grids.
- [`demo_url_images.py`](examples/demo_url_images.py) — `cp.Image(url=...)`:
  the page bakes no pixels; the browser fetches and decodes EXR (ZIP + PIZ)
  client-side. See [`docs/API.md`](docs/API.md) for the full 0.1 API contract,
  and [`docs/browser-support.md`](docs/browser-support.md) for enabling
  WebGPU / HDR output per browser (Chrome, Brave, Firefox, Safari).

## HTML / JS library

The renderer bundles live under `ui/` (a TS/React library). Build the
self-contained bundles with:

```bash
cd ui
npm install
npm run build:plot-inline     # → ui/dist/plot-inline/{core,figure,three,gpu-image}.iife.js + style.css
npm run sync:plot-assets      # copy them into the Python package data (src/cairn_plot/_assets)
```

The bundles are include-once guarded and register renderers into a shared core
bootstrap, so a page carries `core` once plus only the addons its plots need.

## Development

```bash
# Python
uv venv && uv pip install -e ".[dev]"
pytest tests/ -q

# UI
cd ui
npm install
npm run typecheck            # tsc -b --noEmit
npm test                     # node --test over the lib's *.test.ts
npm run check:plot-schema    # TS PlotDescriptor ↔ committed JSON schema
npm run check:plot-boundary  # the library must not import app code
npm run smoke:plot           # headless-Chromium gallery render check
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
