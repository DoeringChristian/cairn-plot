import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canReplayInline,
  DecodePool,
  DecodePoolError,
  INLINE_REPLAY_MAX_BYTES,
  type PoolWorker,
} from "./decode-pool-core.ts";

/** `assert.rejects` predicate: a `DecodePoolError` with this `code` whose message matches `pattern`. */
function poolErr(code: DecodePoolError["code"], pattern: RegExp) {
  return (err: unknown) => err instanceof DecodePoolError && err.code === code && pattern.test(err.message);
}

interface Fake extends PoolWorker { index: number; posts: { id: number; kind?: string }[]; terminated: boolean }

/**
 * `abandonReapMs` defaults to 1 s rather than the pool's real minute: an
 * abandoned job holds a live timer, and a test that forgets to `dispose()`
 * would otherwise keep the node process alive for the full 60 s.
 */
function makePool(size: number, timeoutMs = 30_000, abandonReapMs = 1_000) {
  const workers: Fake[] = [];
  const pool = new DecodePool({
    size,
    timeoutMs,
    abandonReapMs,
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
  await assert.rejects(q, poolErr("reply", /bad file/));
});

test("affinity posts to its worker immediately even when busy", async () => {
  const { pool, workers } = makePool(2);
  const a = pool.run(job("a"));
  const f = pool.run(job("flatten", { affinity: 0, affinityEpoch: 1 }));
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a", "flatten"]);
  assert.equal(workers.length, 1);
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true }); await f;
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); await a;
});

test("an affinity job carrying the epoch its run() returned is dispatched", async () => {
  const { pool, workers } = makePool(2);
  const open = pool.run(job("open"));
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true });
  const { worker, epoch } = await open;
  const f = pool.run(job("flatten", { affinity: worker, affinityEpoch: epoch }));
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["open", "flatten"]);
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true });
  assert.deepEqual(await f.then((r) => [r.worker, r.epoch]), [worker, epoch]);
});

test("a stale affinity epoch is rejected after the slot is reused by a fresh worker", async () => {
  const { pool, workers } = makePool(1);
  const open = pool.run(job("open"));
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true });
  const stale = await open; // handle lives in generation 1 of slot 0
  pool.onWorkerError(0, new Error("crashed"));
  // A plain job respawns slot 0 — same INDEX, a brand-new wasm heap.
  const plain = pool.run(job("plain"));
  assert.equal(workers.length, 2);
  assert.equal(workers[1]!.index, 0);
  pool.onMessage(0, { id: workers[1]!.posts[0]!.id, ok: true });
  const fresh = await plain;
  assert.equal(fresh.worker, stale.worker);
  assert.notEqual(fresh.epoch, stale.epoch);
  // The OLD generation's handle must not be replayed into the new worker...
  await assert.rejects(
    pool.run(job("flatten", { affinity: stale.worker, affinityEpoch: stale.epoch })),
    poolErr("affinity", /deep handle is gone/),
  );
  assert.equal(workers[1]!.posts.length, 1); // nothing posted to the fresh worker
  // ...while a handle opened on the NEW generation still works.
  const f = pool.run(job("flatten", { affinity: fresh.worker, affinityEpoch: fresh.epoch }));
  assert.deepEqual(workers[1]!.posts.map((p) => p.kind), ["plain", "flatten"]);
  pool.onMessage(0, { id: workers[1]!.posts[1]!.id, ok: true }); await f;
});

test("affinity without an epoch is rejected outright", async () => {
  const { pool, workers } = makePool(1);
  await assert.rejects(pool.run(job("flatten", { affinity: 0 })), poolErr("affinity", /needs the affinityEpoch/));
  assert.equal(workers.length, 0);
});

test("abort before dispatch dequeues and rejects with the reason", async () => {
  const { pool, workers } = makePool(1);
  const a = pool.run(job("a"));
  const ctl = new AbortController();
  const b = pool.run(job("b", { signal: ctl.signal }));
  ctl.abort(new Error("gone"));
  // An Error abort reason becomes a DecodePoolError coded "aborted" (never inline-retryable),
  // carrying the caller's reason as `cause`.
  await assert.rejects(b, (err) => err instanceof DecodePoolError && err.code === "aborted" && /gone/.test(err.message) && err.cause instanceof Error);
  assert.equal(pool.stats().queued, 0);
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); await a;
  assert.equal(workers[0]!.posts.length, 1);
});

