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
 * How long ONE request may stall before it is aborted with a clear error.
 *
 * A `fetch` that never answers (a hung connection, a proxy that keeps the socket
 * open, a server that accepted and forgot) never rejects on its own. Everything
 * downstream waits on it forever: the resolve cache records neither a value nor
 * an error, so a pane holds its previous frame or its "Loading…" for the life of
 * the page, and the preparation scheduler's watchdog frees only the SLOT — it
 * never fails the task. Generous on purpose (a 200 MB EXR over a slow link must
 * not be cut off); this is a deadlock breaker, not a latency budget.
 */
export const IMAGE_FETCH_TIMEOUT_MS = 60_000;

/** `AbortSignal.timeout` where the runtime has it (Node ≥ 17.3, all modern
 *  browsers); `undefined` elsewhere, and the fetch simply has no deadline. */
function timeoutSignal(ms: number): AbortSignal | undefined {
  const ctor = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  return typeof ctor.timeout === "function" ? ctor.timeout(ms) : undefined;
}

/** The message every timed-out fetch reports, so callers can recognise it. */
export function fetchTimeoutMessage(url: string, ms: number): string {
  return `cairn-plot: fetch timed out after ${ms} ms (no response): ${url}`;
}

/**
 * ONE plain fetch with a deadline — the shape the decode paths want (no
 * concurrency gate, no retries, just "never hang forever"). Rejects with
 * {@link fetchTimeoutMessage} when the deadline passes.
 */
export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch; init?: RequestInit } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? IMAGE_FETCH_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  const signal = timeoutSignal(timeoutMs);
  try {
    return await doFetch(url, { ...opts.init, ...(signal ? { signal } : {}) });
  } catch (err) {
    if (signal?.aborted) throw new Error(fetchTimeoutMessage(url, timeoutMs));
    throw err;
  }
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
      const signal = timeoutSignal(timeoutMs);
      try {
        res = await doFetch(url, signal ? { signal } : undefined);
      } catch (err) {
        // A TIMEOUT is terminal, not transient: the deadline is already generous,
        // and retrying a stalled host four more times would keep the consumer
        // waiting minutes. It rejects immediately so the error path can run (the
        // resolve cache records it and retries on its own backoff).
        if (signal?.aborted) throw new Error(fetchTimeoutMessage(url, timeoutMs));
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
