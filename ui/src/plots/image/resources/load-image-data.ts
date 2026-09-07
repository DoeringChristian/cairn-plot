/**
 * `loadImageData(url)` — the full-frame `ImageData` for a URL.
 *
 * This used to BE the decode: an `Image` element, a scratch canvas and a
 * whole-frame `getImageData` on the main thread, cached forever by URL. It is
 * now a thin front for the one shared decode (`decoded-image.ts`), whose
 * readback is lazy and memoised and writes through to the same
 * `imageLoadCache` this function used to fill. Signature and contract are
 * unchanged (null on any failure), so every existing caller — the CPU
 * processing passes, the WebGPU colormap bake, the histogram — is untouched;
 * what changed is that asking for PIXELS no longer implies a second decode,
 * and NOT asking for them no longer costs a readback.
 */
import { getCachedLoadedImageData } from "./cache.ts";
import { decodedImage } from "./decoded-image.ts";

export async function loadImageData(url: string): Promise<ImageData | null> {
  const cached = getCachedLoadedImageData(url);
  if (cached) return cached;

  const decoded = await decodedImage(url);
  if (!decoded) return null;
  return await decoded.imageData();
}
