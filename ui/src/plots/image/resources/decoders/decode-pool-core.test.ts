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
    /deep handle is gone/,
  );
  assert.equal(workers[1]!.posts.length, 1); // nothing posted to the fresh worker
  // ...while a handle opened on the NEW generation still works.
  const f = pool.run(job("flatten", { affinity: fresh.worker, affinityEpoch: fresh.epoch }));
  assert.deepEqual(workers[1]!.posts.map((p) => p.kind), ["plain", "flatten"]);
  pool.onMessage(0, { id: workers[1]!.posts[1]!.id, ok: true }); await f;
});

test("affinity without an epoch is rejected outright", async () => {
  const { pool, workers } = makePool(1);
  await assert.rejects(pool.run(job("flatten", { affinity: 0 })), /needs the affinityEpoch/);
  assert.equal(workers.length, 0);
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
  const { pool, workers } = makePool(2); // 30 s default; only `slow` carries a short per-job timeout
  const slow = pool.run(job("slow", { timeoutMs: 10 }));
  const fine = pool.run(job("fine"));
  const queued = pool.run(job("queued"));
  await new Promise((r) => setTimeout(r, 30));
  await assert.rejects(slow, /timed out/);
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
  await assert.rejects(a, /crashed/);
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
  await assert.rejects(a, /crashed/);
  const f = pool.run(job("flatten", { affinity: 0, affinityEpoch: 1 }));
  await assert.rejects(f, /deep handle is gone/);
  assert.equal(workers.length, 1); // no respawn for the affinity job
});

test("dispose terminates every worker and rejects queued and dispatched jobs", async () => {
  const { pool, workers } = makePool(1);
  const a = pool.run(job("a")); const b = pool.run(job("b"));
  pool.dispose();
  await assert.rejects(a, /disposed/); await assert.rejects(b, /disposed/);
  assert.equal(workers[0]!.terminated, true);
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
