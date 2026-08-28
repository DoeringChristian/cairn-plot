/**
 * Unit tests for the throttled, retrying image fetch (`fetch-image.ts`). Runs
 * under Node's test runner with type-stripping — no DOM; `fetch` is injected:
 *
 *   node --experimental-strip-types --test src/resources/fetch-image.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchImageBytes, MAX_CONCURRENT_IMAGE_FETCHES } from "./fetch-image.ts";

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
