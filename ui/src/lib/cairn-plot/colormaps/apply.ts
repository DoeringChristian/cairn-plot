import type { ColormapName } from "../types";
import { getColormapLUT } from "./lut.ts";
import { applyExposureOffset } from "../image/tonemap.ts";

/**
 * Apply a colormap LUT to an ImageData.
 *
 * `mode` controls how pixel values map to the LUT:
 * - "linear": 0→LUT[0], 255→LUT[255]. Use for raw images and non-signed diffs.
 * - "signed": Same as linear, but semantically the midpoint (128) represents
 *   zero diff. Use for signed diffs where the computation already maps zero to 128.
 * - "positive": 0→LUT[128], 255→LUT[255]. Use for absolute/squared diffs
 *   where 0 = no diff (should map to colormap center/white in diverging maps).
 *
 * `exposureEV`/`offset` adjust the colormap SENSITIVITY: they scale the source
 * value fed into the LUT (`value * 2^EV + offset`, in the normalized [0,1]
 * domain) BEFORE the index mapping — i.e. exposure changes which part of the
 * ramp a given pixel lands on, exactly like the GPU diff blit's exposure. Both
 * default to 0 (identity), so existing callers are unaffected.
 */
export function applyColormap(
  src: ImageData,
  cmap: ColormapName,
  mode: "linear" | "signed" | "positive" = "linear",
  exposureEV = 0,
  offset = 0,
): ImageData {
  const lut = getColormapLUT(cmap);
  const out = new ImageData(src.width, src.height);
  const sd = src.data;
  const od = out.data;
  const adjust = exposureEV !== 0 || offset !== 0;
  for (let i = 0; i < sd.length; i += 4) {
    let avg = (sd[i]! + sd[i + 1]! + sd[i + 2]!) / 3;
    if (adjust) {
      // Exposure/offset act in the normalized [0,1] domain (the canonical
      // `applyExposureOffset` = v*2^EV + offset), then back to 0..255.
      avg = Math.max(0, Math.min(255, applyExposureOffset(avg / 255, exposureEV, offset) * 255));
    }
    let idx: number;
    if (mode === "positive") {
      idx = Math.round(128 + (avg / 255) * 127);
    } else {
      idx = Math.round(avg);
    }
    idx = Math.max(0, Math.min(255, idx));
    od[i] = lut[idx * 3]!;
    od[i + 1] = lut[idx * 3 + 1]!;
    od[i + 2] = lut[idx * 3 + 2]!;
    od[i + 3] = sd[i + 3]!;
  }
  return out;
}
