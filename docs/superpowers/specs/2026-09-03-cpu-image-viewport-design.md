# Image panes: one viewport geometry, CPU viewport canvas

Status: v2 DRAFT (2026-09-03). v1 was reviewed by six independent read-only
reviews (performance, architecture, geometry, tests, compare paths, cairn
integration); every finding below marked "review" comes from those.
Owner: cairn-plot. Consumer: cairn (submodule `vendor/cairn-plot`).

## 1. Problem

The CPU image backend zooms by applying `translate(pan) scale(zoom)` to a
wrapper. Inside it the image surface (`<img>` or a native-resolution
`<canvas>`) sits at its object-contain home rect, which is usually fractional
(a 512x512 image in a 642x277.5 pane has a home left edge of 182.25 px).
Chrome snaps element positions to whole device pixels before it applies the
transform. At device pixel ratio 2 the 182.25 px edge becomes 364.5 device
pixels, snaps to 365, and the paint lands 0.25 CSS px right of where layout
says it is. The zoom multiplies that error: at zoom 242 the painted pixels sit
60 px right of the DOM box.

Every other layer (pixel-value labels, region marquee, histogram cursor) is
computed from exact numbers, so all of them disagree with the paint by a
constant fraction of a texel. Measured on 2026-09-03 in the cairn `eval.error`
card: label centroids matched the DOM box within 0.7 px, the paint was 60 px
off, and setting the edge to a whole pixel made both coincide.

Five commits on 2026-09-03 corrected label placement math and could not fix
this, because the labels were never wrong. Any design that magnifies
fractional layout with a CSS transform has the flaw. The GPU backend is immune
because it paints into a canvas whose backing store is sized in device pixels.

Review findings that widen the problem beyond the paint:

- The shell measures two different boxes for one coordinate space. Gestures,
  reframe-on-resize, and zoom-about-cursor measure the padded viewport element;
  paint and the label overlay measure the inner wrapper. The GPU pane escapes
  only because its padding is zero.
- Seven `ResizeObserver`s watch the same pane element, each feeding its own
  state and its own copy of the fit math (three copies of `min(box/natural)`).
- The CPU split compare nests two full shells and duplicates the toolbar.
- The label overlay sizes its backing store from integer `clientWidth`, so on
  fractional boxes it drifts up to one device pixel against the paint on both
  backends.
- The explicit `interpolation` prop is honoured on CPU and ignored on GPU.

## 2. Goals and non-goals

Goals:

- Painted texels and every derived layer agree to sub-pixel precision at any
  zoom, on both backends, by construction: one measured viewport element, one
  geometry value, one backing-store rule.
- One geometry module consumed by paint, labels, marquee, persisted region
  rect, histogram cursor, and the box/mask overlay, on both backends.
- The shell contract has no backend-specific props; the only remaining branch
  is per presentation mode (single image versus split), not per backend.
- Per-frame cost during pan, zoom, and card resize is no higher than today;
  native-resolution work never runs per frame; count-based harness proof.
- Remove the image-viewer pixel axes feature (user ruling).
- Remove every CSS-transform image path (`MediaComparePane` included).

Non-goals:

- No change to decode, tone-map, colormap, diff, or metric computation.
- No change to gesture math (`useImageGestures`, `reframeViewForResize`); they
  already assume `screen = pan + zoom * world` about the viewport origin.
- No change to the WGSL shaders or the WebGPU pool.
- No new authored settings or spec fields.
- The cairn-side session notification per pane per resize frame stays as is.

## 3. Design

### 3.1 Geometry module (components/region-select.ts)

`region-select.ts` already declares itself the one primitive behind every
screen-to-texel mapping and owns `computeFit`. The viewport composition joins
it (review: a sibling module in `runtime/` would be a second mapping module
and a `runtime -> components` edge whose only purpose is the fit primitive):

```ts
viewToUvRect(view, box, naturalW, naturalH)    // moved from webgpu/view.tsx
viewToQuad(view, box, naturalW, naturalH)      // new
screenPxPerTexel(uv, box, naturalW, naturalH)  // moved from webgpu/view.tsx
magnificationFilter(interpolation, pxPerTexel) // "nearest" | "linear"
```

With `S = min(W/N, H/M)`, `L = (W - N*S)/2`, `T = (H - M*S)/2`:

```
quad.left = pan.x + zoom*L      quad.width  = zoom*N*S
quad.top  = pan.y + zoom*T      quad.height = zoom*M*S
uv.x = -L/(N*S) - pan.x/(zoom*N*S)    uv.w = W/(zoom*N*S)   (same for y)
```

