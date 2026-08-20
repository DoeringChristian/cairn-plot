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
| `cp.Scatter` | Scatter plot. `color=` maps a per-point value through `colormap=` (`plasma` · `magma` · `turbo` · `red-green` · `red-blue`; default `turbo`). |
| `cp.Bar` | Bar chart. |
| `cp.Histogram` | Histogram. |
| `cp.Heatmap` | Heatmap. `colormap=` (`plasma` · `magma` · `turbo` · `red-green` · `red-blue`; default `turbo`). |
| `cp.ParallelCoordinates` | Parallel-coordinates plot. `colormap=` colors the lines by the last column (`plasma` · `magma` · `turbo` · `red-green` · `red-blue`; default `turbo`). |
| `cp.Image` | Single image (`PIL`/ndarray/PNG-JPEG bytes, or `url=`). Float `.npy`/`.exr` → HDR renderer. `label=` adds a bottom-left caption (and, as a `cp.Compare` operand, captions its side). |
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
MSE/PSNR/MAE/SSIM) are computed; both are ignored outside diff modes.

The compare pane's metrics chip reads **MSE · PSNR · MAE · SSIM** in every mode
(not only the `ssim` kernel). SSIM is the mean structural similarity (mean of
`SSIM = 1 − (1 − SSIM)`) over the same mapped/compared region as the other
metrics — `1.0000` for identical inputs. All are source-data metrics: they track
the sources and the align/fit region, and are unaffected by EV/offset/colormap or
which diff kernel is displayed.

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

`cp.scalar(data)` · `cp.line(y, x=None, label=None)` · `cp.image(data=None, url=None, label=None)`
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

## HTML / JS builder surface — `window.cairnPlot`

The core bundle (`core.iife.js`) installs `window.cairnPlot`, a first-class JS
builder surface that mirrors the Python `cairn_plot` builders one-to-one. It is
also ESM-exported (`import { cairnPlot, createCairnPlot } from ".../builder"`).
Author a page entirely in JavaScript; the descriptor it lowers to is identical
to the Python emit's, validated by the same
[`schema/cairn-plot-contracts.json`](../schema/cairn-plot-contracts.json).

### Builders
Each returns a **handle** with `.mount(elOrSelector)` and `.toElement()`
(a detached `<div>`); `.descriptor` / `.node` / `.store` / `.runtime` expose the
lowered data.

| Builder | Signature | Python twin |
| --- | --- | --- |
| `cairnPlot.line` | `line(y \| {name: y}, x?, { label })` | `cp.Line` |
| `cairnPlot.scatter` | `scatter(xs, ys, { color, colormap, labels, xLabel, yLabel, colorLabel, xLog, yLog })` | `cp.Scatter` |
| `cairnPlot.bar` | `bar(values, { labels, colors, valueLabel, logX })` | `cp.Bar` |
| `cairnPlot.histogram` | `histogram(x?, { bins, counts, edges, logY })` | `cp.Histogram` |
| `cairnPlot.heatmap` | `heatmap(z, { colormap, zmin, zmax, logColor, originTop, xLabel, yLabel, valueLabel })` | `cp.Heatmap` |
| `cairnPlot.parallelCoordinates` | `parallelCoordinates(dimensions, { colormap })` | `cp.ParallelCoordinates` |
| `cairnPlot.image` | `image(data, { shape, hdr, tonemap, exposure, gamma, peak, colormap, interpolation, showAxes, brightness, contrast, offset, flipSign, pixelValueNotation, toolbar })` | `cp.Image` |
| `cairnPlot.table` | `table(rows \| { cols })` | `cp.Table` |
| `cairnPlot.compare` | `compare(a, b, { mode, colormap, align, fit, splitPosition, blendAlpha, toolbar, ... })` | `cp.Compare` |
| `cairnPlot.grid` | `grid([[...handles]], { cols, colWidths, rowHeights, gap, shared })` | `cp.Grid` |
| `cairnPlot.mesh` / `.pointcloud` / `.volume` / `.boxes` | `(...)` — **throw** a clear error naming `three.iife.js` when the three.js addon isn't loaded (registry-gated; JS 3D data baking is a follow-up — bake via Python for now). | `cp.Mesh` / … |

