/**
 * `image/decoders/exr-decode.ts` — the EXR entry the decoder registry mounts.
 * Moves the (potentially slow) EXR decode OFF the main thread and layers a
 * clean fallback chain:
 *
 *   1. a PERSISTENT Web Worker running the WASM-first core
 *      (`exr-worker.ts` → `exr-wasm.ts`: OpenEXR wasm, TS decoder fallback),
 *      the normal browser path — all compressions (PIZ/PXR24/B44/DWA/…), result
 *      returned as a transferable (f16 bit patterns for all-HALF, else f32);
 *   2. if `Worker` is unavailable or the worker path fails to spin up, the SAME
 *      WASM-first core on the MAIN thread (also the `node:test` path);
 *   3. if that throws, the original pure-TS reader (`exr.ts`, NONE/ZIP/ZIPS) as
 *      a last-ditch net.
 *
 * ## Deep live-flatten (the depth slider)
 * `decodeExr(src, { deepLiveFlatten: true })` (the single-image LEAF path) opens
 * a DEEP EXR with the samples RETAINED behind a wasm handle — living in the
 * worker (or the main-thread module) — and attaches a `DeepFlattenController`
 * (`decoded.deep`) whose `flatten(zClip)` re-composites live and `dispose()`
 * frees the handle. Generic/compare callers omit the flag: deep files decode
 * one-shot (full composite) with no retained handle.
 *
 * One worker is reused across decodes; jobs are correlated by id through a
 * pending map, each guarded by a timeout, with errors propagated back to the
 * awaiting promise.
 */
import type {
  DecodedImage,
  DecodeImageOptions,
  DeepFlattenController,
  DeepGpuCsrData,
  DeepZRangeData,
  ImageSource,
} from "../decoders.ts";
import { decodeExr as decodeExrPure } from "./exr.ts";
import { decodeExrPreferWasm } from "./exr-wasm.ts";
import { loadExrDecoder } from "./wasm-inline/wasm-exr-inline.ts";
import type {
  ExrGpuCsrPayload,
  ExrImagePayload,
  ExrWorkerRequest,
  ExrWorkerResponse,
} from "./exr-worker.ts";

// A decode should never hang the queue; cap it generously (large DWA/PIZ frames
// can take a while, but not this long). Deep re-flatten (dense files re-decode)
// rides the same bound.
const DECODE_TIMEOUT_MS = 30_000;

type F32Image = Extract<DecodedImage, { kind: "f32" }>;
type OkResponse = Extract<ExrWorkerResponse, { ok: true }>;

interface PendingJob {
  resolve: (msg: OkResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<number, PendingJob>();
let nextId = 1;
let workerPromise: Promise<Worker> | null = null;

/** True when this runtime can host a browser Web Worker (false under node). */
function canUseWorker(): boolean {
  return typeof Worker === "function";
}

function rejectAllPending(err: Error): void {
  for (const [, job] of pending) {
    clearTimeout(job.timer);
    job.reject(err);
  }
  pending.clear();
}

/** Tear down the current worker so the next decode respawns a fresh one. */
function resetWorker(err: Error): void {
  rejectAllPending(err);
  const wp = workerPromise;
  workerPromise = null;
  if (wp) wp.then((w) => w.terminate()).catch(() => {});
}

function onWorkerMessage(event: MessageEvent<ExrWorkerResponse>): void {
  const msg = event.data;
  const job = pending.get(msg.id);
  if (!job) return;
  pending.delete(msg.id);
  clearTimeout(job.timer);
  if (msg.ok) job.resolve(msg);
  else job.reject(new Error(msg.error));
}

/** Lazily create (once) the persistent inline-blob worker. */
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Vite `?worker&inline`: the worker + its whole module graph ship as a
      // self-contained inline blob (no separate file / CDN). Dynamic import so
      // the blob is only realized on the first EXR decode.
      const mod = await import("./exr-worker.ts?worker&inline");
      const worker = new mod.default();
      worker.addEventListener("message", onWorkerMessage as EventListener);
      worker.addEventListener("error", () => {
        resetWorker(new Error("cairn-plot decodeImage: EXR decode worker crashed"));
      });
      return worker;
    })();
    // If construction itself rejects, clear so we can retry / fall back.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/** Send one correlated request to the persistent worker. */