The geometry review proved algebraically that `computeSourceFit` applied to
`viewToUvRect` returns exactly `viewToQuad` (`scale' = zoom*S`, `imgLeft' = 0`,
`quadLeft' = quad.left`), and measured double-precision round-trip error of
1e-11 CSS px at the cairn viewport and 2e-8 at the adaptive maximum zoom. The
unit test asserts the inverse with a relative tolerance of `1e-9 * |pan|`.

`magnificationFilter` is the one interpolation rule for both backends: an
explicit `"pixelated"`/`"crisp-edges"` gives nearest, `"auto"` gives nearest
at or above `PIXEL_VALUE_MIN_SCREEN_PX` and linear below. It replaces
`autoImageRendering` and `containScreenPxPerTexel` in `interp-auto.ts`, which
are deleted with their test. CSS `image-rendering` is no longer set on any
image canvas; the GPU sampler and the CPU `imageSmoothingEnabled` flag both
come from this function, which closes the explicit-prop divergence.

### 3.2 Viewport hook (components/use-image-viewport.ts)

One hook, used by both backends, owns measurement and derived geometry:

```ts
useImageViewport({ viewportRef, zoom, pan, naturalDims, interpolation })
  -> ImageViewport | null   // null until measured and dims are known

interface ImageViewport {
  box: { width: number; height: number };        // fractional CSS px
  backing: { width: number; height: number };    // device px, see below
  dpr: number;                                   // backing / box
  uv: SourceWindow;                              // viewToUvRect
  quad: { left, top, width, height };            // viewToQuad, CSS px
  pxPerTexel: number;
  filter: "nearest" | "linear";
}
```

It owns exactly one `ResizeObserver` on the viewport element, observing
`device-pixel-content-box` where the browser supports it (Chrome 84+,
Firefox 93+) and falling back to `Math.round(rect * devicePixelRatio)` from
`getBoundingClientRect` (never `clientWidth`). It performs the synchronous
first measure the way `useContainerSize` does, subscribes to
`useDevicePixelRatio`, and memoizes the result on
`(box, backing, zoom, pan.x, pan.y, naturalW, naturalH, interpolation)` so
consumers receive a stable object and never resubscribe observers per frame
(review: the current `displayGeometry` literal makes `PixelValueOverlay`
disconnect and re-observe every frame, drawing labels twice).

Both canvases in a pane (presentation and label overlay) are `absolute inset-0`
of the same viewport element, so they receive identical device-pixel snapping;
sizing both from `viewport.backing` makes paint and labels agree by
construction. The residual against pointer coordinates is at most half a
device pixel and does not scale with zoom.

### 3.3 Shell: one viewport element, one geometry prop

`ImagePaneShell` changes:

- One viewport element. The shell's inset (4 px) is padding on the shell body
  around the viewport, never on it. The viewport element carries the
  checkerboard, `overflow-hidden`, the pointer handlers, `data-*-image-surface`,
  and is the single ref that gestures, reframe, controller, hook, and every
  overlay measure. `wrapperRef`, `wrapperStyle`, `wrapperClassName`,
  `checkerboard`, `viewportPadding`, and `showAxes` are removed. No
  `flushViewport`: the split divider measures its parent, so an inset outside
  the viewport cannot desync it from the shader split.
- One `viewport: ImageViewport | null` prop from the backend replaces
  `displayElRef`, `sourceWindow`, `hasSource`, and `displayGeometry` on the
  overlay spec. The shell forwards it to `PixelValueOverlay`,
  `RegionSelectLayer`, `RegionRectOverlay`, the histogram cursor, and the
  box/mask overlay. Measure-then-render is `if (!viewport) return`.
- The shell renders `ImageOverlay` itself from `overlay`/`overlaySettings`
  props (today three identical copies in the backends).
- `header` is removed (see 3.5). `requestRender` becomes required; both
  backends can repaint synchronously.
- The shell publishes `data-cairn-view-zoom` and `data-cairn-view-pan` on the
  viewport element, and the presentation canvases carry
  `data-cpu-image-canvas` / `data-gpu-image-canvas`, the label canvas
  `data-pixel-value-overlay`. These are the backend-agnostic hooks the
  harnesses use instead of `<img>` and transform-string probes.
- The overlay spec keeps its `render` variant for per-side split overlays;
  after 3.6 both backends use it in split mode, so it is a mode branch.

