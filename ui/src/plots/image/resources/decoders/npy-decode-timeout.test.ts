/**
 * `decodeNpyBytes` must NOT replay a timed-out (or aborted) pool decode inline
 * on the main thread — that decode may still be running in the worker, and
 * re-parsing the same bytes synchronously can freeze the tab (see
 * `isRetryableInline` in `decode-pool-core.ts`).
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
const { DecodePool, DecodePoolError } = await import("./decode-pool-core.ts");
const { setDecodePoolForTests } = await import("./decode-pool.ts");

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
