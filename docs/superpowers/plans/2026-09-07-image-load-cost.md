# Image Load Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a run page with many 8-bit image cards load close to what a plain image element costs: one off-thread decode per URL, no full-frame readback until pixels are demanded, GPU uploads straight from the bitmap with the sRGB decode on the GPU, bounded concurrency.

**Architecture:** One shared decode resource (`resources/decoded-image.ts`) owns the bitmap and a lazy, memoised readback; both backends consume it. The CPU pane paints the bitmap and reads back only on overlay/histogram demand. The WebGPU device gains an `ImageBitmap` upload and an sRGB texture format so comparison operands need no CPU conversion. A harness measures and gates decodes, readbacks, uploads and conversions per image at mount.

**Tech Stack:** TypeScript/React, canvas 2D, WebGPU, node:test, the parity runner. All commands from `ui/`.

**Spec:** `docs/superpowers/specs/2026-09-07-image-load-cost-design.md`

## Global Constraints

- No numerics change: FLIP, HDR-FLIP, SSIM, pointwise diffs, tone maps and colormaps produce the same values; the parity harnesses are the proof.
- Kernels (`webgpu/kernels/*`, `webgpu/shaders/*`) are not edited.
- The pixel-value overlay and histogram must show the same numbers as before once demanded; `cpu-label-alignment` and `gpu-compare-split-numbers` must pass.
- HDR/float sources are untouched.
- `npm run typecheck && npm test && npm run check:plot-boundary` after every task; the harnesses named per task.
- Commit trailers on every commit:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.

---

### Task 0: Baseline harness (measure before changing)

**Files:**
- Create: `ui/src/plots/image/__tests__/image-load-cost.browser.html`, `image-load-cost.browser.ts`

**Interfaces:** Produces the spy set and the `BENCH:` report format used by Task 5's gates. Read `plots/image/cpu/__tests__/cpu-gesture-cost.browser.ts` first for the harness pattern (self-driving page attributes, `createHarness`, prototype spies installed in a `try/finally`, `BENCH:` lines, `setOverallStatus`).

- [ ] **Step 1: Page + fixture.** Copy the page attributes of `cpu-gesture-cost.browser.html`. In the TS: build a 2048×2048 RGBA PNG data URL once (draw a gradient plus a checker onto a canvas, `toDataURL("image/png")`), and a second distinct one. Mount, under one `PlotApp`/`PlotNodeView` tree like `page-wide-selection.browser.ts` does, 12 image leaves (alternating the two URLs) with `__cairnPlotRenderMode = "cpu"`, wait until all 12 `[data-cpu-image-canvas]` have painted (readback centre pixel non-zero, as `public-host.browser.ts` does), then unmount. If `navigator.gpu`, repeat with `__cairnPlotRenderMode = "gpu"`: 12 image leaves plus 2 compare nodes (`presentation:"difference"`, `settings:{"compare.operation":"absolute"}`) and wait for `canvas[data-gpu-image-canvas]` painted.
- [ ] **Step 2: Spies.** Before each mount install: `HTMLImageElement.prototype` `src` setter (count element decodes), `window.createImageBitmap` (count, keyed by `source.constructor.name`), `CanvasRenderingContext2D.prototype.getImageData` and `OffscreenCanvasRenderingContext2D.prototype.getImageData` (count + pixels), `GPUQueue.prototype.writeTexture` (sum `dataLayout.bytesPerRow*height` or `data.byteLength`) and `copyExternalImageToTexture` (count), and a `Float32Array` constructor wrapper counting allocations with `byteLength >= 16 MiB` (restore all in `finally`).
- [ ] **Step 3: Report.** `BENCH: cpu 12 panes: all painted in <ms> ms; element decodes N, createImageBitmap N (by source), getImageData N (<px> px), float32 ≥16MiB allocs N` and the GPU line with `writeTexture <MB>, copyExternalImageToTexture N`. In this task the gates are `report(true, …)` only (baseline). Add one gate that IS real: "all panes painted within 60 s".
- [ ] **Step 4: Run** `node scripts/test-harness.mjs --only image-load-cost`; paste the BENCH lines into the commit message body as the baseline.
- [ ] **Step 5: Commit** `Add the image-load-cost harness with baseline numbers`.

---

### Task 1: Decoded-image resource and decode queue

**Files:**
- Create: `ui/src/plots/image/resources/decode-queue.ts`, `decode-queue.test.ts`, `decoded-image.ts`, `decoded-image.test.ts`
- Modify: `ui/src/plots/image/resources/load-image-data.ts` (delegate), `ui/src/plots/image/resources/cache.ts` (drop the loaded-ImageData cache if nothing else uses it — grep `getCachedLoadedImageData`)

