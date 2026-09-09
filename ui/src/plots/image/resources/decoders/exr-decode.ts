/**
 * `image/decoders/exr-decode.ts` — the EXR entry the decoder registry mounts.
 * Moves the (potentially slow) EXR decode OFF the main thread and layers a
 * clean fallback chain:
 *
 *   1. the shared decode POOL (`decode-pool.ts`) running the WASM-first core
 *      (`decode-worker.ts` → `exr-wasm.ts`: OpenEXR wasm, TS decoder fallback),
 *      the normal browser path — all compressions (PIZ/PXR24/B44/DWA/…), result
 *      returned as a transferable (f16 bit patterns for all-HALF, else f32);
 *   2. if `Worker` is unavailable, or the pool path fails to spin up or reports
 *      an `ok:false` decode error, the SAME WASM-first core on the MAIN thread
 *      (also the `node:test` path). A pool TIMEOUT or ABORT is never replayed
 *      here: the decode may already be running in the worker, and doing the
 *      same slow work again on the main thread would freeze the tab — that
 *      error surfaces to the caller as-is, and so does a worker CRASH on a
 *      large input (see `canReplayInline`);
 *   3. if that throws, the original pure-TS reader (`exr.ts`, NONE/ZIP/ZIPS) as
 *      a last-ditch net — gated by the SAME rule: a terminal pool error never
 *      reaches it either, since it too decodes on the main thread.
 *
 * ## Deep live-flatten (the depth slider)
 * `decodeExr(src, { deepLiveFlatten: true })` (the single-image LEAF path) opens
 * a DEEP EXR with the samples RETAINED behind a wasm handle — living in ONE pool
 * worker (or the main-thread module) — and attaches a `DeepFlattenController`
 * (`decoded.deep`) whose `flatten(zClip)` re-composites live and `dispose()`
 * frees the handle. Every follow-up message for that handle is pinned to the
 * worker GENERATION that opened it (the pool's `affinity` + `affinityEpoch`),
 * since the samples live in that worker's wasm heap and a crashed slot is later
 * reused by a fresh worker. Generic/compare callers omit the flag: deep files
 * decode one-shot (full composite) with no retained handle.
 *
 * Correlation, timeouts, queueing and per-worker crash recovery all live in the
 * pool (`decode-pool-core.ts`); this module only shapes requests and replies.
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
import { hasExrSelection, type ExrSelection } from "./exr-full.ts";
import { loadExrDecoder } from "./wasm-inline/wasm-exr-inline.ts";
import { decodePoolAvailable, getDecodePool } from "./decode-pool.ts";
import { canReplayInline } from "./decode-pool-core.ts";
import type {
  ExrGpuCsrPayload,
  ExrImagePayload,
  ExrWorkerRequest,
  ExrWorkerResponse,
} from "./decode-worker.ts";

type F32Image = Extract<DecodedImage, { kind: "f32" }>;
type OkResponse = Extract<ExrWorkerResponse, { ok: true }>;

/** True when this runtime can host the pool's Web Workers (false under node). */
function canUseWorker(): boolean {
  return decodePoolAvailable();
}

/** Which pool worker GENERATION a retained deep handle lives in. */
type WorkerAffinity = { worker: number; epoch: number };

/**
 * Run one request through the pool. `affinity` pins the job to the worker that
 * owns a retained deep handle; omit it for stateless jobs (any idle worker).
 * A deep open passes its own `{ worker, epoch }` back as that affinity — the
 * epoch matters because a terminated slot is reused by a fresh worker that
 * knows nothing of the old handle.
 */
