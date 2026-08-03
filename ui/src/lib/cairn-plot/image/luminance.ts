/**
 * `image/luminance.ts` — the ONE relative-luminance helper for cairn-plot.
 *
 * Two DISTINCT luminance notions live in this codebase; keep them apart:
 *
 *  1. `labelLuminance(r,g,b)` — Rec.601 perceptual luma of an already-displayed
 *     8-bit sRGB pixel, normalized to [0,1]. Its ONLY consumer is the pixel-value
 *     overlay's text-contrast pick (dark vs. light label + halo). It was
 *     copy-pasted verbatim across every image/compare pane's pixel sampler; this
 *     is the shared home. It is NOT a colorimetric metric — the coefficients are
 *     the classic NTSC/Rec.601 weights on gamma-encoded bytes, which is exactly
 *     what perceived text contrast wants.
 *
 *  2. {@link REC709_LUMINANCE_WEIGHTS} — the LINEAR Rec.709 luminance triple
 *     used by the diff METRICS (FLIP, SSIM). Different coefficients, different
 *     input domain (linear light, not sRGB bytes). Exported here so the engine
 *     kernels can adopt a single named constant later; do not conflate it with
 *     the text-contrast luma above.
 */

/** Rec.601 text-contrast weights (on gamma-encoded sRGB bytes). */
const R601 = 0.299;
const G601 = 0.587;
const B601 = 0.114;

/**
 * Rec.601 relative luma of an 8-bit sRGB pixel, normalized to [0,1]. Feeds the
 * pixel-overlay dark/light label pick — NOT a colorimetric metric (see file
 * header). `r`/`g`/`b` are 0–255 channel bytes.
 */
export function labelLuminance(r: number, g: number, b: number): number {
  return (R601 * r + G601 * g + B601 * b) / 255;
}

/**
 * Threshold on {@link labelLuminance}'s [0,1] output below which a pixel counts
 * as "dark" and the overlay prints a light label (with a dark halo). Kept here
 * next to the luma it gates so the pick stays consistent across surfaces.
 */
export const LABEL_LUMINANCE_DARK_THRESHOLD = 0.55;

/**
 * Linear Rec.709 luminance weights `[0.2126, 0.7152, 0.0722]` used by the diff
 * metrics (FLIP/SSIM). Exported for the engine kernels to adopt; distinct from
 * the Rec.601 text-contrast luma above.
 */
export const REC709_LUMINANCE_WEIGHTS: readonly [number, number, number] = [
  0.2126, 0.7152, 0.0722,
];