async function requestWorker(
  make: (id: number) => ExrWorkerRequest,
  transfer: Transferable[],
): Promise<OkResponse> {
  const worker = await getWorker();
  const id = nextId++;
  return new Promise<OkResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resetWorker(new Error("cairn-plot decodeImage: EXR decode timed out"));
    }, DECODE_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage(make(id), transfer);
  });
}

/** A flat image payload (worker reply) → the canonical f32 DecodedImage. */
function payloadToImage(msg: ExrImagePayload): F32Image {
  return {
    kind: "f32",
    data: msg.precision === "f16-bits" ? new Uint16Array(msg.data) : new Float32Array(msg.data),
    width: msg.width,
    height: msg.height,
    channels: msg.channels,
    precision: msg.precision,
  };
}

/** Decode via the persistent worker, transferring a copy of the bytes in. */
async function decodeViaWorker(bytes: ArrayBuffer): Promise<F32Image> {
  const buffer = bytes.slice(0); // copy so we never detach the caller's buffer
  const msg = await requestWorker((id) => ({ id, buffer }), [buffer]);
  return payloadToImage(msg as ExrImagePayload);
}

/** Build a worker-backed deep controller (flatten/free posted to the worker). */
function workerDeepController(
  handle: number,
  zMin: number,
  zMax: number,
): DeepFlattenController {
  let disposed = false;
  return {
    zMin,
    zMax,
    async flatten(zNear: number, zFar: number) {
      const msg = await requestWorker((id) => ({ id, kind: "flattenDeep", handle, zNear, zFar }), []);
      const p = msg as ExrImagePayload;
      return p.precision === "f16-bits" ? new Uint16Array(p.data) : new Float32Array(p.data);
    },
    async getGpuCsr(): Promise<DeepGpuCsrData> {
      const msg = await requestWorker((id) => ({ id, kind: "deepGpuCsr", handle }), []);
      const g = (msg as Extract<OkResponse, { gpuCsr: ExrGpuCsrPayload }>).gpuCsr;
      return {
        width: g.width,
        height: g.height,
        total: g.total,
        offsets: new Uint32Array(g.offsets),
        colors: new Float32Array(g.colors),
        zs: new Float32Array(g.zs),
      };
    },
    async zRangeInRect(x0: number, y0: number, x1: number, y1: number): Promise<DeepZRangeData> {
      const msg = await requestWorker((id) => ({ id, kind: "deepZRange", handle, x0, y0, x1, y1 }), []);
      return (msg as Extract<OkResponse, { zRange: DeepZRangeData }>).zRange;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Fire-and-forget; a worker reset before this lands is harmless (the wasm
      // instance — and its handles — is gone with it).
      void requestWorker((id) => ({ id, kind: "freeDeep", handle }), []).catch(() => {});
    },
  };
}

/** Build a main-thread deep controller (flatten/free on the local wasm module). */
async function mainThreadDeepController(
  handle: number,
  zMin: number,
  zMax: number,
): Promise<DeepFlattenController> {
  const { flatten_deep, free_deep, deep_gpu_csr, deep_z_range_in_rect } = await loadExrDecoder();
  let disposed = false;
  return {
    zMin,
    zMax,
    async flatten(zNear: number, zFar: number) {
      const img = flatten_deep(handle, zNear, zFar);
      return img.precision === "f16-bits" ? img.halfBits! : img.floats!;
    },
    async getGpuCsr(): Promise<DeepGpuCsrData> {
      const csr = deep_gpu_csr(handle);
      return {
        width: csr.width,
        height: csr.height,
        total: csr.total,
        offsets: csr.offsets,
        colors: csr.colors,
        zs: csr.zs,
      };
    },
    async zRangeInRect(x0: number, y0: number, x1: number, y1: number): Promise<DeepZRangeData> {
      const zr = deep_z_range_in_rect(handle, x0, y0, x1, y1);
      return { zMin: zr.zMin, zMax: zr.zMax, count: zr.count };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      free_deep(handle);
    },
  };
}

/**
 * Deep-aware decode: open the source with the samples retained and attach a
 * `deep` controller when it IS a deep EXR (else a plain image, no handle).
 * Runs in the worker when available, else on the main-thread module (node).
 */
async function decodeDeepAware(bytes: ArrayBuffer): Promise<DecodedImage> {
  if (canUseWorker()) {
    const buffer = bytes.slice(0);
    const msg = await requestWorker((id) => ({ id, kind: "openDeep", buffer }), [buffer]);
    const image = payloadToImage(msg as ExrImagePayload);
    const deep = (msg as Extract<OkResponse, { deep?: unknown }>).deep as
      | { handle: number; zMin: number; zMax: number }
      | undefined;
    if (!deep) return image;
    return { ...image, deep: workerDeepController(deep.handle, deep.zMin, deep.zMax) };
  }
  // No Worker (node): open + retain on the main-thread module.
  const { open_deep, flatten_deep } = await loadExrDecoder();
  const opened = open_deep(new Uint8Array(bytes));
  if (!opened) return decodeExrPreferWasm(bytes.slice(0)); // not deep
  const flat = flatten_deep(opened.handle, -Infinity, Infinity);
  const image: F32Image = {
    kind: "f32",
    data: flat.precision === "f16-bits" ? flat.halfBits! : flat.floats!,
    width: flat.width,
    height: flat.height,
    channels: flat.channels,
    precision: flat.precision,
  };
  return {
    ...image,
    deep: await mainThreadDeepController(opened.handle, opened.zMin, opened.zMax),
  };
}

/** Full decode: worker when possible, else the same WASM-first core on the main thread. */
async function decodeFull(src: ImageSource): Promise<DecodedImage> {
  const bytes = src.bytes!;
  if (canUseWorker()) {
    try {
      return await decodeViaWorker(bytes);
    } catch {
      // Worker path unavailable/broken → run the SAME WASM-first core on the
      // main thread (also yields the real, informative error for a bad file).
      return decodeExrPreferWasm(bytes.slice(0));
    }
  }
  // No Worker (e.g. node): the WASM-first core runs inline, TS fallback beneath.
  return decodeExrPreferWasm(bytes.slice(0));
}

/**
 * Registry entry: decode an EXR source. Tries the full worker-backed decoder,
 * then the pure-TS reader as a fallback; the full decoder's error wins when both
 * fail (it covers the most variants, so its message is the most informative).
 *
 * With `{ deepLiveFlatten: true }` a deep source additionally retains its samples
 * and attaches `decoded.deep` (the depth slider) — see the module doc.
 */
export async function decodeExr(
  src: ImageSource,
  opts?: DecodeImageOptions,
): Promise<DecodedImage> {
  if (!src.bytes) {
    throw new Error(
      "cairn-plot decodeImage: the exr decoder needs raw bytes (src.bytes), got only a url",
    );
  }
  if (opts?.deepLiveFlatten) {
    try {
      return await decodeDeepAware(src.bytes);
    } catch {
      // Deep-aware path failed (worker crash / broken retained read) → fall
      // through to the ordinary one-shot decode chain below (no slider).
    }
  }
  try {
    return await decodeFull(src);
  } catch (fullErr) {
    try {
      return await decodeExrPure(src);
    } catch {
      throw fullErr instanceof Error ? fullErr : new Error(String(fullErr));
    }
  }
}
