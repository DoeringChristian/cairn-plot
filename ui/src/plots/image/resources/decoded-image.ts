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
 * CANCELLATION is per CALL, through an `AbortSignal`. Every call retains the
 * URL in the decode queue before enqueueing and releases it when it settles —
 * or as soon as its signal aborts, which resolves that call with `null` ("show
 * nothing"). The queue drops a still-QUEUED decode only when its LAST requester
 * lets go, so a pane unmounting frees the slot while a second pane on the same
 * URL keeps the decode alive. A caller whose shared decode was cancelled out
 * from under it (its own effect cleanup released the last ref one tick before
 * the re-run retained it again) simply asks again — a cancelled decode is never
 * a failure and is never negative-cached.
 *
 * Bounds: `DECODED_IMAGE_CACHE_MAX = 50` entries, evicted by dropping the
 * reference ONLY — never `close()`, because a mounted CPU pane or a GPU
 * upload lease may still be holding the bitmap (see `cpu/bitmap-cache.ts` for
 * the same rule). A failed decode resolves `null` EVERY time it is asked —
 * there is no negative cache: a cached failure looks exactly like "still
 * loading" to the pane, and hid the real error from the surface.
 */
import { setCachedLoadedImageData } from "./cache.ts";
import { DecodeCancelled, enqueueDecode, releaseDecode, retainDecode } from "./decode-queue.ts";
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

// Never an `onEvict`: eviction drops the reference, it does NOT close the
// bitmap a pane may still be painting.
const entries = createLruMap<DecodedImage>(DECODED_IMAGE_CACHE_MAX);
const inFlight = new Map<string, Promise<DecodedImage | null>>();

/** The resident entry for `url`, or null. Synchronous; never starts a decode. */
export function peekDecodedImage(url: string): DecodedImage | null {
  return entries.get(url) ?? null;
}

/** Per-call options. `deps` exists for the tests; production callers pass at
 *  most a `signal`. */
export interface DecodedImageOptions {
  /** Abort this CALL: it resolves `null` and drops its hold on the decode. */
  signal?: AbortSignal;
  /** Injected platform, for the unit tests. */
  deps?: DecodedImageDeps;
}

/**
 * The one decode. Cached by URL and in-flight de-duplicated. A total failure
 * resolves `null` and is NOT cached — every ask retries.
 *
 * The call holds a decode-queue retain for as long as it wants the result;
 * aborting `options.signal` drops that hold and resolves the call with `null`
 * (never a rejection — an aborted caller has "nothing to show", which every
 * pane already handles). The DECODE itself outlives an abort only while some
 * OTHER call still wants it.
 */
export function decodedImage(url: string, options: DecodedImageOptions = {}): Promise<DecodedImage | null> {
  return request(url, options.deps ?? defaultDeps, options.signal);
}

/** The outcome of joining one shared decode: the entry, "nothing", or "the
 *  shared decode was cancelled while this call still wanted it". */
const RETRY = Symbol("decode-retry");

async function request(
  url: string,
  deps: DecodedImageDeps,
  signal: AbortSignal | undefined,
): Promise<DecodedImage | null> {
  for (;;) {
    const resident = entries.get(url);
    if (resident) return resident;
    if (signal?.aborted) return null;

    const outcome = await join(url, deps, signal);
    if (outcome !== RETRY) return outcome;
  }
}

/**
 * Join (or start) the shared decode for `url` under ONE retain of this call's
 * own, racing it against `signal`. The retain is what keeps a queued decode
 * alive: it is taken BEFORE the enqueue and dropped the instant this call
 * settles, so the last pane to let go is the one that frees the slot.
 */
function join(
  url: string,
  deps: DecodedImageDeps,
  signal: AbortSignal | undefined,
): Promise<DecodedImage | null | typeof RETRY> {
  retainDecode(url);
  let shared = inFlight.get(url);
  if (!shared) {
    // `inFlight` is cleared BEFORE any joiner's reaction runs (the `finally`
    // settles first), so a retry below always starts a fresh decode.
    shared = produce(url, deps).finally(() => {
      inFlight.delete(url);
    });
    inFlight.set(url, shared);
  }
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: DecodedImage | null | typeof RETRY) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      releaseDecode(url);
      resolve(value);
    };
    const onAbort = () => settle(null);
    signal?.addEventListener("abort", onAbort);
    shared.then(
      (entry) => settle(entry),
      // A cancelled shared decode is not a failure: this call still wants the
      // image, so the loop above asks again.
      (error) => settle(error instanceof DecodeCancelled ? RETRY : null),
    );
  });
}

async function produce(url: string, deps: DecodedImageDeps): Promise<DecodedImage | null> {
  let decoded: DecodedElement | null;
  try {
    // Only the DECODE is admitted through the queue.
    decoded = await enqueueDecode(url, () => decodeOnce(url, deps));
  } catch (error) {
    // Cancellation propagates to the joiners, which decide (by whether THEY
    // were aborted) between asking again and giving up. It is never a failure.
    if (error instanceof DecodeCancelled) throw error;
    decoded = null;
  }
  // A failed decode is NOT cached: the next ask retries. A silently-swallowed
  // failure that stuck around for 5 s was indistinguishable from "still
  // loading", and the pane it fed had nothing to report.
  if (!decoded) return null;
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
      // Deferred deliberately (`Promise.resolve().then`): the whole chain runs
      // in a microtask, AFTER `reading` has been assigned below, so the clear
      // at the end really clears. Only a SUCCESS is memoised — a readback that
      // returns null or throws leaves nothing parked here for every later
      // demand to inherit.
      const attempt = Promise.resolve()
        .then(() => deps.readback(decoded.bitmap, decoded.width, decoded.height))
        .catch((error): ImageData | null => {
          console.warn("[cairn] decodedImage readback threw:", error);
          return null;
        })
        .then((data) => {
          if (data) {
            memo = data;
            setCachedLoadedImageData(url, data);
          }
          reading = null;
          return data;
        });
      reading = attempt;
      return attempt;
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
