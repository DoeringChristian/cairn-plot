/**
 * Unit tests for the ONE decode resource (`decoded-image.ts`).
 *
 * Every dependency is injected (`DecodedImageDeps`), so these run under
 * `node:test` with no DOM: the fetch, the blob decode, the element fallback,
 * the readback and the clock are all fakes and all counted. What is locked
 * here is the design's §3.1 contract:
 *   - ONE decode per URL (concurrent callers de-duplicate, later callers hit
 *     the cache);
 *   - the full-frame readback is LAZY and memoised, `peekImageData()` exposes
 *     it synchronously only once it happened;
 *   - a failed `fetch` falls back to the element path and carries its
 *     `originClean`; a non-origin-clean image never reaches the readback;
 *   - a total failure is negative-cached for 5 s (injected clock);
 *   - the entry LRU evicts by dropping the reference ONLY — never `close()`,
 *     because a mounted pane or a GPU lease may still hold the bitmap;
 *   - `imageData()` writes through to `imageLoadCache`, which is what keeps
 *     the synchronous readers in `webgpu/view.tsx` working.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/resources/decoded-image.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { getCachedLoadedImageData } from "./cache.ts";
import {
  DECODED_IMAGE_CACHE_MAX,
  decodedImage,
  peekDecodedImage,
  type DecodedImageDeps,
} from "./decoded-image.ts";

let urlCounter = 0;
/** A fresh URL per case — the caches are module-level and shared across tests. */
const nextUrl = (): string => `https://example.test/img-${urlCounter++}.png`;

interface Harness {
  deps: DecodedImageDeps;
  calls: { fetchBlob: number; decodeBlob: number; decodeElement: number; readback: number; close: number };
  clock: { value: number };
}

interface HarnessOptions {
  /** Reject `fetchBlob` (drives the element fallback). */
  fetchFails?: boolean;
  /** Reject `decodeBlob` too (drives the element fallback). */
  decodeFails?: boolean;
  /** `decodeElement` resolves null (a total failure) or an entry with this cleanliness. */
  element?: { originClean: boolean } | null;
  /** `readback` returns null (e.g. a tainted canvas). */
  readbackFails?: boolean;
}

const fakeImageData = (width: number, height: number): ImageData =>
  ({ data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: "srgb" }) as ImageData;

function harness(options: HarnessOptions = {}): Harness {
  const calls = { fetchBlob: 0, decodeBlob: 0, decodeElement: 0, readback: 0, close: 0 };
  const clock = { value: 1_000 };
  const bitmap = (width: number, height: number): ImageBitmap =>
    ({ width, height, close: () => void calls.close++ }) as unknown as ImageBitmap;
  const deps: DecodedImageDeps = {
    async fetchBlob() {
      calls.fetchBlob++;
      if (options.fetchFails) throw new Error("fetch failed");
      return {} as Blob;
    },
    async decodeBlob() {
      calls.decodeBlob++;
      if (options.decodeFails) throw new Error("decode failed");
      return bitmap(4, 2);
    },
    async decodeElement() {
      calls.decodeElement++;
      const element = options.element;
      if (!element) return null;
      return { bitmap: bitmap(4, 2), width: 4, height: 2, originClean: element.originClean };
    },
    readback(_bitmap, width, height) {
      calls.readback++;
      return options.readbackFails ? null : fakeImageData(width, height);
    },
    now: () => clock.value,
  };
  return { deps, calls, clock };
}

test("two concurrent calls for one URL decode exactly once", async () => {
  const url = nextUrl();
  const h = harness();
  const [a, b] = await Promise.all([decodedImage(url, h.deps), decodedImage(url, h.deps)]);

  assert.ok(a && b);
  assert.equal(a, b, "both callers get the SAME entry");
  assert.equal(h.calls.fetchBlob, 1);
  assert.equal(h.calls.decodeBlob, 1);
  assert.equal(h.calls.decodeElement, 0, "the fetch path never touched the element fallback");
  assert.equal(a.width, 4);
  assert.equal(a.height, 2);
  assert.equal(a.originClean, true);

  // A later call is served from the cache, and `peekDecodedImage` sees it.
  assert.equal(await decodedImage(url, h.deps), a);
  assert.equal(peekDecodedImage(url), a);
  assert.equal(h.calls.decodeBlob, 1);
});

