import { srgbEotf } from "../runtime/tonemap.ts";

/** Canonical scene-linear RGBA field handed to image comparison backends. */
export interface SceneImageField {
  readonly pixels: Float32Array;
  readonly width: number;
  readonly height: number;
}

/** End the browser-storage lifetime: decoded sRGB bytes become scene-linear
 * floats here, before any image operation or rendering backend sees them. */
export function imageDataToSceneField(
  image: { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number },
): SceneImageField {
  const pixels = new Float32Array(image.width * image.height * 4);
  for (let i = 0; i < image.data.length; i += 4) {
    pixels[i] = srgbEotf(image.data[i]! / 255);
    pixels[i + 1] = srgbEotf(image.data[i + 1]! / 255);
    pixels[i + 2] = srgbEotf(image.data[i + 2]! / 255);
    pixels[i + 3] = image.data[i + 3]! / 255;
  }
  return { pixels, width: image.width, height: image.height };
}
