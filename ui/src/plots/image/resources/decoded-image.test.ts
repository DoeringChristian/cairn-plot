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
import { DECODE_CONCURRENCY, decodeQueueStats, enqueueDecode } from "./decode-queue.ts";
import {
  DECODED_IMAGE_CACHE_MAX,
  decodedImage,
  negativeCacheSize,
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

/**
 * Fill every decode slot, so the NEXT `decodedImage` call is QUEUED rather than
 * running — the only state in which a decode can still be cancelled. Returns
 * the release, which must be awaited before the queue drains.
 */
let busyCounter = 0;
function occupySlots(): () => Promise<void> {
  const opens: (() => void)[] = [];
  for (let i = 0; i < DECODE_CONCURRENCY; i++) {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    void enqueueDecode(`busy-${busyCounter++}`, () => gate);
    opens.push(open);
  }
  return async () => {
    opens.forEach((open) => open());
    // Let the queue pump and whatever it starts settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
}

test("two concurrent calls for one URL decode exactly once", async () => {
  const url = nextUrl();
  const h = harness();
  const [a, b] = await Promise.all([decodedImage(url, { deps: h.deps }), decodedImage(url, { deps: h.deps })]);

  assert.ok(a && b);
  assert.equal(a, b, "both callers get the SAME entry");
  assert.equal(h.calls.fetchBlob, 1);
  assert.equal(h.calls.decodeBlob, 1);
  assert.equal(h.calls.decodeElement, 0, "the fetch path never touched the element fallback");
  assert.equal(a.width, 4);
  assert.equal(a.height, 2);
  assert.equal(a.originClean, true);

  // A later call is served from the cache, and `peekDecodedImage` sees it.
  assert.equal(await decodedImage(url, { deps: h.deps }), a);
  assert.equal(peekDecodedImage(url), a);
  assert.equal(h.calls.decodeBlob, 1);
});

test("imageData() is lazy and memoised; peekImageData() is null until it happens", async () => {
  const url = nextUrl();
  const h = harness();
  const entry = await decodedImage(url, { deps: h.deps });
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
  const entry = await decodedImage(url, { deps: h.deps });

  assert.ok(entry);
  assert.equal(h.calls.decodeElement, 1);
  assert.equal(h.calls.decodeBlob, 0, "the blob decode is skipped when the fetch failed");
  assert.equal(entry.originClean, true);
  assert.ok(await entry.imageData());

  // Same fallback when the fetch succeeds but `createImageBitmap` rejects.
  const url2 = nextUrl();
  const h2 = harness({ decodeFails: true, element: { originClean: false } });
  const entry2 = await decodedImage(url2, { deps: h2.deps });
  assert.ok(entry2);
  assert.equal(h2.calls.decodeBlob, 1);
  assert.equal(h2.calls.decodeElement, 1);
  assert.equal(entry2.originClean, false);
});

test("a non-origin-clean image resolves imageData() to null WITHOUT a readback", async () => {
  const url = nextUrl();
  const h = harness({ fetchFails: true, element: { originClean: false } });
  const entry = await decodedImage(url, { deps: h.deps });
  assert.ok(entry);

  assert.equal(await entry.imageData(), null);
  assert.equal(entry.peekImageData(), null);
  assert.equal(h.calls.readback, 0, "a tainted source is never read back");
  assert.equal(getCachedLoadedImageData(url), undefined, "and nothing is written through");
});

test("a readback that returns null is not memoised as a success", async () => {
  const url = nextUrl();
  const h = harness({ readbackFails: true });
  const entry = await decodedImage(url, { deps: h.deps });
  assert.ok(entry);

  assert.equal(await entry.imageData(), null);
  assert.equal(entry.peekImageData(), null);
  assert.equal(getCachedLoadedImageData(url), undefined);
});

test("a total failure resolves null and is negative-cached for 5 s", async () => {
  const url = nextUrl();
  const h = harness({ fetchFails: true, element: null });

  assert.equal(await decodedImage(url, { deps: h.deps }), null);
  assert.equal(h.calls.decodeElement, 1);

  // Within 5 s: not re-attempted.
  h.clock.value += 4_999;
  assert.equal(await decodedImage(url, { deps: h.deps }), null);
  assert.equal(h.calls.fetchBlob, 1, "no second fetch inside the negative window");
  assert.equal(h.calls.decodeElement, 1);

  // After 5 s: re-attempted, and it can now succeed.
  h.clock.value += 2;
  const ok = harness();
  ok.clock.value = h.clock.value;
  const entry = await decodedImage(url, { deps: ok.deps });
  assert.ok(entry, "the negative entry expired and the retry succeeded");
  assert.equal(ok.calls.fetchBlob, 1);
});

test("the negative cache is bounded and evicts the oldest failures first", async () => {
  const h = harness({ fetchFails: true, element: null });
  const urls = Array.from({ length: DECODED_IMAGE_CACHE_MAX + 5 }, () => nextUrl());
  for (const url of urls) {
    assert.equal(await decodedImage(url, { deps: h.deps }), null);
  }
  assert.equal(
    negativeCacheSize(),
    DECODED_IMAGE_CACHE_MAX,
    "bounded to DECODED_IMAGE_CACHE_MAX, not left to grow with every broken URL",
  );

  // The oldest URL (insertion order) was evicted to stay within the bound, so
  // re-asking for it — still inside the 5 s negative window — is NOT served
  // from a negative cache entry: it is retried immediately.
  const fetchesBefore = h.calls.fetchBlob;
  assert.equal(await decodedImage(urls[0]!, { deps: h.deps }), null);
  assert.equal(
    h.calls.fetchBlob,
    fetchesBefore + 1,
    "the evicted URL was re-attempted rather than negatively cached",
  );

  // The most recently failed URL is still within the bound and the window:
  // it IS served from the negative cache, no new fetch.
  const fetchesBefore2 = h.calls.fetchBlob;
  assert.equal(await decodedImage(urls[urls.length - 1]!, { deps: h.deps }), null);
  assert.equal(h.calls.fetchBlob, fetchesBefore2, "a still-cached URL is not retried inside the window");
});

test("the entry LRU evicts the least-recently-used WITHOUT closing its bitmap", async () => {
  const h = harness();
  const first = nextUrl();
  assert.ok(await decodedImage(first, { deps: h.deps }));
  assert.equal(peekDecodedImage(first)?.url, first);

  for (let i = 0; i < DECODED_IMAGE_CACHE_MAX; i++) {
    assert.ok(await decodedImage(nextUrl(), { deps: h.deps }));
  }

  assert.equal(peekDecodedImage(first), null, "the oldest entry was evicted");
  assert.equal(h.calls.close, 0, "eviction drops the reference only — never close()");
});

test("a call aborted while its decode is QUEUED cancels the decode and resolves null", async () => {
  const url = nextUrl();
  const h = harness();
  const free = occupySlots();
  const controller = new AbortController();
  const pending = decodedImage(url, { deps: h.deps, signal: controller.signal });
  assert.equal(decodeQueueStats().queued, 1, "the decode is queued behind the busy slots");

  controller.abort();
  assert.equal(await pending, null, "an aborted call resolves null — nothing to show");
  assert.equal(decodeQueueStats().queued, 0, "the LAST requester let go, so the decode was dropped");
  await free();
  assert.equal(h.calls.fetchBlob, 0, "the cancelled decode never ran");

  // A cancellation is NOT a failure: the URL is not negative-cached.
  const entry = await decodedImage(url, { deps: h.deps });
  assert.ok(entry, "a later caller decodes it normally");
  assert.equal(h.calls.fetchBlob, 1);
});

test("a second, un-aborted caller for the same URL keeps the queued decode alive", async () => {
  const url = nextUrl();
  const h = harness();
  const free = occupySlots();
  const controller = new AbortController();
  const first = decodedImage(url, { deps: h.deps, signal: controller.signal });
  const second = decodedImage(url, { deps: h.deps });
  assert.deepEqual(decodeQueueStats(), { running: DECODE_CONCURRENCY, queued: 1 }, "ONE shared decode");

  controller.abort();
  assert.equal(await first, null);
  assert.equal(decodeQueueStats().queued, 1, "the surviving caller's retain kept it queued");

  await free();
  const entry = await second;
  assert.ok(entry, "the caller that never aborted still gets the image");
  assert.equal(h.calls.fetchBlob, 1, "decoded exactly once");
});

test("a caller that joins a decode cancelled in the same tick asks again", async () => {
  // The pane shape this exists for: an effect cleanup aborts (dropping the last
  // ref, which cancels the queued decode) and the effect's re-run asks for the
  // SAME url one statement later, while the dying promise is still in-flight.
  const url = nextUrl();
  const h = harness();
  const free = occupySlots();
  const controller = new AbortController();
  const abandoned = decodedImage(url, { deps: h.deps, signal: controller.signal });
  controller.abort();
  const remounted = decodedImage(url, { deps: h.deps });

  assert.equal(await abandoned, null);
  await free();
  const entry = await remounted;
  assert.ok(entry, "the re-mounted caller still gets its image");
  assert.equal(h.calls.fetchBlob, 1);
});

test("imageData() writes through to imageLoadCache for the synchronous readers", async () => {
  const url = nextUrl();
  const h = harness();
  const entry = await decodedImage(url, { deps: h.deps });
  assert.ok(entry);

  assert.equal(getCachedLoadedImageData(url), undefined, "not written before the demand");
  const data = await entry.imageData();
  assert.ok(data);
  assert.equal(getCachedLoadedImageData(url), data, "the SAME object the readers find");
});
