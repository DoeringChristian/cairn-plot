# Decode Worker Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single persistent EXR worker with a pool of decode workers that decode EXR and `.npy` off the main thread in parallel, with per-worker failure isolation and deep-handle affinity.

**Architecture:** A pure scheduler (`decode-pool-core.ts`, no Worker/DOM, node-tested with fake workers) plus a browser shell (`decode-pool.ts`) that spawns N instances of one inlined worker module (`decode-worker.ts`, the renamed `exr-worker.ts` extended with an npy job). `exr-decode.ts` and a new `npy-decode.ts` become thin pool clients; their public exports and the no-`Worker` main-thread fallbacks are unchanged.

**Tech Stack:** TypeScript, Vite `?worker&inline`, `node --experimental-strip-types --test`, the browser harness runner (`ui/scripts/test-harness.mjs`).

**Spec:** `/Users/doeringc/workspace/cairn/docs/superpowers/specs/2026-09-08-exr-artifacts-decode-pool-design.md` (section 5, 6 cairn-plot part).

## Global Constraints

- All new code lives under `ui/src/plots/image/resources/decoders/` (docs/plot-type-authoring.md layout rule).
- The worker must keep shipping as ONE inlined module (`import("./decode-worker.ts?worker&inline")`); `build:plot-inline` uses `inlineDynamicImports: true` and no separate worker asset may appear. N pool members are N `new mod.default()` from that one module.
- Pool size in the browser: `clamp((navigator.hardwareConcurrency ?? 2) - 1, 1, 4)`; `setDecodePoolSize(n)` exists for harnesses.
- Non-affinity jobs dispatch only to an idle worker; otherwise they wait in the pool queue, served most-recent-first (LIFO), like `decode-queue.ts`. Affinity jobs post to their worker immediately.
- Abort before dispatch: dequeue and reject with the signal's reason. Abort after dispatch: reject now, drop the result when it arrives, do NOT terminate the worker.
- Job timeout (default 30 000 ms) or a worker `error` event terminates THAT worker only, rejects the jobs dispatched to it, and leaves other workers and the shared queue untouched; the slot respawns on next use.
- When `typeof Worker !== "function"` (node), today's main-thread paths (`decodeExrPreferWasm`, `parseNpy`) run unchanged.
- Public exports of `exr-decode.ts` (`decodeExr`) and `decoders.ts` (`decodeImage`, `npyArrayToDecoded`, registry) keep their signatures.
- `node --experimental-strip-types --test "src/**/*.test.ts"` passes; `npm run typecheck` (or the repo's equivalent in `ui/package.json`) passes; `node scripts/test-harness.mjs` passes for the touched harness pages.
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.
- Never `git add -A`; add named files only.

---

### Task 1: Pure scheduler `decode-pool-core.ts`

**Files:**
- Create: `ui/src/plots/image/resources/decoders/decode-pool-core.ts`
- Test: `ui/src/plots/image/resources/decoders/decode-pool-core.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PoolWorker { post(msg: unknown, transfer: Transferable[]): void; terminate(): void; }
  export interface PoolOptions { size: number; spawn(index: number): PoolWorker; timeoutMs?: number; }
  export interface PoolJob { make(id: number): { id: number }; transfer?: Transferable[]; affinity?: number; signal?: AbortSignal; }
  export interface PoolReply { id: number; ok?: boolean; error?: string; }
  export interface PoolStats { size: number; spawned: number; completed: number[]; queued: number; }
  export class DecodePool {
    constructor(opts: PoolOptions);
    run<T extends PoolReply>(job: PoolJob): Promise<{ result: T; worker: number }>;
    onMessage(worker: number, msg: PoolReply): void;
    onWorkerError(worker: number, err: Error): void;
    resize(size: number): void;   // only affects future spawns; never terminates
    stats(): PoolStats;
    dispose(): void;              // terminates every worker, rejects everything
  }
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// ui/src/plots/image/resources/decoders/decode-pool-core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DecodePool, type PoolWorker } from "./decode-pool-core.ts";

interface Fake extends PoolWorker { index: number; posts: { id: number; kind?: string }[]; terminated: boolean }

function makePool(size: number, timeoutMs = 30_000) {
  const workers: Fake[] = [];
  const pool = new DecodePool({
    size,
    timeoutMs,
    spawn(index) {
      const w: Fake = { index, posts: [], terminated: false, post(msg) { w.posts.push(msg as { id: number }); }, terminate() { w.terminated = true; } };
      workers.push(w);
      return w;
    },
  });
  return { pool, workers };
}
const job = (kind = "decode", extra: object = {}) => ({ make: (id: number) => ({ id, kind }), ...extra });
const tick = () => new Promise((r) => setTimeout(r, 0));

test("idle worker first, then spawn up to size, then queue LIFO", async () => {
  const { pool, workers } = makePool(2);
  const a = pool.run(job("a")); const b = pool.run(job("b")); const c = pool.run(job("c")); const d = pool.run(job("d"));
  assert.equal(workers.length, 2);
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a"]);
  assert.deepEqual(workers[1]!.posts.map((p) => p.kind), ["b"]);
  assert.equal(pool.stats().queued, 2);
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true });
  await a;
  // most recent queued job (d) runs before c
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a", "d"]);
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true }); await d;
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a", "d", "c"]);
  pool.onMessage(0, { id: workers[0]!.posts[2]!.id, ok: true }); await c;
  pool.onMessage(1, { id: workers[1]!.posts[0]!.id, ok: true }); await b;
  assert.deepEqual(pool.stats().completed, [3, 1]);
});

test("result carries the worker index and ok:false rejects with the error text", async () => {
  const { pool, workers } = makePool(1);
  const p = pool.run(job());
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true });
  assert.equal((await p).worker, 0);
  const q = pool.run(job());
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: false, error: "bad file" });
  await assert.rejects(q, /bad file/);
});

test("affinity posts to its worker immediately even when busy", async () => {
  const { pool, workers } = makePool(2);
  const a = pool.run(job("a"));
  const f = pool.run(job("flatten", { affinity: 0 }));
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a", "flatten"]);
  assert.equal(workers.length, 1);
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true }); await f;
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); await a;
});

test("abort before dispatch dequeues and rejects with the reason", async () => {
  const { pool, workers } = makePool(1);
  const a = pool.run(job("a"));
  const ctl = new AbortController();
  const b = pool.run(job("b", { signal: ctl.signal }));
  ctl.abort(new Error("gone"));
  await assert.rejects(b, /gone/);
  assert.equal(pool.stats().queued, 0);
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); await a;
  assert.equal(workers[0]!.posts.length, 1);
});

test("abort after dispatch rejects now, drops the late result, keeps the worker", async () => {
  const { pool, workers } = makePool(1);
  const ctl = new AbortController();
  const a = pool.run(job("a", { signal: ctl.signal }));
  const b = pool.run(job("b"));
  ctl.abort(new Error("gone"));
  await assert.rejects(a, /gone/);
  assert.equal(workers[0]!.terminated, false);
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); // late result
  await tick();
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a", "b"]); // b dispatched after a completed
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true }); await b;
});

test("timeout terminates only the slow worker; the other worker and the queue survive", async () => {
  const { pool, workers } = makePool(2, 10);
  const slow = pool.run(job("slow"));
  const fine = pool.run(job("fine"));
  const queued = pool.run(job("queued"));
  await new Promise((r) => setTimeout(r, 30));
  await assert.rejects(slow, /timed out/);
  assert.equal(workers[0]!.terminated, true);
  assert.equal(workers[1]!.terminated, false);
  // the freed slot respawned and took the queued job
  assert.equal(workers.length, 3);
  assert.deepEqual(workers[2]!.posts.map((p) => p.kind), ["queued"]);
  pool.onMessage(1, { id: workers[1]!.posts[0]!.id, ok: true }); await fine;
  pool.onMessage(2, { id: workers[2]!.posts[0]!.id, ok: true }); await queued;
});

test("worker error rejects that worker's jobs only and respawns on next use", async () => {
  const { pool, workers } = makePool(2);
  const a = pool.run(job("a")); const b = pool.run(job("b"));
  pool.onWorkerError(0, new Error("crashed"));
  await assert.rejects(a, /crashed/);
  assert.equal(workers[0]!.terminated, true);
  const c = pool.run(job("c"));
  assert.equal(workers.length, 3);
  pool.onMessage(2, { id: workers[2]!.posts[0]!.id, ok: true }); await c;
  pool.onMessage(1, { id: workers[1]!.posts[0]!.id, ok: true }); await b;
});

test("dispose terminates every worker and rejects queued and dispatched jobs", async () => {
  const { pool, workers } = makePool(1);
  const a = pool.run(job("a")); const b = pool.run(job("b"));
  pool.dispose();
  await assert.rejects(a, /disposed/); await assert.rejects(b, /disposed/);
  assert.equal(workers[0]!.terminated, true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd ui && node --experimental-strip-types --test src/plots/image/resources/decoders/decode-pool-core.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// ui/src/plots/image/resources/decoders/decode-pool-core.ts
/**
 * `image/decoders/decode-pool-core.ts` — the decode worker pool SCHEDULER.
 *
 * Pure: no Worker, no DOM. The browser shell (`decode-pool.ts`) supplies
 * `spawn` and forwards worker messages/errors here; node tests drive it with
 * fake workers. Policy (spec §5.2):
 *   - a non-affinity job goes to an idle worker (spawning one while
 *     `spawned < size`), else waits; waiting jobs are served most-recent-first;
 *   - an `affinity` job posts to its worker immediately (deep handles live in
 *     one worker's wasm heap);
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
  affinity?: number;
  signal?: AbortSignal;
}
export interface PoolReply { id: number; ok?: boolean; error?: string }
export interface PoolStats { size: number; spawned: number; completed: number[]; queued: number }

const DEFAULT_TIMEOUT_MS = 30_000;

interface Queued { job: PoolJob; resolve: (v: { result: never; worker: number }) => void; reject: (e: Error) => void; onAbort?: () => void }
interface Dispatched { worker: number; resolve: (v: { result: never; worker: number }) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; dropped: boolean; holdsBusy: boolean; onAbort?: () => void }

export class DecodePool {
  private size: number;
  private readonly spawn: (index: number) => PoolWorker;
  private readonly timeoutMs: number;
  private readonly slots: (PoolWorker | null)[] = [];
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

  run<T extends PoolReply>(job: PoolJob): Promise<{ result: T; worker: number }> {
    return new Promise((resolve, reject) => {
      if (this.disposed) return reject(new Error("cairn-plot decode pool: disposed"));
      if (job.signal?.aborted) return reject(abortError(job.signal));
      if (job.affinity !== undefined) {
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
  }

  onMessage(worker: number, msg: PoolReply): void {
    const d = this.dispatched.get(msg.id);
    if (!d || d.worker !== worker) return;
    this.dispatched.delete(msg.id);
    clearTimeout(d.timer);
    this.completed[worker] = (this.completed[worker] ?? 0) + 1;
    this.markIdle(worker);
    if (!d.dropped) {
      if (msg.ok === false) d.reject(new Error(msg.error ?? "cairn-plot decode pool: worker error"));
      else d.resolve({ result: msg as never, worker });
    }
    this.pump();
  }

  onWorkerError(worker: number, err: Error): void {
    this.terminate(worker, err);
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
    const err = new Error("cairn-plot decode pool: disposed");
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
      this.busy[index] = false;
      this.completed[index] = this.completed[index] ?? 0;
    }
    return w;
  }

  private dispatch(worker: number, q: Queued): void {
    const w = this.ensure(worker);
    const id = this.nextId++;
    const d: Dispatched = {
      worker, resolve: q.resolve, reject: q.reject, dropped: false, holdsBusy: q.job.affinity === undefined,
      timer: setTimeout(() => {
        this.terminate(worker, new Error("cairn-plot decode pool: decode timed out"));
        this.pump();
      }, this.timeoutMs),
    };
    if (q.job.signal) {
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

function abortError(signal: AbortSignal): Error {
  const r = signal.reason;
  return r instanceof Error ? r : new Error(typeof r === "string" ? r : "cairn-plot decode pool: aborted");
}
```

Note: `dispatch` sets `busy[worker] = true` only for non-affinity jobs; `markIdle` recomputes from the outstanding set so an affinity reply never frees a slot that still runs a queued job. The `onAbort` listeners are registered `{ once: true }`; a listener firing after its id left `dispatched` is a no-op.

- [ ] **Step 4: Run tests to green**

Run: `cd ui && node --experimental-strip-types --test src/plots/image/resources/decoders/decode-pool-core.test.ts`
Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add ui/src/plots/image/resources/decoders/decode-pool-core.ts ui/src/plots/image/resources/decoders/decode-pool-core.test.ts
git commit -m "Add decode worker pool scheduler"
```

---

### Task 2: One worker module for EXR and npy, and the browser shell

**Files:**
- Create: `ui/src/plots/image/resources/decoders/npy-image.ts` (moved code)
- Rename: `ui/src/plots/image/resources/decoders/exr-worker.ts` → `decode-worker.ts` (`git mv`)
- Create: `ui/src/plots/image/resources/decoders/decode-pool.ts`
- Modify: `ui/src/plots/image/resources/decoders.ts` (import `npyArrayToDecoded`/`isU8Dtype` from `./decoders/npy-image.ts`, re-export `npyArrayToDecoded` so existing importers keep working)
- Modify: `ui/src/plots/image/resources/decoders/exr-decode.ts` (only the import of the message types and the `?worker&inline` path, so the rename compiles; the pool rewiring is Task 3)
- Test: `ui/src/plots/image/resources/decoders/npy-image.test.ts`

**Interfaces:**
- Produces `npy-image.ts`: `export function isU8Dtype(dtype: string): boolean` and `export function npyArrayToDecoded(npy: NpyArray): DecodedImage` — the two functions cut verbatim from `decoders.ts` (they must not import `decoders.ts`; import `DecodedImage` from `../decoders.ts` as a `type` import only — check for cycles: `decoders.ts` may import `npy-image.ts` at runtime while `npy-image.ts` imports `decoders.ts` type-only, which is fine).
- Produces `decode-worker.ts`: the renamed module with the request union extended by
  `| { id: number; kind: "parseNpy"; buffer: ArrayBuffer }` and the response union extended by
  `| { id: number; ok: true; npy: NpyImagePayload }` where
  ```ts
  export interface NpyImagePayload { kind: "u8" | "f32"; data: ArrayBuffer; width: number; height: number; channels: number; precision: "f32" }
  ```
  Handler: `const img = npyArrayToDecoded(parseNpy(buffer)); const data = (img.data as Uint8ClampedArray | Float32Array).buffer as ArrayBuffer; ctx.postMessage({ id, ok: true, npy: { kind: img.kind, data, width: img.width, height: img.height, channels: img.kind === "f32" ? img.channels : 1, precision: "f32" } }, [data]);` — for the `u8` kind `img.data` is always a `Uint8ClampedArray` here (never `ImageData`) because `npyArrayToDecoded` builds it with `Uint8ClampedArray.from`. Type names `ExrWorkerRequest`/`ExrWorkerResponse`/`ExrImagePayload`/`ExrGpuCsrPayload` keep their names (rename is file-level only).
- Produces `decode-pool.ts`:
  ```ts
  export function decodePoolAvailable(): boolean;          // typeof Worker === "function"
  export function getDecodePool(): DecodePool;              // lazy singleton
  export function setDecodePoolSize(n: number): void;       // resize (harness hook)
  export function defaultDecodePoolSize(): number;          // clamp(hc-1, 1, 4)
  ```

- [ ] **Step 1: Test for the moved npy code**

```ts
// ui/src/plots/image/resources/decoders/npy-image.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { npyArrayToDecoded, isU8Dtype } from "./npy-image.ts";

test("isU8Dtype", () => {
  assert.equal(isU8Dtype("|u1"), true); assert.equal(isU8Dtype("|i1"), true); assert.equal(isU8Dtype("|b1"), true);
  assert.equal(isU8Dtype("<f4"), false); assert.equal(isU8Dtype("<u2"), false);
});
test("npyArrayToDecoded maps u8 and float arrays", () => {
  const u8 = npyArrayToDecoded({ dtype: "|u1", shape: [1, 2, 3], fortranOrder: false, data: Float64Array.from([1, 2, 3, 4, 5, 6]) });
  assert.equal(u8.kind, "u8"); assert.equal(u8.width, 2); assert.equal(u8.height, 1);
  const f = npyArrayToDecoded({ dtype: "<f4", shape: [2, 2], fortranOrder: false, data: Float64Array.from([0.5, 1, 2, 4]) });
  assert.equal(f.kind, "f32"); if (f.kind === "f32") { assert.equal(f.channels, 1); assert.equal(f.precision, "f32"); }
  assert.throws(() => npyArrayToDecoded({ dtype: "<f4", shape: [4], fortranOrder: false, data: new Float64Array(4) }), /2D|3D/);
});
```

- [ ] **Step 2: Move the code, rename the worker, add the npy job, write the shell**

`decode-pool.ts`:

```ts
/**
 * `image/decoders/decode-pool.ts` — browser shell of the decode worker pool.
 *
 * Spawns N instances of the ONE inlined worker module (`decode-worker.ts`,
 * Vite `?worker&inline`, so `build:plot-inline` stays a single file) and wires
 * their messages/errors into the pure scheduler (`decode-pool-core.ts`). The
 * module is imported once and lazily; each `PoolWorker` buffers posts until its
 * Worker exists.
 */
import { DecodePool, type PoolWorker } from "./decode-pool-core.ts";

let pool: DecodePool | null = null;
let modPromise: Promise<{ default: new () => Worker }> | null = null;

export function decodePoolAvailable(): boolean {
  return typeof Worker === "function";
}

export function defaultDecodePoolSize(): number {
  const hc = typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
  return Math.min(4, Math.max(1, hc - 1));
}

function loadModule() {
  if (!modPromise) {
    modPromise = import("./decode-worker.ts?worker&inline");
    modPromise.catch(() => { modPromise = null; });
  }
  return modPromise;
}

function spawn(index: number): PoolWorker {
  let worker: Worker | null = null;
  let dead = false;
  const buffered: [unknown, Transferable[]][] = [];
  loadModule()
    .then((mod) => {
      if (dead) return;
      const w = new mod.default();
      w.addEventListener("message", (e: MessageEvent) => pool?.onMessage(index, e.data));
      w.addEventListener("error", () => pool?.onWorkerError(index, new Error("cairn-plot decode pool: worker crashed")));
      worker = w;
      for (const [m, t] of buffered.splice(0)) w.postMessage(m, t);
    })
    .catch((err) => pool?.onWorkerError(index, err instanceof Error ? err : new Error(String(err))));
  return {
    post(msg, transfer) { if (worker) worker.postMessage(msg, transfer); else buffered.push([msg, transfer]); },
    terminate() { dead = true; worker?.terminate(); worker = null; },
  };
}

export function getDecodePool(): DecodePool {
  if (!pool) pool = new DecodePool({ size: defaultDecodePoolSize(), spawn });
  return pool;
}

export function setDecodePoolSize(n: number): void {
  getDecodePool().resize(n);
}
```

In `exr-decode.ts` for this task only: change `import("./exr-worker.ts?worker&inline")` to `import("./decode-worker.ts?worker&inline")` and the type import path; nothing else.

- [ ] **Step 3: Typecheck and run the decoder tests**

Run: `cd ui && npm run typecheck && node --experimental-strip-types --test "src/plots/image/resources/**/*.test.ts"`
Expected: PASS. (`npm run typecheck` — use the script name present in `ui/package.json`; if none exists use `npx tsc -p tsconfig.json --noEmit`.)

- [ ] **Step 4: Commit**

```bash
git add ui/src/plots/image/resources/decoders/npy-image.ts ui/src/plots/image/resources/decoders/npy-image.test.ts ui/src/plots/image/resources/decoders/decode-worker.ts ui/src/plots/image/resources/decoders/decode-pool.ts ui/src/plots/image/resources/decoders.ts ui/src/plots/image/resources/decoders/exr-decode.ts
git commit -m "Introduce the shared decode worker module and pool shell"
```
(`git mv` stages the rename; verify `git status` shows `renamed: exr-worker.ts -> decode-worker.ts`.)

---

### Task 3: Route EXR and npy decoding through the pool

**Files:**
- Modify: `ui/src/plots/image/resources/decoders/exr-decode.ts`
- Create: `ui/src/plots/image/resources/decoders/npy-decode.ts`
- Modify: `ui/src/plots/image/resources/decoders.ts` (`decodeNpy`)
- Test: `ui/src/plots/image/resources/decoders/npy-decode.test.ts`

**Interfaces:**
- Consumes: `getDecodePool`, `decodePoolAvailable` (Task 2); `DecodePool.run` (Task 1); `NpyImagePayload`, `ExrWorkerRequest`, `ExrWorkerResponse` (Task 2).
- Produces: `npy-decode.ts`: `export async function decodeNpyBytes(bytes: ArrayBuffer): Promise<DecodedImage>` (pool when available, else `npyArrayToDecoded(parseNpy(bytes))`), and `export function npyPayloadToImage(p: NpyImagePayload): DecodedImage`.

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/plots/image/resources/decoders/npy-decode.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeNpyBytes, npyPayloadToImage } from "./npy-decode.ts";

function npyFloat32(width: number, height: number, values: number[]): ArrayBuffer {
  const header = `{'descr': '<f4', 'fortran_order': False, 'shape': (${height}, ${width}), }`;
  const pad = 64 - ((10 + header.length + 1) % 64);
  const text = header + " ".repeat(pad) + "\n";
  const buf = new ArrayBuffer(10 + text.length + values.length * 4);
  const u8 = new Uint8Array(buf);
  u8.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]);
  new DataView(buf).setUint16(8, text.length, true);
  for (let i = 0; i < text.length; i++) u8[10 + i] = text.charCodeAt(i);
  new Float32Array(buf, 10 + text.length).set(values);
  return buf;
}

test("decodeNpyBytes decodes on the main thread when no Worker exists (node)", async () => {
  const img = await decodeNpyBytes(npyFloat32(2, 1, [0.25, 8]));
  assert.equal(img.kind, "f32");
  if (img.kind === "f32") { assert.deepEqual(Array.from(img.data as Float32Array), [0.25, 8]); assert.equal(img.width, 2); }
});

test("npyPayloadToImage reinterprets transferred buffers", () => {
  const f = npyPayloadToImage({ kind: "f32", data: Float32Array.from([1, 2]).buffer as ArrayBuffer, width: 2, height: 1, channels: 1, precision: "f32" });
  assert.equal(f.kind, "f32"); if (f.kind === "f32") assert.equal((f.data as Float32Array)[1], 2);
  const u = npyPayloadToImage({ kind: "u8", data: Uint8ClampedArray.from([9, 9, 9]).buffer as ArrayBuffer, width: 1, height: 1, channels: 3, precision: "f32" });
  assert.equal(u.kind, "u8"); if (u.kind === "u8") assert.equal((u.data as Uint8ClampedArray).length, 3);
});
```

- [ ] **Step 2: Run to verify failure** — `cd ui && node --experimental-strip-types --test src/plots/image/resources/decoders/npy-decode.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `npy-decode.ts` and rewire `exr-decode.ts`**

```ts
// ui/src/plots/image/resources/decoders/npy-decode.ts
import type { DecodedImage } from "../decoders.ts";
import { parseNpy } from "../../../transforms/parse-npy.ts";
import { npyArrayToDecoded } from "./npy-image.ts";
import { decodePoolAvailable, getDecodePool } from "./decode-pool.ts";
import type { ExrWorkerResponse, NpyImagePayload } from "./decode-worker.ts";

export function npyPayloadToImage(p: NpyImagePayload): DecodedImage {
  if (p.kind === "u8") return { kind: "u8", data: new Uint8ClampedArray(p.data), width: p.width, height: p.height };
  return { kind: "f32", data: new Float32Array(p.data), width: p.width, height: p.height, channels: p.channels, precision: "f32" };
}

/** Parse a `.npy` image in a pool worker (browser) or inline (node). */
export async function decodeNpyBytes(bytes: ArrayBuffer): Promise<DecodedImage> {
  if (!decodePoolAvailable()) return npyArrayToDecoded(parseNpy(bytes));
  const buffer = bytes.slice(0); // never detach the caller's buffer
  const { result } = await getDecodePool().run<Extract<ExrWorkerResponse, { npy: NpyImagePayload }>>({
    make: (id) => ({ id, kind: "parseNpy", buffer }),
    transfer: [buffer],
  });
  return npyPayloadToImage(result.npy);
}
```

`decoders.ts`: `async function decodeNpy(src) { return decodeNpyBytes(requireBytes(src, "npy")); }` with the import; remove the now-unused direct `parseNpy` import from `decoders.ts` only if nothing else in the file uses it.

`exr-decode.ts` rewrite of the worker plumbing (keep every exported symbol and the module doc's fallback chain; update the doc to say "pool"):

- Delete `pending`, `nextId`, `workerPromise`, `rejectAllPending`, `resetWorker`, `onWorkerMessage`, `getWorker`, `DECODE_TIMEOUT_MS`.
- `canUseWorker()` → `return decodePoolAvailable();`
- Replace `requestWorker` with:
  ```ts
  async function requestWorker(
    make: (id: number) => ExrWorkerRequest,
    transfer: Transferable[],
    affinity?: number,
  ): Promise<{ msg: OkResponse; worker: number }> {
    const { result, worker } = await getDecodePool().run<ExrWorkerResponse>({ make, transfer, affinity });
    if (!result.ok) throw new Error(result.error);
    return { msg: result, worker };
  }
  ```
- `decodeViaWorker`: `const { msg } = await requestWorker(...)`.
- `workerDeepController(handle, zMin, zMax, worker: number)`: every `requestWorker(...)` inside passes `worker` as `affinity`; `dispose()` too.
- `decodeDeepAware`: `const { msg, worker } = await requestWorker((id) => ({ id, kind: "openDeep", buffer }), [buffer]);` and `workerDeepController(deep.handle, deep.zMin, deep.zMax, worker)`.
- Everything else (main-thread controllers, `decodeFull`, `decodeExr`) unchanged.

- [ ] **Step 4: Typecheck and run all unit tests** — `cd ui && npm run typecheck && node --experimental-strip-types --test "src/**/*.test.ts"` → PASS.

- [ ] **Step 5: Build the inline bundle and confirm one file** — `cd ui && npm run build:plot-inline && ls dist/plot-inline` → no `*worker*` asset file besides the IIFE/css; `grep -c "parseNpy" dist/plot-inline/core.iife.js` ≥ 1. Then `npm run sync:plot-assets` (the python package's synced copy must match; CI runs `check:plot-assets`).

- [ ] **Step 6: Commit**

```bash
git add ui/src/plots/image/resources/decoders/exr-decode.ts ui/src/plots/image/resources/decoders/npy-decode.ts ui/src/plots/image/resources/decoders/npy-decode.test.ts ui/src/plots/image/resources/decoders.ts packages/python/src/cairn_plot/_assets/plot-inline
git commit -m "Decode EXR and npy through the worker pool"
```
(If `sync:plot-assets` changed files under `packages/python/.../plot-inline`, include exactly those; check with `git status --short`.)

---

### Task 4: Browser harness, float-compare EXR case, docs

**Files:**
- Create: `ui/src/plots/image/resources/decoders/__tests__/decode-pool.browser.ts` and `decode-pool.browser.html`
- Modify: `ui/src/plots/image/compare/__tests__/float-compare.browser.ts` (add EXR cases)
- Modify: `docs/architecture.md` (decode section)

**Interfaces:**
- Consumes: `setDecodePoolSize`, `getDecodePool().stats()` (Task 2), `decodeImage` from `resources/decoders.ts`.

- [ ] **Step 1: Read the harness conventions** — `ui/scripts/test-harness.mjs` lines 1–99 and `__tests__/gain-map-decode.browser.{html,ts}` as the template (fixture URLs resolve from `import.meta.url`; the page sets `#status` to exactly `PASS`/`FAIL`; opt in with `data-cairn-harness="self-driving"` on `<html>`).

- [ ] **Step 2: Write `decode-pool.browser.ts`**

Behaviour:
1. `setDecodePoolSize(3)`.
2. Fetch these fixtures from `../fixtures/`: `rgb-piz-half-64x48.exr`, `rgb-piz-float-64x48.exr`, `rgb-zip-half-64x48.exr`, `tiled-zip-half-64x48.exr`, `htj2k-half-64x48.exr`, `luma-chroma-64x48.exr`, `layers-demo-128x96.exr`, `multipart-2part-64x48.exr` (8 distinct sources).
3. Start a `PerformanceObserver` on `longtask` (guard: `PerformanceObserver.supportedEntryTypes?.includes("longtask")`; if unsupported, record "longtask unsupported" and skip that assertion).
4. `await Promise.all(fixtures.map((b) => decodeImage({ bytes: b, ext: "exr" })))`, timing wall time.
5. Then decode the same 8 serially and time that.
6. Assertions: every decode returned `kind === "f32"` with `width > 0`; `getDecodePool().stats().spawned >= 2`; at least two entries of `stats().completed` are > 0; no `longtask` entry ≥ 100 ms during the parallel phase; print both wall times (informational, no assertion on the ratio — the fixtures are tiny).
7. Also: an npy decode through the pool: build a 4×4 float32 npy in-page (copy the `npyFloat32` helper from Task 3's test), `decodeImage({ bytes, ext: "npy" })` → `kind === "f32"`, values round-trip.
8. Failure isolation: post a deliberately broken EXR (`new Uint8Array([0x76,0x2f,0x31,0x01, 0,0,0,0]).buffer`) → `decodeImage` rejects; afterwards a good decode still resolves and `stats().spawned` is unchanged (an `ok:false` reply is not a crash).
9. Set `#status` to `PASS` or `FAIL` with the failing assertion text in `#result`.

- [ ] **Step 3: `decode-pool.browser.html`** — copy `gain-map-decode.browser.html`, retitle, point the script at `./decode-pool.browser.bundle.js`, add `data-cairn-harness="self-driving"` to `<html>`.

- [ ] **Step 4: Run it** — `cd ui && node scripts/test-harness.mjs --only decode-pool` (check the runner's filter flag name in its header; if `--only` matches on page basename use that) → PASS.

- [ ] **Step 5: float-compare EXR cases** — in `float-compare.browser.ts` add, after the existing cases: (a) EXR × same EXR (`rgb-piz-half-64x48.exr`, fetched via `new URL("../../resources/decoders/fixtures/rgb-piz-half-64x48.exr", import.meta.url)`) in `difference` mode → readback all zeros; (b) EXR × npy: decode the EXR with `decodeImage`, widen `f16-bits` via `halfToFloat` from `runtime/half.ts` if needed, encode to npy with the page's existing encoder, compare in `difference` mode → all zeros within 1e-6. Both on whichever backends the page already iterates. Run: `node scripts/test-harness.mjs --only float-compare` → PASS.

- [ ] **Step 6: Docs** — in `docs/architecture.md`, in the image decode section (around the `decoded-image.ts` paragraph), add one paragraph: EXR and npy bytes decode in a pool of up to four inlined workers (`decoders/decode-pool-core.ts` scheduler, `decode-pool.ts` shell, `decode-worker.ts`), each with its own OpenEXR WASM instance; policy summary (idle-first, LIFO wait, affinity for deep handles, per-worker failure isolation); node runs the main-thread paths.

- [ ] **Step 7: Full check and commit**

Run: `cd ui && npm run typecheck && node --experimental-strip-types --test "src/**/*.test.ts" && node scripts/test-harness.mjs` (full harness; note any pre-existing quarantined pages).

```bash
git add ui/src/plots/image/resources/decoders/__tests__/decode-pool.browser.ts ui/src/plots/image/resources/decoders/__tests__/decode-pool.browser.html ui/src/plots/image/compare/__tests__/float-compare.browser.ts docs/architecture.md
git commit -m "Add decode pool harness, EXR compare cases, and docs"
```
