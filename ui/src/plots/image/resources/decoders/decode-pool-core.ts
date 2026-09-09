/**
 * `image/decoders/decode-pool-core.ts` — the decode worker pool SCHEDULER.
 *
 * Pure: no Worker, no DOM. The browser shell (`decode-pool.ts`) supplies
 * `spawn` and forwards worker messages/errors here; node tests drive it with
 * fake workers. Policy (spec §5.2):
 *   - a non-affinity job goes to an idle worker (spawning one while
 *     `spawned < size`), else waits; waiting jobs are served most-recent-first;
 *   - an `affinity` job posts to its worker immediately (deep handles live in
 *     one worker's wasm heap). A slot INDEX is not enough to name that worker:
 *     a terminated slot is reused by the next spawn, so an affinity job must
 *     also carry the `affinityEpoch` its `run` returned — the slot's generation
 *     counter — or a stale handle would be replayed into a fresh wasm heap;
 *   - abort before dispatch dequeues; abort after dispatch settles the job now
 *     (freeing the slot, cancelling its timer) and drops the late reply — wasm
 *     cannot be interrupted, so the worker itself is kept, but it is booked as
 *     ABANDONED: new work prefers unburdened slots, the late reply lifts the
 *     booking, and a worker that never returns is reaped (`ABANDON_REAP_MS`);
 *   - a timeout or error terminates ONLY that worker (its dispatched jobs
 *     reject); the slot respawns on next use; other workers and the shared queue
 *     are untouched.
 */
export interface PoolWorker {
  post(msg: unknown, transfer: Transferable[]): void;
  terminate(): void;
}
export interface PoolOptions {
  size: number;
  spawn(index: number): PoolWorker;
  timeoutMs?: number;
  /** How long a worker may hold a slot for an abandoned job (default {@link ABANDON_REAP_MS}). */
  abandonReapMs?: number;
}
export interface PoolJob {
  make(id: number): { id: number };
  transfer?: Transferable[];
  /** Worker index a deep handle lives in: post there, never elsewhere. */
  affinity?: number;
  /**
   * Generation of that worker (the `epoch` the handle-creating `run` resolved).
   * REQUIRED whenever `affinity` is set: the slot may have been terminated and
   * respawned since, and the fresh worker knows nothing of the old handle.
   */
  affinityEpoch?: number;
  signal?: AbortSignal;
  /** Per-job override of the pool's timeout. */
  timeoutMs?: number;
}
export interface PoolReply { id: number; ok?: boolean; error?: string }
export interface PoolStats {
  size: number;
  spawned: number;
  completed: number[];
  queued: number;
  /** Per slot: jobs the worker is still computing for nobody (aborted after dispatch). */
  abandoned: number[];
}

/**
 * Every rejection the pool itself produces is a `DecodePoolError` carrying a
 * `code` that says WHY:
 *   - `"timeout"` — a dispatched job outran its timeout; the worker was killed.
 *   - `"spawn-failed"` — the worker NEVER RAN anything: the shell could not load
 *     the worker module or could not construct the Worker at all (offline
 *     `file://`, a strict CSP), or it died before a single message reached it.
 *     Unambiguous, and therefore always safe to replay inline (`onSpawnFailed`).
 *   - `"worker-error"` — a worker that HAD been given work crashed. It may well
 *     have died ON this decode, so the replay decision weighs the work involved.
 *   - `"reply"` — the worker replied `ok:false` (a decode-level failure).
 *   - `"affinity"` — an affinity job is missing its `affinityEpoch`, or the
 *     worker holding its deep handle is gone (crashed/timed out/never existed).
 *   - `"disposed"` — the pool was disposed.
 *   - `"aborted"` — the job's `AbortSignal` fired and its `reason` was not
 *     itself an `Error` (an `Error` reason is thrown as-is, unwrapped).
 * Callers use this to decide whether replaying the same decode inline on the
 * main thread is safe: see `canReplayInline` below.
 */
