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

const { decodeExr, decodedByteEstimate } = await import("./exr-decode.ts");
const { DecodePool, DecodePoolError, INLINE_REPLAY_MAX_BYTES } = await import("./decode-pool-core.ts");
const { getDecodePool, setDecodePoolForTests } = await import("./decode-pool.ts");

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

test("the fixture decodes on the main thread when the pool never spins a worker up", async () => {
  // Control for the timeout test below. No pool override, so the REAL pool runs
  // and its `import("./decode-worker.ts?worker&inline")` fails under node —
  // exactly what an offline `file://` page or a strict CSP produces. Pin the
  // code that path reports, since the whole fallback hinges on it...
  await assert.rejects(
    getDecodePool().run({ make: (id: number) => ({ id }) }),
    (err: unknown) => err instanceof DecodePoolError && err.code === "spawn-failed",
  );
  // ...and the decode still succeeds through the inline replay it permits.
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

test("a DISPOSED pool rejects decodeExr rather than decoding again on the main thread", async () => {
  // Same rule for the other terminal codes: a pane that scrolled away or moved
  // to the next step drops its decode, and the pool can go out from under it.
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


/**
 * A HEADER-ONLY EXR: `describeExr` reads its extent, but there are no pixels
 * behind it. Tiny on disk, enormous decoded — the shape a file-size gate gets
 * exactly backwards (as does a DWA file, which this stands in for).
 */
function exrHeaderOnly(width: number, height: number, channelNames: string[], pixelType = 1): ArrayBuffer {
  const out: number[] = [];
  const i32 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  const str = (a: number[], v: string) => { for (let i = 0; i < v.length; i++) a.push(v.charCodeAt(i)); a.push(0); };
  i32(out, 20000630); // magic
  i32(out, 2); // version, no flags
  const chlist: number[] = [];
  for (const name of channelNames) {
    str(chlist, name);
    i32(chlist, pixelType); // 0 UINT, 1 HALF, 2 FLOAT
    i32(chlist, 0); // pLinear + 3 reserved
    i32(chlist, 1); // xSampling
    i32(chlist, 1); // ySampling
  }
  chlist.push(0); // empty name ends the channel list
  str(out, "channels"); str(out, "chlist"); i32(out, chlist.length); out.push(...chlist);
  const dw: number[] = [];
  i32(dw, 0); i32(dw, 0); i32(dw, width - 1); i32(dw, height - 1);
  str(out, "dataWindow"); str(out, "box2i"); i32(out, dw.length); out.push(...dw);
  out.push(0); // empty attribute name ends the header
  return new Uint8Array(out).buffer;
}

test("decodedByteEstimate measures the DECODE, from the header — not the file size", () => {
  // 4096 x 4096 RGBA half = 128 MB of pixels behind a header of a few hundred
  // bytes. Judged by file size this looks free; it is the freeze.
  const header = exrHeaderOnly(4096, 4096, ["A", "B", "G", "R"]);
  assert.ok(header.byteLength < 1024, `header-only file should be tiny, was ${header.byteLength}`);
  assert.equal(decodedByteEstimate(header), 4096 * 4096 * 4 * 2);
  // FLOAT channels are 4 bytes, HALF 2 — the estimate follows the declared type.
  assert.equal(decodedByteEstimate(exrHeaderOnly(64, 32, ["R"], 2)), 64 * 32 * 4);
  // A real fixture: 64 x 48, a handful of half channels.
  const real = decodedByteEstimate(zipFixture());
  assert.ok(real >= 64 * 48 * 3 * 2 && real <= 64 * 48 * 4 * 4, `implausible estimate ${real}`);
  // Nothing parseable → assume 8:1 compression rather than trusting the bytes.
  const garbage = new ArrayBuffer(4096);
  assert.equal(decodedByteEstimate(garbage), 4096 * 8);
});

test("a worker CRASH on a big FILE holding a small image still falls back inline", async () => {
  // The gate is about the work, not the download: this is 8 MB+ of file around
  // a 64 x 48 image (padding stands in for a fat header / trailing chunk), and
  // re-decoding it on the main thread costs microseconds. Judged by file size
  // it would have been refused and the pane left blank.
  const src = new Uint8Array(zipFixture());
  const padded = new Uint8Array(INLINE_REPLAY_MAX_BYTES + 4096);
  padded.set(src);
  const bytes = padded.buffer;
  assert.ok(bytes.byteLength > INLINE_REPLAY_MAX_BYTES);
  assert.ok(decodedByteEstimate(bytes) < 1024 * 1024);

  let pool: InstanceType<typeof DecodePool> | undefined;
  pool = new DecodePool({
    size: 1,
    timeoutMs: 1_000,
    spawn(index) {
      return {
        post() { queueMicrotask(() => pool!.onWorkerError(index, new Error("worker crashed mid-decode"))); },
        terminate() {},
      };
    },
  });
  setDecodePoolForTests(pool);
  try {
    const img = await decodeExr({ bytes, ext: "exr" });
    assert.equal(img.width, 64);
    assert.equal(img.height, 48);
  } finally {
    setDecodePoolForTests(null);
  }
});