`image(data, ...)` routing (JS-idiomatic; same validation rules as Python):
- a numeric buffer (`Float32Array` / `Float64Array` / `Uint16Array` f16 bits /
  nested number arrays) → the **float-HDR** path (`imagehdr` renderer). A flat
  TypedArray needs `{ shape: [H, W(, C)] }`; nested arrays infer it. The buffer
  rides **by reference** through the runtime store — no `.npy` encode, no base64.
- encoded container bytes (`ArrayBuffer` / `Uint8Array`) → an 8-bit `image`,
  served as a `blob:` URL (no base64);
- `ImageData` / `<canvas>` → an 8-bit `image` (canvas → data URL, the one encode);
- `{ url }` (or a URL string) → a `url` DataSpec verbatim, or the fetch+decode
  `image.url` seam for `.exr`/`.npy`/`.npz` (or `{ hdr: true }`).

The allowed `colormap` / `tonemap` / compare `mode` sets are the same
cross-language contract Python enforces; bad values throw the same way.

### Jeri → cairnPlot migration
[Jeri](https://github.com/tomseago/jeri)'s `renderViewer(el, { image })` — an
HDR image viewer keyed by a Float32Array + shape — maps directly onto
`cairnPlot.image`:

```js
// Jeri
import { renderViewer } from "jeri";
renderViewer(document.getElementById("view"), {
  image: { data: floats, width: W, height: H, channels: 3 },
});

// cairnPlot — the Float32Array rides by reference, tone-mapped client-side
window.cairnPlot
  .image(floats, { shape: [H, W, 3], tonemap: "aces", exposure: 0 })
  .mount("#view");

// A/B comparison (Jeri's two-image diff) → cairnPlot.compare:
window.cairnPlot
  .compare(
    window.cairnPlot.image(refFloats, { shape: [H, W, 3] }),
    window.cairnPlot.image(predFloats, { shape: [H, W, 3] }),
    { mode: "abs", colormap: "magma" },
  )
  .mount("#diff");
```

Unlike Jeri, the pane ships the full cairn-plot toolbar (tone-map menu, exposure,
zoom/pan, TEV-style pixel readout, and the compare mode/kernel switcher).

### Runtime store (zero-base64 seam)
JS-provided data is registered in an in-memory `window.__cairnPlotRuntimeStore`
(hash → `{ kind: "bytes", bytes, mime }` or `{ kind: "float", data, shape, dtype,
precision }`). `createLocalDataSource` consults it **before** the base64 store, so
the committed descriptor schema is untouched (a runtime hash is an opaque string).
A float buffer routes straight into the `imagehdr` `hdr` prop by reference. See
[`lib/cairn-plot/viewport/runtime-store.ts`](../ui/src/lib/cairn-plot/viewport/runtime-store.ts).

> Out of scope (follow-up): a tabs/selector container, and JS-side 3D data baking
> (the 3D builders gate on the three addon but leave data baking to Python).

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
| `cairnPlot` | The JS builder surface (`cairnPlot.line(...)` etc.) — installed by core; mirrors the Python `cairn_plot` builders. |
| `__cairnPlotMountObject(el, descriptor, { store, runtime })` | Render a descriptor OBJECT into `el` (the seam `PlotHandle.mount`/`.toElement` render through); registers the base64 store + in-memory runtime entries first. |
| `__cairnPlotRuntimeStore` | In-memory `Map<hash, RuntimeStoreEntry>` for JS-provided data (bytes/float) — consulted before the base64 store, zero base64. |
| `__cairnPlotHasRenderer(name)` | Read companion to `__cairnPlotRegisterRenderer` — the builder's 3D gate uses it to tell "three addon loaded" from "missing". |
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

**Live / redirecting URLs are content-addressed via the final URL.** A `url`
DataSpec (or `cp.Image(url=…)`) may point at a *live query URL* whose bytes
change over time — a server endpoint that `302`-redirects to a
content-addressed blob (e.g. `/api/query?run=latest&tag=…` → `/api/artifacts/{digest}`).
The image/diff caches key on the URL string, so before a URL reaches the panes
it is resolved to its **final post-redirect URL** (`res.url`, the digest) via
`resolveFinalUrl` (`lib/cairn-plot/image/final-url.ts`). Two "latest" resolutions
that land on different digests therefore get different cache identities (no stale
pixels); identical content across queries shares one digest (free dedup). A
non-redirecting or `data:`/`blob:` URL resolves to itself (unchanged), and a
CORS-blocked probe falls back to the raw URL so cross-origin `<img src>` rendering
still works.

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
the window snaps to the Z range the samples under it occupy (Esc cancels). The rect
persists as an editable overlay anchored in image space (move/resize re-query the
window live; the top-right × removes it). It's placeable anywhere — an empty region
selects an EMPTY window (transparent; sliders show a crossed state). HOME restores
the full composite. On WebGPU panes the window is a real-time GPU composite; the
CPU/non-WebGPU fallback re-flattens in wasm.

An **HDR/float** image pane (`imagehdr`) gets a leading toolbar **TONEMAP menu**
that switches the tone-map operator view-locally. The menu shows the operator
**actually in effect**, and HOME restores it. An **SDR/8-bit** image pane (plain
path, no colormap) gets the **SAME unified 5-operator TONEMAP menu** — *unified no
matter what the input data was* — plus the **PEAK** slider when the HDR surface
engages: the WebGPU pane sRGB-DECODEs the 8-bit source to scene-linear first, so
`reinhard`/`aces` are meaningful post-decode and `P > 1` pushes an `EV+n` 8-bit
image genuinely past SDR white on a real HDR display (verified by the GPU harness:
a `255`-white pixel at `EV+1` under an extended operator encodes above SDR white).
It appears only on the plain path — a **colormap** SDR image is already false-
colored / display-ready, so it is never re-encoded. `cp.Image(..., gamma=)` on an
8-bit source feeds the **operator γ** (the Gamma display transfer), DISTINCT from
the 8-bit CSS-filter `processing.gamma` (a separate legacy brightness-style knob),
so a value is never applied twice. The pure `sRGB · Gamma · Linear` display-
transfer subset (contract `displayTransfers`) survives only on the **CPU** backend
menu — the P=1 hardware exception below.

**Unified surface — pick a curve, pick a ceiling.** There is ONE operator menu
(`linear · srgb · gamma · reinhard · aces · normal`, where `normal` remaps a
signed normal map `[-1,1] → [0,1]` per channel for inspecting normal maps) and
the **PEAK** slider `P` is the
**mode**: every operator respects `P` as its ceiling, so *the only difference
between SDR and HDR is where you clip*. **SDR is just `P = 1`**; `P > 1` extends
onto a real HDR surface; `P = ∞` (double-click the PEAK read-out and type `inf`)
hands the raw value to the browser. The old two-group menu (an "Extended · *"
duplicate of each curve) is **gone** — that duplication is exactly what the
`P = 1` invariant exists to kill.

**Operators** (per channel; `x` = exposure/offset-applied scene-linear light; the
range-map clips at `P`, then the output-encode transfer runs):

| Operator (menu label) | Range-map (ceiling `P`) | Encode transfer | `P = 1` (SDR) |
|---|---|---|---|
| `linear` (Linear) | `clamp(x, 0, P)` | identity (raw linear) | `clamp(x,0,1)` |
| `srgb` (sRGB) | `clamp(x, 0, P)` | (extended) sRGB OETF | `clamp01` then sRGB OETF |
| `gamma` (Gamma) | `clamp(x, 0, P)` | `sign·|x|^(1/γ)` (γ default 2.2, slider ~0.5–4) | `pow(clamp01(x), 1/γ)` |
| `reinhard` (Reinhard) | `x / (1 + x/P)` | (extended) sRGB OETF | `x/(1+x)` |
| `aces` (ACES) | `P·aces(x/P)` (Narkowicz) | (extended) sRGB OETF | `aces(x)` |

**Operator-family invariant.** Each operator is ONE peak-parameterized curve, and
its SDR rendition IS the same curve at `P = 1`. `aces = P·aces(x/P)` is reworked
so `aces(x, P=1) ≡ aces(x)` **exactly** (the old `P·aces(x·S/P)`, `S=0.14/0.03`,
slope-1 normalization broke this). Locked by `image/tonemap.ts`'s
`resolveRenderTonemap` P=1-equivalence goldens and inherited by the GPU↔CPU parity
harness. The Gamma display golden at `P=1`: `0.5^(1/2.2) ≈ 0.7297` (distinct from
sRGB's `0.5 → 0.7354` — a 2.2 power curve only approximates the sRGB OETF); at
`P>1`, above-white survives — `gamma`, `x=4`, `P=8` → `4^(1/2.2) ≈ 1.878` (an
encoded value **above 1** the HDR canvas renders as extended brightness).

**PEAK (`P`, the HDR mode).** Slider ×SDR white; range `1..16`, default `4`, step
`0.5`; shown **whenever the real HDR surface engages** (Linear/sRGB/Gamma
hard-clip at `P`; Reinhard/ACES roll off toward `P`). Double-click to type any
value, including `inf`. `P = ∞` makes Linear/sRGB/Gamma **raw browser-clipped
extended** (each browser clips at its own headroom estimate — the *same* image
then renders differently in Chrome vs Safari); Reinhard degenerates to
pass-through; ACES has no meaningful `∞` (`P·aces(x/P) → 0`), so its ceiling
clamps to the slider max. Finite `P > 1` clips in **cairn-plot's own shader**
(GPU↔CPU parity-tested), so every HDR browser converges below `P` — the managed,
deterministic choice. On a **non-HDR surface** PEAK is hidden and `P` is forced
to 1: the same operators, SDR by construction (this IS the degrade rule).
(**Follow-up:** a browser-exposed display headroom, once standardized, would seed
the PEAK default; see `docs/browser-support.md`.)

**Default-in-effect** (`image/tonemap.ts`'s `resolveEffectiveTonemap` +
`resolveRenderTonemap`, pure + unit-tested): an explicit `tonemap=` is honored
(canonicalized to one of the 5). An **unset** `tonemap=` defaults by surface —
**Linear with the managed PEAK (`P = 4`)** on an engaged HDR surface (this
**replaces** the pre-unification raw-`extended` default; type `P = inf` to recover
the raw browser-clipped look), and **sRGB** on SDR (the bit-exact 8-bit
round-trip). `peak=` (a float) seeds the slider; unset → `1` on SDR / `4` on HDR.

**Deprecated aliases.** The pre-unification `tonemap=` names still validate and
resolve to a `(operator, peak)` pair (so old code keeps working): `extended` →
`linear` + `P=∞`; `extended-clamp` → `linear`; `extended-reinhard` → `reinhard`;
`extended-aces` → `aces`; `extended-gamma` → `gamma`. They are contract-listed as
`tonemapOperatorAliases` (distinct from the canonical 5 `tonemapOperators`).

**CPU backend — the P=1 hardware exception.** The 2D-canvas backend cannot emit
extended output (a `<canvas>` 2D context has no HDR/`rgba16float` surface), so it
is ALWAYS the SDR rendition (`P = 1`, no PEAK slider) — the one hardware-truth
exception to the unified model. Its capability notice never mislabels this: the
`no-hdr-*` notices are reported only from the WebGPU pane (a resolved
`getSharedDevice()`), and a WebGPU-less page renders the CPU pane, which reports
nothing. A `peak > 1` requested on a CPU-rendered SDR source degrades to the
clamped SDR look there while the WebGPU backend extends it.

**`cp.Compare` panes — unified tone-map (§A).** The engine-backed compare pane's
**slide / split / blend** modes now expose the SAME unified TONEMAP menu + PEAK/γ
sliders as the single-image pane, wired through the SAME `resolveEffectiveTonemap`
/ `resolveRenderTonemap` + HOME contract. Both operands run through ONE display
mapping in the compose shader (each u8 side sRGB-DECODED to scene-linear per side,
so mixed u8/float operands compare in linear light), and the pane engages the
extended `rgba16float` surface (probed exactly like the single-image pane) when
the browser + display support it. **DIFF** modes keep the menu **hidden** — a
derived error map routes through **colormaps**, not a tone-map operator (error
values aren't light). **Side** mode is two independent single-image panes, which
already carry the menu. Parity: a slide compose with an operator applied is
byte-identical to a single-pane render of the same operand (GPU harness,
`renderCompose(split:0) === renderImage`).

### Host-controlled panes (`toolbar=` + the controlled-props contract)

A host (e.g. cairn) can hide a pane's `PlotToolbar` and drive the whole view from
its **own** menu. `cp.Image(toolbar=False)` / `cp.Compare(toolbar=False)` (and the
JS `image(data, { toolbar:false })` / `compare(a, b, { toolbar:false })`) emit
`props.toolbar = false`; the default `True` is omitted (minimal descriptor). The
flag is a validated bool and rides the shared `ImageBackendProps.toolbar` seam, so
**both panes** (`CpuImagePane`, `GpuImagePane` — the ONE unified pane for images
AND every compare mode) hide it identically.

**Hidden-toolbar convention.** With `toolbar=false` the shell (`ImagePaneShell`)
renders **no `PlotToolbar` and no hover `group`**; the ONLY floating affordance
kept is the pixel-notation toggle chip (`0–255 ⇄ 0–1`), and only while the TEV
pixel-value overlay is active. Zoom/pan (wheel + drag), the double-click HOME
reset, and the TEV overlay all keep working — the toolbar was chrome, not the
interaction. This is the long-standing CPU-pane convention, now unified across
every backend and formalized as the host seam.

**Controlled-props contract (the host-menu surface).** With the toolbar gone, the
host drives every control by *setting the descriptor prop*; each pane RE-SEEDS
from its prop on change, so the prop is the controlled value:

| Control | Prop (all shapes) | How it's controlled | Notes |
|---|---|---|---|
| Colormap | `colormap` | re-seeds view-local override | image (SDR) + compare (diff LUT) |
| Tone-map operator | `tonemap` | re-seeds (follow-default) | unified 5-operator set |
| Peak (HDR ceiling `P`) | `peak` | re-seeds view-local | shown only on an engaged HDR surface |
| Gamma (γ) | `gamma` | re-seeds view-local | the Gamma operator's exponent |
| Base exposure (EV) | `exposure` | read straight from props | render EV = `exposure` + toolbar slider (additive; HOME zeroes only the slider) |
| Base offset | `offset` | read straight from props | render offset = `offset` + toolbar slider (additive) |
| Compare mode | `mode` / view-mode | re-seeds + `onCompareModeChange` | side · slide · blend · diff |
| Diff kernel | `diffSubmode` / `diffKernel` | re-seeds + `onDiffKernelChange` | the pointwise ids + `flip`/`ssim` |
| Split position | `splitPosition` | controlled + `onSplitPositionChange` | slide mode |
| Blend alpha | `blendAlpha` | controlled | blend mode |
| Interpolation / axes / notation | `interpolation` / `showAxes` / `pixelValueNotation` | read straight from props | — |

Notes on EV/offset: the toolbar's **EV/OFF sliders are additive runtime
adjustments** layered on the controlled base `exposure`/`offset`; HOME resets only
the slider (to 0), so the descriptor base persists. With the toolbar hidden the
host sets EV/offset entirely through `exposure`/`offset`. The **CPU 2D-canvas**
plain-`<img>` SDR path has no scene-linear recompute stage, so it does NOT apply
base EV/offset there (documented graceful degradation — the WebGPU backend and the
CPU HDR tone-map path both do); a colormapped SDR pane forces a raw passthrough, so
EV/offset don't apply there either. Deep-EXR depth sliders + region-select are
**data-driven** (present only for a deep source), not host-menu controls.

#### Half-precision (F16) HDR pipeline (`lib/cairn-plot/image/half.ts`)
An all-`HALF` EXR keeps its raw IEEE-754 **binary16 bit patterns** end-to-end
instead of widening to f32 on decode. The float payload carries a
`precision: "f32" | "f16-bits"` tag (`DecodedImage`, `HdrData`,
`CompareFloatSource`; default/absent = `"f32"`):
- `"f16-bits"` ⇒ `data` is a `Uint16Array` of half bits (2 bytes/sample); the
  pure-TS `exr.ts` reader emits it when **every** channel is `HALF` (a mix with
  any `FLOAT`/`UINT` channel stays `"f32"`).
- Upload: the unified `GpuImagePane` (image AND compare) expands RGB→RGBA **in
  half space** (alpha = `HALF_ONE` = `0x3C00`) and uploads an `rgba16float` source texture
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

#### media-compare seams (`lib/cairn-plot/media-compare`)
The unified visual-media comparison core. A host card supplies the app bindings
(react-query fetching, run/series identity, persistence); cairn-plot owns the
renderer-shaped seams below, all reachable from the pure barrel:

- **Reference resolution** — `resolveArtifactAtStep`, `resolveArtifactPointAtStep`
  (point-returning sibling, for metadata reads), `resolveGlobalPositionalReference`,
  and `resolveReferenceHashes(policy, data, ctx)`: the pure global-vs-per-run +
  external + series-same-step DISPATCH (the app hook fetches candidate data, then
  hands it here to decide which reference each pane shows).
  Types: `ReferenceResolutionPolicy` · `ReferenceResolutionData` ·
  `ReferenceResolutionContext` · `ResolvedReferenceHashes` · `MissingArtifactMode`.
- **Compare settings** — `MediaCompareSettings` (the renderer-owned subset of a
  card's persisted settings; a host intersects it with its own app-typed fields),
  `DEFAULT_MEDIA_COMPARE_SETTINGS`, the labelled option lists
  (`CORE_COMPARE_MODE_OPTIONS`, `DIFF_SUBMODE_OPTIONS`, `PIXEL_DIFF_COLORMAP_OPTIONS`,
  `DIFF_COLORMAP_OPTIONS`), and `enumerateCompareModeOptions(caps, extras?)` — "list
  the valid compare modes for these capabilities" (core kinds + capability-gated
  native kinds, and — when `extras.engineKernels` is supplied — the ENGINE diff
  KERNELS, GPU-gated by `extras.gpuAvailable`). The kernel list is passed IN by the
  caller (from the gpu-image addon's `listDiffMenuModes()` / the
  `window.__cairnPlotDiffMenuModes` list), so this module stays engine-free like
  `compare-mode-menu.ts`; each engine option is flagged `kernel: true` (and
  `disabled` when the GPU is unavailable) so a settings panel can enumerate the
  FULL set. The form UI stays host-side.
- **Offscreen compare** — `useOffscreenSnapshot` (live `<canvas>` → coalesced PNG
  data URL) and `OffscreenComparePanes` (renders two hidden 3D mirrors into the ONE
  shared compositor, camera-sync + orbit/zoom overlay; parameterized by a
  caller-supplied `render` callback per side). `OffscreenComparePanes` imports
  `three`, so its runtime value is **not** re-exported through the barrel (which is
  core-reachable, and core ships no three) — import it directly from
  `media-compare/OffscreenComparePanes`; only its types cross the barrel.
- **Cross-type bridge** — `hasForeignFrameBridge(objectType, loaders)` +
  `CrossTypeForeignFrame` (renders a foreign 3D type's reference off-screen to a
  `FrameSource` for image↔3D compare). The per-type loader registry is injected by
  the host via `ForeignFrameLoaders`; cairn-plot hard-codes no app chunk paths.
- **Cross-type diff alignment** — `alignFrameSourcesForDiff` resamples + letterboxes
  two mismatched-size frames onto one raster before the pixel-diff pipeline.

#### Viewport adapter — HDR float artifacts (`lib/cairn-plot/viewport/data-sources.ts`)
The image `ViewportModule` turns per-pane artifact hashes into render-ready
`ImageViewportItem`s. Two resolvers share ONE decode seam:

- `resolveImageViewportItems(args, source, parseOverlay)` — the synchronous
  hash → `{ url, overlay }` mapping (an `<img src>` URL, no fetch). Unchanged.
- `resolveImageViewportItemsAsync(args, source, parseOverlay)` — the **async,
  float-aware** superset. For any pane whose URL/MIME sniffs to a raw-buffer
  format (`.exr` / float `.npy` — detect from `args.mimes`/`args.referenceMimes`,
  the host's `artifact_mime`, else the URL extension + magic bytes) it fetches
  (via `source.bytes`) and decodes, attaching a decoded
  `float: CompareFloatSource` to the item (`ImageViewportItem.float`) and
  clearing its `url`. Browser-native panes (png/jpeg/…) and extension-less URLs
  pass through UNCHANGED (no extra fetch/decode), so it is a strict superset a
  host adopts to get true-HDR panes/compare (rgba16float, HDR-FLIP
  auto-dispatch, tonemap menu).

The decode itself is the shared `decodeImageSource({ url?, bytes?, mime? })` →
`{ url, float? }` seam (also consumed by `plot-node.tsx`'s `resolveFrame`): fetch
(redirect-following; the final URL is the diff-cache content key), sniff via
`decodeImage`, and route `f32` → a `CompareFloatSource` vs `u8` → a PNG `data:`
URL. `decodedFloatToCompareSource(decoded, contentKey)` is the pure
`DecodedImage` (f32) → `CompareFloatSource` map (carries the `precision` tag);
`isFloatCandidateArtifact({ url?, mime? })` is the raw-buffer-format detection
gate. `ImageViewportPane` threads `imageFloat`/`baselineFloat` (explicit props,
else the item's own `float`) to `CompositeMediaPane`, plus the compare-kernel
callbacks `diffKernel` · `onDiffKernelChange` · `onCompareModeChange` ·
`onRequestSide` (all new on `ViewportPaneProps`) so a host can persist the diff
kernel choice.

#### Auto image-interpolation threshold (`lib/cairn-plot/renderers/interp-auto.ts`)
Both image backends snap magnification to nearest/pixelated at the SAME zoom —
once one source texel covers `PIXEL_VALUE_MIN_SCREEN_PX` screen px (the point
`PixelValueOverlay` starts drawing per-pixel numbers). `GpuImagePane` flips its
sampler `nearest`/`linear`; `CpuImagePane` now flips CSS `image-rendering`
`pixelated`/default via the shared pure rule `autoImageRendering(screenPxPerTexel,
threshold)` + `containScreenPxPerTexel(box, naturalW, naturalH)`. The threshold
is passed in (the ONE `PIXEL_VALUE_MIN_SCREEN_PX` constant both panes import),
not duplicated. Applies to both the SDR and HDR CPU branches; an explicit
`pixelated`/`crisp-edges` bypasses it.
