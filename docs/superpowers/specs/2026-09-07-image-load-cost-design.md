# Image load cost: decode once, read back on demand, upload without CPU conversion

Status: v1 (2026-09-07). Branch `image-load-cost` off main after the
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
  `rgba8unorm-srgb`, so the GPU performs the sRGB decode; kernels unchanged.
- Bounded decode concurrency and a tighter lazy-mount margin.
- A self-driving harness that counts decodes, readbacks, uploads and
  conversions per image at mount and reports time-to-painted for N panes,
  with gates.

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
  /** Lazy, memoised full-frame readback. */
  imageData(): Promise<ImageData | null>;
}
export function decodedImage(url: string): Promise<DecodedImage | null>;   // cached by URL, in-flight de-duplicated
export function peekDecodedImage(url: string): DecodedImage | null;
```

`decodedImage` = `fetch(url)` → `blob()` → `createImageBitmap(blob,
{ colorSpaceConversion: "none", premultiplyAlpha: "none" })` through the
decode queue (§3.4). `imageData()` draws the bitmap into an `OffscreenCanvas`
(or a detached canvas) and calls `getImageData` once; the result is memoised
on the entry. `loadImageData(url)` in `load-image-data.ts` becomes
`(await decodedImage(url))?.imageData() ?? null`, keeping its signature for
the processing-pass callers; its own cache module is removed.

### 3.2 CPU backend

- `bitmapFromUrl` is replaced by `decodedImage(url)`; the identity path
  paints the bitmap directly. Processing paths keep calling
  `loadImageData` (now lazy over the shared decode).
- The two mount effects that fill `dataRef`/`valueDataRef` become demand
  effects: the shells wire `overlay.onSampleDemandChange` (as the WebGPU
  view already does for the diff overlay) and the histogram source requests
  pixels through a provider. State: `sampleDemanded` (overlay) and
  `histogramDemanded` (panel open, via the shell's existing histogram open
  state). When either becomes true and the ref is empty, `imageData()` is
  awaited and the version bumped. `u8HistogramSource` accepts
  `() => Promise<ImageData | null>` and resolves on first use.

### 3.3 WebGPU backend

- `device-contract.ts` `TextureFormat` gains `"rgba8unorm-srgb"`;
  `Texture.write` accepts `ArrayBufferView | ImageBitmap` and uses
  `queue.copyExternalImageToTexture` for bitmaps. `SourceUpload.data`
  widens accordingly; `pool.ts` passes it through.
- Plain image (`!hasCompare`, no CPU false colour): `applySdr` uploads the
  bitmap as `rgba8unorm`; `sdrImageDataRef` stays null until the pixel-value
  overlay demands samples (`onSampleDemandChange` wired for the primary
  overlay like the diff overlay), then `imageData()` fills it.
- Comparison operands (`hasCompare`, and `decodedSourceUploadLease` for
  operand `b`): upload the bitmap as `rgba8unorm-srgb`. Kernels bind
  operands as `texture_2d<f32>` and `textureLoad` returns linear values for
  sRGB formats, so `imageDataToSceneField` leaves the upload path; it stays
  only where a CPU float field is genuinely needed (grep before deleting).
  Cache keys include the format.
- The TEV samplers for comparison (`pixel-samplers.ts`) read from
  `imageData()` on demand as today's refs, filled on demand.

### 3.4 Concurrency and lazy margin

`resources/decode-queue.ts`: `enqueue<T>(fn: () => Promise<T>): Promise<T>`
with `DECODE_CONCURRENCY = 3`, FIFO. `LAZY_ROOT_MARGIN` becomes
`"300px 0px"`.

### 3.5 Harness `plots/image/__tests__/image-load-cost.browser.{html,ts}`

Self-driving. Builds one 2048×2048 RGBA PNG data URL (and a second, distinct
one for a comparison) once, mounts 12 CPU panes and, when WebGPU is
available, 12 GPU panes plus 2 GPU comparison panes, in a scrollable page
with all panes inside the lazy margin. Spies (prototype, installed before
mount): `HTMLImageElement` `src` setter (element decodes), `createImageBitmap`
(by source type), `CanvasRenderingContext2D`/`OffscreenCanvasRenderingContext2D`
`getImageData`, `GPUQueue.writeTexture` (bytes) and
`copyExternalImageToTexture`, `Float32Array` allocations ≥ 16 MB (scene
conversions). Waits until every pane has painted a non-empty frame. Reports
`BENCH:` lines: ms to all-painted, counts per category. Gates (final task):
element decodes = 0; `createImageBitmap` calls = distinct URLs; `getImageData`
= 0 before any overlay demand; then toggles numbers on ONE pane and asserts
exactly one readback; GPU: `writeTexture` bytes for uint8 sources = 0 and
`copyExternalImageToTexture` = image count; comparison operands: no ≥ 16 MB
`Float32Array` allocation. A `BENCH` line prints the ratio against the
baseline recorded in Task 0.

## 4. Testing

Unit (node:test): decode queue ordering and concurrency; decoded-image
cache de-duplication with an injected decoder; `u8HistogramSource` with a
provider. Harnesses: the new one; `cpu-gesture-cost`, `cpu-label-alignment`,
`gpu-image-diff`, `flip`, `hdr-flip`, `ssim`, `diff-display`,
`gpu-compare-split-numbers`, `gpu-cached-error-numbers`, `cpu-compare-fallback`
all keep passing (numbers overlay correctness after demand; FLIP parity with
sRGB-format operands).

## 5. Compatibility

No public API change. Firefox/Safari: `createImageBitmap(Blob)` and
`OffscreenCanvas` are available in current versions; where
`createImageBitmap` is missing the element path remains as fallback.
