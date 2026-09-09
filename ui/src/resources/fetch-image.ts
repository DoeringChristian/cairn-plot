/**
 * Throttled, retrying image fetch — the ONE gate every URL-image fetch goes
 * through (see `plot-descriptor.ts`).
 *
 * A large gallery of URL images (e.g. the OpenEXR sample set — 97 files) can
 * trip a host's rate limit (raw.githubusercontent → `429 Too Many Requests`) if
 * many panes fetch at once. So:
 *   - BOUND the concurrent image fetches ({@link MAX_CONCURRENT_IMAGE_FETCHES}),
 *     so the burst never exceeds the host's limit; and
 *   - RETRY a transient `429`/`503` (or a network error) with jittered
 *     exponential backoff, honouring a `Retry-After` header, so the gallery
 *     loads progressively and RECOVERS instead of surfacing a hard error.
 *
 * A persistent failure (a `404`, or a `429` that survives every retry) is
 * returned/thrown so the caller can report it.
 *
 * Framework-free (only `fetch` / `setTimeout` / `Math.random`) so it unit-tests
 * under Node's runner with an injected `fetch`.
 */

/** Max image fetches in flight at once (across all panes). */
export const MAX_CONCURRENT_IMAGE_FETCHES = 4;

/**
 * How long a request may stall BEFORE ITS RESPONSE HEADERS ARRIVE.
 *
 * This is a HEADER deadline, not a transfer budget. A `fetch` that never answers
 * (a hung connection, a proxy that keeps the socket open, a server that accepted
 * and forgot) never rejects on its own, and everything downstream waits on it
 * forever: the resolve cache records neither a value nor an error, so a pane
 * holds its previous frame or its "Loading…" for the life of the page, and the
 * preparation scheduler's watchdog frees only the SLOT — it never fails the
 * task. But a healthy 200 MB EXR over a slow link may legitimately take minutes
 * to TRANSFER, and cutting that off would break a working page, so the timer is
 * cleared the moment the response resolves; the body then streams for as long as
 * it needs. Deadlock breaker, not a latency budget.
 */
export const IMAGE_FETCH_TIMEOUT_MS = 60_000;

/** The message every timed-out fetch reports, so callers can recognise it. */
export function fetchTimeoutMessage(url: string, ms: number): string {
  return `cairn-plot: fetch timed out after ${ms} ms (no response headers): ${url}`;
}

/** True for the rejection an aborted fetch produces (browsers and Node both
 *  reject with `name === "AbortError"`; a `DOMException` in either case). */
function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

/**
 * Run `request` under a HEADER deadline: the abort fires only while the response
 * is still outstanding, and the timer is cleared as soon as it resolves. Returns
 * the response untouched — reading its body is the caller's business and is NOT
 * covered by the deadline (see {@link IMAGE_FETCH_TIMEOUT_MS}).
 */
async function withHeaderDeadline(
  url: string,
  timeoutMs: number,
  request: (signal: AbortSignal | undefined) => Promise<Response>,
): Promise<Response> {
  if (typeof AbortController !== "function") return request(undefined);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await request(controller.signal);
  } catch (err) {
    if (timedOut) throw new Error(fetchTimeoutMessage(url, timeoutMs));
    throw err;
  } finally {
    // Cleared on BOTH paths: a resolved response must be free to stream its body
    // for as long as it likes, and a rejected one has nothing left to abort.
    clearTimeout(timer);
  }
}

/**
 * Translate an abort thrown while READING a body into the timeout message.
 *
 * The header deadline can fire in the window between the response resolving and
 * the caller reading it; the body read then rejects with a bare `AbortError`
 * that says nothing about why. Body-read sites funnel through this so the user
 * sees the same sentence either way.
 */
export function asFetchTimeoutError(err: unknown, url: string, ms = IMAGE_FETCH_TIMEOUT_MS): unknown {
  return isAbortError(err) ? new Error(fetchTimeoutMessage(url, ms)) : err;
}

/**
 * ONE plain fetch with a header deadline — the shape the decode paths want (no
 * concurrency gate, no retries, just "never hang forever"). Rejects with
 * {@link fetchTimeoutMessage} when the headers never arrive.
 */
export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; init?: RequestInit } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? IMAGE_FETCH_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  return withHeaderDeadline(url, timeoutMs, (signal) =>
    doFetch(url, { ...opts.init, ...(signal ? { signal } : {}) }));
}

let inFlight = 0;
const waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT_IMAGE_FETCHES) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      inFlight++;
      resolve();
    });
  });
}
function releaseSlot(): void {
  inFlight--;
  waiters.shift()?.(); // hand the freed slot straight to the next waiter
}
function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchImageOptions {
  /** Retry attempts after the first try for a transient 429/503/network error. */
  retries?: number;
  /** Base backoff (ms); doubles each retry, capped at 8s, plus 0..base jitter. */
  backoffBaseMs?: number;
  /** Injectable fetch (tests). Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Per-attempt deadline; see {@link IMAGE_FETCH_TIMEOUT_MS}. */
  timeoutMs?: number;
}

/**
 * Fetch a URL through the concurrency gate, retrying a transient `429`/`503` (or
 * a network error) with jittered backoff. Resolves with the final `Response`
 * (which may still be non-`ok` after all retries); rejects only if a network
 * error survives every retry.
 */
export async function fetchImageBytes(url: string, opts: FetchImageOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 4;
  const base = opts.backoffBaseMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? IMAGE_FETCH_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  await acquireSlot();
  try {
    let backoff = base;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await withHeaderDeadline(url, timeoutMs, (signal) =>
          doFetch(url, signal ? { signal } : undefined));
      } catch (err) {
        // A TIMEOUT is terminal, not transient: the deadline is already generous,
        // and retrying a stalled host four more times would keep the consumer
        // waiting minutes. It rejects immediately so the error path can run (the
        // resolve cache records it and retries on its own backoff).
        if (err instanceof Error && err.message === fetchTimeoutMessage(url, timeoutMs)) throw err;
        if (attempt >= retries) throw err;
        await sleepMs(backoff + Math.random() * backoff);
        backoff = Math.min(backoff * 2, 8000);
        continue;
      }
      if ((res.status !== 429 && res.status !== 503) || attempt >= retries) return res;
      const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
      const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : backoff + Math.random() * backoff;
      await sleepMs(Math.min(wait, 10000));
      backoff = Math.min(backoff * 2, 8000);
    }
  } finally {
    releaseSlot();
  }
}