test("abort with a non-Error reason is wrapped in a DecodePoolError coded \"aborted\"", async () => {
  const { pool } = makePool(1);
  const ctl = new AbortController();
  const b = pool.run(job("b", { signal: ctl.signal }));
  ctl.abort("gone-string");
  await assert.rejects(b, poolErr("aborted", /gone-string/));
  pool.dispose();
});

test("abort after dispatch frees the worker at once, drops the late result, and cancels its timer", async () => {
  const { pool, workers } = makePool(1); // 30 s default; only `a` carries a short timeout
  const ctl = new AbortController();
  const a = pool.run(job("a", { signal: ctl.signal, timeoutMs: 10 }));
  const b = pool.run(job("b"));
  assert.equal(pool.stats().queued, 1);
  ctl.abort(new Error("gone"));
  await assert.rejects(a, (err) => err instanceof DecodePoolError && err.code === "aborted" && /gone/.test(err.message));
  assert.equal(workers[0]!.terminated, false); // wasm cannot be interrupted: the worker is kept
  // The aborted job no longer holds the slot: the queued job goes out NOW, not
  // once some later event happens to free the worker.
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a", "b"]);
  assert.equal(pool.stats().queued, 0);
  // ...and the aborted job's timer was cancelled with it: were it still armed,
  // it would fire here and terminate the worker, taking `b` down too.
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(workers[0]!.terminated, false);
  // The worker is nonetheless still computing `a` for nobody: booked as such.
  assert.deepEqual(pool.stats().abandoned, [1]);
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); // late result for `a`: ignored by id
  await tick();
  assert.deepEqual(pool.stats().abandoned, [0]); // ...but it does free the worker
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true }); await b;
  assert.deepEqual(pool.stats().completed, [1]); // only `b` counted
  pool.dispose();
});

test("new work avoids a worker still chewing on an abandoned job", async () => {
  const { pool, workers } = makePool(2);
  const ctl = new AbortController();
  const a = pool.run(job("a", { signal: ctl.signal })); // slot 0
  const b = pool.run(job("b")); // slot 1
  pool.onMessage(1, { id: workers[1]!.posts[0]!.id, ok: true }); await b; // slot 1: idle and clean
  ctl.abort(new Error("gone"));
  await assert.rejects(a, poolErr("aborted", /gone/)); // slot 0: idle on paper, loaded in fact
  assert.deepEqual(pool.stats().abandoned, [1, 0]);
  pool.run(job("c"));
  assert.deepEqual(workers[0]!.posts.map((p) => p.kind), ["a"]);
  assert.deepEqual(workers[1]!.posts.map((p) => p.kind), ["b", "c"]);
  pool.dispose();
});

test("a fresh spawn beats an abandoned worker while the pool is under size", async () => {
  const { pool, workers } = makePool(2);
  const ctl = new AbortController();
  const a = pool.run(job("a", { signal: ctl.signal }));
  ctl.abort(new Error("gone"));
  await assert.rejects(a, poolErr("aborted", /gone/));
  pool.run(job("b"));
  assert.equal(workers.length, 2, "a second worker was spawned rather than queueing behind the abandoned decode");
  assert.deepEqual(workers[1]!.posts.map((p) => p.kind), ["b"]);
  pool.dispose();
});

test("a worker that never returns from an abandoned job is reaped", async () => {
  const { pool, workers } = makePool(1, 30_000, 20);
  const ctl = new AbortController();
  const a = pool.run(job("a", { signal: ctl.signal }));
  ctl.abort(new Error("gone"));
  await assert.rejects(a, poolErr("aborted", /gone/));
  const b = pool.run(job("b")); // the only slot: dispatched behind the abandoned decode
  assert.equal(workers[0]!.terminated, false);
  await new Promise((r) => setTimeout(r, 60));
  // The abandoned reply never came: the worker is not coming back, so it is
  // killed rather than left holding a slot — and whatever was queued behind it
  // is told so instead of hanging.
  assert.equal(workers[0]!.terminated, true);
  await assert.rejects(b, poolErr("worker-error", /never returned/));
  assert.deepEqual(pool.stats().abandoned, [0]);
  // ...and the slot is usable again.
  const c = pool.run(job("c"));
  assert.equal(workers.length, 2);
  pool.onMessage(0, { id: workers[1]!.posts[0]!.id, ok: true }); await c;
  pool.dispose();
});

