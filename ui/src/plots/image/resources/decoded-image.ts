/**
 * `resources/decoded-image.ts` — the ONE decode per image URL.
 *
 * Before this module a mounted 8-bit image card paid for two decodes and a
 * full-frame readback it usually did not need: `load-image-data.ts` decoded
 * through an `Image` element, drew it to a scratch canvas and called
 * `getImageData` over the whole frame on the main thread, while the CPU
 * backend decoded the same URL a second time for its paint source.
 *
 * The shape here (design §3.1):
 *
 *   - ONE decode per URL, off the main thread: `fetch` → `Blob` →
 *     `createImageBitmap(blob, { colorSpaceConversion: "default",
 *     premultiplyAlpha: "none" })`. Concurrent callers de-duplicate on the
 *     in-flight promise; later callers hit the entry LRU. Only this step is
 *     admitted through `decode-queue.ts`.
 *   - The element path (`new Image()` + `createImageBitmap(img)` — the body
 *     that used to live in `cpu/use-cpu-content.ts` as `bitmapFromUrl`) is the
 *     FALLBACK, for anything `fetch` cannot serve (an opaque cross-origin
 *     response, a non-2xx, a blob `createImageBitmap` rejects, or a runtime
 *     without `createImageBitmap` at all).
 *   - Pixels are LAZY: `imageData()` draws the bitmap once and memoises the
 *     result; `peekImageData()` exposes that memo synchronously. Nothing reads
 *     back at mount any more. The readback is deliberately NOT queued — a
 *     queued task waiting on a queued task could deadlock the slots.
 *   - `imageData()` WRITES THROUGH to `imageLoadCache` (`cache.ts`), which is
 *     what keeps the synchronous readers in `webgpu/view.tsx` (the resident
 *     upload lease, the paint-atomic `applySdr` fast path, `refU8Ref`) working
 *     unchanged.
 *   - `originClean` is false for a cross-origin element load without CORS: the
 *     bitmap can be PAINTED but never read back (a tainted canvas throws) and
 *     never uploaded with `copyExternalImageToTexture`. `imageData()` then
 *     resolves null rather than throwing.
 *
 * Bounds: `DECODED_IMAGE_CACHE_MAX = 50` entries, evicted by dropping the
 * reference ONLY — never `close()`, because a mounted CPU pane or a GPU
 * upload lease may still be holding the bitmap (see `cpu/bitmap-cache.ts` for
 * the same rule). A total failure is negative-cached for `NEGATIVE_CACHE_MS`
 * so a broken URL on a page of cards is not retried on every render.
 */
import { setCachedLoadedImageData } from "./cache.ts";
import { DecodeCancelled, enqueueDecode } from "./decode-queue.ts";
import { createLruMap } from "./lru-map.ts";

/** A decoded image plus its lazy, memoised pixels. */
export interface DecodedImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /** An element only where `createImageBitmap` is missing or rejected it. */
  readonly bitmap: ImageBitmap | HTMLImageElement;
  /** False for a cross-origin source without CORS: paintable, never readable. */
  readonly originClean: boolean;
  /** Lazy, memoised full-frame readback; null when `!originClean`. Not queued. */
  imageData(): Promise<ImageData | null>;
  /** The memoised readback if it already happened, else null. Synchronous. */
  peekImageData(): ImageData | null;
}

/** A raw decode result, before it becomes a cached `DecodedImage`. */
export interface DecodedElement {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  originClean: boolean;
}

/** Everything that touches the platform, injected so the unit tests need no DOM. */
export interface DecodedImageDeps {
  fetchBlob(url: string): Promise<Blob>;
  decodeBlob(blob: Blob): Promise<ImageBitmap>;
  decodeElement(url: string): Promise<DecodedElement | null>;
  readback(bitmap: ImageBitmap | HTMLImageElement, width: number, height: number): ImageData | null;
  now(): number;
}

export const DECODED_IMAGE_CACHE_MAX = 50;
const NEGATIVE_CACHE_MS = 5_000;

// Never an `onEvict`: eviction drops the reference, it does NOT close the
// bitmap a pane may still be painting.
const entries = createLruMap<DecodedImage>(DECODED_IMAGE_CACHE_MAX);
const inFlight = new Map<string, Promise<DecodedImage | null>>();
/** url → the clock reading at which the decode failed outright. */
const failures = new Map<string, number>();

/** The resident entry for `url`, or null. Synchronous; never starts a decode. */
export function peekDecodedImage(url: string): DecodedImage | null {
  return entries.get(url) ?? null;
}

/**
 * The one decode. Cached by URL, in-flight de-duplicated, negative-cached for
 * `NEGATIVE_CACHE_MS` on a total failure. `deps` exists for the tests; production
 * callers pass nothing.
 */
