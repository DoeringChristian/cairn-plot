/**
 * `decodeNpyBytes` falls back to the inline parse on ANY pool failure.
 *
 * This lives in its OWN file because node runs each test file in a fresh
 * process: the stub `globalThis.Worker` below must be installed BEFORE
 * `npy-decode.ts` (and, through it, `decode-pool.ts`) is imported, and it must
 * not leak into the other decoder tests. With a `Worker` present,
 * `decodePoolAvailable()` is true, so the real pool path runs — and its
 * `import("./decode-worker.ts?worker&inline")` has no node resolution, so the
 * module load rejects, `onWorkerError` terminates the slot, and `run()` rejects.
 * That is the "pool broke while spinning up" case, and it must still decode.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Stand in for the browser Worker constructor. It is never actually invoked:
// the pool's dynamic import of the worker module fails first, under node.
(globalThis as { Worker?: unknown }).Worker = class {};

const { decodeNpyBytes } = await import("./npy-decode.ts");

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

test("a broken pool falls back to the inline parse (not the 30 s timeout)", async () => {
  const bytes = npyFloat32(2, 2, [0.25, 8, -1, 3]);
  const started = Date.now();
  const img = await decodeNpyBytes(bytes);
  // The worker-module load rejects promptly; nothing here waits on the pool's
  // 30 s decode timeout. Assert that explicitly so a regression to the timeout
  // path is a failure, not a slow-but-green test.
  assert.ok(Date.now() - started < 5_000, "fallback must not wait on the pool timeout");
  assert.equal(img.kind, "f32");
  if (img.kind === "f32") {
    assert.deepEqual(Array.from(img.data as Float32Array), [0.25, 8, -1, 3]);
    assert.equal(img.width, 2);
    assert.equal(img.height, 2);
  }
  // The caller's buffer is never detached: a second decode of the SAME bytes works.
  const again = await decodeNpyBytes(bytes);
  assert.equal(again.kind, "f32");
});
