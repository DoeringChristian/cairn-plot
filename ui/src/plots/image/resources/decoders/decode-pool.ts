/**
 * `image/decoders/decode-pool.ts` — browser shell of the decode worker pool.
 *
 * Spawns N instances of the ONE inlined worker module (`decode-worker.ts`,
 * Vite `?worker&inline`, so `build:plot-inline` stays a single file) and wires
 * their messages/errors into the pure scheduler (`decode-pool-core.ts`). The
 * module is imported once and lazily; each `PoolWorker` buffers posts until its
 * Worker exists.
 */
import { DecodePool, type PoolWorker } from "./decode-pool-core.ts";

let pool: DecodePool | null = null;
let modPromise: Promise<{ default: new () => Worker }> | null = null;

export function decodePoolAvailable(): boolean {
  return typeof Worker === "function";
}

export function defaultDecodePoolSize(): number {
  const hc = typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
  return Math.min(4, Math.max(1, hc - 1));
}

function loadModule() {
  if (!modPromise) {
    modPromise = import("./decode-worker.ts?worker&inline");
    modPromise.catch(() => { modPromise = null; });
  }
  return modPromise;
}

function spawn(index: number): PoolWorker {
  let worker: Worker | null = null;
  let dead = false;
  const buffered: [unknown, Transferable[]][] = [];
  loadModule()
    .then((mod) => {
      if (dead) return;
      const w = new mod.default();
      w.addEventListener("message", (e: MessageEvent) => pool?.onMessage(index, e.data));
      w.addEventListener("error", () => pool?.onWorkerError(index, new Error("cairn-plot decode pool: worker crashed")));
      worker = w;
      for (const [m, t] of buffered.splice(0)) w.postMessage(m, t);
    })
    .catch((err) => pool?.onWorkerError(index, err instanceof Error ? err : new Error(String(err))));
  return {
    post(msg, transfer) { if (worker) worker.postMessage(msg, transfer); else buffered.push([msg, transfer]); },
    terminate() { dead = true; worker?.terminate(); worker = null; },
  };
}

export function getDecodePool(): DecodePool {
  if (!pool) pool = new DecodePool({ size: defaultDecodePoolSize(), spawn });
  return pool;
}

export function setDecodePoolSize(n: number): void {
  getDecodePool().resize(n);
}

/**
 * TEST-ONLY seam: install a specific `DecodePool` (e.g. one built with a fake
 * `spawn` and a short `timeoutMs`) so `getDecodePool()` returns it instead of
 * the lazily-constructed default. Pass `null` to restore the default on next
 * call to `getDecodePool()`. Never call this from application code.
 */
export function setDecodePoolForTests(p: DecodePool | null): void {
  pool = p;
}
