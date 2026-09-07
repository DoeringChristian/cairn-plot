# Image Load Cost Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a run page with many 8-bit image cards load close to what a plain image element costs: one off-thread decode per URL, no full-frame readback until pixels are demanded, GPU uploads straight from the bitmap with the sRGB decode on the GPU, prioritised bounded decoding.

**Architecture:** One shared decode resource (`resources/decoded-image.ts`) owns the bitmap, a lazy memoised readback with a synchronous peek, and writes through to the existing `imageLoadCache` so the GPU view's synchronous readers keep working. The CPU pane paints the bitmap and reads back only on overlay/histogram demand. The WebGPU device gains an `ImageBitmap` upload and an sRGB texture format so comparison operands need no CPU conversion. A harness measures and gates decodes, readbacks, uploads and conversions per image at mount.

**Tech Stack:** TypeScript/React, canvas 2D, WebGPU, node:test, the parity runner. All commands from `ui/`.

**Spec:** `docs/superpowers/specs/2026-09-07-image-load-cost-design.md` (v2)

## Global Constraints

- No numerics change: FLIP, HDR-FLIP, SSIM, pointwise diffs, tone maps and colormaps produce the same values. Task 4 adds the equivalence case that proves the sRGB-format operands; `compare-metrics`' `[metrics] mse` line must be identical before and after.
- Kernels (`webgpu/kernels/*`, `webgpu/shaders/*`) are not edited.
- Bitmaps are never `close()`d by a cache (`cpu/bitmap-cache.ts` rule).
- `colorSpaceConversion: "default"`; pixels painted and read back must equal today's element path (harness fixtures).
- Cross-origin images without CORS keep painting (element-path fallback); only readback and GPU upload are unavailable for them, as today.
- HDR/float sources untouched. Public API unchanged.
- `npm run typecheck && npm test && npm run check:plot-boundary` after every task; harnesses named per task.
- Commit trailers on every commit:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.

---

### Task 0: Baseline harness (measure before changing)

**Files:**
- Create: `ui/src/plots/image/__tests__/image-load-cost.browser.html`, `image-load-cost.browser.ts` (new directory)
- Modify: `ui/src/plots/image/resources/scene-field.ts` (export `sceneConversionCount(): number`, incremented in `imageDataToSceneField`)

**Read first:** `plots/image/cpu/__tests__/cpu-gesture-cost.browser.ts` (spy pattern, `BENCH:` lines, `createHarness`/`setOverallStatus`), `testing/browser/renderers/page-wide-selection.browser.ts` (mounting leaves under `PlotApp`), `public/__tests__/public-host.browser.ts:44-48` (centre-pixel paint probe), `host/lazy-mount.ts:52` (`__cairnPlotEagerMount`).

- [ ] **Step 1: Page + fixtures.** Page attributes as `cpu-gesture-cost.browser.html`. In the TS, set `window.__cairnPlotEagerMount = true` before mounting. Build two distinct 2048×2048 RGBA PNG data URLs once (gradient+checker; reuse), a 64×64 PNG with a `gAMA`/ICC tag (embed a small base64 fixture in the file) and a 64×64 translucent PNG. Mount 12 image leaves (alternating the two URLs; 11 at ~300 px wide, 1 at ≥ 1000 px so the histogram auto-opens) under `__cairnPlotRenderMode = "cpu"`, wait until all 12 `[data-cpu-image-canvas]` are painted using the SAVED original `getImageData`, then unmount. If `navigator.gpu`: 12 GPU leaves plus 2 compare nodes (`presentation:"difference"`, `settings:{"compare.operation":"absolute"}`), wait for `canvas[data-gpu-image-canvas]` painted.
- [ ] **Step 2: Spies, installed BEFORE each mount, restored in `finally`:** `HTMLImageElement.prototype` `src` setter; `window.createImageBitmap` (count per `source.constructor.name`); `CanvasRenderingContext2D.prototype.getImageData` and `OffscreenCanvasRenderingContext2D.prototype.getImageData` (count + pixels; skip when `this.canvas` matches `[data-cpu-image-canvas], [data-gpu-image-canvas]`); `GPUQueue.prototype.writeTexture` (bytes: `data.byteLength`) and `copyExternalImageToTexture` (count); read `sceneConversionCount()` before/after.
- [ ] **Step 3: Report** `BENCH: cpu 12 panes: all painted in <ms> ms; element decodes N, createImageBitmap N (Blob N, HTMLImageElement N, ImageData N), getImageData N (<Mpx>), scene conversions N` and the GPU line with `writeTexture <MB>, copyExternalImageToTexture N`. Real gates in this task: painted panes `=== 12` per backend within 60 s. Everything else `report(true, …)` (baseline).
- [ ] **Step 4: Run** `node scripts/test-harness.mjs --only image-load-cost`; paste the BENCH lines into the commit message body.
- [ ] **Step 5: Commit** `Add the image-load-cost harness with baseline numbers`.

