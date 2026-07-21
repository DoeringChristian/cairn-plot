/**
 * `image/decoders/exr-worker.ts` — the Web Worker entry that runs the
 * vendored EXR decoder OFF the main thread. Imported by the dispatcher
 * (`exr-decode.ts`) via Vite's `?worker&inline` so the whole worker module
 * graph (this file + `exr-full.ts` + `vendor/exr-loader.js` + `fflate`) is
 * embedded as a self-contained inline blob — no separate asset, no CDN.
 *
 * Decode is WASM-first (Rust `exr` crate, inline base64) with the vendored TS
 * decoder as the fallback — see `exr-wasm.ts`. The WASM decoder is instantiated
 * ONCE per worker lifetime (memoized inside `loadExrDecoder`). All-HALF sources
 * come back as raw f16 bit patterns (`precision:"f16-bits"`), so the reply also
 * carries a `precision` tag telling the host how to reinterpret `data`.
 *
 * Protocol (one job per message; the dispatcher correlates by `id`):
 *   ← { id, buffer: ArrayBuffer }                                  (transferred in)
 *   → { id, ok: true, data, width, height, channels, precision }   (transferred out)
 *   → { id, ok: false, error: string }
 */
import type { Precision } from "../half.ts";
import { decodeExrPreferWasm } from "./exr-wasm.ts";

/** Inbound decode request. */
export interface ExrWorkerRequest {
  id: number;
  buffer: ArrayBuffer;
}

/** Outbound decode reply. */
export type ExrWorkerResponse =
  | {
      id: number;
      ok: true;
      data: ArrayBuffer;
      width: number;
      height: number;
      channels: number;
      /** How to reinterpret `data`: `"f16-bits"` → Uint16Array, `"f32"` → Float32Array. */
      precision: Precision;
    }
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

ctx.addEventListener("message", (event) => {
  const { id, buffer } = event.data;
  decodeExrPreferWasm(buffer)
    .then((decoded) => {
      const out = decoded.data.buffer as ArrayBuffer;
      ctx.postMessage(
        {
          id,
          ok: true,
          data: out,
          width: decoded.width,
          height: decoded.height,
          channels: decoded.channels,
          precision: decoded.precision,
        },
        [out], // zero-copy transfer of the decoded (f16-bits or f32) buffer
      );
    })
    .catch((err) => {
      ctx.postMessage({
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
});
