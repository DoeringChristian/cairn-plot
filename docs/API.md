# cairn-plot public API (0.1)

This is the defined, supported surface for cairn-plot 0.1. Everything not listed
here is internal and may change without notice. Backwards-compatibility shims and
deprecated aliases were removed in the 0.1 cleanup (see
`docs/api-cleanup-inventory.md`).

There are two surfaces:
- **Python** (`cairn_plot`) — the authoring API you import in a notebook/script.
- **TypeScript / runtime** (the `ui` renderer package) — the self-contained IIFE
  bundles the Python package inlines, plus the pure-library seams a host embeds.

---

## Python — `import cairn_plot as cp`

`cp.__version__` → `"0.1.0"`.

### Composable components (capitalized)
Compose these into a recursive tree; each renders self-contained (no server, no
CDN) in a notebook via `_repr_html_`, or bakes into one offline HTML file.

| Component | What it renders |
| --- | --- |
| `cp.Line` | Line / scalar-sequence chart. `Line(y)`, `Line(y, x)`, `Line({"a": ya, "b": yb})`. |
| `cp.Scatter` | Scatter plot. `color=` maps a per-point value through `colormap=` (`viridis` · `plasma` · `magma` · `red-green` · `red-blue`; default `viridis`). |
| `cp.Bar` | Bar chart. |
| `cp.Histogram` | Histogram. |
| `cp.Heatmap` | Heatmap. `colormap=` (`viridis` · `plasma` · `magma` · `red-green` · `red-blue`; default `viridis`). |
| `cp.ParallelCoordinates` | Parallel-coordinates plot. `colormap=` colors the lines by the last column (`viridis` · `plasma` · `magma` · `red-green` · `red-blue`; default `viridis`). |
| `cp.Image` | Single image (`PIL`/ndarray/PNG-JPEG bytes, or `url=`). Float `.npy`/`.exr` → HDR renderer. |
| `cp.PointCloud` | 3D point cloud `(N,3\|4\|6)`. |
| `cp.Mesh` | 3D mesh (`vertices`/`faces`). |
| `cp.Volume` | 3D scalar grid `(D,H,W)`. |
| `cp.Boxes` | 3D axis-aligned boxes (`mins`/`maxs`). |
| `cp.Table` | Tabular data (DataFrame / list-of-dicts / list-of-rows). |
| `cp.Figure` | A Plotly `go.Figure` (e.g. from a recipe below). |

### Containers
| Container | Purpose |
| --- | --- |
| `cp.Grid` | Lay out child components in a grid (per-column widths, optional viewport/camera sync via `Shared`). |
| `cp.Compare` | Visual compare of a `prediction` against a `reference`. Flat `mode=`: view (`side` · `slide` · `blend`) or diff kernel (`signed` · `abs` · `square` · `rel_signed` · `rel_abs` · `rel_square` · `flip` · `flip_ldr` · `ssim`). `flip` is perceptual FLIP — auto-dispatched LDR-FLIP for u8 sources, HDR-FLIP (multi-exposure) for float/HDR sources; `flip_ldr` forces the tone-mapped LDR comparison on float sources. `ssim` is structural similarity (Wang et al. 2004) on linear luminance — the map shows the error field `1 − SSIM`. `flip`/`ssim` are GPU-only. `colormap=` colors the diff map. |
| `cp.Shared` | Declare shared viewport/camera sync scope for children of a `Grid`. |
| `cp.Component` | Base class for the above (subclassing seam). |

#### `cp.Compare` mismatched-size operands: `align=` / `fit=`
In diff modes, `prediction`/`reference` need not share a resolution. `align=`
and `fit=` control how they're reconciled before the diff (and its metrics —
MSE/PSNR/MAE) are computed; both are ignored outside diff modes.

| `fit=` | Meaning |
| --- | --- |
| `"crop"` (default) | Min-crop overlap: the diff/metrics are computed over the overlapping region only. |
| `"fill"` | Rescale both operands to a common grid (the primary/foreground resolution) before diffing; the diff/metrics cover the full common grid. `align=` is irrelevant under `"fill"`. |