async function requestWorker(
  make: (id: number) => ExrWorkerRequest,
  transfer: Transferable[],
  affinity?: WorkerAffinity,
): Promise<{ msg: OkResponse; worker: number; epoch: number }> {
  const { result, worker, epoch } = await getDecodePool().run<ExrWorkerResponse>({
    make,
    transfer,
    affinity: affinity?.worker,
    affinityEpoch: affinity?.epoch,
  });
  if (!result.ok) throw new Error(result.error);
  return { msg: result, worker, epoch };
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

/** Decode via a pool worker, transferring a copy of the bytes in. */
async function decodeViaWorker(bytes: ArrayBuffer, select?: ExrSelection): Promise<F32Image> {
  const buffer = bytes.slice(0); // copy so we never detach the caller's buffer
  const { msg } = await requestWorker((id) => ({ id, buffer, select }), [buffer]);
  return payloadToImage(msg as ExrImagePayload);
}

/**
 * Build a worker-backed deep controller. Every message is pinned to `affinity` —
 * the pool slot GENERATION whose wasm heap holds this `handle`. If that worker
 * crashed or timed out (even where its slot has since been reused), the pool
 * rejects rather than replaying the stale handle into a fresh wasm heap.
 */
function workerDeepController(
  handle: number,
  zMin: number,
  zMax: number,
  affinity: WorkerAffinity,
): DeepFlattenController {
  let disposed = false;
  return {
    zMin,
    zMax,
    async flatten(zNear: number, zFar: number) {
      const { msg } = await requestWorker((id) => ({ id, kind: "flattenDeep", handle, zNear, zFar }), [], affinity);
      const p = msg as ExrImagePayload;
      return p.precision === "f16-bits" ? new Uint16Array(p.data) : new Float32Array(p.data);
    },
    async getGpuCsr(): Promise<DeepGpuCsrData> {
      const { msg } = await requestWorker((id) => ({ id, kind: "deepGpuCsr", handle }), [], affinity);
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
      const { msg } = await requestWorker((id) => ({ id, kind: "deepZRange", handle, x0, y0, x1, y1 }), [], affinity);
      return (msg as Extract<OkResponse, { zRange: DeepZRangeData }>).zRange;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Fire-and-forget; a worker teardown before this lands is harmless (the
      // wasm instance — and its handles — is gone with it).
      void requestWorker((id) => ({ id, kind: "freeDeep", handle }), [], affinity).catch(() => {});
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
 * Runs in a pool worker when available, else on the main-thread module (node).
 */
async function decodeDeepAware(bytes: ArrayBuffer): Promise<DecodedImage> {
  if (canUseWorker()) {
    const buffer = bytes.slice(0);
    const { msg, worker, epoch } = await requestWorker((id) => ({ id, kind: "openDeep", buffer }), [buffer]);
    const image = payloadToImage(msg as ExrImagePayload);
    const deep = (msg as Extract<OkResponse, { deep?: unknown }>).deep as
      | { handle: number; zMin: number; zMax: number }
      | undefined;
    if (!deep) return image;
    return { ...image, deep: workerDeepController(deep.handle, deep.zMin, deep.zMax, { worker, epoch }) };
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
async function decodeFull(src: ImageSource, select?: ExrSelection): Promise<DecodedImage> {
  const bytes = src.bytes!;
  if (canUseWorker()) {
    try {
      return await decodeViaWorker(bytes, select);
    } catch (err) {
      // Worker path unavailable/broken → run the SAME WASM-first core on the
      // main thread (also yields the real, informative error for a bad file).
      // A pool TIMEOUT or ABORT is NOT retried here: the worker may still be
      // running the decode, and replaying it inline can freeze the tab. Nor is
      // a crash on a LARGE input, where the decode itself is the likely cause.
      if (!canReplayInline(err, bytes.byteLength)) throw err;
      return decodeExrPreferWasm(bytes.slice(0), undefined, select);
    }
  }
  // No Worker (e.g. node): the WASM-first core runs inline, TS fallback beneath.
  return decodeExrPreferWasm(bytes.slice(0), undefined, select);
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
  const select = opts?.select;
  // A part/layer SELECTION uses the plain full-decoder path: deep parts reject
  // selection (exr-full throws a clear error), and the deep-live-flatten open
  // has no selection concept yet.
  if (opts?.deepLiveFlatten && !hasExrSelection(select)) {
    try {
      return await decodeDeepAware(src.bytes);
    } catch {
      // Deep-aware path failed (worker crash / broken retained read) → fall
      // through to the ordinary one-shot decode chain below (no slider).
    }
  }
  try {
    return await decodeFull(src, select);
  } catch (fullErr) {
    // A TERMINAL pool failure (timeout/abort/disposed/affinity, or a crash on a
    // large input) stops the chain here. `decodeExrPure` is a main-thread decode
    // like any other: replaying a decode the worker already spent 30 s on would
    // freeze the tab exactly as the inline WASM path would.
    if (!canReplayInline(fullErr, src.bytes.byteLength)) throw fullErr;
    // The pure reader has no selection support — with a selection, the full
    // decoder's error (e.g. "no channel named X") is the real answer.
    if (hasExrSelection(select)) {
      throw fullErr instanceof Error ? fullErr : new Error(String(fullErr));
    }
    try {
      return await decodeExrPure(src);
    } catch {
      throw fullErr instanceof Error ? fullErr : new Error(String(fullErr));
    }
  }
}
