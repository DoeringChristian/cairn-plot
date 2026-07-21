/**
 * `image/half.ts` — shared IEEE-754 binary16 (half-precision) helpers for the
 * F16 END-TO-END pipeline.
 *
 * ## Why keep half bits at all
 * An HDR/EXR source whose channels are stored as `HALF` is only 2 bytes per
 * sample. Historically every such source was WIDENED to `f32` the instant it
 * was decoded (a scalar `halfToFloat` loop) and then uploaded to the GPU as
 * `rgba32float` — 16 bytes/px for data that was 8. This module lets the raw
 * `Uint16Array` of half BIT PATTERNS survive all the way to an `rgba16float`
 * texture upload (halving resident source-texture memory), converting to `f32`
 * only LAZILY where a CPU consumer actually needs float values (the TEV
 * per-pixel overlay, the CPU tone-map fallback, the FLIP reference paths).
 *
 * A payload tagged {@link Precision} `"f16-bits"` stores a `Uint16Array` of raw
 * binary16 bit patterns (little-endian sample order, 1 u16 per channel sample);
 * `"f32"` stores ordinary `Float32Array`/`Float64Array` float values.
 */

/** Precision tag carried alongside a float image payload's `data` array. */
export type Precision = "f32" | "f16-bits";

/** IEEE-754 binary16 bit pattern for +1.0 — the alpha fill for RGB→RGBA. */
export const HALF_ONE = 0x3c00;

/** IEEE-754 half (16-bit) bit pattern → `f32`. Exact for every half value. */
export function halfToFloat(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const mant = h & 0x3ff;
  if (exp === 0) {
    if (mant === 0) return sign * 0;
    // subnormal: mant * 2^-24
    return sign * mant * 2 ** -24;
  }
  if (exp === 31) {
    return mant === 0 ? sign * Infinity : NaN;
  }
  // normal: 2^(exp-15) * (1 + mant/1024)
  return sign * 2 ** (exp - 15) * (1 + mant / 1024);
}

// `Float16Array` is new-ish (ES2025) and NOT in this project's TS lib
// (`ES2020`) — feature-detect it off `globalThis` behind a minimal structural
// type so tsc never depends on the global name. When present, it reinterprets
// the half bits as floats natively (a fast C++ path); otherwise we fall back to
// the scalar `halfToFloat` loop above.
type Float16Ctor = {
  new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): ArrayLike<number> & Iterable<number>;
};
const Float16: Float16Ctor | undefined = (globalThis as { Float16Array?: Float16Ctor }).Float16Array;

/** True iff this runtime has a native `Float16Array` (used by tests/diagnostics). */
export const hasFloat16Array = Float16 !== undefined;

/**
 * Widen a `Uint16Array` of `count` (default: all) raw binary16 bit patterns
 * into a fresh `Float32Array` of float values — the LAZY f16→f32 conversion the
 * CPU-side consumers use. Prefers a native `Float16Array` view when available,
 * else the scalar `halfToFloat` fallback; both produce identical results.
 */
export function f16BitsToFloat32(bits: Uint16Array, count = bits.length): Float32Array {
  if (Float16) {
    const view = new Float16(bits.buffer, bits.byteOffset, count);
    return Float32Array.from(view);
  }
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = halfToFloat(bits[i]!);
  return out;
}
