/**
 * `image/decoders/npy-decode.ts` — the `.npy` entry the decoder registry mounts.
 *
 * Moves the (potentially large) numpy parse + float widening OFF the main thread
 * through the shared decode pool (`decode-pool.ts` → `decode-worker.ts`), with
 * the same fallback shape as the EXR path (`exr-decode.ts`):
 *
 *   1. a pool worker (`kind:"parseNpy"`), the normal browser path — the decoded
 *      samples come back as a transferable, never copied;
 *   2. on a pool failure the worker never actually ran the job (no `Worker`,
 *      construction/module-load failure, crash) or reported a decode-level
 *      `ok:false`, the SAME pure parse runs inline on the main thread (also the
 *      `node:test` path, and the path that surfaces the real, informative error
 *      for a bad file). A pool TIMEOUT or ABORT is never replayed inline — the
 *      worker may still be parsing, and re-running the same parse on the main
 *      thread can freeze the tab — that error surfaces to the caller as-is, and
 *      so does a worker CRASH on an input past `INLINE_REPLAY_MAX_BYTES` (the
 *      parse itself is then the likely cause). See `canReplayInline`.
 */
import type { DecodedImage } from "../decoders.ts";
import { parseNpy } from "../../../transforms/parse-npy.ts";
import { npyArrayToDecoded } from "./npy-image.ts";
import { decodePoolAvailable, getDecodePool } from "./decode-pool.ts";
import { canReplayInline } from "./decode-pool-core.ts";
import type { ExrWorkerResponse, NpyImagePayload } from "./decode-worker.ts";

/** A worker `.npy` reply → the canonical {@link DecodedImage} (buffers reinterpreted). */
export function npyPayloadToImage(p: NpyImagePayload): DecodedImage {
  if (p.kind === "u8") {
    return { kind: "u8", data: new Uint8ClampedArray(p.data), width: p.width, height: p.height };
  }
  return {
    kind: "f32",
    data: new Float32Array(p.data),
    width: p.width,
    height: p.height,
    channels: p.channels,
    precision: "f32",
  };
}

/** Parse a `.npy` image in a pool worker (browser) or inline (node / pool failure). */
export async function decodeNpyBytes(bytes: ArrayBuffer): Promise<DecodedImage> {
  if (!decodePoolAvailable()) return npyArrayToDecoded(parseNpy(bytes));
  const buffer = bytes.slice(0); // copy so we never detach the caller's buffer
  let payload: NpyImagePayload;
  try {
    const { result } = await getDecodePool().run<Extract<ExrWorkerResponse, { npy: NpyImagePayload }>>({
      make: (id) => ({ id, kind: "parseNpy", buffer }),
      transfer: [buffer],
    });
    payload = result.npy;
  } catch (err) {
    // Pool unavailable/broken (never ran the job) or a decode-level failure →
    // the same parse inline (also yields the real, informative error for a
    // genuinely bad file). A TIMEOUT or ABORT is NOT retried here: the worker
    // may still be parsing, and replaying it inline can freeze the tab. Nor is
    // a crash on a LARGE input: the parse itself is then the likely cause, so
    // the error surfaces instead of being re-run on the main thread.
    if (!canReplayInline(err, bytes.byteLength)) throw err;
    return npyArrayToDecoded(parseNpy(bytes));
  }
  // OUTSIDE the catch: a malformed reply is a protocol bug, and must surface as
  // one rather than being masked by a silent (and now buffer-less) re-parse.
  return npyPayloadToImage(payload);
}