export type DecodePoolErrorCode =
  | "timeout"
  | "spawn-failed"
  | "worker-error"
  | "reply"
  | "affinity"
  | "disposed"
  | "aborted";

export class DecodePoolError extends Error {
  readonly code: DecodePoolErrorCode;
  /** The caller's abort reason for `"aborted"` errors (the lib target predates `Error.cause`). */
  cause?: unknown;
  constructor(message: string, code: DecodePoolErrorCode) {
    super(message);
    this.name = "DecodePoolError";
    this.code = code;
  }
}

/**
 * Which pool failures could, in principle, be retried with the SAME decode run
 * inline on the main thread: the worker never ran the job (`"spawn-failed"`,
 * `"worker-error"`), or it ran it and reported a decode-level failure
 * (`"reply"`, which the inline path re-derives with a fresh, informative error
 * for a bad file). False for `"timeout"` and `"aborted"` (the job may already be
 * running / may have genuinely taken too long — replaying it inline can freeze
 * the main thread), `"disposed"`, and `"affinity"`. A non-`DecodePoolError`
 * (e.g. a shell exception thrown before the pool was even reached) is retryable.
 *
 * Module-private on purpose: `"worker-error"` alone is not a verdict, since the
 * worker may have died ON this decode. Callers ask `canReplayInline`, which
 * weighs the work as well.
 */
function isRetryableInline(err: unknown): boolean {
  if (err instanceof DecodePoolError) {
    return err.code === "spawn-failed" || err.code === "worker-error" || err.code === "reply";
  }
  return true;
}

/**
 * True when the pool has ruled this failure TERMINAL for the job: the work is
 * already under way, or the caller/pool is gone, so retrying the SAME job is
 * pointless (`timeout`, `aborted`, `disposed`, `affinity`). Unlike
 * `canReplayInline` it asks nothing about cost — use it where the retry would
 * go back to the POOL and no main-thread time is at stake.
 */
export function isPoolTerminal(err: unknown): boolean {
  return !isRetryableInline(err);
}

/**
 * Default ceiling on the work a caller may redo inline after a `"worker-error"`,
 * for callers with no better measure than the encoded size. Each decoder passes
 * its OWN budget: the cost of a main-thread replay is a property of the format,
 * not of the pool (`.npy` is a memcpy-ish widening, an EXR is entropy decoding).
 */
export const INLINE_REPLAY_MAX_BYTES = 8 * 1024 * 1024;

/**
 * May the decode that failed with `err` be replayed on the main thread, given
 * that redoing it costs `cost` (bytes of work, in whatever measure `maxCost`
 * uses)? `"spawn-failed"` always may — nothing ever ran, so no amount of work
 * is being REPEATED, and this is the path an offline `file://` page or a
 * strict-CSP page lives on. A `"worker-error"` may have been the decode itself
 * killing the worker, so it is allowed only up to `maxCost`; past that the
 * error surfaces rather than freezing the tab a second time.
 */