| `align=` | Meaning |
| --- | --- |
| `"top-left"` (default) | Smaller operand anchored to the top-left of the larger, before the overlap crop. |
| `"center"` | Smaller operand centered within the larger. |
| `"top-right"` | Smaller operand anchored to the top-right. |
| `"bottom-left"` | Smaller operand anchored to the bottom-left. |
| `"bottom-right"` | Smaller operand anchored to the bottom-right. |

### Lowercase builders (return a ready `PlotElement`)
Thin fronts over the capitalized components, mirroring the `cairn.plot` surface.
Case-sensitive and distinct from the capitalized names and the recipes.

`cp.scalar(data)` · `cp.line(y, x=None, label=None)` · `cp.image(data=None, url=None)`
· `cp.figure(fig)` · `cp.table(data)` · `cp.mesh(v, faces=None)` · `cp.pointcloud(a)`
· `cp.volume(a)` · `cp.boxes(mins, maxs=None)`

Each accepts `data_mode="local"` (default; bakes data inline) — the offline,
self-contained mode. (`run[tag]` handles + endpoint mode are provided by the
separate `cairn-track` package layered on this surface.)

### Reports
- `cp.Report(title=None, template="cairn", theme="auto"|"light"|"dark")` / `cp.report(...)` — a composable, self-contained
  report. Chain `.md(...)` · `.html(...)` · `.add(component)` · `.grid(...)`; emit
  via `_repr_html_` · `.show()` · `.save(path)`.
- `cp.PlotReport` — the report class (`Report` is its ergonomic public alias).

### Elements (returned by builders / `.add`)
`cp.PlotElement` · `cp.Element` · `cp.HtmlElement` — the lowered leaf types a
report/grid composes. Construct via the builders above rather than directly.

### Pure-numpy Plotly recipe helpers (return a `plotly.graph_objects.Figure`)
Wrap in `cp.Figure(...)` / `cp.figure(...)` to render.

`cp.confusion_matrix(...)` · `cp.roc_curve(...)` · `cp.pr_curve(...)` · `cp.bar(...)`
· `cp.line_series(...)`

> Distinct from the plot builders: `cp.bar` != `cp.Bar`, `cp.line_series` !=
> `cp.line` != `cp.Line`.

### Optional dependencies
The core 2D/3D composables + reports need only `numpy` + `pydantic` + `jinja2`.
The figure recipes (Plotly) and raw-image baking (Pillow) need the `media` extra:
`pip install cairn-plot[media]`. Missing-dep paths raise a clear `ImportError`
naming that extra.

---

## TypeScript / runtime — the `ui` renderer package

The renderer package is **not published to npm**; its canonical distributable is
the set of self-contained IIFE bundles the Python package inlines. The supported
TS surface is: the bundles, their runtime `window.__cairnPlot*` seams, and the
pure-library contracts a host reuses.

### Self-contained IIFE bundles (`build:plot-inline` → `src/cairn_plot/_assets/plot-inline/`)
| File | Global | Contents / when emitted |
| --- | --- | --- |
| `core.iife.js` | `__cairnPlotCoreBundle` | 2D charts + CPU image/table renderers + the bootstrap. Emitted for every plot. No Plotly/three.js/WebGPU engine. |
| `figure.iife.js` | `__cairnPlotFigureAddon` | Plotly + the `Figure` renderer. Emitted only when a `figure` plot is present. |
| `three.iife.js` | `__cairnPlotThreeAddon` | three.js 3D renderers (mesh/volume/boxes/pointcloud). Emitted only when a 3D plot is present. |
| `gpu-image.iife.js` | `__cairnPlotGpuImageAddon` | WebGPU image backend (`GpuImagePane`) + compare. Optional; self-heals to the CPU backend on failure. |
| `style.css` | — | Shared renderer stylesheet. |

Addons cannot `import` from core; they attach at runtime via the registry seam.

### Runtime seams (`window`)
| Seam | Role |
| --- | --- |
| `__cairnPlotBootstrap(divId, descId)` | Mount one plot: div `#divId` from the descriptor JSON in `#descId`. |
| `__cairnPlotQueue` | Pre-load mount queue (GA-style `push`); drained + replaced with an immediate-mount shim once core loads. |
| `__cairnPlotRegisterRenderer(name, component)` | Core→addon seam: an addon IIFE registers its renderer by name (`"figure"`, `"image"`, 3D types). |
| `__cairnPlotBundleLoaded` | Include-once guard for core. |
| `__cairnPlotFigureLoaded` / `__cairnPlotThreeLoaded` / `__cairnPlotGpuImageLoaded` | Include-once guards per addon. |
| `__cairnPlotRenderMode` (`"cpu"\|"gpu"\|"auto"`) | Settable override for the image backend selection. |
| `__cairnPlotUseGpuImage` (`boolean`) | Escape hatch to force off the WebGPU image backend. |