**Interfaces (produced):**
```ts
// decode-queue.ts
export const DECODE_CONCURRENCY = 3;
export function enqueueDecode<T>(fn: () => Promise<T>): Promise<T>;   // FIFO, at most DECODE_CONCURRENCY in flight
export function decodeQueueStats(): { running: number; queued: number };
// decoded-image.ts
export interface DecodedImage { readonly url: string; readonly width: number; readonly height: number;
  readonly bitmap: ImageBitmap | HTMLImageElement; imageData(): Promise<ImageData | null> }
export function decodedImage(url: string, deps?: DecodedImageDeps): Promise<DecodedImage | null>;
export function peekDecodedImage(url: string): DecodedImage | null;
export interface DecodedImageDeps { fetchBlob(url: string): Promise<Blob>; decode(blob: Blob): Promise<ImageBitmap>; readback(bitmap: ImageBitmap | HTMLImageElement, w: number, h: number): ImageData | null }  // injectable for tests; defaults use fetch/createImageBitmap/OffscreenCanvas
```

- [ ] **Step 1: Tests first.** `decode-queue.test.ts`: with concurrency 3, enqueue 5 deferred promises, assert `running === 3, queued === 2`, resolve one, assert `running === 3, queued === 1`, resolution order is FIFO, a rejected fn does not block the queue. `decoded-image.test.ts` with injected deps (fake blob/bitmap objects, a counting `decode`, a counting `readback`): two concurrent `decodedImage(url)` calls decode once; `imageData()` twice reads back once; a second URL decodes separately; a failed fetch resolves `null` and is retried on the next call (not cached as null).
- [ ] **Step 2: Implement** per spec §3.1 and §3.4. Default `decode` = `createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" })`, falling back to an `Image` element when `createImageBitmap` is undefined or throws (then `bitmap` is the element). Default `readback` draws into an `OffscreenCanvas` when available else a detached `<canvas>`, `getImageData(0,0,w,h)`. `loadImageData(url)` = `(await decodedImage(url))?.imageData() ?? null`.
- [ ] **Step 3: Verify** typecheck, unit tests, boundary; `node scripts/test-harness.mjs --only cpu-compare-fallback` and `--only gpu-image-diff` (callers of `loadImageData` still work). **Commit** `Decode each image once through a shared decoded-image resource`.

---

### Task 2: CPU backend paints the bitmap and reads back on demand

**Files:**
- Modify: `ui/src/plots/image/cpu/use-cpu-content.ts` (`bitmapFromUrl` → `decodedImage`; keep `toPaintSource` for produced ImageData)
- Modify: `ui/src/plots/image/cpu/view.tsx` (the `dataRef` effect ~line 312 and the `valueDataRef` effect ~line 538 become demand-driven; wire `onSampleDemandChange` in both `overlay` props; histogram provider)
- Modify: `ui/src/plots/image/components/image-histogram-source.ts` (`u8HistogramSource(provider, version)` where `provider: () => Promise<ImageData | null>`), `image-histogram-source.test.ts` if present else create
- Modify: `ui/src/plots/image/components/ImagePaneShell.tsx` only if the histogram panel's open state is not already observable by the pane (read it first: the shell has `histogram`/`infoPanelSetting` props; expose an `onHistogramDemandChange` callback in the `histogram` slot if none exists)

**Interfaces:** consumes Task 1. Produces the demand wiring both shells use: `const [sampleDemanded, setSampleDemanded] = useState(false)`; effect: `if (!(sampleDemanded || histogramDemanded) || dataRef.current || !url) return; decodedImage(url).then(d => d?.imageData()).then(...)`.