export function decodedImage(url: string, deps: DecodedImageDeps = defaultDeps): Promise<DecodedImage | null> {
  const resident = entries.get(url);
  if (resident) return Promise.resolve(resident);

  const pending = inFlight.get(url);
  if (pending) return pending;

  const failedAt = failures.get(url);
  if (failedAt !== undefined) {
    if (deps.now() - failedAt < NEGATIVE_CACHE_MS) return Promise.resolve(null);
    failures.delete(url);
  }

  const promise = produce(url, deps).finally(() => {
    inFlight.delete(url);
  });
  inFlight.set(url, promise);
  return promise;
}

async function produce(url: string, deps: DecodedImageDeps): Promise<DecodedImage | null> {
  let decoded: DecodedElement | null;
  try {
    // Only the DECODE is admitted through the queue.
    decoded = await enqueueDecode(url, () => decodeOnce(url, deps));
  } catch (error) {
    // A cancelled decode is not a failure: nobody wants it any more, and a
    // later requester must be free to ask again.
    if (error instanceof DecodeCancelled) return null;
    decoded = null;
  }
  if (!decoded) {
    failures.set(url, deps.now());
    return null;
  }
  const entry = makeEntry(url, decoded, deps);
  entries.set(url, entry);
  return entry;
}

async function decodeOnce(url: string, deps: DecodedImageDeps): Promise<DecodedElement | null> {
  try {
    const blob = await deps.fetchBlob(url);
    const bitmap = await deps.decodeBlob(blob);
    // `fetch` only reaches here same-origin or with CORS, so the bytes are ours.
    return { bitmap, width: bitmap.width, height: bitmap.height, originClean: true };
  } catch {
    // Opaque / non-2xx / unsupported blob: the element path may still paint it.
    return await deps.decodeElement(url);
  }
}

function makeEntry(url: string, decoded: DecodedElement, deps: DecodedImageDeps): DecodedImage {
  let memo: ImageData | null = null;
  let reading: Promise<ImageData | null> | null = null;
  return {
    url,
    width: decoded.width,
    height: decoded.height,
    bitmap: decoded.bitmap,
    originClean: decoded.originClean,
    imageData(): Promise<ImageData | null> {
      if (memo) {
        // Re-assert the write-through: `imageLoadCache` is a bounded LRU and
        // may have evicted this entry since.
        setCachedLoadedImageData(url, memo);
        return Promise.resolve(memo);
      }
      if (!decoded.originClean) return Promise.resolve(null);
      if (reading) return reading;
      reading = (async () => {
        const data = deps.readback(decoded.bitmap, decoded.width, decoded.height);
        if (data) {
          memo = data;
          setCachedLoadedImageData(url, data);
        }
        reading = null;
        return data;
      })();
      return reading;
    },
    peekImageData(): ImageData | null {
      return memo;
    },
  };
}

// --- the platform ---------------------------------------------------------

/** True for data:/blob: URLs and anything on this document's origin. */
function isSameOrigin(url: string): boolean {
  if (/^(data|blob):/i.test(url)) return true;
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    // A relative URL in a context without `location`: treat as ours.
    return true;
  }
}

/**
 * The element fallback — the body that used to be `bitmapFromUrl` in
 * `cpu/use-cpu-content.ts`, plus the origin-cleanliness the readback needs.
 * A cross-origin element load without `crossOrigin` taints any canvas it is
 * drawn into, so it is painted but never read back.
 */
export async function decodeElementImage(url: string): Promise<DecodedElement | null> {
  const img = new Image();
  img.decoding = "async";
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!ok) return null;
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const originClean = isSameOrigin(url) || img.crossOrigin != null;
  if (typeof createImageBitmap === "function") {
    try {
      return { bitmap: await createImageBitmap(img), width, height, originClean };
    } catch {
      /* fall through to the element itself — `drawImage` accepts it */
    }
  }
  return { bitmap: img, width, height, originClean };
}

const defaultDeps: DecodedImageDeps = {
  async fetchBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    // An opaque response has no readable bytes; a non-2xx has the wrong ones.
    if (!response.ok || response.type === "opaque") {
      throw new Error(`[cairn] decodedImage: ${response.status} for ${url}`);
    }
    return await response.blob();
  },
  decodeBlob(blob: Blob): Promise<ImageBitmap> {
    // `"default"` colour-space conversion keeps today's pixels (the element
    // path normalises to sRGB); `"none"` would change tagged PNGs.
    return createImageBitmap(blob, { colorSpaceConversion: "default", premultiplyAlpha: "none" });
  },
  decodeElement: decodeElementImage,
  readback(bitmap, width, height): ImageData | null {
    try {
      const source = bitmap as CanvasImageSource;
      if (typeof OffscreenCanvas === "function") {
        const context = new OffscreenCanvas(width, height).getContext("2d");
        if (!context) return null;
        context.drawImage(source, 0, 0);
        return context.getImageData(0, 0, width, height);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(source, 0, 0);
      return context.getImageData(0, 0, width, height);
    } catch (error) {
      // A tainted canvas throws `SecurityError` here — the pixels are simply
      // unavailable, which every caller already handles as a null.
      console.warn("[cairn] decodedImage readback failed:", error);
      return null;
    }
  },
  now: () => Date.now(),
};