---

### Task 1: Decoded-image resource, decode queue, synchronous readers migrated

**Files:**
- Create: `ui/src/plots/image/resources/decode-queue.ts`, `decode-queue.test.ts`, `decoded-image.ts`, `decoded-image.test.ts`
- Modify: `ui/src/plots/image/resources/load-image-data.ts` (delegate; keep signature), `ui/src/plots/image/resources/cache.ts` (keep `imageLoadCache`; `decoded-image` writes through)
- Modify: `ui/src/plots/image/webgpu/view.tsx` lines ~260 (`decodedSourceUploadLease` resident fast path), ~1112-1120 (paint-atomic `applySdr` fast path), ~1204 (`refU8Ref`): keep them working — in this task they may still read `getCachedLoadedImageData` (write-through keeps it populated after the first `imageData()`); add `peekDecodedImage` where a bitmap suffices only if trivial, else leave for Task 3.

**Interfaces (produced):**
```ts
// decode-queue.ts
export const DECODE_CONCURRENCY = 3;
export function enqueueDecode<T>(key: string, fn: () => Promise<T>): Promise<T>;  // most-recent-first among queued; at most DECODE_CONCURRENCY running
export function retainDecode(key: string): void; export function releaseDecode(key: string): void;  // refcount; a queued entry with 0 refs is dropped (its promise rejects with DecodeCancelled)
export function decodeQueueStats(): { running: number; queued: number };
// decoded-image.ts — per spec §3.1
export interface DecodedImage { url; width; height; bitmap: ImageBitmap | HTMLImageElement; originClean: boolean; imageData(): Promise<ImageData | null>; peekImageData(): ImageData | null }
export function decodedImage(url: string, deps?: DecodedImageDeps): Promise<DecodedImage | null>;
export function peekDecodedImage(url: string): DecodedImage | null;
export const DECODED_IMAGE_CACHE_MAX = 50;
export interface DecodedImageDeps { fetchBlob(url): Promise<Blob>; decodeBlob(blob): Promise<ImageBitmap>; decodeElement(url): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width; height; originClean: boolean } | null>; readback(bitmap, w, h): ImageData | null; now(): number }
```