- [ ] **Step 1: Test first.** `image-histogram-source.test.ts`: the u8 source with a provider does not call the provider until its bins are requested; calls it once.
- [ ] **Step 2: Implement.** In `use-cpu-content.ts` the identity path uses `(await decodedImage(url))` and claims `{bitmap, width, height}` as the paint source (no `toPaintSource`, no readback). In `cpu/view.tsx` replace both mount effects with demand effects; wire `overlay.onSampleDemandChange: setSampleDemanded` in the SDR and HDR (uint8 branch only) shells; pass the provider to `u8HistogramSource`. Keep `pixelDataVersion` bumps so the overlay redraws after the readback lands.
- [ ] **Step 3: Verify** unit tests; harnesses `cpu-gesture-cost`, `cpu-label-alignment` (numbers must still appear at zoom — the overlay demands samples, the readback lands, labels draw within the harness's wait), `cpu-compare-fallback`, `pane-histogram`, `image-load-cost` (CPU line: element decodes 0, createImageBitmap 12 by `Blob`, getImageData 0). **Commit** `Paint the decoded bitmap on the CPU backend and read back only on demand`.

---

### Task 3: WebGPU uploads plain images from the bitmap; TEV readback on demand

**Files:**
- Modify: `ui/src/plots/image/webgpu/device/device-contract.ts` (`Texture.write(data: ArrayBufferView | ImageBitmap)`), `device.ts` (`copyExternalImageToTexture` branch, `flipY:false`, `premultipliedAlpha:false`), `engines/webgpu/rhi.ts` if it mirrors the write signature
- Modify: `ui/src/plots/image/webgpu/pool.ts` (`SourceUpload.data: ArrayBufferView | ImageBitmap`)
- Modify: `ui/src/plots/image/webgpu/view.tsx` (`applySdr` plain branch uploads the bitmap; the effect at ~line 1123 that calls `loadImageData(imageUrl)` uses `decodedImage` and fills `sdrImageDataRef` only on demand; wire `onSampleDemandChange` for the primary overlay next to the diff one at ~line 2309)

- [ ] **Step 1: Read** `applySdr` and its callers (~1060-1130) and `decodedSourceUploadLease` (~242-280) fully; note where `display !== raw` (CPU false colour for an authored colormap on uint8): that branch keeps `loadImageData`.
- [ ] **Step 2: Implement.** Plain path: `decodedImage(url)` → `build = () => ({ data: img.bitmap, width, height, format: "rgba8unorm" })` (element fallback: readback once and upload bytes). `sdrImageDataRef` filled by a demand effect (`primaryOverlayDemanded` state) via `imageData()`.
- [ ] **Step 3: Verify** harnesses `gpu-image-diff`, `image-pass`, `gpu-image-page-cap`, `gpu-compare-split-numbers`, `enlarge-channel`, `image-load-cost` (GPU line: `writeTexture` bytes for uint8 sources 0, `copyExternalImageToTexture` 12 for the plain panes). **Commit** `Upload plain 8-bit images to the GPU from the decoded bitmap`.

---

### Task 4: sRGB-format comparison operands

**Files:**
- Modify: `device-contract.ts` (`TextureFormat` gains `"rgba8unorm-srgb"`), `device.ts` (`createTexture` format map; sRGB textures need `RENDER_ATTACHMENT`? no — `TEXTURE_BINDING | COPY_DST` only; verify usage flags), `engines/webgpu/rhi.ts` (format union)
- Modify: `webgpu/view.tsx` (`sceneFieldUpload` → bitmap upload with `format: "rgba8unorm-srgb"`; `decodedSourceUploadLease` for operand `b` likewise; cache keys carry the format), `webgpu/pool.ts` if it validates formats
- Modify: `resources/scene-field.ts` — delete `imageDataToSceneField` if no caller remains (grep; the harness `flip.browser.ts` uses its own `uploadSceneRGBA` — leave harness helpers alone)

- [ ] **Step 1: Confirm the binding.** Grep every kernel that reads a comparison operand: all must bind `texture_2d<f32>` and read via `textureLoad`/`textureSample` (never `texture_storage_2d` for operands). If any storage binding reads an operand directly, STOP and report (the format change would break it).
- [ ] **Step 2: Implement** per spec §3.3. The pointwise diff pipeline and FLIP/SSIM receive linear values from `textureLoad` on the sRGB texture exactly as they received the CPU-converted floats.
- [ ] **Step 3: Verify** parity: `flip`, `hdr-flip`, `ssim`, `diff-display`, `gpu-compare-split-numbers`, `gpu-cached-error-numbers`, `stacked-diff-flip`, `image-load-cost` (no ≥16 MiB Float32 allocations on the comparison panes). Compare the `[metrics] mse` line of `diff-display` against its value before this task (must be identical to the printed precision). **Commit** `Let the GPU decode sRGB comparison operands`.

---

### Task 5: Concurrency, lazy margin, gates, docs

**Files:**
- Modify: `ui/src/plots/image/resources/decoded-image.ts` (route decodes through `enqueueDecode` if Task 1 did not already), `ui/src/host/lazy-mount.ts` (`LAZY_ROOT_MARGIN = "300px 0px"` with the comment updated)
- Modify: `ui/src/plots/image/__tests__/image-load-cost.browser.ts` (turn the `report(true, …)` baselines into the gates of spec §3.5; print the ratio vs the Task 0 baseline hard-coded from its commit message)
- Modify: `docs/architecture.md` (one paragraph: image decode resource, demand-driven readback, bitmap upload, sRGB operands), `docs/API.md` if it describes the load path

- [ ] **Step 1:** Implement, then run `image-load-cost` and the full `npm run test:harness`; all pass, the harness prints the before/after ratio.
- [ ] **Step 2: Commit** `Bound decode concurrency and gate image load cost`.