test("a late reply cancels the reaper: the worker is kept", async () => {
  const { pool, workers } = makePool(1, 30_000, 20);
  const ctl = new AbortController();
  const a = pool.run(job("a", { signal: ctl.signal }));
  ctl.abort(new Error("gone"));
  await assert.rejects(a, poolErr("aborted", /gone/));
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true }); // it did come back
  assert.deepEqual(pool.stats().abandoned, [0]);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(workers[0]!.terminated, false, "a returned worker must not be reaped");
  pool.dispose();
});

test("a spawn failure rejects with a code that says nothing ever ran", async () => {
  const { pool, workers } = makePool(1);
  const a = pool.run(job("a"));
  // The shell could not construct the Worker (blocked by CSP, offline file://,
  // module load failed): a different code from a worker that crashed ON a job.
  pool.onSpawnFailed(0, new Error("worker module unavailable"));
  await assert.rejects(a, poolErr("spawn-failed", /module unavailable/));
  assert.equal(workers[0]!.terminated, true);
  // Callers may redo such a decode inline however large it is.
  assert.equal(canReplayInline(new DecodePoolError("x", "spawn-failed"), 1e9), true);
});

test("timeout terminates only the slow worker; the other worker and the queue survive", async () => {
  const { pool, workers } = makePool(2); // 30 s default; only `slow` carries a short per-job timeout
  const slow = pool.run(job("slow", { timeoutMs: 10 }));
  const fine = pool.run(job("fine"));
  const queued = pool.run(job("queued"));
  await new Promise((r) => setTimeout(r, 30));
  await assert.rejects(slow, poolErr("timeout", /timed out/));
  assert.equal(workers[0]!.terminated, true);
  assert.equal(workers[1]!.terminated, false);
  // the freed slot (index 0) respawned — the fake is workers[2], its pool index is 0 — and took the queued job
  assert.equal(workers.length, 3);
  assert.equal(workers[2]!.index, 0);
  assert.deepEqual(workers[2]!.posts.map((p) => p.kind), ["queued"]);
  pool.onMessage(1, { id: workers[1]!.posts[0]!.id, ok: true }); await fine;
  pool.onMessage(0, { id: workers[2]!.posts[0]!.id, ok: true }); await queued;
});

test("worker error rejects that worker's jobs only and respawns on next use", async () => {
  const { pool, workers } = makePool(2);
  const a = pool.run(job("a")); const b = pool.run(job("b"));
  pool.onWorkerError(0, new Error("crashed"));
  await assert.rejects(a, poolErr("worker-error", /crashed/));
  assert.equal(workers[0]!.terminated, true);
  const c = pool.run(job("c"));
  assert.equal(workers.length, 3);
  assert.equal(workers[2]!.index, 0); // respawned into slot 0
  pool.onMessage(0, { id: workers[2]!.posts[0]!.id, ok: true }); await c;
  pool.onMessage(1, { id: workers[1]!.posts[0]!.id, ok: true }); await b;
});

test("affinity to a terminated slot rejects and never respawns", async () => {
  const { pool, workers } = makePool(2);
  const a = pool.run(job("open"));
  pool.onWorkerError(0, new Error("crashed"));
  await assert.rejects(a, poolErr("worker-error", /crashed/));
  const f = pool.run(job("flatten", { affinity: 0, affinityEpoch: 1 }));
  await assert.rejects(f, poolErr("affinity", /deep handle is gone/));
  assert.equal(workers.length, 1); // no respawn for the affinity job
});

test("dispose terminates every worker and rejects queued and dispatched jobs", async () => {
  const { pool, workers } = makePool(1);
  const a = pool.run(job("a")); const b = pool.run(job("b"));
  pool.dispose();
  await assert.rejects(a, poolErr("disposed", /disposed/)); await assert.rejects(b, poolErr("disposed", /disposed/));
  assert.equal(workers[0]!.terminated, true);
});

