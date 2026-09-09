# Architecture

This page is a compact architecture summary. See [Design](design.md) for the
overarching repository design and ownership model.

Cairn Plot has one production path:

```text
PlotSpec -> PlotHost -> layout -> PlotCell -> backend -> engine
```

## Durable specification

`packages/spec` contains the one JSON-safe recursive specification shared by the
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

The image catalogue (`plots/image/definition/`) is the hull of display and
comparison operations the authoring side validates against. A backend
advertises catalogue ids only (`ImageBackendCapabilities`), must include the
core (`identity`, `split`, `srgb`, `turbo`) and is assumed to support every
parameter the catalogue declares for an id it advertises. Toolbars are the
catalogue intersected with the active backend. Authored settings are the
default state and HOME restores them; when the active backend lacks a
selected id, the view projects it at read time onto the core fallback
(`definition/core.ts`) and shows a fallback chip. The store is never
rewritten by a projection.

An 8-bit image URL is decoded exactly once, by
`plots/image/resources/decoded-image.ts`: `fetch` → `Blob` →
`createImageBitmap`, off the main thread, de-duplicated in flight and cached by
URL, with the old `<img>` element path kept only as the fallback for what
`fetch` cannot serve. Pixels are lazy — `imageData()` reads a frame back once,
on first demand (the pixel-value numbers, an open histogram panel, a CPU
processing pass), so a gallery of cards pays no readback at mount. The CPU
backend paints the bitmap directly; the WebGPU backend uploads it with
`copyExternalImageToTexture` (no CPU-side RGBA buffer) as `rgba8unorm` for a
plain pane and as `rgba8unorm-srgb` for a comparison operand, letting the
hardware do the sRGB decode that `imageDataToSceneField` used to do in a scalar
JavaScript loop at four times the bytes. The hardware decode is not bit-identical
to that loop; it is bounded to half an 8-bit code step and gated exactly, by
requiring every decoded sample to re-encode onto its source byte
(`webgpu/__tests__/compare-metrics.browser.ts`). Decodes run through
`resources/decode-queue.ts`, which bounds concurrency and serves its queue
most-recent-first so a pane scrolled into view preempts stale offscreen
requests; because of that priority the lazy-mount margin
(`host/lazy-mount.ts` `LAZY_ROOT_MARGIN`) stays at 600 px — offscreen decodes no
longer delay visible ones, and a smaller margin would only blank panes on fast
scrolling. `plots/image/__tests__/image-load-cost.browser.ts` gates the whole
path: per backend, twelve cards cost twelve decodes, zero element decodes, one
readback (the one open histogram), zero scene conversions and zero source bytes
through `writeTexture`.

Formats the browser cannot decode itself — `.exr` and `.npy` — go to a pool of
up to four Web Workers instead of the main thread: `decoders/decode-pool-core.ts`
is the pure scheduler, `decoders/decode-pool.ts` the browser shell, and
`decoders/decode-worker.ts` the single worker module every slot runs (imported
`?worker&inline`, so one inlined blob serves N workers and `build:plot-inline`
stays a single file). Each worker instantiates its OWN OpenEXR WASM module.
Policy: a stateless job takes an idle worker, spawning one while the pool is
under size, else it waits and waiting jobs are served most-recent-first (LIFO —
the pane scrolled into view preempts stale requests, as in `decode-queue.ts`); a
job touching a RETAINED deep-EXR handle has affinity for the worker whose WASM
heap owns it, pinned by that worker's generation counter so a respawned slot
rejects a stale handle rather than replaying it into a fresh heap; a timeout or
crash terminates ONLY that worker, rejecting its in-flight jobs and leaving the
other workers and the shared queue untouched (an `ok:false` reply is an ordinary
error, not a teardown). Both paths fall back to the same decoders running inline
on the calling thread not only when no `Worker` exists (which is how node's
`*.test.ts` suite runs them) but on ANY worker-side failure — a crash, the
pool's timeout, or an `ok:false` reply — so a decode is retried on the main
thread, where it also yields the real, informative error for a bad file. The pool is proven end-to-end only in a browser:
`decoders/__tests__/decode-pool.browser.ts` decodes eight distinct EXRs at once
with no >50 ms main-thread longtask, interleaves deep-handle flattens with
unrelated decodes, and pins the failure isolation.

The scalar plot (`plots/scalar/`) never hands raw points to the chart. Each
series is *prepared* once into typed arrays by `PreparedSeriesCache`
(`prepared-series.ts`), keyed by series key: identical points reuse the entry
untouched, an append extends it in place (probing the head and the previous tail
so a rewritten history rebuilds instead of being silently spliced), and only an
option change or a mismatch rebuilds. Prepared identity is the memo key
downstream, so a re-render that changed nothing rebuilds nothing. Drawing then
goes through an M4 pixel reduction (`transforms/`): the visible window is split
into one bucket per screen column and at most four samples survive per column
(first, last, min, max), so a path carries points proportional to the plot's
*width*, not to the data — the budget the render-cost harness pins is
≤ 5 × columns + 2 per path. Inline data identity is a content summary
(`contentId`), not a serialisation: two identical point arrays produce the same
key and an append produces a different one, without hashing every sample.
Hovering a line does not re-render: Recharts forwards `data-*` onto the curve
`<path>`, so the hovered key is written as `data-emph` straight onto the DOM and
two rules in `public/theme/plot.css` do the emphasis/dimming — path geometry is
untouched by a pointer move. High-frequency gestures (wheel, pinch, pan) push
through a frame coalescer instead of calling `onViewChange` directly, capping
view emits at one per frame, while commits (box-zoom release, double-click
reset) flush the pending value and fire immediately.
`plots/scalar/__tests__/scalar-render-cost.browser.ts` is the gate for the
budgets in the scalar render-performance spec (§4): 10 series × 100 000 points
in an 800 px host, measuring mount-to-paint, an append, one wheel step and a
hover sweep against long-task budgets, and printing a cost attribution (the
prepare + reduce pipeline separately from what React and Recharts spend on the
merged rows).

## Browser host

The supported browser API is `ui/src/public`:

```tsx
<PlotHost spec={spec} dataSource={dataSource} />
```

The imperative `mountPlot` function mounts the same React host; it is not a
second runtime. Plot registration, cell settings, selection, stage and resource
machinery remain private.

## Repository packages

- `packages/spec`: canonical recursive wire types.
- `packages/python`: Python authoring, reports and bundled browser assets.
- `ui`: the single browser implementation and public host.

The former controller/plugin/React package experiment was removed because it
did not drive production and duplicated the specification, settings and backend
models. Optional figure and Three bundles install backends on core-owned typed
definitions; there is no second renderer registry.
