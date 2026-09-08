/**
 * DECODE WORKER POOL — the end-to-end proof that decodes really leave the main
 * thread.
 *
 * `node:test` cannot see this: jsdom has no `Worker`, so every unit test around
 * `decode-pool-core.ts` drives FAKE workers and every `exr-decode.ts`/
 * `npy-decode.ts` test takes the main-thread fallback branch. Only a real
 * browser can prove that the pool
 *   (a) actually spawns several inlined workers and spreads jobs over them,
 *   (b) keeps the main thread responsive while eight EXRs decode at once,
 *   (c) pins a retained DEEP handle to the ONE worker whose wasm heap owns it,
 *       even while unrelated decodes are interleaved on the other workers,
 *   (d) routes `.npy` through the same pool, and
 *   (e) isolates a failed decode: an `ok:false` reply is an error, not a crash,
 *       so no worker is torn down and the next decode still succeeds.
 *
 * NOTE ON THE BUNDLER. The pool imports its worker as
 * `./decode-worker.ts?worker&inline` (Vite). `scripts/test-harness.mjs` teaches
 * esbuild the same trick via `inlineWorkerPlugin` — without it `mod.default` is
 * undefined, `new mod.default()` throws, and this page would silently measure
 * the MAIN-THREAD fallback instead. `test-harness-selftest.mjs` pins that.
 *
 * RUNNING:
 *   npm run test:harness -- --only decode-pool
 * (or bundle by hand and open the .browser.html from an http server rooted at
 * ui/ — the fixture URLs resolve from `import.meta.url`.)
 */
import { decodeImage } from "../../decoders.ts";
import { getDecodePool, setDecodePoolSize, decodePoolAvailable } from "../decode-pool.ts";
import { createHarness } from "../../../../../testing/harness";

const { report, setOverallStatus } = createHarness({
  title: "DECODE POOL",
  colors: { pass: "#6f6", fail: "#f66" },
});

function info(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = message;
    p.style.color = "#6cf";
    el.appendChild(p);
  }
}

/** The eight distinct EXR sources the parallel phase decodes (all committed). */
const FIXTURES = [
  "rgb-piz-half-64x48.exr",
  "rgb-piz-float-64x48.exr",
  "rgb-zip-half-64x48.exr",
  "tiled-zip-half-64x48.exr",
  "htj2k-half-64x48.exr",
  "luma-chroma-64x48.exr",
  "layers-demo-128x96.exr",
  "multipart-2part-64x48.exr",
];

const DEEP_FIXTURE = "deep-rgba-32x32.exr";

