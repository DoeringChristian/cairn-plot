/**
 * `decodeNpyBytes` must NOT replay a TERMINAL pool failure inline on the main
 * thread. A timed-out (or aborted) decode may still be running in the worker,
 * and re-parsing the same bytes synchronously can freeze the tab; so can a
 * worker CRASH on a large input, where the parse itself is the likely cause
 * (the pool cannot tell that crash apart from a worker that never started, so
 * the input SIZE decides). See `canReplayInline` in `decode-pool-core.ts`.
 *
 * This lives in its OWN file for the same reason as `npy-decode-fallback.test.ts`:
 * node runs each test file in a fresh process, and the stub `globalThis.Worker`
 * below (needed so `decodePoolAvailable()` is true) must not leak into the
 * other decoder tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

(globalThis as { Worker?: unknown }).Worker = class {};

const { decodeNpyBytes } = await import("./npy-decode.ts");
const { DecodePool, DecodePoolError, INLINE_REPLAY_MAX_BYTES } = await import("./decode-pool-core.ts");
const { setDecodePoolForTests } = await import("./decode-pool.ts");

/** A valid float32 `.npy` buffer; `values` fills it, otherwise it stays zeroed. */
function npyFloat32(width: number, height: number, values?: number[]): ArrayBuffer {
  const header = `{'descr': '<f4', 'fortran_order': False, 'shape': (${height}, ${width}), }`;
  const pad = 64 - ((10 + header.length + 1) % 64);
  const text = header + " ".repeat(pad) + "\n";
  const buf = new ArrayBuffer(10 + text.length + width * height * 4);
  const u8 = new Uint8Array(buf);
  u8.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]);
  new DataView(buf).setUint16(8, text.length, true);
  for (let i = 0; i < text.length; i++) u8[10 + i] = text.charCodeAt(i);
  if (values) new Float32Array(buf, 10 + text.length).set(values);
  return buf;
}

test("a pool TIMEOUT rejects decodeNpyBytes; it is never replayed inline", async () => {
  // A worker that never replies — every job dispatched to it times out.
  const pool = new DecodePool({
    size: 1,
    timeoutMs: 5,
    spawn() { return { post() {}, terminate() {} }; },
  });
  setDecodePoolForTests(pool);
  try {
    // VALID npy bytes: if the inline fallback ran anyway, this would resolve
    // instead of rejecting.
    const bytes = npyFloat32(2, 2, [0.25, 8, -1, 3]);
    await assert.rejects(
      decodeNpyBytes(bytes),
      (err) => err instanceof DecodePoolError && err.code === "timeout",
    );
  } finally {
    setDecodePoolForTests(null);
  }
});

/** A pool whose worker accepts the job and then dies on it, mid-parse. */
function crashingPool() {
  let pool: InstanceType<typeof DecodePool> | undefined;
  pool = new DecodePool({
    size: 1,
    timeoutMs: 1_000,
    spawn(index) {
      return {
        post() { queueMicrotask(() => pool!.onWorkerError(index, new Error("worker crashed mid-parse"))); },
        terminate() {},
      };
    },
  });
  return pool;
}

test("a worker CRASH on a LARGE input rejects; the parse is not re-run on the main thread", async () => {
  setDecodePoolForTests(crashingPool());
  try {
    // Comfortably past the gate: 2048 x 1200 float32 ≈ 9.8 MB.
    const bytes = npyFloat32(2048, 1200);
    assert.ok(bytes.byteLength > INLINE_REPLAY_MAX_BYTES);
    // VALID bytes again: were the inline parse taken, this would resolve.
    await assert.rejects(
      decodeNpyBytes(bytes),
      (err) => err instanceof DecodePoolError && err.code === "worker-error",
    );
  } finally {
    setDecodePoolForTests(null);
  }
});

test("a worker CRASH on a SMALL input still falls back to the inline parse", async () => {
  // The other half of the same rule: below the gate a crash is most likely the
  // worker failing to spin up at all, and the inline parse is both cheap and
  // the path that yields the real error for a genuinely bad file.
  setDecodePoolForTests(crashingPool());
  try {
    const img = await decodeNpyBytes(npyFloat32(2, 2, [0.25, 8, -1, 3]));
    assert.equal(img.kind, "f32");
    if (img.kind === "f32") assert.deepEqual(Array.from(img.data as Float32Array), [0.25, 8, -1, 3]);
  } finally {
    setDecodePoolForTests(null);
  }
});
