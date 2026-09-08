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
 *   - abort before dispatch dequeues; abort after dispatch rejects now and drops
 *     the late reply — wasm cannot be interrupted, the worker is kept;
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
export interface PoolStats { size: number; spawned: number; completed: number[]; queued: number }

/**
 * Every rejection the pool itself produces is a `DecodePoolError` carrying a
 * `code` that says WHY:
 *   - `"timeout"` — a dispatched job outran its timeout; the worker was killed.
 *   - `"worker-error"` — the worker crashed, or the shell couldn't spawn/load
 *     it (module-load failure forwarded via `onWorkerError`).
 *   - `"reply"` — the worker replied `ok:false` (a decode-level failure).
 *   - `"affinity"` — an affinity job is missing its `affinityEpoch`, or the
 *     worker holding its deep handle is gone (crashed/timed out/never existed).
 *   - `"disposed"` — the pool was disposed.
 *   - `"aborted"` — the job's `AbortSignal` fired and its `reason` was not
 *     itself an `Error` (an `Error` reason is thrown as-is, unwrapped).
 * Callers use this to decide whether replaying the same decode inline on the
 * main thread is safe: see `isRetryableInline` below.
 */
export type DecodePoolErrorCode = "timeout" | "worker-error" | "reply" | "affinity" | "disposed" | "aborted";

export class DecodePoolError extends Error {
  readonly code: DecodePoolErrorCode;
  constructor(message: string, code: DecodePoolErrorCode) {
    super(message);
    this.name = "DecodePoolError";
    this.code = code;
  }
}

/**
 * True only for pool failures safe to retry with the SAME decode run inline
 * on the main thread: a worker that never ran the job (`"worker-error"`) or
 * one that ran it and reported a decode-level failure (`"reply"`, which the
 * inline path re-derives with a fresh, informative error for a bad file).
 * False for `"timeout"` and `"aborted"` (the job may already be running / may
 * have genuinely taken too long — replaying it inline can freeze the main
 * thread), `"disposed"`, and `"affinity"`. A non-`DecodePoolError` (e.g. a
 * shell exception thrown before the pool was even reached) is retryable.
 */
export function isRetryableInline(err: unknown): boolean {
  if (err instanceof DecodePoolError) return err.code === "worker-error" || err.code === "reply";
  return true;
}

const DEFAULT_TIMEOUT_MS = 30_000;

type Settle = (v: { result: never; worker: number; epoch: number }) => void;
interface Queued { job: PoolJob; resolve: Settle; reject: (e: Error) => void; onAbort?: () => void }
interface Dispatched { worker: number; epoch: number; resolve: Settle; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; dropped: boolean; holdsBusy: boolean; signal?: AbortSignal; onAbort?: () => void }

export class DecodePool {
  private size: number;
  private readonly spawn: (index: number) => PoolWorker;
  private readonly timeoutMs: number;
  private readonly slots: (PoolWorker | null)[] = [];
  /** Per-slot generation, bumped on every spawn: identifies WHICH worker a slot holds. */
  private readonly epochs: number[] = [];
  private readonly busy: boolean[] = [];
  private readonly completed: number[] = [];
  private readonly queue: Queued[] = [];
  private readonly dispatched = new Map<number, Dispatched>();
  private nextId = 1;
  private disposed = false;

  constructor(opts: PoolOptions) {
    this.size = Math.max(1, opts.size | 0);
    this.spawn = opts.spawn;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
    if (!d || d.worker !== worker) return;
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

  resize(size: number): void { this.size = Math.max(1, size | 0); }

  stats(): PoolStats {
    return {
      size: this.size,
      spawned: this.slots.filter((s) => s !== null).length,
      completed: this.slots.map((_, i) => this.completed[i] ?? 0),
      queued: this.queue.length,
    };
  }

  dispose(): void {
    this.disposed = true;
    const err = new DecodePoolError("cairn-plot decode pool: disposed", "disposed");
    for (let i = 0; i < this.slots.length; i++) this.terminate(i, err);
    for (const q of this.queue.splice(0)) { q.onAbort && q.job.signal?.removeEventListener("abort", q.onAbort); q.reject(err); }
  }

  // ---- internals ----

  /** Index of an idle spawned worker, or a fresh slot while under `size`, else -1. */
  private idleSlot(): number {
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i] && !this.busy[i]) return i;
    if (this.slots.filter((s) => s !== null).length < this.size) {
      const free = this.slots.indexOf(null);
      return free !== -1 ? free : this.slots.length;
    }
    return -1;
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
      d.onAbort = () => { if (this.dispatched.has(id)) { d.dropped = true; d.reject(abortError(q.job.signal!)); } };
      q.job.signal.addEventListener("abort", d.onAbort, { once: true });
    }
    this.dispatched.set(id, d);
    if (q.job.affinity === undefined) this.busy[worker] = true;
    w.post(q.job.make(id), q.job.transfer ?? []);
  }

  /** A worker is busy while a non-affinity job is outstanding on it. */
  private markIdle(worker: number): void {
    let busy = false;
    for (const d of this.dispatched.values()) if (d.worker === worker && d.holdsBusy) { busy = true; break; }
    this.busy[worker] = busy;
  }

  private terminate(worker: number, err: Error): void {
    const w = this.slots[worker];
    if (!w) return;
    this.slots[worker] = null;
    this.busy[worker] = false;
    w.terminate();
    for (const [id, d] of this.dispatched) {
      if (d.worker !== worker) continue;
      this.dispatched.delete(id);
      clearTimeout(d.timer);
      detachAbort(d);
      if (!d.dropped) d.reject(err);
    }
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

function abortError(signal: AbortSignal): Error {
  const r = signal.reason;
  if (r instanceof Error) return r; // caller's own reason wins, unwrapped
  return new DecodePoolError(typeof r === "string" ? r : "cairn-plot decode pool: aborted", "aborted");
}
