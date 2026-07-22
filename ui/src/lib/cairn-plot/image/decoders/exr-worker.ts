/**
 * `image/decoders/exr-worker.ts` — the Web Worker entry that runs the
 * vendored EXR decoder OFF the main thread. Imported by the dispatcher
 * (`exr-decode.ts`) via Vite's `?worker&inline` so the whole worker module
 * graph (this file + `exr-full.ts` + `vendor/exr-loader.js` + `fflate`) is
 * embedded as a self-contained inline blob — no separate asset, no CDN.
 *
 * Decode is WASM-first (OpenEXR compiled to wasm, inline base64) with the
 * vendored TS decoder as the fallback — see `exr-wasm.ts`. The WASM decoder is
 * instantiated ONCE per worker lifetime (memoized inside `loadExrDecoder`).
 * All-HALF sources come back as raw f16 bit patterns (`precision:"f16-bits"`),
 * so replies carry a `precision` tag telling the host how to reinterpret `data`.
 *
 * ## Deep live-flatten (the depth slider)
 * A DEEP EXR opened with `kind:"openDeep"` is parsed ONCE; its samples are
 * RETAINED behind a wasm-side handle that stays alive in THIS worker across
 * messages. The reply carries the full composite plus `deep:{handle,zMin,zMax}`.
 * The host then drives the slider with `kind:"flattenDeep"` (re-composite at a
 * Z cutoff, live) and releases the handle on pane unmount with `kind:"freeDeep"`.
 *
 * Protocol (one job per message; the dispatcher correlates by `id`):
 *   ← { id, kind?:"decode", buffer }                                 (transferred in)
 *   ← { id, kind:"openDeep", buffer }                                (transferred in)
 *   ← { id, kind:"flattenDeep", handle, zClip }
 *   ← { id, kind:"freeDeep", handle }
 *   → { id, ok:true, data, width, height, channels, precision, deep? } (transferred out)
 *   → { id, ok:true, freed:true }                                    (freeDeep ack)
 *   → { id, ok:false, error }
 */
import type { Precision } from "../half.ts";
import { decodeExrPreferWasm } from "./exr-wasm.ts";
import { loadExrDecoder, type DecodedImage } from "./wasm-inline/wasm-exr-inline.ts";

/** Inbound requests (discriminated by `kind`; absent `kind` = "decode"). */
export type ExrWorkerRequest =
  | { id: number; kind?: "decode"; buffer: ArrayBuffer }
  | { id: number; kind: "openDeep"; buffer: ArrayBuffer }
  | { id: number; kind: "flattenDeep"; handle: number; zClip: number }
  | { id: number; kind: "deepGpuCsr"; handle: number }
  | { id: number; kind: "freeDeep"; handle: number };

/** A flat image payload shared by decode / openDeep / flattenDeep replies. */
export interface ExrImagePayload {
  data: ArrayBuffer;
  width: number;
  height: number;
  channels: number;
  /** How to reinterpret `data`: `"f16-bits"` → Uint16Array, `"f32"` → Float32Array. */
  precision: Precision;
}

/** Z-sorted deep samples for GPU upload (transferable buffers). */
export interface ExrGpuCsrPayload {
  width: number;
  height: number;
  total: number;
  offsets: ArrayBuffer; // Uint32Array bytes (pixels+1)
  colors: ArrayBuffer; // Float32Array bytes (4*total)
  zs: ArrayBuffer; // Float32Array bytes (total)
}

/** Outbound replies. */
export type ExrWorkerResponse =
  | (ExrImagePayload & {
      id: number;
      ok: true;
      /** Present when the source was a live-flatten DEEP open. */
      deep?: { handle: number; zMin: number; zMax: number };
    })
  | { id: number; ok: true; gpuCsr: ExrGpuCsrPayload }
  | { id: number; ok: true; freed: true }
  | { id: number; ok: false; error: string };

// Minimal dedicated-worker surface (the app tsconfig uses the DOM lib, not
// WebWorker, so `self` types as `Window`; narrow it locally).
interface WorkerScope {
  postMessage(message: ExrWorkerResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ExrWorkerRequest>) => void,
  ): void;
}
const ctx = self as unknown as WorkerScope;

/** Copy a decoded (JS-owned) wasm-inline image into a transferable payload. */
function toPayload(img: DecodedImage): ExrImagePayload {
  const arr = img.precision === "f16-bits" ? img.halfBits! : img.floats!;
  const buf = arr.buffer as ArrayBuffer;
  return {
    data: buf,
    width: img.width,
    height: img.height,
    channels: img.channels,
    precision: img.precision,
  };
}

function fail(id: number, err: unknown): void {
  ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
}

async function handle(req: ExrWorkerRequest): Promise<void> {
  const { id } = req;
  const kind = req.kind ?? "decode";

  if (kind === "flattenDeep") {
    const { handle: h, zClip } = req as Extract<ExrWorkerRequest, { kind: "flattenDeep" }>;
    const { flatten_deep } = await loadExrDecoder();
    const payload = toPayload(flatten_deep(h, zClip));
    ctx.postMessage({ id, ok: true, ...payload }, [payload.data]);
    return;
  }

  if (kind === "deepGpuCsr") {
    const { handle: h } = req as Extract<ExrWorkerRequest, { kind: "deepGpuCsr" }>;
    const { deep_gpu_csr } = await loadExrDecoder();
    const csr = deep_gpu_csr(h);
    const offsets = csr.offsets.buffer as ArrayBuffer;
    const colors = csr.colors.buffer as ArrayBuffer;
    const zs = csr.zs.buffer as ArrayBuffer;
    ctx.postMessage(
      { id, ok: true, gpuCsr: { width: csr.width, height: csr.height, total: csr.total, offsets, colors, zs } },
      [offsets, colors, zs],
    );
    return;
  }

  if (kind === "freeDeep") {
    const { handle: h } = req as Extract<ExrWorkerRequest, { kind: "freeDeep" }>;
    const { free_deep } = await loadExrDecoder();
    free_deep(h);
    ctx.postMessage({ id, ok: true, freed: true });
    return;
  }

  if (kind === "openDeep") {
    const { buffer } = req as Extract<ExrWorkerRequest, { kind: "openDeep" }>;
    const { open_deep, flatten_deep } = await loadExrDecoder();
    const deep = open_deep(new Uint8Array(buffer));
    if (deep) {
      // Retained handle stays alive in this worker; initial image = full composite.
      const payload = toPayload(flatten_deep(deep.handle, deep.zMax));
      ctx.postMessage(
        { id, ok: true, ...payload, deep: { handle: deep.handle, zMin: deep.zMin, zMax: deep.zMax } },
        [payload.data],
      );
      return;
    }
    // Not a deep file → ordinary decode, no handle.
    const decoded = await decodeExrPreferWasm(buffer);
    const out = decoded.data.buffer as ArrayBuffer;
    ctx.postMessage(
      { id, ok: true, data: out, width: decoded.width, height: decoded.height, channels: decoded.channels, precision: decoded.precision },
      [out],
    );
    return;
  }

  // Plain decode (also the deep FALLBACK: one-shot full composite, no handle).
  const { buffer } = req as Extract<ExrWorkerRequest, { kind?: "decode" }>;
  const decoded = await decodeExrPreferWasm(buffer);
  const out = decoded.data.buffer as ArrayBuffer;
  ctx.postMessage(
    { id, ok: true, data: out, width: decoded.width, height: decoded.height, channels: decoded.channels, precision: decoded.precision },
    [out],
  );
}

ctx.addEventListener("message", (event) => {
  handle(event.data).catch((err) => fail(event.data.id, err));
});