export function canReplayInline(err: unknown, cost: number, maxCost: number = INLINE_REPLAY_MAX_BYTES): boolean {
  if (!isRetryableInline(err)) return false;
  if (err instanceof DecodePoolError && err.code === "worker-error" && cost > maxCost) return false;
  return true;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * How long a worker may keep computing a job whose caller has gone (an abort
 * after dispatch) before the worker is terminated. Wasm cannot be interrupted,
 * so the pool cannot cancel the work — it can only stop waiting for it, and
 * eventually stop paying for the slot it occupies.
 */
export const ABANDON_REAP_MS = 60_000;

type Settle = (v: { result: never; worker: number; epoch: number }) => void;
interface Queued { job: PoolJob; resolve: Settle; reject: (e: Error) => void; onAbort?: () => void }
interface Dispatched { worker: number; epoch: number; resolve: Settle; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; dropped: boolean; holdsBusy: boolean; signal?: AbortSignal; onAbort?: () => void }

export class DecodePool {
  private size: number;
  private readonly spawn: (index: number) => PoolWorker;
  private readonly timeoutMs: number;
  private readonly abandonReapMs: number;
  private readonly slots: (PoolWorker | null)[] = [];
  /** Per-slot generation, bumped on every spawn: identifies WHICH worker a slot holds. */
  private readonly epochs: number[] = [];
  private readonly busy: boolean[] = [];
  private readonly completed: number[] = [];
  /** Per slot: how many aborted-after-dispatch jobs the worker is still chewing on. */
  private readonly abandoned: number[] = [];
  private readonly queue: Queued[] = [];
  private readonly dispatched = new Map<number, Dispatched>();
  /** Abandoned job id → the slot it burdens and the timer that will reap that slot. */
  private readonly reapers = new Map<number, { worker: number; timer: ReturnType<typeof setTimeout> }>();
  private nextId = 1;
  private disposed = false;

  constructor(opts: PoolOptions) {
    this.size = Math.max(1, opts.size | 0);
    this.spawn = opts.spawn;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.abandonReapMs = opts.abandonReapMs ?? ABANDON_REAP_MS;
  }

  run<T extends PoolReply>(job: PoolJob): Promise<{ result: T; worker: number; epoch: number }> {
    const promise = new Promise<{ result: T; worker: number; epoch: number }>((resolve, reject) => {
      if (this.disposed) return reject(new DecodePoolError("cairn-plot decode pool: disposed", "disposed"));
      if (job.signal?.aborted) return reject(abortError(job.signal));
      if (job.affinity !== undefined) {
        if (job.affinityEpoch === undefined) {
          return reject(new DecodePoolError(
            "cairn-plot decode pool: an affinity job needs the affinityEpoch its run() returned",
            "affinity",
          ));
        }
        // The slot may have been terminated and respawned; a fresh worker holds
        // none of the old worker's handles, so match the generation, not the index.
        if (!this.slots[job.affinity] || this.epochs[job.affinity] !== job.affinityEpoch) {
          return reject(new DecodePoolError("cairn-plot decode pool: the worker holding this deep handle is gone", "affinity"));
        }
        this.dispatch(job.affinity, { job, resolve: resolve as never, reject });
        return;
      }
      const idle = this.idleSlot();
      if (idle !== -1) {
        this.dispatch(idle, { job, resolve: resolve as never, reject });
        return;
      }
      const q: Queued = { job, resolve: resolve as never, reject };
      if (job.signal) {
        q.onAbort = () => {
          const i = this.queue.indexOf(q);
          if (i !== -1) this.queue.splice(i, 1);
          reject(abortError(job.signal!));
        };
        job.signal.addEventListener("abort", q.onAbort, { once: true });
      }
      this.queue.push(q);
    });
    // A job can reject asynchronously (timer, worker error) before the caller
    // awaits it — this guard registers a reaction immediately so Node never
    // flags it as an unhandled rejection; it does not consume the rejection
    // for real callers, who still see it via their own await/.then/.catch.
    promise.catch(() => {});
    return promise;
  }

  onMessage(worker: number, msg: PoolReply): void {
    const d = this.dispatched.get(msg.id);
    if (!d || d.worker !== worker) {
      // No live job by that id. It is the LATE reply of an abandoned one: the
      // worker is free again, so lift the penalty and cancel its reaper (never
      // return before doing that, or the slot stays marked loaded for ever).
      this.reclaim(worker, msg.id);
      return;
    }
    this.dispatched.delete(msg.id);
    clearTimeout(d.timer);
    detachAbort(d);
    this.completed[worker] = (this.completed[worker] ?? 0) + 1;
    this.markIdle(worker);
    if (!d.dropped) {
      if (msg.ok === false) d.reject(new DecodePoolError(msg.error ?? "cairn-plot decode pool: worker error", "reply"));
      else d.resolve({ result: msg as never, worker, epoch: d.epoch });
    }
    this.pump();
  }

  onWorkerError(worker: number, err: Error): void {
    this.terminate(worker, new DecodePoolError(err.message, "worker-error"));
    this.pump();
  }

  /**
   * The shell could not produce a working Worker for this slot at all — the
   * module never loaded, or the constructor was refused (offline `file://`,
   * strict CSP), or the worker died before a single message reached it. The
   * distinction from `onWorkerError` matters downstream: nothing ran, so the
   * caller may redo the decode inline however big it is.
   */
  onSpawnFailed(worker: number, err: Error): void {
    this.terminate(worker, new DecodePoolError(err.message, "spawn-failed"));
    this.pump();
  }

  resize(size: number): void { this.size = Math.max(1, size | 0); }

  stats(): PoolStats {
    return {
      size: this.size,
      spawned: this.slots.filter((s) => s !== null).length,
      completed: this.slots.map((_, i) => this.completed[i] ?? 0),
      queued: this.queue.length,
      abandoned: this.slots.map((_, i) => this.abandoned[i] ?? 0),
    };
  }

  dispose(): void {
    this.disposed = true;
    const err = new DecodePoolError("cairn-plot decode pool: disposed", "disposed");
    for (let i = 0; i < this.slots.length; i++) this.terminate(i, err);
    for (const q of this.queue.splice(0)) { q.onAbort && q.job.signal?.removeEventListener("abort", q.onAbort); q.reject(err); }
  }

  // ---- internals ----

  /**
   * Index of an idle spawned worker, or a fresh slot while under `size`, else -1.
   * An idle worker still computing an ABANDONED job is idle only on paper — its
   * message loop is blocked — so a clean worker wins, then a fresh spawn, and a
   * loaded worker is used only when there is nothing else (least loaded first).
   */
  private idleSlot(): number {
    let best = -1;
    let bestLoad = Infinity;
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i] || this.busy[i]) continue;
      const load = this.abandoned[i] ?? 0;
      if (load < bestLoad) { best = i; bestLoad = load; }
      if (bestLoad === 0) return best;
    }
    if (this.slots.filter((s) => s !== null).length < this.size) {
      const free = this.slots.indexOf(null);
      return free !== -1 ? free : this.slots.length;
    }
    return best;
  }

  private ensure(index: number): PoolWorker {
    let w = this.slots[index];
    if (!w) {
      w = this.spawn(index);
      this.slots[index] = w;
      this.epochs[index] = (this.epochs[index] ?? 0) + 1;
      this.busy[index] = false;
      this.completed[index] = this.completed[index] ?? 0;
    }
    return w;
  }

  private dispatch(worker: number, q: Queued): void {
    const w = this.ensure(worker);
    const id = this.nextId++;
    const d: Dispatched = {
      worker, epoch: this.epochs[worker]!, resolve: q.resolve, reject: q.reject, dropped: false, holdsBusy: q.job.affinity === undefined,
      timer: setTimeout(() => {
        this.terminate(worker, new DecodePoolError("cairn-plot decode pool: decode timed out", "timeout"));
        this.pump();
      }, q.job.timeoutMs ?? this.timeoutMs),
    };
    if (q.job.signal) {
      d.signal = q.job.signal;
      d.onAbort = () => {
        if (!this.dispatched.has(id)) return;
        // Abort AFTER dispatch: wasm cannot be interrupted, so the worker is
        // kept and its late reply is simply ignored (the id is gone from
        // `dispatched`). The job must be FULLY settled here — forgotten, timer
        // cleared, listener detached, the slot freed and the queue pumped — or
        // the worker would stay busy until the stale timer killed it, taking
        // every other job dispatched to it down with it.
        this.dispatched.delete(id);
        clearTimeout(d.timer);
        detachAbort(d);
        d.dropped = true;
        d.reject(abortError(q.job.signal!));
        this.abandon(worker, id);
        this.markIdle(worker);
        this.pump();
      };
      q.job.signal.addEventListener("abort", d.onAbort, { once: true });
    }
    this.dispatched.set(id, d);
    if (q.job.affinity === undefined) this.busy[worker] = true;
    w.post(q.job.make(id), q.job.transfer ?? []);
  }

  /**
   * Book an abandoned job against its worker. The slot is usable again, but the
   * worker is really still computing: `idleSlot` sends work elsewhere while it
   * can, and if the reply never comes the worker is reaped rather than left to
   * hold a slot for the rest of the session (a slider drag would otherwise
   * stack every later decode behind a job nobody is waiting for).
   */
  private abandon(worker: number, id: number): void {
    this.abandoned[worker] = (this.abandoned[worker] ?? 0) + 1;
    const timer = setTimeout(() => {
      this.reapers.delete(id);
      // Only jobs dispatched to this worker SINCE the abandonment can still be
      // waiting on it, so this message is addressed to them: they are collateral,
      // they never got their turn, and retrying them is safe.
      this.terminate(
        worker,
        new DecodePoolError(
          "cairn-plot decode pool: dropped — this worker never returned from an earlier, abandoned decode; retrying is safe",
          "worker-error",
        ),
      );
      this.pump();
    }, this.abandonReapMs);
    this.reapers.set(id, { worker, timer });
  }

  /** A late reply for an abandoned job: the worker is free, so undo its penalty. */
  private reclaim(worker: number, id: number): void {
    const r = this.reapers.get(id);
    if (!r || r.worker !== worker) return;
    clearTimeout(r.timer);
    this.reapers.delete(id);
    this.abandoned[worker] = Math.max(0, (this.abandoned[worker] ?? 0) - 1);
    this.pump();
  }

  /** A worker is busy while a non-affinity job is outstanding on it. */
  private markIdle(worker: number): void {
    let busy = false;
    for (const d of this.dispatched.values()) if (d.worker === worker && d.holdsBusy) { busy = true; break; }
    this.busy[worker] = busy;
  }

  private terminate(worker: number, err: Error): void {
    // Settle this worker's jobs FIRST, before the empty-slot early return: a
    // slot can hold NO worker and still own dispatched jobs, and bailing out on
    // the null slot would leave those `run()` promises pending for ever (e.g.
    // `dispose()` reaching a slot that was nulled earlier). `busy` is likewise
    // cleared below only when a worker was actually there — an empty slot is
    // already `busy: false`, set when it was emptied.
    for (const [id, d] of this.dispatched) {
      if (d.worker !== worker) continue;
      this.dispatched.delete(id);
      clearTimeout(d.timer);
      detachAbort(d);
      if (!d.dropped) d.reject(err);
    }
    // A terminated worker can no longer answer for its abandoned jobs, and a
    // fresh worker will take the slot: drop the penalty and its reap timers.
    for (const [id, r] of this.reapers) {
      if (r.worker !== worker) continue;
      clearTimeout(r.timer);
      this.reapers.delete(id);
    }
    this.abandoned[worker] = 0;
    const w = this.slots[worker];
    if (!w) return;
    this.slots[worker] = null;
    this.busy[worker] = false;
    w.terminate();
  }

  private pump(): void {
    while (this.queue.length) {
      const idle = this.idleSlot();
      if (idle === -1) return;
      const q = this.queue.pop()!;
      if (q.onAbort) q.job.signal?.removeEventListener("abort", q.onAbort);
      this.dispatch(idle, q);
    }
  }
}

/** Detach a dispatched job's abort listener on every settle path (not just abort itself). */
function detachAbort(d: Dispatched): void {
  if (d.onAbort) d.signal?.removeEventListener("abort", d.onAbort);
}

/**
 * Every abort rejects with a `DecodePoolError` coded `"aborted"` so callers'
 * retry gates (`isRetryableInline`) can never mistake it for an error that
 * happened before the pool was reached. The caller's own reason survives as
 * `cause` (and as the message when it is an Error or a string).
 */
function abortError(signal: AbortSignal): DecodePoolError {
  const r = signal.reason;
  const message =
    r instanceof Error ? r.message : typeof r === "string" ? r : "cairn-plot decode pool: aborted";
  const err = new DecodePoolError(message, "aborted");
  err.cause = r;
  return err;
}