### Descriptor contract
A plot is mounted from a **tree** descriptor — `{ root: PlotNode, mode?, endpoint? }`
— serialized in a `<script type="application/cairn-plot+json">` blob (schema:
`schema/cairn-plot-spec.schema.json`). The tree root form is the only accepted
shape (the pre-G1 flat form is gone). `mode: "local"` reads the page's inlined
content-addressed store; `mode: "endpoint"` fetches artifacts from a server origin.

### Renderer registry seam
`plot-registry.tsx` exposes the in-bundle registry the bootstrap and addons use:
- `registerRenderer(name, component)` — register a renderer by name.
- `getRenderer(name)` — look one up.
- `onRegister(cb)` — subscribe to registrations (leaves bounded-wait for a
  late-loading addon).

### Image-backend contract (`lib/cairn-plot/renderers/image-backend.ts`)
The one place the interchangeable image-backend contract lives. `CpuImagePane`
(2D canvas) and `GpuImagePane` (WebGPU, addon) both accept the same props and are
picked per mount by `resolveRenderMode(...)`.
- `type ImageBackendProps = HdrImageProps | SdrImageProps` — the shared prop union
  (float-HDR shape vs. 8-bit `imageUrl` shape), discriminated by the presence of `hdr`.
- `type ImageBackend = (props: ImageBackendProps) => JSX.Element`.
- `isHdrProps(props)` — the discriminant.
- `type RenderMode = "cpu" | "gpu" | "auto"`; `resolveRenderMode(explicit?)`.
- `interface HdrData` — a parsed float image buffer (`data`, `shape`, `dtype`,
  `precision?`). See the F16 pipeline below for `precision`.
- `tonemapToImageData(hdr, tonemap, exposure, gamma?, offset?)` — pure HDR-float →
  `ImageData` tone-mapper (exported from `CpuImagePane`). `offset` (default 0) is
  the TEV display offset, added after exposure (before the tone-map operator).

For a **deep** `.exr` (`deepscanline`/`deeptile`), a single-image pane also gets a
toolbar **DEPTH WINDOW** — Z-NEAR + Z-FAR sliders that live-composite only the
samples with `zNear ≤ Z ≤ zFar` (linear, or log10 when `zMax/zMin > 1e3`) — and a
**"select depth from region"** marquee button: drag a rectangle over the image and
the window snaps to the Z range the samples under it occupy (Esc cancels; an empty
region is a no-op). HOME restores the full composite. On WebGPU panes the window is
a real-time GPU composite; the CPU/non-WebGPU fallback re-flattens in wasm.

An **HDR/float** image pane (`imagehdr`) gets a leading toolbar **TONEMAP menu**
that switches the tone-map operator view-locally (SDR panes have no such menu:
their 8-bit pixels are already encoded, so there is no tone-map stage). The menu
shows the operator **actually in effect**, and HOME restores it.

**Operators** (per channel; `x` = exposure/offset-applied scene-linear light):

| Group | Operator (menu label) | Formula | Range |
|---|---|---|---|
| SDR | `linear` (Linear) | `clamp(x, 0, 1)` | → `[0,1]` |
| SDR | `srgb` (sRGB) | `clamp(x, 0, 1)`, then the sRGB OETF at output-encode | → `[0,1]` |
| SDR | `reinhard` (Reinhard) | `x / (1 + x)` | → `[0,1)` |
| SDR | `aces` (ACES) | Narkowicz `clamp((x(2.51x+0.03))/(x(2.43x+0.59)+0.14), 0, 1)` | → `[0,1]` |
| HDR | `extended` (Extended · Linear) | `x` (unclamped pass-through) | → `[0,∞)` |
| HDR | `extended-reinhard` (Extended · Reinhard) | `x/(1 + x/P)` | → `P` asymptote, slope 1 at 0 |
| HDR | `extended-aces` (Extended · ACES) | `P·aces(x·S/P)`, `S = 0.14/0.03` | → `P` asymptote, slope 1 at 0 |

