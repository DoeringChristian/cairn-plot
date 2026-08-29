/**
 * `image/pixel-buffer.ts` — the SELF-DESCRIBING float pixel buffer (user
 * ruling, 2026-08-25; tev's `PixelBuffer` translated to TypeScript).
 *
 * THE PROBLEM THIS SOLVES. JavaScript has no `half` scalar: a buffer of raw
 * IEEE-754 binary16 BIT PATTERNS and a buffer of small integers are both just
 * a `Uint16Array` — the meaning of the bytes cannot travel in the array type,
 * so it used to travel BESIDE the data as an optional `precision` tag. An
 * optional tag is a droppable tag: one packer forgot to copy it and half-EXR
 * bit patterns were uploaded as float VALUES (1.0 → 15360 ≈ 2^14 — the
 * "compare exposure blows up" bug). In tev the equivalent mistake is
 * impossible: its buffer carries its own pixel format and access goes through
 * typed views, with C++'s `half` converting to float on read.
 *
 * THE FIX: representation is INTRINSIC to the buffer object and unforgeable —
 * the two interpretations use DIFFERENT FIELD NAMES, so reading `.values` on
 * a bits buffer is a compile error, and no consumer can misinterpret bytes by
 * omission. All reads go through the accessors below, which widen half → f32
 * on the fly (the explicit form of tev's implicit `half → float`).
 *
 * The discriminant is the INTERPRETATION, not the width: `"values"` holds
 * directly-readable float values (f32 or f64 storage); `"f16-bits"` holds raw
 * binary16 bit patterns (the F16 pipeline — kept half through to an
 * `rgba16float` upload; see `./half.ts`).
 */
import { f16BitsToFloat32, halfToFloat } from "./half.ts";
import type { FloatPixels } from "../definition/content.ts";

export type { FloatPixels } from "../definition/content.ts";

/** A float pixel payload whose representation travels WITH the bytes. */
/** Wrap directly-readable float values. */
export function floatValues(values: Float32Array | Float64Array): FloatPixels {
  return { kind: "values", values };
}

/** Wrap raw binary16 bit patterns. */
export function halfBits(bits: Uint16Array): FloatPixels {
  return { kind: "f16-bits", bits };
}

/**
 * Bridge from the WIRE format (`data` + `precision`, e.g. a baked descriptor /
 * worker message) into a self-describing buffer — the ONE place the legacy
 * pair is interpreted. A `Uint16Array` without the `"f16-bits"` tag is REFUSED
 * loudly: that ambiguity is exactly the silent-misread bug this type removes.
 */
export function floatPixelsFrom(
  data: Float32Array | Float64Array | Uint16Array,
  precision: "f32" | "f16-bits" | undefined,
): FloatPixels {
  if (precision === "f16-bits") {
    if (!(data instanceof Uint16Array)) {
      throw new Error("cairn-plot: 'f16-bits' pixels must be a Uint16Array of binary16 bits");
    }
    return halfBits(data);
  }
  if (data instanceof Uint16Array) {
    throw new Error(
      "cairn-plot: Uint16Array pixel data without precision:'f16-bits' — refusing to guess " +
        "(reading bit patterns as values is the 2^14 exposure bug)",
    );
  }
  return floatValues(data);
}

/** Sample count in the buffer. */
export function floatPixelsLength(px: FloatPixels): number {
  return px.kind === "values" ? px.values.length : px.bits.length;
}

/** Read ONE sample as a float value (widen half on the fly). */
export function readFloatPixel(px: FloatPixels, i: number): number {
  return px.kind === "values" ? (px.values[i] ?? 0) : halfToFloat(px.bits[i] ?? 0);
}

/** A hot-loop reader with the representation branch hoisted OUT of the loop. */
export function floatPixelReader(px: FloatPixels): (i: number) => number {
  if (px.kind === "values") {
    const v = px.values;
    return (i) => v[i] ?? 0;
  }
  const b = px.bits;
  return (i) => halfToFloat(b[i] ?? 0);
}

/** The whole buffer as float32 VALUES (pass-through for f32 storage; widens
 *  f64 / half). For consumers that genuinely need a values array. */
export function widenFloatPixels(px: FloatPixels): Float32Array {
  if (px.kind === "f16-bits") return f16BitsToFloat32(px.bits);
  return px.values instanceof Float32Array ? px.values : Float32Array.from(px.values);
}

/** The underlying typed array, for size accounting / structured-clone — NEVER
 *  for reading samples (use the accessors; the caller must branch on `kind`
 *  before interpreting). */
export function floatPixelsRaw(px: FloatPixels): Float32Array | Float64Array | Uint16Array {
  return px.kind === "values" ? px.values : px.bits;
}
