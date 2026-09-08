/**
 * `image/decoders/npy-image.ts` — the pure `.npy` → {@link DecodedImage} map.
 *
 * Lifted out of `decoders.ts` so BOTH the main thread and the decode worker
 * (`decode-worker.ts`) can reach it without pulling the registry — and with it
 * the browser-native decode paths — into the worker bundle. Pure and DOM-free:
 * the only tie back to `decoders.ts` is the `DecodedImage` TYPE (a `import type`,
 * erased at build time), so there is no runtime cycle even though `decoders.ts`
 * imports this module eagerly.
 */
import type { NpyArray } from "../../../transforms/parse-npy.ts";
import type { DecodedImage } from "../decoders.ts";

/** True when a numpy descr string names a uint8/int8/bool (single-byte) dtype. */
export function isU8Dtype(dtype: string): boolean {
  const kind = dtype[1]; // '<' | '>' | '|' prefix, then kind char
  const itemsize = dtype.slice(2) || "1";
  return (kind === "u" || kind === "i" || kind === "b") && itemsize === "1";
}

/**
 * Map a parsed numpy array (`[H,W]` grayscale or `[H,W,C]`) to the canonical
 * {@link DecodedImage}. `uint8`/`int8`/`bool` → `u8`; everything else (floats,
 * and wider integers, which `parseNpy` already coerced to `Float64`) → `f32`.
 */
export function npyArrayToDecoded(npy: NpyArray): DecodedImage {
  const { shape, dtype, data } = npy;
  if (shape.length !== 2 && shape.length !== 3) {
    throw new Error(
      `cairn-plot decodeImage: expected a 2D [H,W] or 3D [H,W,C] array, got shape [${shape.join(
        ", ",
      )}]`,
    );
  }
  const height = shape[0]!;
  const width = shape[1]!;
  const channels = shape.length === 3 ? shape[2]! : 1;

  if (isU8Dtype(dtype)) {
    return { kind: "u8", data: Uint8ClampedArray.from(data), width, height };
  }
  // Floats (and any other numeric dtype `parseNpy` coerced to Float64) feed the
  // HDR/float path. `parseNpy` always widens to Float64, so numpy `.npy` arrays
  // are always `precision:"f32"` here; emitting `float16` arrays as `"f16-bits"`
  // is a deferred follow-up (needs a raw-half path in `parseNpy` — see P1 note).
  return { kind: "f32", data: Float32Array.from(data), width, height, channels, precision: "f32" };
}