test("dispose settles a dispatched job whose slot no longer holds a worker", async () => {
  const { pool } = makePool(1);
  const a = pool.run(job("a"));
  // The shape the guard is about: a slot with NO worker that still owns a
  // dispatched job. `terminate()` used to bail on the empty slot before
  // rejecting, so `a` never settled and its caller waited for ever.
  (pool as unknown as { slots: (PoolWorker | null)[] }).slots[0] = null;
  pool.dispose();
  // Raced against a timer rather than awaited: a never-settling promise must
  // fail this test, not hang node's (untimed) runner.
  const settled = await Promise.race([
    a.then(() => "resolved" as unknown, (e: unknown) => e),
    new Promise((r) => setTimeout(() => r("still pending"), 50)),
  ]);
  assert.ok(
    settled instanceof DecodePoolError && settled.code === "disposed",
    `a dispatched job must settle even on an empty slot, got: ${String(settled)}`,
  );
});

test("dispatch-stage abort listener is removed on settle, not just on abort", async () => {
  const { pool, workers } = makePool(1);
  const ctl = new AbortController();
  let adds = 0;
  let removes = 0;
  const rawAdd = ctl.signal.addEventListener.bind(ctl.signal);
  const rawRemove = ctl.signal.removeEventListener.bind(ctl.signal);
  ctl.signal.addEventListener = ((...args: Parameters<typeof rawAdd>) => { adds++; return rawAdd(...args); }) as typeof rawAdd;
  ctl.signal.removeEventListener = ((...args: Parameters<typeof rawRemove>) => { removes++; return rawRemove(...args); }) as typeof rawRemove;

  const a = pool.run(job("a", { signal: ctl.signal }));
  pool.onMessage(0, { id: workers[0]!.posts[0]!.id, ok: true });
  await a;
  const b = pool.run(job("b", { signal: ctl.signal }));
  pool.onMessage(0, { id: workers[0]!.posts[1]!.id, ok: true });
  await b;

  assert.equal(pool.stats().queued, 0);
  assert.equal(adds, removes); // every dispatch-stage listener registered on settle was also removed
  assert.doesNotThrow(() => ctl.abort(new Error("late, nobody is listening any more")));
});

test("canReplayInline: only a never-ran failure and a decode-level reply may be redone inline", () => {
  const small = 1024;
  // The worker never ran the job (it could not be spawned) or ran it and said
  // the FILE is bad — the inline path re-derives that with a real error message.
  assert.equal(canReplayInline(new DecodePoolError("x", "spawn-failed"), small), true);
  assert.equal(canReplayInline(new DecodePoolError("x", "worker-error"), small), true);
  assert.equal(canReplayInline(new DecodePoolError("x", "reply"), small), true);
  // The work may already be under way, or the caller is gone, or the pool is:
  // redoing any of these on the main thread is what freezes a tab.
  assert.equal(canReplayInline(new DecodePoolError("x", "timeout"), small), false);
  assert.equal(canReplayInline(new DecodePoolError("x", "aborted"), small), false);
  assert.equal(canReplayInline(new DecodePoolError("x", "disposed"), small), false);
  assert.equal(canReplayInline(new DecodePoolError("x", "affinity"), small), false);
  // A non-DecodePoolError (e.g. a shell exception thrown before the pool was
  // even reached) carries no pool verdict to defer to.
  assert.equal(canReplayInline(new Error("shell exploded"), small), true);
  assert.equal(canReplayInline("not even an Error", small), true);
});

test("canReplayInline: the size gate applies to a worker CRASH, and only to that", () => {
  const big = INLINE_REPLAY_MAX_BYTES + 1;
  const small = 1024;
  // A crash the pool cannot attribute: below the budget it is treated as the
  // spin-up failure it usually is; above it, as the decode killing the worker.
  assert.equal(canReplayInline(new DecodePoolError("x", "worker-error"), small), true);
  assert.equal(canReplayInline(new DecodePoolError("x", "worker-error"), big), false);
  // Callers pass their own budget: the same crash, the same input, two formats.
  assert.equal(canReplayInline(new DecodePoolError("x", "worker-error"), big, big * 4), true);
  // A worker that never started ran nothing, so nothing is being REPEATED: the
  // fallback holds at any size (offline `file://`, strict CSP).
  assert.equal(canReplayInline(new DecodePoolError("x", "spawn-failed"), big * 1000), true);
  // A decode-level `ok:false` reply says the worker ran fine — size is irrelevant.
  assert.equal(canReplayInline(new DecodePoolError("x", "reply"), big), true);
  // Terminal codes stay terminal at every size.
  for (const code of ["timeout", "aborted", "disposed", "affinity"] as const) {
    assert.equal(canReplayInline(new DecodePoolError("x", code), small), false);
  }
});