- [ ] **Step 1: Tests first.** `decode-queue.test.ts`: concurrency 3, enqueue a,b,c,d,e (deferred) → running 3 queued 2; resolve a → d? No: most-recent-first means `e` runs next, then `d`; a rejected fn frees its slot; `retain/release` to zero on a queued key rejects it with `DecodeCancelled` and it never runs. `decoded-image.test.ts` with injected deps: two concurrent calls decode once; `imageData()` twice reads back once and `peekImageData()` returns it afterwards (null before); `fetchBlob` rejection → `decodeElement` path used, `originClean` per its result; `originClean:false` → `imageData()` resolves null without calling `readback`; a total failure resolves null and is NOT re-attempted within 5 s (`now` injected), IS re-attempted after; inserting 51 URLs evicts the least recently used without calling any `close` (assert the fake bitmap's `close` spy is never called); write-through: after `imageData()`, `getCachedLoadedImageData(url)` returns the same object.
- [ ] **Step 2: Implement** per spec §3.1/§3.4. Default deps: `fetchBlob` = `fetch(url)` rejecting on `!res.ok || res.type === "opaque"`; `decodeBlob` = `createImageBitmap(blob, { colorSpaceConversion: "default", premultiplyAlpha: "none" })`; `decodeElement` = today's `bitmapFromUrl` body (move it here from `use-cpu-content.ts`, export nothing else), `originClean` = same-origin or `crossOrigin` set and loaded; `readback` = `OffscreenCanvas` if available else detached canvas, returning null on a `SecurityError`. `decodedImage` queues only the decode step under `enqueueDecode(url, …)`. `loadImageData(url)` = `(await decodedImage(url))?.imageData() ?? null`.
- [ ] **Step 3: Verify** typecheck, unit tests, boundary; harnesses `cpu-compare-fallback`, `gpu-image-diff`, `gpu-compare-split-numbers`, `gpu-cached-error-numbers`, `stacked-diff-flip` (the synchronous readers still find their data). **Commit** `Decode each image once through a shared decoded-image resource`.

---

### Task 2: CPU backend paints the bitmap and reads back on demand

**Files:**
- Modify: `ui/src/plots/image/cpu/use-cpu-content.ts` (identity path ~346 uses `decodedImage`; `bitmapFromUrl` removed; `toPaintSource` stays for produced ImageData)
- Modify: `ui/src/plots/image/cpu/view.tsx` (`useCompareForeground` effect ~312-327 and the SDR `valueDataRef` effect ~535-549 become demand effects; `splitOverlaySpec` ~253-289 gains `onSampleDemandChange` pass-through; both shells pass `onHistogramDemandChange`; `retainDecode`/`releaseDecode` around the pane's URL lifetime)
- Modify: `ui/src/plots/image/components/ImagePaneShell.tsx` (new prop `onHistogramDemandChange?: (open: boolean) => void`, fired from an effect on `infoOpen`)

- [ ] **Step 1: Read** the two effects, `splitOverlaySpec`, `u8HistogramSource` call at ~572 (its signature stays `(imageData | null, version)`), and the shell's `infoOpen` (~372-385).
- [ ] **Step 2: Implement.** `const [sampleDemanded, setSampleDemanded] = useState(false); const [histogramDemanded, setHistogramDemanded] = useState(false);` in each shell; demand effect: `if (!(sampleDemanded || histogramDemanded) || ref.current || !url) return; let c = false; decodedImage(url).then(d => d?.imageData()).then(d => { if (c || !d) return; ref.current = d; bump(); }); return () => { c = true; }`. `useCompareForeground` takes a `demanded` flag from its caller (either overlay). Wire `overlay.onSampleDemandChange` in the `single` specs and through `splitOverlaySpec` onto both overlays; `onHistogramDemandChange={setHistogramDemanded}` on both shells. Identity paint path: `const d = await decodedImage(url); claim({ bitmap: d.bitmap, width, height })` — no `toPaintSource`, no readback.
- [ ] **Step 3: Verify** unit tests; harnesses `cpu-gesture-cost`, `cpu-label-alignment` (numbers appear after the demand round-trip; if the harness's wait is too short for a 2048² readback, raise ITS wait, not the gate), `cpu-compare-fallback`, `pane-histogram`, `image-load-cost` (CPU: element decodes 0, `createImageBitmap` 2 from `Blob`, `getImageData` 1 = the wide pane). **Commit** `Paint the decoded bitmap on the CPU backend and read back only on demand`.

---

### Task 3: WebGPU uploads plain images from the bitmap; TEV readbacks on demand

**Files:**
- Modify: `ui/src/plots/image/webgpu/device/device-contract.ts` (`write(data: ArrayBufferView | ImageBitmap)`), `device.ts` (`WGPUTexture.write` ~377-386: bitmap → `queue.copyExternalImageToTexture({ source }, { texture, premultipliedAlpha: false }, [w, h])`; usage flags unchanged), `engines/webgpu/rhi.ts:19` (mirror)
- Modify: `ui/src/plots/image/webgpu/pool.ts:169-174` (`SourceUpload.data: ArrayBufferView | ImageBitmap`), `expanded-upload-cache.ts:41` (`bytes: textureByteLength(upload.width, upload.height, upload.format)`)
- Modify: `ui/src/plots/image/webgpu/view.tsx`: `applySdr` ~1082-1105 plain branch (`display === raw`) uploads `decoded.bitmap` as `rgba8unorm`; the paint-atomic fast path ~1112-1120 uses `peekDecodedImage(url)?.bitmap`; the effect ~1123 calls `decodedImage`; rename `diffOverlayDemanded` → `overlayDemanded` (~723, ~1813, ~1848, ~2309) and gate `sdrImageDataRef` and `refU8Ref` (~1204) fills on it via `imageData()` with their version bumps; the histogram at ~2088 keeps `u8HistogramSource(sdrImageDataRef.current, version)` and is fed by the same demand plus the shell's `onHistogramDemandChange`.

- [ ] **Step 1: Read** the listed regions fully before editing. Non-origin-clean bitmaps: skip the bitmap upload and report the source unavailable (today's readback also fails for them).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify** harnesses `gpu-image-diff`, `image-pass`, `gpu-image-page-cap`, `gpu-compare-split-numbers` (b-operand numbers appear after demand), `gpu-cached-error-numbers`, `enlarge-channel`, `stacked-diff-flip`, `image-load-cost` (GPU: `writeTexture` bytes for uint8 sources 0, `copyExternalImageToTexture` 12 plain). **Commit** `Upload plain 8-bit images to the GPU from the decoded bitmap`.

---

### Task 4: sRGB-format comparison operands with an equivalence proof

**Files:**
- Modify: `device-contract.ts` (`TextureFormat` gains `"rgba8unorm-srgb"`), `device.ts` (`gpuFormatFor` ~232-247, `bytesPerPixelFor` ~249-263 = 4; never `STORAGE_BINDING`), `engines/webgpu/rhi.ts:3-7`
- Modify: `webgpu/view.tsx` (`sceneFieldUpload` ~277 replaced by a bitmap upload with `format: "rgba8unorm-srgb"`; `decodedSourceUploadLease` ~242-265 likewise for `b`; cache keys at ~262 and ~1093 carry the format), `webgpu/pool.ts` if it validates formats
- Modify: `webgpu/__tests__/compare-metrics.browser.ts` (created by the review-fixes branch): add the equivalence case
- Leave: `resources/scene-field.ts` (`imageDataToSceneField` keeps its CPU callers)

- [ ] **Step 1: Confirm bindings** (grep `texture_storage_2d` and `copyTextureToTexture` under `webgpu/` — must be absent for operands) and that no readback (`device.ts` ~1203) targets an operand texture.
- [ ] **Step 2: Equivalence case first** in `compare-metrics.browser.ts`: upload one 64×64 sRGB fixture as `rgba32float` via `imageDataToSceneField` and as `rgba8unorm-srgb` via `copyExternalImageToTexture` from a bitmap of the same bytes; run a trivial `textureLoad` copy pass (or reuse an existing readback helper) and assert per-channel agreement ≤ 1e-5 for RGB and exact for alpha. It must FAIL before Step 3 (format not accepted) and PASS after.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify** `compare-metrics` (equivalence + `[metrics] mse` identical to the Task 3 run, quote both), `flip`, `hdr-flip`, `ssim`, `gpu-compare-split-numbers`, `gpu-cached-error-numbers`, `stacked-diff-flip`, `image-load-cost` (scene conversions 0 on the comparison panes). **Commit** `Let the GPU decode sRGB comparison operands`.

---

### Task 5: Gates, fixtures, docs

**Files:**
- Modify: `ui/src/plots/image/__tests__/image-load-cost.browser.ts` (turn baselines into the gates of spec §3.5; the tagged/translucent fixtures read back byte-identical via `decodedImage(...).imageData()` and via an element-path readback done in the harness; print the before/after ratio against the Task 0 numbers hard-coded from its commit message, as a BENCH line only)
- Modify: `docs/architecture.md` (one paragraph: decode resource, demand-driven readback, bitmap upload, sRGB operands, queue priority, margin decision), `docs/API.md` if it describes the load path
- Modify: `ui/src/host/lazy-mount.ts` comment only (state why 600 px stays)

- [ ] **Step 1:** Implement; `node scripts/test-harness.mjs --only image-load-cost`, then the full `npm run test:harness` (all pass).
- [ ] **Step 2: Commit** `Gate image load cost and document the decode path`.
