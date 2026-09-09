/**
 * `decodeExr` and TERMINAL pool failures.
 *
 * A pool timeout means a worker has ALREADY been grinding on this decode for
 * the whole timeout. Replaying it on the main thread freezes the tab — through
 * the inline WASM core (`decodeFull`) and equally through the pure-TS reader
 * (`exr.ts`), which is a main-thread decode like any other. Both fallbacks must
 * therefore be skipped, and the pool error must surface to the caller.
 *
 * This lives in its OWN file (as `npy-decode-fallback.test.ts` does): node runs
 * each test file in a fresh process, and the stub `globalThis.Worker` below —
 * needed so `decodePoolAvailable()` is true — must be installed BEFORE
 * `exr-decode.ts` (and, through it, `decode-pool.ts`) is imported, and must not
 * leak into the other decoder tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

(globalThis as { Worker?: unknown }).Worker = class {};

const { decodeExr } = await import("./exr-decode.ts");
const { DecodePool, DecodePoolError } = await import("./decode-pool-core.ts");
const { setDecodePoolForTests } = await import("./decode-pool.ts");

/**
 * A ZIP fixture — deliberately one the PURE reader (`exr.ts`, NONE/ZIP/ZIPS)
 * can decode by itself, so a main-thread replay would visibly SUCCEED. That is
 * what makes its absence observable: with the fallback wrongly taken these
 * tests resolve instead of rejecting.
 */
function zipFixture(): ArrayBuffer {
  const buf = readFileSync(new URL("./fixtures/rgb-zip-half-64x48.exr", import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** A pool of workers that accept every job and never answer. */
function silentPool(timeoutMs: number): InstanceType<typeof DecodePool> {
  return new DecodePool({ size: 1, timeoutMs, spawn() { return { post() {}, terminate() {} }; } });
}

test("the fixture decodes on the main thread when the pool merely failed to spin up", async () => {
  // Control for the timeout test below: no pool override, so the real pool's
  // `import("./decode-worker.ts?worker&inline")` fails under node → a
  // "worker-error" the worker never ran, small input → inline replay, which
  // decodes this fixture fine. The fallback path is alive and reachable.
  const img = await decodeExr({ bytes: zipFixture(), ext: "exr" });
  assert.equal(img.width, 64);
  assert.equal(img.height, 48);
});

test("a pool TIMEOUT rejects decodeExr; neither the inline WASM core nor the pure reader runs", async () => {
  setDecodePoolForTests(silentPool(5));
  try {
    const started = Date.now();
    await assert.rejects(
      decodeExr({ bytes: zipFixture(), ext: "exr" }),
      (err) => err instanceof DecodePoolError && err.code === "timeout",
    );
    // A main-thread replay of this fixture succeeds (see the control above), so
    // rejecting at all proves neither fallback ran. The clock is a second
    // guard: a real replay would show up as a slow, still-green test.
    assert.ok(Date.now() - started < 1_000, "must fail fast, not decode again on the main thread");
  } finally {
    setDecodePoolForTests(null);
  }
});

test("a pool ABORT rejects decodeExr rather than decoding again on the main thread", async () => {
  // Same rule for the other terminal code a comparison pane produces constantly:
  // a pane that scrolled away or moved to the next step aborts its decode.
  const pool = silentPool(30_000);
  setDecodePoolForTests(pool);
  try {
    // The pool's own dispose is the abort every pane inherits when the pool goes.
    const p = decodeExr({ bytes: zipFixture(), ext: "exr" });
    pool.dispose();
    await assert.rejects(p, (err) => err instanceof DecodePoolError && err.code === "disposed");
  } finally {
    setDecodePoolForTests(null);
  }
});
