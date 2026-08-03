/**
 * Bounded caches for image render results and decoded loads. Both are LRU (see
 * `createLruMap`): they are keyed by content the user revisits (a URL, or a
 * url+mode+colormap render combo), and the natural access pattern is
 * scrub/toggle back and forth — so a key that is READ again must survive newer
 * arrivals. A FIFO evicts by insertion age and would drop exactly those
 * hot-but-old keys (e.g. the first image while paging through a long gallery
 * and back), causing avoidable re-decodes/re-renders.
 */
import { createLruMap } from "./lru-map.ts";

// Diff / false-color render results (keyed by url+mode+colormap combos). LRU so
// a re-shown combo (toggling mode/colormap back and forth) stays cached even
// after many other combos have been produced since.
const IMAGE_DATA_CACHE_MAX = 50;
const imageDataCache = createLruMap<ImageData>(IMAGE_DATA_CACHE_MAX);

export function getCachedImageData(key: string): ImageData | undefined {
  return imageDataCache.get(key);
}

export function setCachedImageData(key: string, data: ImageData): void {
  imageDataCache.set(key, data);
}

// Raw decoded ImageData from `loadImageData` (keyed by url). LRU for the same
// reason: paging through a gallery and back re-reads earlier URLs, and keeping
// the re-read ones resident avoids a redundant fetch+decode.
const IMAGE_LOAD_CACHE_MAX = 100;
const imageLoadCache = createLruMap<ImageData>(IMAGE_LOAD_CACHE_MAX);

export function getCachedLoadedImageData(key: string): ImageData | undefined {
  return imageLoadCache.get(key);
}

export function setCachedLoadedImageData(key: string, data: ImageData): void {
  imageLoadCache.set(key, data);
}
