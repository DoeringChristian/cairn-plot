/**
 * Unit tests for the throttled, retrying image fetch (`fetch-image.ts`). Runs
 * under Node's test runner with type-stripping — no DOM; `fetch` is injected:
 *
 *   node --experimental-strip-types --test src/resources/fetch-image.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchImageBytes,
  fetchWithTimeout,
  IMAGE_FETCH_TIMEOUT_MS,
  MAX_CONCURRENT_IMAGE_FETCHES,
} from "./fetch-image.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const resp = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? "ok" : null, { status, headers });

test("retries a transient 429 then succeeds", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return calls < 3 ? resp(429) : resp(200);
  }) as unknown as typeof fetch;
  const res = await fetchImageBytes("u", { fetchImpl, backoffBaseMs: 1 });
  assert.equal(res.status, 200);
  assert.equal(calls, 3, "one initial + two retries");
});

test("honours a Retry-After header without breaking (and still recovers)", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return calls < 2 ? resp(503, { "retry-after": "0" }) : resp(200);
  }) as unknown as typeof fetch;
  const res = await fetchImageBytes("u", { fetchImpl, backoffBaseMs: 1 });
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test("gives up after `retries` and RETURNS the last 429 (does not throw)", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return resp(429);
  }) as unknown as typeof fetch;
  const res = await fetchImageBytes("u", { fetchImpl, backoffBaseMs: 1, retries: 2 });
  assert.equal(res.status, 429, "the caller reports a persistent failure");
  assert.equal(calls, 3, "initial + 2 retries");
});

test("retries a thrown network error, then rethrows if it never recovers", async () => {
  // recovers on the 2nd try
  let a = 0;
  const flaky = (async () => {
    a++;
    if (a < 2) throw new Error("network");
    return resp(200);
  }) as unknown as typeof fetch;
  assert.equal((await fetchImageBytes("u", { fetchImpl: flaky, backoffBaseMs: 1 })).status, 200);

  // never recovers → rejects after exhausting retries
  const dead = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  await assert.rejects(() => fetchImageBytes("u", { fetchImpl: dead, backoffBaseMs: 1, retries: 2 }), /network down/);
});

test("a 404 (or any non-429/503) returns immediately — no retry", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return resp(404);
  }) as unknown as typeof fetch;
  const res = await fetchImageBytes("u", { fetchImpl, backoffBaseMs: 1 });
  assert.equal(res.status, 404);
  assert.equal(calls, 1, "a 404 is not transient — no retry");
});

test("bounds concurrency to MAX_CONCURRENT_IMAGE_FETCHES", async () => {
  let concurrent = 0;
  let peak = 0;
  const fetchImpl = (async () => {
    concurrent++;
    peak = Math.max(peak, concurrent);
    await sleep(5);
    concurrent--;
    return resp(200);
  }) as unknown as typeof fetch;
  await Promise.all(
    Array.from({ length: MAX_CONCURRENT_IMAGE_FETCHES * 3 }, () =>
      fetchImageBytes("u", { fetchImpl, backoffBaseMs: 1 }),
    ),
  );
  assert.ok(peak <= MAX_CONCURRENT_IMAGE_FETCHES, `peak ${peak} ≤ ${MAX_CONCURRENT_IMAGE_FETCHES}`);
  assert.ok(peak >= 1);
});

// --- deadlines -------------------------------------------------------------
// A hung request never rejects on its own, and everything downstream (the
// resolve cache, the pane's held frame, the preparation scheduler) waits on the
// promise, so the pane stays stuck with no error recorded anywhere.

/** A fetch that hangs until its abort signal fires — a stalled server. */
const hangingFetch = (async (_url: string, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")));
  })) as unknown as typeof fetch;

test("fetchWithTimeout: a stalled request rejects with a clear timeout error", async () => {
  await assert.rejects(
    () => fetchWithTimeout("http://stalled/x.exr", { fetchImpl: hangingFetch, timeoutMs: 20 }),
    (err: Error) => /timed out after 20 ms/.test(err.message) && err.message.includes("http://stalled/x.exr"),
  );
});

test("fetchWithTimeout: passes a normal response straight through", async () => {
  const fetchImpl = (async () => resp(200)) as unknown as typeof fetch;
  const res = await fetchWithTimeout("u", { fetchImpl, timeoutMs: 50 });
  assert.equal(res.status, 200);
});

test("fetchImageBytes: a stalled request times out and is NOT retried", async () => {
  let calls = 0;
  const counting = (async (url: string, init?: RequestInit) => {
    calls++;
    return hangingFetch(url, init);
  }) as unknown as typeof fetch;
  await assert.rejects(
    () => fetchImageBytes("http://stalled/y.png", { fetchImpl: counting, timeoutMs: 20, backoffBaseMs: 1 }),
    /timed out after 20 ms/,
  );
  // The deadline is already generous; retrying a stalled host would multiply it.
  assert.equal(calls, 1);
});

test("fetchImageBytes: a rejecting fetch still surfaces as a rejection after its retries", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    throw new TypeError("NetworkError when attempting to fetch resource.");
  }) as unknown as typeof fetch;
  await assert.rejects(
    () => fetchImageBytes("u", { fetchImpl, retries: 2, backoffBaseMs: 1 }),
    /NetworkError/,
  );
  assert.equal(calls, 3, "the first try plus both retries");
});

test("fetchWithTimeout: a slow BODY is never cut off — the deadline is on the headers", async () => {
  // A healthy 200 MB EXR can take minutes to transfer. The timer must be cleared
  // when the response resolves, not when the body finishes.
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = new Promise<string>((resolve) => setTimeout(() => resolve("ok"), 60));
    return {
      status: 200,
      ok: true,
      // The signal stays live in the real API too; what matters is that nothing
      // aborts it any more once the response has been handed over.
      async text() {
        if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
        return body;
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  const res = await fetchWithTimeout("u", { fetchImpl, timeoutMs: 20 });
  await sleep(40); // well past the deadline, with the body still streaming
  assert.equal(await res.text(), "ok");
});

test("the default deadline is the documented one", () => {
  assert.equal(IMAGE_FETCH_TIMEOUT_MS, 60_000);
});
