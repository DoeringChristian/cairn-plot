/**
 * `image/decoders/npy-decode.ts` — the `.npy` entry the decoder registry mounts.
 *
 * Moves the (potentially large) numpy parse + float widening OFF the main thread
 * through the shared decode pool (`decode-pool.ts` → `decode-worker.ts`), with
 * the same fallback shape as the EXR path (`exr-decode.ts`):
 *
 *   1. a pool worker (`kind:"parseNpy"`), the normal browser path — the decoded
 *      samples come back as a transferable, never copied;
 *   2. on ANY pool failure (no `Worker`, construction, crash, timeout) the SAME
 *      pure parse runs inline on the main thread (also the `node:test` path, and
 *      the path that surfaces the real, informative error for a bad file).
 */
import type { DecodedImage } from "../decoders.ts";
import { parseNpy } from "../../../transforms/parse-npy.ts";
import { npyArrayToDecoded } from "./npy-image.ts";
import { decodePoolAvailable, getDecodePool } from "./decode-pool.ts";
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
  try {
    const { result } = await getDecodePool().run<Extract<ExrWorkerResponse, { npy: NpyImagePayload }>>({
      make: (id) => ({ id, kind: "parseNpy", buffer }),
      transfer: [buffer],
    });
    return npyPayloadToImage(result.npy);
  } catch {
    // Pool unavailable/broken → the same parse inline (also yields the real,
    // informative error for a genuinely bad file).
    return npyArrayToDecoded(parseNpy(bytes));
  }
}
