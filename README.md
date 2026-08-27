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

**View every feature live right now** — CI re-renders the showcase from every
push to `main` and publishes it via GitHub Pages
(**<https://doeringchristian.github.io/cairn-plot/>**):

- [**Gallery** — every plot type](https://doeringchristian.github.io/cairn-plot/gallery.html)
  (2D charts, tables, SDR/HDR images, compare modes incl. FLIP at 2048×2048,
  WebGL 3D viewers)
- [**Feature report** — themed `cp.Report`](https://doeringchristian.github.io/cairn-plot/report.html)
  (compare/diff kernels, FLIP + HDR-FLIP validation, synced viewports)
- [**URL images** — client-side EXR decoding](https://doeringchristian.github.io/cairn-plot/url-images.html)
  (needs network when viewed)
- [**Pick & compare** — two images from your own device](https://doeringchristian.github.io/cairn-plot/compare.html)
  (interactive: choose two local PNG/JPG/EXR/… images and compare them —
  side/wipe/blend or pixel-diff incl. FLIP/SSIM; fully client-side, nothing
  uploaded)

Each page is one fully self-contained HTML file — save it from the browser for
offline use, or regenerate locally with the example scripts below.
(`examples/rendered/` is git-ignored: the pages are CI-rendered artifacts, not
sources — committing the ~50 MB regenerations made pushes enormous.)

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
  WebGPU / HDR output per browser (Chrome, Brave, Firefox, Safari) — including
  the [secure-context requirement](docs/browser-support.md#secure-context-required-for-webgpu)
  (WebGPU is hidden on plain-HTTP non-localhost origins, which silently drops
  the GPU-only compare kernels — open via `http://localhost` or https).

## HTML / JS library

The same renderers expose a **first-class JS builder surface** —
`window.cairnPlot` — that mirrors the Python `cairn_plot` builders one-to-one.
Load the offline `core` bundle and author plots entirely in JavaScript; no
Python, no server, no CDN:

```html
<link rel="stylesheet" href="core/style.css" />
<script src="core/core.iife.js"></script>  <!-- installs window.cairnPlot -->
<div id="loss"></div>
<div id="pred"></div>
<script>
  const cp = window.cairnPlot;

  // Same builders as Python — line/scatter/bar/histogram/heatmap/
  // parallelCoordinates/image/table/compare/grid (+ 3D via the three addon).
  cp.line({ loss: [2, 1.3, 0.9, 0.7], val: [2.1, 1.5, 1.1, 1.0] }).mount("#loss");

  // HDR image straight from a Float32Array — rides by reference, no base64:
  const data = new Float32Array(64 * 64 * 3); /* fill with HDR values … */
  cp.image(data, { shape: [64, 64, 3], tonemap: "aces" }).mount("#pred");
</script>
```

Every builder returns a handle with `.mount(elOrSelector)` and `.toElement()`
(a detached `<div>`). Inputs accept plain arrays, nested arrays, TypedArrays,
`ImageData`, `<canvas>`, and `{ url }`; JS-provided pixels ride through an
in-memory runtime store **by reference** (no base64 round-trip). Validation
(colormaps / tone-maps / compare kernels) uses the same cross-language contract
as Python. See [`examples/demo_js_api.html`](examples/demo_js_api.html) for a
self-contained page and [`docs/API.md`](docs/API.md#html--js-builder-surface)
for the full JS surface (incl. a Jeri → `cairnPlot` migration snippet).

[`examples/demo_compare_upload.html`](examples/demo_compare_upload.html) is a
JS-authored, fully client-side tool: pick two images from your own device
(phone camera roll, Files, or disk) and compare them with `cairnPlot.compare`
— no server, no upload, no network. It reads each file into a `blob:` URL and
decodes it in-browser (browser-native PNG/JPEG plus OpenEXR/`.hdr`/`.pfm` and
float `.npy`/`.npz`). Build the bundles first (`cd ui && npm run
build:plot-inline`), then open it from disk; the GitHub Pages build inlines the
bundles into one self-contained file via
[`ui/scripts/inline-html.mjs`](ui/scripts/inline-html.mjs).

The bundles are include-once guarded and register renderers into a shared core
bootstrap, so a page carries `core` once plus only the addons its plots need.
Build them under `ui/` (a TS/React library):

```bash
cd ui
npm install
npm run build:plot-inline     # → ui/dist/plot-inline/{core,figure,three,gpu-image}.iife.js + style.css
npm run sync:plot-assets      # copy into packages/python/src/cairn_plot/_assets
```

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
npm run smoke:plot           # headless-Chromium gallery render check (Python emit)
npm run smoke:js             # headless-Chromium render check (window.cairnPlot JS face)
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