`PixelValueOverlay` takes `viewport` instead of `imageElRef`/`sourceWindow`/
`displayGeometry`. It sizes from `viewport.backing`, draws with
`setTransform(backing.w/box.w, 0, 0, backing.h/box.h, 0, 0)`, and derives the
quad from `viewport.quad` directly; `computeSourceFit` remains for the
mismatched-resolution `sourceDims` case. Its ResizeObserver is removed; the
hook is the only observer.

### 3.4 CPU backend: content hook and one presentation canvas

`cpu/view.tsx` splits into two responsibilities.

`useCpuContent(props)` resolves exactly one pipeline for the current props and
returns `{ source: CanvasImageSource | null; version: number; dims }`. The
pipelines are today's effects unchanged in what they compute (plain decode,
SDR display transfer, false-color, uint8 diff, HDR tone-map, comparison error
map), keyed on the same scalar display parameters as today and never on
viewport, box, or DPR. Rules:

- Sources are native-resolution `ImageBitmap`s created once per content
  version (`createImageBitmap(imageData)`), stored through the existing
  decoded resource cache keyed by content plus display parameters, so a
  remount (cairn detail modal, comparison template switch) is one `drawImage`
  and not a re-decode. Source canvases are never read back and never created
  with `willReadFrequently`, so Chrome keeps them accelerated.
- The plain SDR path decodes through `loadImageData` (already used for label
  values) into a bitmap; no `<img>` element remains.
- `processing` (brightness, contrast, gamma, offset, flip) is applied in the
  same per-pixel ImageData stage as the display transfer, matching the GPU
  shader. `useGammaFilter`, `GammaFilterSvg`, and the shell `header` slot are
  deleted (review: CSS/SVG filters on the surface were a second display
  mechanism and the reason the shell had a CPU-only prop).
- Split mode returns two sources (reference, foreground) with their dims.

`CpuImagePane` mounts one visible `<canvas>` that is `absolute inset-0` of the
viewport element and paints in a layout effect keyed on
`(viewport, source, version)`:

1. If `viewport.backing` differs from the last applied size, assign
   `canvas.width/height` (assigning clears and reallocates, so only on change)
   and reapply `imageSmoothingEnabled`.
2. If no source is ready yet, return without clearing (hold the previous frame;
   `holdPreviousWhileLoading` relies on this).
3. `clearRect`, set `imageSmoothingEnabled = filter === "linear"` and
   `imageSmoothingQuality = "high"` (Skia's default `"low"` is unmipped
   bilinear, worse than the `<img>` path it replaces).
4. Draw with identity transform in device pixels computed in JS doubles:
   clip to the visible integer texel window
   `tx0 = max(0, floor(-quad.left / pxPerTexel))`,
   `tx1 = min(N, ceil((box.width - quad.left) / pxPerTexel))` (same for y),
   then `drawImage(src, tx0, ty0, tx1-tx0, ty1-ty0, (quad.left + tx0*pxPerTexel)*dpr, ..., (tx1-tx0)*pxPerTexel*dpr, ...)`.
   Review: Skia converts destination rects to float32, so a full quad at
   30 million device pixels would jitter texel edges by 1 to 2 px; clipping
   keeps every destination magnitude below the canvas size plus one texel.
5. In split mode, draw the reference under `clip(0..split)` and the
   foreground under `clip(split..1)` into the same canvas, both at the
   reference quad (the GPU compositor's framing: the foreground fills the
   reference footprint with its own grid). Diff mode is one source, the error
   map, as today.

The paint runs in a layout effect, not an imperative rAF painter (performance
review: the per-frame React commit already exists on both backends because the
CSS transform was itself a React style prop; an imperative path would need a
second live view source beside the settings store, which is the two-mechanism
class of bug this design removes). It lands one frame earlier than the GPU
pane's post-paint rAF.

Hardware nearest sampling on an accelerated 2D canvas quantizes texel
boundaries to about 1/256 texel (1 device px at the cairn zoom, invisible
against 262 px cells). Accepted and measured by the harness; labels are
centred from exact geometry so they are never visibly off.

Deleted: `useCpuDisplayPresentation`, `display-geometry.ts` and its test, the
wrapper transform, the four toggled DOM surfaces and their callback refs,
`CpuSplitComparePane` and its duplicated toolbar (the split becomes one shell
with the `render` overlay variant and per-side `sourceDims`, as on GPU).
`exportCanvasRef` and `requestRender` point at the presentation paint.

### 3.5 GPU backend wiring

`webgpu/view.tsx` imports the moved functions from `region-select.ts`, uses
`useImageViewport` instead of `containerTick` plus `getBoundingClientRect`
plus `setOverlayWindow`, sizes `handle.resize` from `viewport.backing`, picks
the sampler from `viewport.filter`, and passes `viewport` to the shell. The
`wrapEl ?? paneEl` measurement fallback is deleted with the wrapper. No shader
or pool change.

