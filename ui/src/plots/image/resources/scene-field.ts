import { srgbEotf } from "../runtime/tonemap.ts";

/** Canonical scene-linear RGBA field handed to image comparison backends. */
export interface SceneImageField {
  readonly pixels: Float32Array;
  readonly width: number;
  readonly height: number;
}

/**
 * How many times `imageDataToSceneField` has run in this document.
 *
 * INSTRUMENTATION ONLY — nothing in the product branches on it. This whole-CPU
 * sRGB→linear expansion is the single most expensive step on the WebGPU
 * comparison path (one `Float32Array` of `w*h*4` per operand, built one pixel at
 * a time), and it is invisible from the outside: no DOM node, no network entry,
 * no native call a prototype spy can count. The `image-load-cost` harness reads
 * this counter before and after a mount to put a number on it, and a later task
 * removes the GPU-side calls; the counter is how that removal is proven rather
 * than assumed.
 */
let conversions = 0;

/** The value of the conversion counter above. See its doc comment. */
export function sceneConversionCount(): number {
  return conversions;
}

/** End the browser-storage lifetime: decoded sRGB bytes become scene-linear
 * floats here, before any image operation or rendering backend sees them. */
export function imageDataToSceneField(
  image: { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number },
): SceneImageField {
  conversions++;
  const pixels = new Float32Array(image.width * image.height * 4);
  for (let i = 0; i < image.data.length; i += 4) {
    pixels[i] = srgbEotf(image.data[i]! / 255);
    pixels[i + 1] = srgbEotf(image.data[i + 1]! / 255);
    pixels[i + 2] = srgbEotf(image.data[i + 2]! / 255);
    pixels[i + 3] = image.data[i + 3]! / 255;
  }
  return { pixels, width: image.width, height: image.height };
}
