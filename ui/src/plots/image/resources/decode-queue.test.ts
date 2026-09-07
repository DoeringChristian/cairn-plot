/**
 * Unit tests for the bounded decode queue (`decode-queue.ts`).
 *
 * The three properties the design (§3.4) depends on:
 *   - at most `DECODE_CONCURRENCY` decodes run at once, so a page of image
 *     cards no longer fires every decode at mount;
 *   - queued (not yet running) work is served MOST-RECENT-FIRST, so a pane
 *     scrolled into view now beats the stale mount requests ahead of it;
 *   - a queued entry whose refcount falls to zero is dropped and NEVER runs
 *     (the unmounted pane's decode is cancelled, not merely ignored).
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/resources/decode-queue.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DECODE_CONCURRENCY,
  DecodeCancelled,
  decodeQueueStats,
  enqueueDecode,
  releaseDecode,
  retainDecode,
} from "./decode-queue.ts";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A gate per key: `enqueue(k)` records when `k` STARTS and blocks until released. */
function gates() {
  const started: string[] = [];
  const open = new Map<string, Deferred<string>>();
  const enqueue = (key: string): Promise<string> => {
    const gate = deferred<string>();
    open.set(key, gate);
    return enqueueDecode(key, () => {
      started.push(key);
      return gate.promise;
    });
  };
  return { started, open, enqueue };
}

test("runs at most DECODE_CONCURRENCY at once and queues the rest", async () => {
  assert.equal(DECODE_CONCURRENCY, 3);
  const g = gates();
  const promises = ["a", "b", "c", "d", "e"].map((k) => g.enqueue(k));

  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 2 });
  assert.deepEqual(g.started, ["a", "b", "c"], "only the first three started");

  // Free one slot: the MOST RECENTLY queued entry ("e") runs next, not "d".
  g.open.get("a")!.resolve("a");
  assert.equal(await promises[0], "a");
  assert.deepEqual(g.started, ["a", "b", "c", "e"], "most-recent-first");
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 1 });

  // A REJECTED task frees its slot exactly like a resolved one.
  g.open.get("b")!.reject(new Error("boom"));
  await assert.rejects(promises[1], /boom/);
  assert.deepEqual(g.started, ["a", "b", "c", "e", "d"], "then the older one");
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 0 });

  for (const key of ["c", "d", "e"]) g.open.get(key)!.resolve(key);
  assert.deepEqual(await Promise.all([promises[2], promises[3], promises[4]]), ["c", "d", "e"]);
  assert.deepEqual(decodeQueueStats(), { running: 0, queued: 0 });
});

test("a queued entry released to zero refs is cancelled and never runs", async () => {
  const g = gates();
  const busy = ["x1", "x2", "x3"].map((k) => g.enqueue(k));
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 0 });

  let ran = false;
  retainDecode("z");
  const queuedPromise = enqueueDecode("z", () => {
    ran = true;
    return Promise.resolve("z");
  });
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 1 });

  releaseDecode("z");
  await assert.rejects(queuedPromise, (error: unknown) => error instanceof DecodeCancelled);
  assert.equal(ran, false, "the cancelled task never executed");
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 0 });

  for (const key of ["x1", "x2", "x3"]) g.open.get(key)!.resolve(key);
  await Promise.all(busy);
  assert.deepEqual(decodeQueueStats(), { running: 0, queued: 0 });
});

test("only the LAST release cancels, and a running entry is never cancelled", async () => {
  const g = gates();
  const busy = ["y1", "y2"].map((k) => g.enqueue(k));

  // "y1" is RUNNING; releasing its last ref must not disturb it.
  retainDecode("y1");
  releaseDecode("y1");

  let ran = false;
  retainDecode("w");
  retainDecode("w");
  const queuedPromise = g.enqueue("w0"); // occupies the third slot
  const held = enqueueDecode("w", () => {
    ran = true;
    return Promise.resolve("w");
  });
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 1 });

  releaseDecode("w"); // two refs -> one: still wanted
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 1 });

  // A release for a key nobody ever retained must not drop anything either.
  releaseDecode("never-retained");
  assert.deepEqual(decodeQueueStats(), { running: 3, queued: 1 });

  g.open.get("y1")!.resolve("y1");
  assert.equal(await busy[0], "y1", "the running entry finished normally");
  assert.equal(await held, "w");
  assert.equal(ran, true);

  g.open.get("y2")!.resolve("y2");
  g.open.get("w0")!.resolve("w0");
  await Promise.all([busy[1], queuedPromise]);
  assert.deepEqual(decodeQueueStats(), { running: 0, queued: 0 });
});
