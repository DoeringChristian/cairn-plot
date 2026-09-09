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


/** One part of a synthetic header: dimensions and channels, no pixels behind it. */
interface PartSpec { width: number; height: number; channels: string[]; pixelType?: number; deep?: boolean; name?: string }

/**
 * A HEADER-ONLY EXR: `describeExr` reads its parts and their extent, but there
 * is nothing behind them. Tiny on disk, enormous decoded — the shape a
 * file-size gate gets exactly backwards (as does a DWA file, which this stands
 * in for), and the only cheap way to author a multi-part or deep header.
 */
function exrHeaderOnly(parts: PartSpec[]): ArrayBuffer {
  const out: number[] = [];
  const i32 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  const str = (a: number[], v: string) => { for (let i = 0; i < v.length; i++) a.push(v.charCodeAt(i)); a.push(0); };
  const attr = (name: string, type: string, payload: number[]) => {
    str(out, name); str(out, type); i32(out, payload.length); out.push(...payload);
  };
  const multi = parts.length > 1;
  const singleDeep = !multi && !!parts[0]?.deep;
  i32(out, 20000630); // magic
  i32(out, 2 | (multi ? 0x1000 : 0) | (singleDeep ? 0x0800 : 0)); // version + flags
  for (const part of parts) {
    const chlist: number[] = [];
    for (const name of part.channels) {
      str(chlist, name);
      i32(chlist, part.pixelType ?? 1); // 0 UINT, 1 HALF, 2 FLOAT
      i32(chlist, 0); // pLinear + 3 reserved
      i32(chlist, 1); // xSampling
      i32(chlist, 1); // ySampling
    }
    chlist.push(0); // empty name ends the channel list
    attr("channels", "chlist", chlist);
    const dw: number[] = [];
    i32(dw, 0); i32(dw, 0); i32(dw, part.width - 1); i32(dw, part.height - 1);
    attr("dataWindow", "box2i", dw);
    if (multi) {
      const nm: number[] = []; for (const c of part.name ?? "") nm.push(c.charCodeAt(0));
      attr("name", "string", nm);
      const ty: number[] = []; for (const c of part.deep ? "deepscanline" : "scanlineimage") ty.push(c.charCodeAt(0));
      attr("type", "string", ty);
    }
    out.push(0); // empty attribute name ends this header
  }
  if (multi) out.push(0); // a lone empty header terminates the part list
  return new Uint8Array(out).buffer;
}

