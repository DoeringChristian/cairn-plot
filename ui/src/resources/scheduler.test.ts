import assert from "node:assert/strict";
import test from "node:test";

import { PreparationScheduler } from "./scheduler.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

test("foreground activation overtakes queued adjacent preloads", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1 });
  const gate = deferred<void>();
  const order: string[] = [];
  const active = scheduler.schedule("active", "foreground", async () => {
    order.push("active");
    await gate.promise;
  });
  const previous = scheduler.schedule("previous", "preload", async () => { order.push("previous"); });
  const next = scheduler.schedule("next", "preload", async () => { order.push("next"); });
  const selected = scheduler.schedule("selected", "foreground", async () => { order.push("selected"); });

  await Promise.resolve();
  gate.resolve();
  await Promise.all([active, previous, next, selected]);
  assert.deepEqual(order, ["active", "selected", "previous", "next"]);
});

test("foreground request promotes and shares an existing preload", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1 });
  const gate = deferred<void>();
  const blocker = scheduler.schedule("blocker", "foreground", () => gate.promise);
  let calls = 0;
  const preload = scheduler.schedule("slot", "preload", async () => ++calls);
  const foreground = scheduler.schedule("slot", "foreground", async () => ++calls);
  assert.equal(preload, foreground);

  gate.resolve();
  await blocker;
  assert.equal(await foreground, 1);
  assert.equal(calls, 1);
});

test("failed work leaves the scheduler and can be retried", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1 });
  await assert.rejects(scheduler.schedule("slot", "preload", async () => {
    throw new Error("cold failure");
  }));
  assert.equal(await scheduler.schedule("slot", "foreground", async () => 42), 42);
});
