/**
 * `cpu/processing.ts` — the display-space `processing` block as a PER-PIXEL pass.
 *
 * The CPU backend used to express `ImageProcessing` as CSS on its `<img>`
 * element (`url(#gamma) brightness() contrast() invert()`, built by the
 * since-deleted `compare/post-processing.tsx`). The unified viewport paints every CPU image
 * into ONE presentation canvas with `drawImage`, so there is no styled element
 * to hang a filter on any more: the same math runs here, over the 8-bit sRGB
 * pixels, before the bitmap is made.
 *
 * The brightness/contrast/flipSign affine is `applyDisplayAdjust1` — the ONE
 * numeric definition of the CSS functions, the same one the GPU shader ports
 * (`cairnDisplayAdjust`), so the two backends agree. The gamma/offset stage is
 * the SVG `feComponentTransfer type="gamma"` (amplitude 1, exponent 1/γ, plus
 * offset) that CSS has no function for. Order matches the old filter list:
 * gamma/offset first, then brightness (with 2^exposure folded into the gain),
 * contrast, invert. Alpha passes through untouched.
 */
import type { ImageProcessing } from "../../types";
import { applyDisplayAdjust1 } from "../runtime/tonemap.ts";

/** True when the block is a no-op. `exposure`/`offset` here are legacy slots
 *  (lifted top-level on the unified path); they are still honoured for
 *  completeness so an authored block renders as before. */
export function isIdentityProcessing(p: ImageProcessing): boolean {
  return p.brightness === 0 && p.contrast === 0 && p.gamma === 1 && p.exposure === 0 && p.offset === 0 && !p.flipSign;
}

/** `new ImageData` where the global exists (browsers); a plain object of the
 *  same shape under Node (`node:test`), which is all the pure callers read. */
function makeImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  // The lib's `ImageData` ctor is typed on `Uint8ClampedArray<ArrayBuffer>`; a
  // parameter of the plain alias widens to `ArrayBufferLike`, hence the cast.
  if (typeof ImageData !== "undefined") return new ImageData(data as ImageData["data"], width, height);
  return { data, width, height } as ImageData;
}

/**
 * Apply the `processing` block to 8-bit sRGB pixels. Returns `src` UNCHANGED
 * (same object) when the block is the identity, so the common path allocates
 * nothing. The per-channel transfer is a 256-entry LUT — the stage is a pure
 * function of the byte value, so each of the 256 possible inputs is computed
 * once regardless of the image size.
 *
 * `Uint8ClampedArray` assignment rounds and clamps, matching CSS's
 * rasterization-time clamp of the (unclamped) filter math.
 */
export function applyProcessingToImageData(src: ImageData, p: ImageProcessing): ImageData {
  if (isIdentityProcessing(p)) return src;
  const out = new Uint8ClampedArray(src.data.length);
  const d = src.data;
  const adjust = {
    brightness: (1 + p.brightness) * Math.pow(2, p.exposure) - 1,
    contrast: p.contrast,
    flipSign: p.flipSign,
  };
  const exponent = 1 / p.gamma;
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i / 255;
    if (p.gamma !== 1 || p.offset !== 0) v = Math.pow(v, exponent) + p.offset;
    lut[i] = 255 * applyDisplayAdjust1(v, adjust);
  }
  for (let i = 0; i < d.length; i += 4) {
    out[i] = lut[d[i]!]!;
    out[i + 1] = lut[d[i + 1]!]!;
    out[i + 2] = lut[d[i + 2]!]!;
    out[i + 3] = d[i + 3]!;
  }
  return makeImageData(out, src.width, src.height);
}