test("imageData() is lazy and memoised; peekImageData() is null until it happens", async () => {
  const url = nextUrl();
  const h = harness();
  const entry = await decodedImage(url, h.deps);
  assert.ok(entry);

  assert.equal(h.calls.readback, 0, "decoding does NOT read back");
  assert.equal(entry.peekImageData(), null, "nothing memoised yet");

  const [first, second] = await Promise.all([entry.imageData(), entry.imageData()]);
  assert.ok(first);
  assert.equal(first, second);
  assert.equal(h.calls.readback, 1, "concurrent demands read back once");

  const third = await entry.imageData();
  assert.equal(third, first);
  assert.equal(h.calls.readback, 1, "a later demand is served from the memo");
  assert.equal(entry.peekImageData(), first, "and synchronously");
});

test("a failed fetch falls back to the element path and carries its originClean", async () => {
  const url = nextUrl();
  const h = harness({ fetchFails: true, element: { originClean: true } });
  const entry = await decodedImage(url, h.deps);

  assert.ok(entry);
  assert.equal(h.calls.decodeElement, 1);
  assert.equal(h.calls.decodeBlob, 0, "the blob decode is skipped when the fetch failed");
  assert.equal(entry.originClean, true);
  assert.ok(await entry.imageData());

  // Same fallback when the fetch succeeds but `createImageBitmap` rejects.
  const url2 = nextUrl();
  const h2 = harness({ decodeFails: true, element: { originClean: false } });
  const entry2 = await decodedImage(url2, h2.deps);
  assert.ok(entry2);
  assert.equal(h2.calls.decodeBlob, 1);
  assert.equal(h2.calls.decodeElement, 1);
  assert.equal(entry2.originClean, false);
});

test("a non-origin-clean image resolves imageData() to null WITHOUT a readback", async () => {
  const url = nextUrl();
  const h = harness({ fetchFails: true, element: { originClean: false } });
  const entry = await decodedImage(url, h.deps);
  assert.ok(entry);

  assert.equal(await entry.imageData(), null);
  assert.equal(entry.peekImageData(), null);
  assert.equal(h.calls.readback, 0, "a tainted source is never read back");
  assert.equal(getCachedLoadedImageData(url), undefined, "and nothing is written through");
});

test("a readback that returns null is not memoised as a success", async () => {
  const url = nextUrl();
  const h = harness({ readbackFails: true });
  const entry = await decodedImage(url, h.deps);
  assert.ok(entry);

  assert.equal(await entry.imageData(), null);
  assert.equal(entry.peekImageData(), null);
  assert.equal(getCachedLoadedImageData(url), undefined);
});

test("a total failure resolves null and is negative-cached for 5 s", async () => {
  const url = nextUrl();
  const h = harness({ fetchFails: true, element: null });

  assert.equal(await decodedImage(url, h.deps), null);
  assert.equal(h.calls.decodeElement, 1);

  // Within 5 s: not re-attempted.
  h.clock.value += 4_999;
  assert.equal(await decodedImage(url, h.deps), null);
  assert.equal(h.calls.fetchBlob, 1, "no second fetch inside the negative window");
  assert.equal(h.calls.decodeElement, 1);

  // After 5 s: re-attempted, and it can now succeed.
  h.clock.value += 2;
  const ok = harness();
  ok.clock.value = h.clock.value;
  const entry = await decodedImage(url, ok.deps);
  assert.ok(entry, "the negative entry expired and the retry succeeded");
  assert.equal(ok.calls.fetchBlob, 1);
});

test("the entry LRU evicts the least-recently-used WITHOUT closing its bitmap", async () => {
  const h = harness();
  const first = nextUrl();
  assert.ok(await decodedImage(first, h.deps));
  assert.equal(peekDecodedImage(first)?.url, first);

  for (let i = 0; i < DECODED_IMAGE_CACHE_MAX; i++) {
    assert.ok(await decodedImage(nextUrl(), h.deps));
  }

  assert.equal(peekDecodedImage(first), null, "the oldest entry was evicted");
  assert.equal(h.calls.close, 0, "eviction drops the reference only — never close()");
});

test("imageData() writes through to imageLoadCache for the synchronous readers", async () => {
  const url = nextUrl();
  const h = harness();
  const entry = await decodedImage(url, h.deps);
  assert.ok(entry);

  assert.equal(getCachedLoadedImageData(url), undefined, "not written before the demand");
  const data = await entry.imageData();
  assert.ok(data);
  assert.equal(getCachedLoadedImageData(url), data, "the SAME object the readers find");
});
