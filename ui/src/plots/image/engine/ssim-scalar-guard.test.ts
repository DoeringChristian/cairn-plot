/**
 * Node test: the mean-SSIM scalar guard + chunked CPU fallback — the two halves
 * of the fix for the reported "switching a mismatched-size URL compare pane to
 * SSIM wedges the page for 60s+".
 *
 * Root cause: the metrics-chip effect can re-fire many times, and every firing
 * used to START a fresh SSIM computation (GPU multipass + readback, or the
 * ~250ms CPU reference). Stacking those hard-blocks the main thread. The guard
 * (`guardedSsimScalar`, wired into `diff-engine.ts` `ensureSsimScalar`) makes
 * `getSsimComputeCount()` move exactly ONCE per content+mapping no matter how
 * many times you call; the chunked CPU path yields between scanline batches so
 * even that single run never blocks.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     src/plots/image/engine/ssim-scalar-guard.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardedSsimScalar, getSsimComputeCount } from "./ssim-scalar-guard.ts";
import { ssimMeanFromLuminanceChunked } from "./kernels/ssim-reference.ts";
import type { Device } from "./types.ts";

/** A stand-in device object — the guard only uses it as a WeakMap key. */
const fakeDevice = (): Device => ({}) as unknown as Device;

/** A compute that resolves after a microtask hop, counting how many times it actually ran. */
function countingCompute(value: number) {
  const state = { runs: 0 };
  const fn = async () => {
    state.runs++;
    await Promise.resolve();
    return value;
  };
  return { fn, state };
}

test("guard: a burst of concurrent calls computes exactly ONCE and all share the value", async () => {
  const device = fakeDevice();
  const { fn, state } = countingCompute(0.372);

  const before = getSsimComputeCount();
  const results = await Promise.all(
    Array.from({ length: 200 }, () => guardedSsimScalar(device, "urlA|urlB|crop:800x800", fn)),
  );

  assert.equal(state.runs, 1, `underlying compute must run once, ran ${state.runs}`);
  assert.equal(getSsimComputeCount() - before, 1, "compute counter moves exactly once for the burst");
  for (const v of results) assert.equal(v, 0.372);
});

test("guard: distinct keys each compute once; a settled key is served from cache", async () => {
  const device = fakeDevice();
  const a = countingCompute(0.1);
  const b = countingCompute(0.2);
  const before = getSsimComputeCount();

  await Promise.all([
    guardedSsimScalar(device, "k1", a.fn),
    guardedSsimScalar(device, "k1", a.fn), // same key -> guard hit
    guardedSsimScalar(device, "k2", b.fn), // different key -> its own compute
  ]);
  assert.equal(getSsimComputeCount() - before, 2, "two distinct keys => two computes");
  assert.equal(a.state.runs, 1);
  assert.equal(b.state.runs, 1);

  // A repeat of an already-settled key does not recompute.
  const v = await guardedSsimScalar(device, "k1", a.fn);
  assert.equal(v, 0.1);
  assert.equal(a.state.runs, 1, "settled key must not recompute");
});

test("guard: a REJECTED attempt is evicted so a later call can retry", async () => {
  const device = fakeDevice();
  let attempt = 0;
  const flaky = async () => {
    attempt++;
    await Promise.resolve();
    if (attempt === 1) throw new Error("transient GPU failure");
    return 0.9;
  };
  const before = getSsimComputeCount();

  await assert.rejects(() => guardedSsimScalar(device, "kf", flaky));
  // The failed key was dropped — a fresh call retries (and now succeeds).
  const v = await guardedSsimScalar(device, "kf", flaky);
  assert.equal(v, 0.9);
  assert.equal(attempt, 2, "one failed + one successful attempt");
  assert.equal(getSsimComputeCount() - before, 2, "each real attempt counts once");
});

test("guard: keys are isolated per device (WeakMap-scoped)", async () => {
  const d1 = fakeDevice();
  const d2 = fakeDevice();
  const c1 = countingCompute(0.5);
  const c2 = countingCompute(0.6);
  const before = getSsimComputeCount();

  const [v1, v2] = await Promise.all([
    guardedSsimScalar(d1, "same-key", c1.fn),
    guardedSsimScalar(d2, "same-key", c2.fn),
  ]);
  assert.equal(v1, 0.5);
  assert.equal(v2, 0.6);
  assert.equal(getSsimComputeCount() - before, 2, "same key on two devices => two computes");
});

test("chunked CPU SSIM yields between scanline batches AND matches the un-yielded math", async () => {
  const W = 200, H = 200;
  const x = new Float64Array(W * H);
  const y = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) {
    x[i] = ((i * 13) % 97) / 97;
    y[i] = ((i * 29) % 97) / 97;
  }
  let yields = 0;
  const countingYield = () => { yields++; return Promise.resolve(); };
  const meanChunked = await ssimMeanFromLuminanceChunked(x, y, W, H, countingYield);
  const meanNoYield = await ssimMeanFromLuminanceChunked(x, y, W, H, () => Promise.resolve());

  assert.equal(meanChunked, meanNoYield, "yield scheduling must not change the numeric result");
  assert.ok(Number.isFinite(meanChunked), "mean must be finite");
  // 200 rows / 64-row batches over ~5 blurs x 2 passes => many yields: the work
  // is broken into bounded synchronous slices, never one un-yielded burst.
  assert.ok(yields >= 20, `expected many cooperative yields, got ${yields}`);

  // Identical inputs read a mean of ~1 (SSIM of a plane with itself).
  const same = await ssimMeanFromLuminanceChunked(x, x, W, H, () => Promise.resolve());
  assert.ok(Math.abs(same - 1) < 1e-9, `SSIM(x,x) mean should be 1, got ${same}`);
});