/** The committed DEEP fixture (32 x 32, five FLOAT channels, samples per pixel). */
function deepFixture(): ArrayBuffer {
  const buf = readFileSync(new URL("./fixtures/deep-rgba-32x32.exr", import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** `bytes` followed by `padTo - bytes.byteLength` zeros — a big FILE, same image. */
function padTo(bytes: ArrayBuffer, padTo: number): ArrayBuffer {
  const out = new Uint8Array(padTo);
  out.set(new Uint8Array(bytes));
  return out.buffer;
}

test("decodedByteEstimate measures the DECODE, from the header — not the file size", () => {
  // 4096 x 4096 RGBA half = 128 MB of pixels behind a header of a few hundred
  // bytes. Judged by file size this looks free; it is the freeze.
  const header = exrHeaderOnly([{ width: 4096, height: 4096, channels: ["A", "B", "G", "R"] }]);
  assert.ok(header.byteLength < 1024, `header-only file should be tiny, was ${header.byteLength}`);
  assert.equal(decodedByteEstimate(header), 4096 * 4096 * 4 * 2);
  // FLOAT channels are 4 bytes, HALF 2 — the estimate follows the declared type.
  assert.equal(decodedByteEstimate(exrHeaderOnly([{ width: 64, height: 32, channels: ["R"], pixelType: 2 }])), 64 * 32 * 4);
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

test("decodedByteEstimate: a DEEP part is never judged by its flat extent alone", () => {
  const deep = deepFixture();
  // 32 x 32 with five FLOAT channels is 20 KB of FLAT pixels — but every pixel
  // holds a LIST of samples, which the header does not count, and the file is
  // 21 KB compressed. The bytes on disk are the only signal that tracks the
  // real sample count, so they win.
  const flat = 32 * 32 * 5 * 4;
  assert.equal(decodedByteEstimate(deep), deep.byteLength * 8);
  assert.ok(decodedByteEstimate(deep) > flat);
  // A synthetic deep header makes the same point where the flat extent is tiny.
  const synthetic = exrHeaderOnly([{ width: 8, height: 8, channels: ["R", "G", "B", "A", "Z"], deep: true }]);
  assert.equal(decodedByteEstimate(synthetic), synthetic.byteLength * 8);
  // The flat rule still applies to an ordinary part of the same shape.
  const flatPart = exrHeaderOnly([{ width: 8, height: 8, channels: ["R", "G", "B", "A", "Z"] }]);
  assert.equal(decodedByteEstimate(flatPart), 8 * 8 * 5 * 2);
});

test("decodedByteEstimate: the SELECTED part is measured, not the largest", () => {
  // Only the selected part's pixels are ever produced, so a 4096² sibling must
  // not condemn a decode of the 16² part 0 (nor be excused by it).
  const file = exrHeaderOnly([
    { width: 16, height: 16, channels: ["R", "G", "B"], name: "small" },
    { width: 4096, height: 4096, channels: ["R", "G", "B"], name: "huge" },
  ]);
  const small = 16 * 16 * 3 * 2;
  const huge = 4096 * 4096 * 3 * 2;
  assert.equal(decodedByteEstimate(file), small); // default: part 0
  assert.equal(decodedByteEstimate(file, { part: 0 }), small);
  assert.equal(decodedByteEstimate(file, { part: 1 }), huge);
  assert.equal(decodedByteEstimate(file, { part: "huge" }), huge);
  // A part that does not exist is not a licence to guess low.
  assert.equal(decodedByteEstimate(file, { part: "nope" }), file.byteLength * 8);
});

/** A pool whose worker takes the job and then dies on it, mid-decode. */
function crashingPool(kinds?: (kind: string | undefined) => boolean) {
  let pool: InstanceType<typeof DecodePool> | undefined;
  pool = new DecodePool({
    size: 1,
    timeoutMs: 1_000,
    spawn(index) {
      return {
        post(msg) {
          const m = msg as { id: number; kind?: string };
          if (!kinds || kinds(m.kind)) {
            queueMicrotask(() => pool!.onWorkerError(index, new Error("worker crashed mid-decode")));
          } else {
            // Anything not scripted to crash comes back as a 2 x 1 RGB image.
            queueMicrotask(() => pool!.onMessage(index, {
              id: m.id, ok: true, width: 2, height: 1, channels: 3, precision: "f32",
              data: new Float32Array([1, 2, 3, 4, 5, 6]).buffer,
            } as never));
          }
        },
        terminate() {},
      };
    },
  });
  return pool;
}

test("a worker CRASH on a DEEP file above the budget is not replayed inline", async () => {
  // 4.2 MB of deep file → an estimate of ~34 MB, past the budget. Judged by its
  // FLAT extent (20 KB) this would have been waved through — and the inline
  // replay genuinely succeeds, which is exactly why the estimate has to be
  // honest about deep samples rather than fail open.
  const bytes = padTo(deepFixture(), 4.2 * 1024 * 1024);
  assert.ok(decodedByteEstimate(bytes) > 32 * 1024 * 1024);
  setDecodePoolForTests(crashingPool());
  try {
    await assert.rejects(
      decodeExr({ bytes, ext: "exr" }),
      (err: unknown) => err instanceof DecodePoolError && err.code === "worker-error",
    );
  } finally {
    setDecodePoolForTests(null);
  }
});

test("a crash on the DEEP OPEN still gets its one-shot pool decode, however big the file", async () => {
  // The deep-open fall-through leads back to the POOL, not to the main thread,
  // so nothing here is being redone on the UI thread and the size of the file is
  // beside the point: a one-off worker crash must not cost the pane its image.
  const bytes = exrHeaderOnly([{ width: 4096, height: 4096, channels: ["A", "B", "G", "R"] }]);
  assert.ok(decodedByteEstimate(bytes) > 32 * 1024 * 1024);
  setDecodePoolForTests(crashingPool((kind) => kind === "openDeep"));
  try {
    const img = await decodeExr({ bytes, ext: "exr" }, { deepLiveFlatten: true });
    assert.equal(img.width, 2);
    assert.equal(img.height, 1);
    assert.equal("deep" in img ? img.deep : undefined, undefined);
  } finally {
    setDecodePoolForTests(null);
  }
});