### 3.6 Box and mask overlay (components/ImageOverlay.tsx)

`ImageOverlay` currently letterboxes into its container and positions a
native-resolution mask canvas and an SVG as DOM elements; it only follows zoom
because the CPU wrapper was transformed, and it is wrong on GPU. It becomes a
viewport-canvas layer like the labels: it takes `viewport`, draws masks with
`drawImage` of the class-coloured native canvas at the quad and boxes as
strokes on one `absolute inset-0` canvas sized from `viewport.backing`;
label chips stay HTML, positioned from the quad. Rendered by the shell for
both backends (review: DOM elements scaled to over 100k px are a second
placement mechanism and a layer browsers may refuse to rasterize).

### 3.7 Pixel axes removed

The image viewer's pixel-index ticks are removed end to end: `PixelAxes.tsx`
and its barrel export; `showAxes` in `ImagePaneShell.tsx`, `cpu/view.tsx`,
`webgpu/view.tsx`, `runtime/contracts.ts`, `runtime/presentation.ts`,
`runtime/comparison-plan.ts`, `runtime/view.tsx`, `runtime/host-adapter.tsx`
(comment), `compare/compare-settings.ts` (dead field), the compositor props;
`showAxes` in `public/builder/builders.ts` (both image builders; the option
leaves the option type and validation, so a caller passing it gets the
validator's unknown-key error, symmetric with Python); Python `show_axes` on
the image prop helpers, `Image`, and `Compare` in `components.py`, including
docstrings and the warning text; `docs/API.md`; `tests/test_toolbar_host_seam.py`.
`cp.Image(show_axes=...)` and `cp.Compare(show_axes=...)` raise `TypeError`.
The 3D `show_axes` (PointCloud, Mesh, Volume, Boxes) and the example scripts,
which only use the 3D form, are untouched (v1 wrongly listed the examples).

### 3.8 Compare compositor slimmed

Review finding: `MediaComparePane` is not reachable in production at all. The
chain `OffscreenComparePanes -> CrossTypeCompositeMediaPane ->
CompositeMediaPane -> MediaComparePane` has no importer in the source tree, no
public export, and no cairn consumer; only the browser harness reaches it.
`compare-compositor.tsx` becomes a thin adapter: pick the backend
(`resolveGpuImagePane() ?? CpuImagePane`), build the one `compareSource` it
already builds for the GPU branch, thread the settings store to both backends,
and render one pane. Deleted: `MediaComparePane` and its private overlays,
`CpuFloatComparePane`, `floatSourceToDataUrl`, `CompareCpuNotice`,
`isEngineOnlyDiff`, `CompareFloatUnsupportedError`, and the three "needs
WebGPU" notices, which are no longer true since the CPU pane computes float
and uint8 split, pointwise, SSIM, and FLIP diffs itself. Doc comments naming
`MediaComparePane` in seven files are updated.

### 3.9 Performance rules (binding)

- Content effects depend only on content identity and scalar display
  parameters. `useCpuComparisonInput`'s memo on scalar keys stays.
- The presentation paint depends on `viewport`, `source`, `version`; never
  the reverse.
- Canvas backing size is assigned only on change.
- Exactly one `ResizeObserver` per pane, inside the hook.
- No `getImageData` on source bitmaps; label sampling reads the raw buffers.
- No `desynchronized` context; no CSS `image-rendering`.
- Presentation backing clamped to 16384 per axis and 2^28 pixels; CSS
  stretches the canvas in that rare case with at most one device pixel of
  scaling error. Sources larger than that limit are held as `ImageBitmap`,
  which has no such cap.

## 4. Testing

Unit (`node --test`):

- `region-select.test.ts`: `viewToQuad`/`viewToUvRect` inverse with relative
  tolerance; home view equals the object-contain rect; the cairn case (pane
  642x277.5, image 512x512, zoom 242.257, pan -44091.4/-40039.9) and the
  v1 `display-geometry` case (pane 355x402.5, zoom 183.934, pan
  78.5184/-42274.7, first texel centre 142.284581640625); degenerate boxes;
  `magnificationFilter` for explicit and auto interpolation.
- `image-overlay-placement.test.ts`: pure placement of boxes on the quad.
- Source-text tests that pin consumers (`split-divider`, `label-chip`,
  `ref-badge`, `pane-unavailable`, `pixel-overlay-stacking`) retarget from the
  compositor to `cpu/view.tsx`.

Browser harness. First fix `ui/scripts/test-harness.mjs`: its parity-set filter
still matches `/engine/__tests__/`, a directory flattened away on 2026-08-29,
so the WebGPU parity proofs are not running in CI (review finding). Change the
substring to `/webgpu/__tests__/`. New harnesses declare
`data-cairn-harness="self-driving"` so `npm run test:harness` and CI run them.

- `plots/image/cpu/__tests__/cpu-label-alignment.browser.ts`: a 512x512
  uint8 source whose texel colour encodes its index, mounted in a
  642x277.5 host, view set programmatically to the cairn case (as
  `pane-enlarge.browser.ts` does). Scan the presentation canvas centre row
  and column for colour steps (painted edges, threshold at 50% alpha at the
  outer edge), read the label canvas, cluster ink into runs between edges,
  and assert each cluster's bounding-box midpoint is within 1 px of the edge
  midpoint on both axes; assert the edge pitch equals `zoom*S` within
  0.05 px. Repeat for hosts 355x402.5, 500x333.3, 800x601.5, a zoom-1 home
  view, and a split view. The same body runs against `GpuImagePane` when an
  adapter is available, skipping loudly otherwise.
- DPR 2: CSS `zoom` does not change `devicePixelRatio` (review), so the
  runner gains a `data-cairn-harness-dpr` attribute that applies a CDP
  `Emulation.setDeviceMetricsOverride` before navigation; the alignment
  harness runs at DPR 1 and 2.
- `plots/image/cpu/__tests__/cpu-gesture-cost.browser.ts`: mount a
  4096x4096 uint8 and a 2048x2048 float pane, dispatch 60 wheel and 120
  pointer-move events over 60 frames, then a 30-step host resize loop, with
  prototype spies. Assert: zero `putImageData`, zero `tonemapToImageData`,
  `sdrTransferToImageData`, `computeDiff`, `loadImageData` calls; at most
  one presentation `drawImage` per frame; zero backing-size assignments
  while the box is unchanged and exactly one per resize step; zero
  `ResizeObserver.observe` calls after mount. Timing is reported, not
  asserted (headless CI rasterizes in software).
- Existing harnesses updated per the review table: `public-host`,
  `cpu-compare-fallback` (rewritten to the unified semantics: no notices,
  split shows one pane with two clipped overlays, diff shows
  `[data-cpu-comparison-result]`, native-canvas readback replaced by a
  centre-pixel read of the presentation canvas), `selection-stage`,
  `page-wide-selection`, `content-aspect-frame`, `engine-fallback`,
  `grid-stacked` (view state read from the new data attributes), and
  `overlay-float` (re-run, only harness exercising `ImageOverlay`).

Python: `tests/test_toolbar_host_seam.py` drops `show_axes`; new assertions
check that `cp.Image(show_axes=True)` and `cp.Compare(show_axes=True)` raise.

## 5. Compatibility and rollout

- Authored specs that still carry `showAxes` are ignored by the renderer
  (unknown image prop); no schema change because image props are free-form.
- The CPU screenshot export changes from native resolution to the viewport at
  device resolution, matching the GPU backend.
- cairn-plot: `npm run typecheck`, `npm test`, `npm run test:harness:public`,
  `check:plot-schema`, `check:plot-boundary`, `build:plot-inline`,
  `check:plot-bundles`, `sync:plot-assets`, `check:plot-assets`,
  `test:harness`, `smoke:plot`, `smoke:js`, `uv run pytest tests/`.
- cairn: bump `vendor/cairn-plot`; run `cd cairn/ui && npm run build` by hand
  and stage `cairn/ui/dist` (the pre-commit hook only rebuilds when cairn's
  own UI source is staged, so a bare submodule bump would commit a stale
  bundle); update `tests/unit/test_plot_components.py` (two `show_axes`
  asserts on `cp.Image`); restart `cairn ui` (it caches `index.html` at
  startup); verify on the `glints4` run's `eval.error` card at high zoom, the
  detail modal, a column-span resize drag with six image cards visible, step
  scrubbing, and a selected pane's outline.

## 6. Decisions recorded

- Export resolution change: accepted unless the user objects.
- Compositor: slimmed to an adapter rather than deleted, because
  `docs/API.md` documents `OffscreenComparePanes`; deleting the whole
  cross-type chain is a separate decision.
- `runtime/reframe-view.ts` is viewport math living in `runtime/` and
  imported by a host hook; moving it beside the geometry module is a
  follow-up, not part of this change.
