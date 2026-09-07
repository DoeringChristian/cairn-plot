# Image load cost: decode once, read back on demand, upload without CPU conversion

Status: v2 (2026-09-07; v1 revised after two plan checks against the code). Branch `image-load-cost` off main after the
review-fixes merge. Owner: cairn-plot. Consumer: cairn.

## 1. Problem

Opening a run with many image cards is far slower than cairn's previous
renderer, on both backends. Per 8-bit image at mount, cairn-plot today:

- `resources/load-image-data.ts`: decodes through an `Image` element, draws it
  to a scratch canvas and reads the whole frame back (`getImageData`), on the
  main thread, cached forever by URL. Both backends call it at mount to feed
  the pixel-value numbers and the histogram (`cpu/view.tsx` `dataRef`/
  `valueDataRef` effects; `webgpu/view.tsx` `sdrImageDataRef`).
- CPU backend: decodes the same URL a second time (`bitmapFromUrl`: `Image`
  element → `createImageBitmap(img)`) for the paint source.
- WebGPU backend: uploads plain images as `rgba8unorm` from the read-back
  bytes (`writeTexture`), and converts every comparison operand to
  scene-linear `rgba32float` in a scalar JavaScript loop calling the sRGB
  transfer function per channel (`resources/scene-field.ts`
  `imageDataToSceneField`), then uploads four times the bytes.
- Every card mounts within a 600 px lazy margin and all decodes run
  concurrently.

The old card set a source on an image element: browser decode off the main
thread, no readback, no conversion.

## 2. Goals and non-goals

Goals:

- One decode per URL, off the main thread: `fetch` → `Blob` →
  `createImageBitmap(blob)`.
- No full-frame readback at mount. `ImageData` is produced lazily from the
  bitmap, once, on first demand (pixel-value numbers shown, histogram panel
  opened, or a processing pass that needs pixels).
- WebGPU: plain 8-bit images upload from the `ImageBitmap`
  (`copyExternalImageToTexture`); comparison operands upload as
  `rgba8unorm-srgb`, so the GPU performs the sRGB decode. No kernel, WGSL
  binding or reduction changes — but the decoded VALUES move slightly; see
  Numerics below.
- Bounded decode concurrency and a tighter lazy-mount margin.
- A self-driving harness that counts decodes, readbacks, uploads and
  conversions per image at mount and reports time-to-painted for N panes,
  with gates.