The **SDR group** always shows. The **HDR group** (`extended*`) appears **only**
when the pane's true-HDR surface engages (WebGPU `rgba16float` + Chrome extended
canvas tone-mapping, on an HDR display); those operators emit display-linear
light in `[0, P]` (not `[0,1]`) that the OS compositor maps to the panel's peak.
`P` is the **PEAK** slider (×SDR white; range `1..16`, default `4`, step `0.5`),
shown only while `extended-reinhard`/`extended-aces` is selected. `S = 0.14/0.03`
normalizes Extended · ACES so its slope at 0 is exactly 1 (identity-like at low
`x`) and it saturates at `P`. (**Follow-up:** a browser-exposed display headroom,
once standardized, would seed the PEAK default.)

**Default-in-effect + fallback** (`image/tonemap.ts`'s `resolveEffectiveTonemap`,
pure + unit-tested):
- Not engaged → the descriptor's `tonemap=` coerced to SDR (`extended`→`linear`,
  `extended-reinhard`→`reinhard`, `extended-aces`→`aces`; Python default `srgb`).
- Engaged → an explicit `extended*` `tonemap=` is honored **verbatim**; any SDR /
  unset descriptor defaults to **`extended`** (Extended · Linear). Selecting an
  SDR operator on an engaged pane **tone-maps into SDR range** (previewing the
  SDR rendition on the HDR display): the render path drops `hdrOut` and runs the
  operator + output-encode.

The CPU backend never engages a real HDR surface, so it never offers the HDR
group (its `extended*` descriptors resolve to the SDR fallback). **Follow-up:**
`cp.Compare` panes (split/blend/diff of HDR sources) do not yet expose a TONEMAP
menu.

#### Half-precision (F16) HDR pipeline (`lib/cairn-plot/image/half.ts`)
An all-`HALF` EXR keeps its raw IEEE-754 **binary16 bit patterns** end-to-end
instead of widening to f32 on decode. The float payload carries a
`precision: "f32" | "f16-bits"` tag (`DecodedImage`, `HdrData`,
`CompareFloatSource`; default/absent = `"f32"`):
- `"f16-bits"` ⇒ `data` is a `Uint16Array` of half bits (2 bytes/sample); the
  pure-TS `exr.ts` reader emits it when **every** channel is `HALF` (a mix with
  any `FLOAT`/`UINT` channel stays `"f32"`).
- Upload: `GpuImagePane`/`GpuComparePane` expand RGB→RGBA **in half space**
  (alpha = `HALF_ONE` = `0x3C00`) and upload an `rgba16float` source texture
  (8 B/px vs 16 B/px for `rgba32float`). `textureLoad` yields f32 in-shader, so
  all diff/tonemap/FLIP kernel math is unchanged.
- CPU consumers widen **lazily** via `image/half.ts` — `halfToFloat` per pixel
  (TEV overlays), `f16BitsToFloat32` per frame (the CPU tone-map **fallback**
  and the FLIP reference exposure pass), preferring a native `Float16Array` when
  present, scalar fallback otherwise.
- **Deferred:** the vendored three.js worker decoder (`exr-full.ts`, the normal
  browser EXR path) still emits `"f32"`; float16 `.npy` from Python still bakes
  as f32 (`parseNpy` widens to Float64). Both are follow-ups — the plumbing
  already routes `"f16-bits"` through once those sources emit it.

The prior `HdrGpuImagePaneProps` / `SdrGpuImagePaneProps` names and the
`GpuImagePaneProps` / `ImageRenderProps` aliases were removed — use the canonical
names above.

### Pure library barrel (`lib/cairn-plot/index.ts`)
The library barrel re-exports the pure renderers (`ScatterPlot`, `BarChart`,
`ScalarPlot`, `Heatmap`, `HistogramPlot`, `ParallelCoords`, `Table`,
`PointCloudViewer`, `CpuImagePane`, `ImageOverlay`), the media-compare core, the
viewport contract, colormaps, tonemap operators, transforms, and the image-backend
contract above. (`Figure` is intentionally *not* re-exported here — import it from
`renderers/Figure` so Plotly stays out of the eager chunk.) These are stable for
in-repo composition and the `cairn` monorepo submodule consumer.