async function fetchFixture(name: string): Promise<ArrayBuffer> {
  const url = new URL(`../fixtures/${name}`, import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fixture ${name} → HTTP ${res.status}`);
  return res.arrayBuffer();
}

/** A minimal little-endian float32 `.npy` (the unit tests' helper, in-page). */
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

/** Collects `longtask` entries (>50 ms main-thread blocks) over a window. */
function longtaskRecorder(): {
  supported: boolean;
  start(): void;
  stop(): PerformanceEntry[];
} {
  const supported =
    typeof PerformanceObserver !== "undefined" &&
    (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask");
  const entries: PerformanceEntry[] = [];
  let observer: PerformanceObserver | null = null;
  return {
    supported,
    start() {
      if (!supported) return;
      entries.length = 0;
      observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ entryTypes: ["longtask"] });
    },
    stop() {
      if (!observer) return [];
      entries.push(...observer.takeRecords());
      observer.disconnect();
      observer = null;
      return entries.slice();
    },
  };
}

async function run(): Promise<boolean> {
  let allPass = true;
  const check = (cond: boolean, msg: string): void => {
    if (!cond) allPass = false;
    report(cond, msg);
  };

  check(decodePoolAvailable(), `this host has Worker (decodePoolAvailable=${decodePoolAvailable()})`);

  // ---- setup: a 3-worker pool and the eight fixtures ----------------------
  setDecodePoolSize(3);
  const bytes = await Promise.all(FIXTURES.map(fetchFixture));
  check(
    bytes.every((b) => b.byteLength > 0),
    `fetched ${bytes.length} distinct EXR fixtures (${bytes.map((b) => b.byteLength).join("/")} bytes)`,
  );

  // ---- (a)(b) eight decodes in parallel, main thread unblocked -----------
  // One WARM decode first: spawning a worker means materialising the inlined
  // blob (the OpenEXR WASM travels base64 inside it), compiling that script and
  // instantiating the WASM. That is a one-time STARTUP cost, not decode work,
  // and it is main-thread work on the way in — pay it outside the measured
  // window so the >50 ms longtask assertion below is about decoding, not about
  // booting the pool. The assertion itself is unchanged and stays strict.
  await decodeImage({ bytes: bytes[0]!, ext: "exr" });

  const longtasks = longtaskRecorder();
  longtasks.start();
  const t0 = performance.now();
  const parallel = await Promise.all(bytes.map((b) => decodeImage({ bytes: b, ext: "exr" })));
  const parallelMs = performance.now() - t0;
  const observed = longtasks.stop();

  const statsAfter = getDecodePool().stats();
  info(`pool stats after the parallel batch: ${JSON.stringify(statsAfter)}`);

  parallel.forEach((d, i) => {
    check(
      d.kind === "f32" && d.width > 0,
      `${FIXTURES[i]} → kind=${d.kind} ${d.width}x${d.height}${d.kind === "f32" ? ` ch=${d.channels} ${d.precision}` : ""}`,
    );
  });
  check(
    statsAfter.spawned >= 2,
    `the pool spawned ${statsAfter.spawned} worker(s) (>= 2 — decodes really ran concurrently)`,
  );
  const workingWorkers = statsAfter.completed.filter((n) => n > 0).length;
  check(
    workingWorkers >= 2,
    `${workingWorkers} worker(s) completed at least one job (completed=[${statsAfter.completed.join(", ")}])`,
  );
  if (longtasks.supported) {
    const blocking = observed.filter((e) => e.duration > 50);
    check(
      blocking.length === 0,
      `no main-thread longtask > 50 ms while 8 EXRs decoded (${observed.length} entr(y|ies) seen${
        blocking.length ? `, worst ${Math.max(...blocking.map((e) => e.duration)).toFixed(1)} ms` : ""
      })`,
    );
  } else {
    info("longtask unsupported on this host — the main-thread-blocking assertion is skipped");
  }

  // ---- the same eight, serially (informational timing only) --------------
  // The fixtures are 64x48: a ratio assertion here would measure worker
  // dispatch overhead, not decode throughput. Print both, assert neither.
  const t1 = performance.now();
  for (const b of bytes) await decodeImage({ bytes: b, ext: "exr" });
  const serialMs = performance.now() - t1;
  info(
    `wall time — parallel ${parallelMs.toFixed(1)} ms, serial ${serialMs.toFixed(1)} ms ` +
      `(informational: 64x48 fixtures, so this is dispatch cost, not throughput)`,
  );

  // ---- (c) a retained DEEP handle stays pinned to ONE worker --------------
  // The deep samples live in the wasm heap of the worker that opened them, so
  // every follow-up message must land there. This runs the pool SATURATED: at
  // every step, a plain decode occupies EVERY spawned worker, so there is no
  // idle slot an affinity-ignoring scheduler could fall back on — it would have
  // to queue the flatten and then hand it to whichever worker frees first,
  // which rejects (unknown handle) or returns another image's pixels.
  //
  // `setDecodePoolSize(2)` caps how far the pool may GROW from here; it does
  // NOT retire the workers already spawned above (`resize` only moves the
  // ceiling), so saturation is measured against `stats().spawned`, not `size`.
  setDecodePoolSize(2);
  const saturate = (tag: number): Promise<unknown>[] =>
    Array.from({ length: getDecodePool().stats().spawned }, (_, k) =>
      decodeImage({ bytes: bytes[(tag + k) % bytes.length]!, ext: "exr" }),
    );
  const deepBytes = await fetchFixture(DEEP_FIXTURE);
  const busy = saturate(1);
  const decodedDeep = await decodeImage({ bytes: deepBytes, ext: "exr" }, { deepLiveFlatten: true });
  await Promise.all(busy);
  const deep = decodedDeep.kind === "f32" ? decodedDeep.deep : undefined;
  check(
    deep !== undefined,
    `${DEEP_FIXTURE} opened behind a retained deep handle while every worker was busy (deep=${deep !== undefined})`,
  );
  if (deep) {
    const EXPECT = 32 * 32 * 4;
    for (let i = 0; i < 3; i++) {
      const interleaved = saturate(i + 2);
      const flat = await deep.flatten(deep.zMin, deep.zMax);
      await Promise.all(interleaved);
      check(
        flat.length === EXPECT,
        `deep flatten #${i + 1} (all ${interleaved.length} spawned workers busy with plain decodes) → ${flat.length} samples == 32*32*4`,
      );
    }
    deep.dispose();
    info("deep handle disposed");
  }
  // Later steps assert on a 3-worker pool again.
  setDecodePoolSize(3);

  // ---- (d) .npy through the SAME pool ------------------------------------
  const values = Array.from({ length: 16 }, (_, i) => i * 0.25 - 1);
  const npy = await decodeImage({ bytes: npyFloat32(4, 4, values), ext: "npy" });
  check(npy.kind === "f32" && npy.width === 4 && npy.height === 4, `npy → kind=${npy.kind} ${npy.width}x${npy.height}`);
  if (npy.kind === "f32") {
    const got = Array.from(npy.data as Float32Array);
    check(
      got.length === values.length && got.every((v, i) => Math.abs(v - values[i]!) < 1e-6),
      `npy values round-trip through the worker ([${got.slice(0, 4).join(", ")}, …])`,
    );
  }

  // ---- (e) a bad file is an ERROR, not a crash ---------------------------
  // Valid EXR magic + version, then nothing: the WASM decoder rejects it and
  // the worker replies `ok:false`. That must reject the decode WITHOUT tearing
  // the worker down — the pool's spawned count is the proof (a crash or a
  // timeout would terminate the slot).
  //
  // These exact bytes used to HANG instead. Not in the WASM decoder (that
  // rejects them in ~2 ms) but in the vendored pure-TS fallback underneath it:
  // `parseNullTerminatedString` scanned for a header terminator with
  // `uintBuffer[i] != 0`, and reading past the end yields `undefined`, which is
  // `!= 0` forever. Fixed in f3e7e91 ("Bound header string reads in the TS EXR
  // fallback"), so the brief's original input is usable again — and the wall
  // clock below is the guard that keeps it that way: a rejection that took
  // 30 s would be the POOL TIMEOUT tearing a worker down, a completely
  // different code path wearing the same error, so anything slower than 5 s
  // fails this case even though it "rejected".
  const before = getDecodePool().stats().spawned;
  const broken = new Uint8Array([0x76, 0x2f, 0x31, 0x01, 0, 0, 0, 0]).buffer;
  let rejected = false;
  let rejectMessage = "";
  const tBroken = performance.now();
  try {
    await decodeImage({ bytes: broken, ext: "exr" });
  } catch (err) {
    rejected = true;
    rejectMessage = err instanceof Error ? err.message : String(err);
  }
  const brokenMs = performance.now() - tBroken;
  check(rejected, `a truncated EXR rejects ("${rejectMessage.slice(0, 90)}")`);
  check(
    brokenMs < 5000,
    `it rejects promptly — ${brokenMs.toFixed(1)} ms < 5000 ms (an ok:false reply, not the pool's 30 s timeout)`,
  );
  const recovered = await decodeImage({ bytes: bytes[0]!, ext: "exr" });
  check(recovered.kind === "f32" && recovered.width > 0, `a good decode still resolves afterwards (${recovered.width}x${recovered.height})`);
  const spawnedAfter = getDecodePool().stats().spawned;
  check(
    spawnedAfter === before,
    `an ok:false reply tore down no worker (spawned ${before} → ${spawnedAfter})`,
  );
  info(`final pool stats: ${JSON.stringify(getDecodePool().stats())}`);

  return allPass;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