Numerics: moving the sRGB decode of 8-bit comparison operands from the CPU
EOTF (`imageDataToSceneField`'s `srgbEotf`) to the hardware's sRGB texture
table is not bit-identical — a GPU's sRGB decode is spec-permitted
implementation tolerance, not an exact function. The bound is HALF AN 8-BIT
CODE STEP, enforced by an exact test gate rather than a number: every decoded
sample must re-encode through `srgbOetf` onto its source code value
(`__tests__/compare-metrics.browser.ts`, `[equiv/srgb-operand]`), so a decoded
operand can never be confused with a different source byte. Measured worst
deviation from the exact EOTF: ≤1.22e-4 absolute / 1.5e-3 relative on Apple
Metal-3, 7.7e-6 on SwiftShader — ≤6% of one code step. Downstream, displayed
metrics shift by ≤4.9e-4 absolute mse (≈1e-3 relative at mse 0.19), ≤5e-3 dB
psnr, ≤2.4e-4 mae; identical images still reduce to exactly mse 0 / psnr ∞.
The CPU-reduced operand paths (`computeMetrics`' mapped branch,
`ssimScalarReference`) are unchanged: `readback()` decodes an
`rgba8unorm-srgb` texture with the same exact `srgbEotf` those paths always
used.

Non-goals: HDR/float sources (`FloatImageData`, EXR) are untouched; CPU
processing passes (tone map, false colour, diff) still need pixels and keep
reading back, lazily; no change to kernels, catalogue, settings, or public
API; the CPU false-colour path for an authored colormap on a uint8 image
keeps its CPU conversion.

## 3. Design

### 3.1 `resources/decoded-image.ts` — the one decode

```ts
export interface DecodedImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly bitmap: ImageBitmap | HTMLImageElement;   // element only where createImageBitmap is missing
  /** False when the image came from a cross-origin URL without CORS: it can be
   *  painted but never read back (and never uploaded via copyExternalImageToTexture). */
  readonly originClean: boolean;
  /** Lazy, memoised full-frame readback; null when !originClean. Not queued. */
  imageData(): Promise<ImageData | null>;
  /** The memoised readback if it already happened, else null. Synchronous. */
  peekImageData(): ImageData | null;
}
export function decodedImage(url: string, deps?: DecodedImageDeps): Promise<DecodedImage | null>;  // cached by URL; in-flight de-duplicated
export function peekDecodedImage(url: string): DecodedImage | null;
export function releaseDecodeRequest(url: string): void;   // refcount for queued (not running) decodes
```

Decode strategy, in order: `fetch(url)` (same-origin or CORS) → `blob()` →
`createImageBitmap(blob, { colorSpaceConversion: "default", premultiplyAlpha: "none" })`;
on any rejection, non-2xx or opaque response, fall back to the element path
(`new Image()` + `createImageBitmap(img)`, today's `bitmapFromUrl` body), with
`originClean = false` when the element is cross-origin without CORS. Default
colour-space conversion keeps today's pixels (the `Image`-element path
normalises to sRGB); `"none"` would change tagged PNGs. `imageData()` draws
the bitmap into an `OffscreenCanvas` (or detached canvas) and calls
`getImageData` once; the result is memoised on the entry AND written through
to the existing `imageLoadCache` (`resources/cache.ts`) so the synchronous
readers in `webgpu/view.tsx` keep working. `loadImageData(url)` becomes
`(await decodedImage(url))?.imageData() ?? null`.

Bounds: the decoded-image map is an LRU of `DECODED_IMAGE_CACHE_MAX = 50`
entries (the size class of `BITMAP_CACHE_MAX`), evicting by dropping the
reference only, never `close()` (a mounted pane or a GPU lease may still hold
the bitmap; see `cpu/bitmap-cache.ts`). Memoised `ImageData` lives in the
existing `imageLoadCache` LRU (100). A failed decode is cached as a negative
entry for 5 s.

### 3.2 CPU backend

- `bitmapFromUrl` is replaced by `decodedImage(url)`; the identity path
  paints the bitmap directly. Processing paths (`use-cpu-content.ts` false
  colour, transfer, diff at lines ~312/350/377/395) keep calling
  `loadImageData` (now lazy over the shared decode).
- The two mount readbacks become demand-driven. `useCompareForeground`
  (`cpu/view.tsx` ~312, shared by the SDR and HDR shells) and the SDR
  `valueDataRef` effect (~538) fill their refs only when demanded, then bump
  `pixelDataVersion`. Demand sources: (a) the pixel-value overlay via
  `onSampleDemandChange` — the `single` overlay variant already forwards it;
  `splitOverlaySpec` gains a pass-through onto both of its overlays;
  (b) the histogram: `ImagePaneShell` fires a new
  `onHistogramDemandChange(open)` from an effect on its `infoOpen` state.
  `u8HistogramSource(imageData | null, version)` keeps its synchronous
  shape; the pane re-memoises it on the version bump. Wide panes auto-open
  the panel at mount (`autoInfoOpen`), so they still read back at mount;
  this is documented and measured by the harness (one wide pane, exactly one
  readback).

### 3.3 WebGPU backend

- `device-contract.ts` `TextureFormat` gains `"rgba8unorm-srgb"`;
  `Texture.write(data: ArrayBufferView | ImageBitmap)` uses
  `queue.copyExternalImageToTexture({ source }, { texture, premultipliedAlpha: false }, [w, h])`
  for bitmaps. Usage flags are unchanged (`WGPUTexture` already grants
  `TEXTURE_BINDING | COPY_DST | COPY_SRC | RENDER_ATTACHMENT`, which
  `copyExternalImageToTexture` requires); sRGB textures never gain
  `STORAGE_BINDING`. `engines/webgpu/rhi.ts` mirrors both changes.
  `SourceUpload.data` widens; `expanded-upload-cache.ts` computes `bytes`
  with `textureByteLength(width, height, format)` instead of
  `data.byteLength`.
- Plain image (`!hasCompare`, `display === raw`): `applySdr` uploads the
  bitmap as `rgba8unorm`; the paint-atomic synchronous fast path
  (`view.tsx` ~1112-1120) uses `peekDecodedImage(url)?.bitmap`. The CPU
  false-colour branch (`display !== raw`) keeps `loadImageData`.
  `sdrImageDataRef` is filled on demand: the existing
  `diffOverlayDemanded` state (already wired to the one overlay spec at
  ~2309) is renamed `overlayDemanded` and gates the readback for the primary
  as well. A non-origin-clean bitmap cannot be uploaded (SecurityError); the
  pane then reports the source unavailable, as the readback path does today.
- Comparison operands (`hasCompare`, and `decodedSourceUploadLease` for
  operand `b`): upload the bitmap as `rgba8unorm-srgb`. Every kernel binds
  operands as `texture_2d<f32>` and reads with `textureLoad`, which returns
  linear values for sRGB formats (verified: no storage-texture operand
  binding and no texture-to-texture copy exists). `sceneFieldUpload` leaves
  the GPU path; `imageDataToSceneField` stays for its CPU callers
  (`use-cpu-content.ts` false colour, `source-metrics.ts`). Cache keys
  `expanded:${contentKey}|scene-rgba32float|…` (~262) and
  `expanded:${primaryKey}|…:${format}` (~1093) carry the new format.
  `refU8Ref` (the `b` operand's pixels for the TEV numbers) is filled on
  demand from `decodedImage(b.url).imageData()`, keyed on `contentKeyB`,
  with its own version bump. No readback path may target an sRGB operand
  texture (a readback would return encoded bytes).

### 3.4 Decode queue and lazy margin

`resources/decode-queue.ts`: `enqueueDecode<T>(key, fn): Promise<T>` with
`DECODE_CONCURRENCY = 3`; queued (not running) entries are served
most-recent-first (a pane scrolled into view now beats stale mount requests)
and are dropped when their refcount reaches zero (`releaseDecodeRequest` from
the pane's unmount). Only the decode (`createImageBitmap` or element load) is
queued; `imageData()` never enters the queue, so a queued task cannot wait on
a queued task.

`LAZY_ROOT_MARGIN` stays at `600px 0px`: with a prioritised queue, offscreen
decodes no longer delay visible ones, and a smaller margin only blanks panes
on fast scrolling; cairn's card layout was not checked for a dependency on
the margin. The constant is the one place to change if measurement says
otherwise.

### 3.5 Harness `plots/image/__tests__/image-load-cost.browser.{html,ts}`

New directory (the runner discovers `*.browser.html` recursively). Self-
driving; sets `window.__cairnPlotEagerMount = true` so lazy mount does not
gate the page. Builds two distinct 2048×2048 RGBA PNG data URLs once, plus a
small gamma-tagged PNG and a translucent PNG fixture. Mounts 12 image leaves
(alternating URLs, 11 narrow and 1 wider than `4 × INFO_PANEL_W` so its
histogram auto-opens) under `__cairnPlotRenderMode = "cpu"`, waits until all
12 CPU canvases are painted (centre-pixel probe via the SAVED original
`getImageData`), unmounts; then, if `navigator.gpu`, 12 GPU leaves plus 2
comparison nodes. Spies are installed BEFORE mount and restored in `finally`:
`HTMLImageElement.prototype.src` setter, `createImageBitmap` (by source
type), both `getImageData`s (excluding calls on `[data-cpu-image-canvas]` /
`[data-gpu-image-canvas]`), `GPUQueue.writeTexture` (bytes) and
`copyExternalImageToTexture` (count), and the exported conversion counter
from `resources/scene-field.ts`. Reports `BENCH:` lines (ms to all painted,
counts). Gates after Task 5: painted panes `=== 12` per backend; element
decodes `=== 0` on same-origin data; `createImageBitmap` calls `=== distinct
URLs`; `getImageData` `=== 1` before any overlay demand (the wide pane);
after toggling numbers on one narrow pane exactly one more; GPU:
`writeTexture` bytes for uint8 sources `=== 0`, `copyExternalImageToTexture`
`=== image count + one upload per distinct operand URL and format` (the
upload cache is keyed by content+format, so two comparison cards naming the
same operands share textures — two cards, two operand uploads, not four);
scene conversions `=== 0`; the tagged and translucent fixtures read back
byte-identical through `decodedImage` and through the element path.

Note: the wide pane opens its histogram via `settings: {"panel.info": true}`
rather than by width alone, because a square 2048² source cannot reach the
auto-open width (`4 × INFO_PANEL_W`) in the runner window — `ContentAspectFrame`
caps the drawable box by `window.innerHeight`, so a square box capped in
height is capped in width too.

## 4. Testing

Unit (node:test): decode queue ordering (most-recent-first), concurrency and
refcount drop; decoded-image cache de-duplication, fallback to the element
path on fetch failure, negative caching, LRU eviction without `close()`,
write-through to `imageLoadCache`; `peekImageData` semantics. Harnesses: the
new one; a device-level equivalence case in `webgpu/__tests__/compare-metrics`
(`runSrgbOperandEquivalence`, `[equiv/srgb-operand]`) uploading one fixture as
`rgba32float` via `imageDataToSceneField` and as `rgba8unorm-srgb` via
`copyExternalImageToTexture`, reading both back through the same trivial
`textureLoad` pass and gating on the shipped bound rather than a single
number: every RGB sample must re-encode through the exact `srgbOetf` back onto
its source 8-bit code value (hardware-independent — the GPU decode loses
nothing the source carried), the raw decode must additionally agree with the
CPU EOTF within `SRGB_DECODE_TOL = 5e-4` (a bound on the hardware's
reduced-precision sRGB table, not on the code under test), and alpha — left
linear by the sRGB format, same as `imageDataToSceneField` — must agree within
`ALPHA_ULP_TOL = 1e-7` (a few float32 ulps, covering only the adapter's
unorm→float rounding); see `webgpu/__tests__/compare-metrics.browser.ts`
~line 60 for the constants;
`cpu-gesture-cost`, `cpu-label-alignment`, `gpu-image-diff`, `flip`,
`hdr-flip`, `ssim`, `gpu-compare-split-numbers`, `gpu-cached-error-numbers`,
`cpu-compare-fallback`, `pane-histogram`, `enlarge-channel` keep passing.

## 5. Compatibility

No public API change. Firefox/Safari: `createImageBitmap(Blob)` and
`OffscreenCanvas` are available in current versions; where
`createImageBitmap` is missing the element path remains as fallback.
