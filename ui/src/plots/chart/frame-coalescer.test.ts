/**
 * Pure unit tests for the frame coalescer. No test runner is configured in
 * this package, so this runs under Node's built-in test runner with
 * TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/plots/chart/frame-coalescer.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFrameCoalescer,
  defaultFrameScheduler,
  type FrameScheduler,
} from "./frame-coalescer.ts";

function fakeScheduler() {
  let pendingCb: (() => void) | null = null;
  let cancelCalls = 0;
  const cancelSpy = () => {
    cancelCalls++;
  };
  const scheduler: FrameScheduler = (cb) => {
    pendingCb = cb;
    return cancelSpy;
  };
  return {
    scheduler,
    fire() {
      const cb = pendingCb;
      pendingCb = null;
      assert.ok(cb, "expected a scheduled frame callback");
      cb();
    },
    hasPending() {
      return pendingCb !== null;
    },
    cancelCalls() {
      return cancelCalls;
    },
  };
}

test("three pushes before the frame fires emit once, with the last value", () => {
  const fake = fakeScheduler();
  const emitted: number[] = [];
  const c = createFrameCoalescer<number>((v) => emitted.push(v), fake.scheduler);

  c.push(1);
  c.push(2);
  c.push(3);
  assert.deepEqual(emitted, []);

  fake.fire();
  assert.deepEqual(emitted, [3]);
});

test("flush() emits immediately and cancels the pending frame", () => {
  const fake = fakeScheduler();
  const emitted: number[] = [];
  const c = createFrameCoalescer<number>((v) => emitted.push(v), fake.scheduler);

  c.push(42);
  assert.equal(fake.cancelCalls(), 0);
  c.flush();
  assert.deepEqual(emitted, [42]);
  assert.equal(fake.cancelCalls(), 1);
});

test("flush() with nothing pending is a no-op", () => {
  const fake = fakeScheduler();
  const emitted: number[] = [];
  const c = createFrameCoalescer<number>((v) => emitted.push(v), fake.scheduler);

  c.flush();
  assert.deepEqual(emitted, []);
  assert.equal(fake.cancelCalls(), 0);
});

test("cancel() drops the pending value: no emit when the frame later fires", () => {
  const fake = fakeScheduler();
  const emitted: number[] = [];
  const c = createFrameCoalescer<number>((v) => emitted.push(v), fake.scheduler);

  c.push(7);
  c.cancel();
  assert.equal(fake.cancelCalls(), 1);
  // The scheduler in this fake doesn't remove the callback on cancel (that's
  // the real scheduler's job); the coalescer itself must not emit anything
  // when it fires because the pending value was dropped.
  fake.fire();
  assert.deepEqual(emitted, []);
});

test("a push after flush schedules a new frame", () => {
  const fake = fakeScheduler();
  const emitted: number[] = [];
  const c = createFrameCoalescer<number>((v) => emitted.push(v), fake.scheduler);

  c.push(1);
  c.flush();
  assert.deepEqual(emitted, [1]);

  c.push(2);
  assert.equal(fake.hasPending(), true);
  fake.fire();
  assert.deepEqual(emitted, [1, 2]);
});

test("a push after cancel schedules a new frame", () => {
  const fake = fakeScheduler();
  const emitted: number[] = [];
  const c = createFrameCoalescer<number>((v) => emitted.push(v), fake.scheduler);

  c.push(1);
  c.cancel();
  c.push(2);
  assert.equal(fake.hasPending(), true);
  fake.fire();
  assert.deepEqual(emitted, [2]);
});

test("only one frame is scheduled across multiple pushes", () => {
  let scheduleCalls = 0;
  const scheduler: FrameScheduler = (cb) => {
    scheduleCalls++;
    return () => {};
  };
  const c = createFrameCoalescer<number>(() => {}, scheduler);
  c.push(1);
  c.push(2);
  c.push(3);
  assert.equal(scheduleCalls, 1);
});

test("defaultFrameScheduler falls back to setTimeout when requestAnimationFrame is undefined", async () => {
  const g = globalThis as { requestAnimationFrame?: unknown };
  const original = g.requestAnimationFrame;
  assert.equal(original, undefined, "expected no requestAnimationFrame in node");

  let called = false;
  let ranSynchronously = true;
  defaultFrameScheduler(() => {
    called = true;
  });
  // The setTimeout(fn, 0) fallback must run asynchronously, not synchronously.
  ranSynchronously = called;
  assert.equal(ranSynchronously, false);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(called, true);
});
