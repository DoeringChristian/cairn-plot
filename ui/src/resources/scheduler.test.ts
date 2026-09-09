import assert from "node:assert/strict";
import test from "node:test";

import {
  PreparationScheduler,
  TASK_WATCHDOG_MS,
  comparePreparationTasks,
} from "./scheduler.ts";

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

// --- H1: a never-settling task must not pin its slot forever ---------------

test("watchdog frees the slot a never-settling task holds", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1, watchdogMs: 10 });
  const warnings: unknown[][] = [];
  // eslint-disable-next-line no-console
  const realWarn = console.warn;
  // eslint-disable-next-line no-console
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    // A task that NEVER settles — a decode worker that died without replying.
    const stuck = scheduler.schedule("stuck", "foreground", () => new Promise<void>(() => {}));
    let ranAfter = false;
    const queued = scheduler.schedule("after", "foreground", async () => { ranAfter = true; });

    await Promise.resolve();
    assert.equal(ranAfter, false, "the queued task waits behind the stuck one");

    assert.equal(await queued.then(() => "settled"), "settled");
    assert.equal(ranAfter, true, "the watchdog released the slot and drained the queue");
    assert.equal(warnings.length, 1, "the watchdog warns exactly once");
    assert.match(String(warnings[0]?.[0]), /"stuck"/);
    // The stuck task's own promise is deliberately left alone.
    assert.equal(
      await Promise.race([stuck.then(() => "settled"), Promise.resolve("pending")]),
      "pending",
    );
  } finally {
    // eslint-disable-next-line no-console
    console.warn = realWarn;
  }
});

test("watchdog does not fire for a task that settles normally", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1, watchdogMs: 10 });
  const warnings: unknown[][] = [];
  // eslint-disable-next-line no-console
  const realWarn = console.warn;
  // eslint-disable-next-line no-console
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    assert.equal(await scheduler.schedule("quick", "foreground", async () => 7), 7);
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(warnings, []);
  } finally {
    // eslint-disable-next-line no-console
    console.warn = realWarn;
  }
});

test("a watchdogged key can be rescheduled and runs again", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 2, watchdogMs: 10 });
  // eslint-disable-next-line no-console
  const realWarn = console.warn;
  // eslint-disable-next-line no-console
  console.warn = () => {};
  try {
    void scheduler.schedule("slot", "foreground", () => new Promise<number>(() => {}));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(await scheduler.schedule("slot", "foreground", async () => 5), 5);
  } finally {
    // eslint-disable-next-line no-console
    console.warn = realWarn;
  }
});

test("default watchdog is the documented 60s", () => {
  assert.equal(TASK_WATCHDOG_MS, 60_000);
  assert.equal(new PreparationScheduler({ concurrency: 1 }).watchdogMs, TASK_WATCHDOG_MS);
});

// --- H1: fairness — visible work jumps the queue within its band -----------

test("visible tasks jump ahead of equally-prioritised offscreen ones", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1 });
  const gate = deferred<void>();
  const order: string[] = [];
  const blocker = scheduler.schedule("blocker", "foreground", () => gate.promise);
  const offscreenA = scheduler.schedule("offA", "foreground", async () => { order.push("offA"); });
  const offscreenB = scheduler.schedule("offB", "foreground", async () => { order.push("offB"); });
  // Queued LAST but on screen — it must still run first.
  const onscreen = scheduler.schedule("on", "foreground", async () => { order.push("on"); }, { visible: true });

  gate.resolve();
  await Promise.all([blocker, offscreenA, offscreenB, onscreen]);
  assert.deepEqual(order, ["on", "offA", "offB"]);
});

test("priority still outranks visibility", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1 });
  const gate = deferred<void>();
  const order: string[] = [];
  const blocker = scheduler.schedule("blocker", "foreground", () => gate.promise);
  const visiblePreload = scheduler.schedule("pre", "preload", async () => { order.push("pre"); }, { visible: true });
  const hiddenForeground = scheduler.schedule("fg", "foreground", async () => { order.push("fg"); });

  gate.resolve();
  await Promise.all([blocker, visiblePreload, hiddenForeground]);
  assert.deepEqual(order, ["fg", "pre"], "a visible preload never overtakes foreground work");
});

test("re-requesting a queued task as visible promotes it", async () => {
  const scheduler = new PreparationScheduler({ concurrency: 1 });
  const gate = deferred<void>();
  const order: string[] = [];
  const blocker = scheduler.schedule("blocker", "foreground", () => gate.promise);
  const first = scheduler.schedule("first", "foreground", async () => { order.push("first"); });
  const second = scheduler.schedule("second", "foreground", async () => { order.push("second"); });
  // The pane for "second" scrolls into view before either has started.
  assert.equal(scheduler.schedule("second", "foreground", async () => { order.push("second"); }, { visible: true }), second);

  gate.resolve();
  await Promise.all([blocker, first, second]);
  assert.deepEqual(order, ["second", "first"]);
});

test("comparePreparationTasks orders priority, then visibility, then FIFO", () => {
  const fg = { priority: "foreground" as const, order: 5 };
  const pre = { priority: "preload" as const, order: 0 };
  assert.ok(comparePreparationTasks(fg, pre) < 0, "foreground first");
  assert.ok(
    comparePreparationTasks({ ...pre, visible: true }, { ...pre, order: 1 }) < 0,
    "visible first within a band",
  );
  assert.ok(
    comparePreparationTasks({ ...fg, order: 1 }, { ...fg, order: 2 }) < 0,
    "FIFO otherwise",
  );
  assert.equal(comparePreparationTasks(fg, fg), 0);
});
