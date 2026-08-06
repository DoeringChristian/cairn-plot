/**
 * `interp-auto.ts` — the pure, shared "auto" image-interpolation rule.
 *
 * Both image backends switch their magnification filter at the SAME zoom
 * threshold: once one source texel covers `PIXEL_VALUE_MIN_SCREEN_PX` screen px
 * (magnified enough to read individual texels — the exact point
 * `PixelValueOverlay` starts drawing per-pixel numbers), they snap to
 * nearest/pixelated so the pixel grid is crisp; below it they smooth.
 *
 * `GpuImagePane` implements this inline (its WebGPU sampler flips
 * `nearest`/`linear` at `screenPxPerTexel(...) >= PIXEL_VALUE_MIN_SCREEN_PX`,
 * Q20). This module is the CPU backend's counterpart — the ONE pure home for
 * the rule (`autoImageRendering`) + the object-contain texel-size math
 * (`containScreenPxPerTexel`), so the CPU pane's CSS `image-rendering` flips at
 * the identical zoom.
 *
 * The threshold is a PARAMETER, not a baked literal: `CpuImagePane` passes the
 * SAME `PIXEL_VALUE_MIN_SCREEN_PX` constant `GpuImagePane` reads (both import it
 * from `primitives/PixelValueOverlay`), so there is ONE source of truth and no
 * duplicated number. Parameterizing it also keeps this module — and its unit
 * test — framework-free and loadable under Node's `.ts`-only type-stripping
 * runner (which can't strip the `.tsx` the constant lives in).
 */

/**
 * Screen px covered by ONE source texel for an object-`contain` display box —
 * the same `min(box/natural)` fit `GpuImagePane.screenPxPerTexel` uses (there
 * parameterized by a `rawUv` crop; here the CPU pane instead grows its box
 * physically via the wrapper's CSS `scale(zoom)`, so pass the ON-SCREEN box —
 * the unscaled layout box multiplied by `zoom`). Returns 0 for a degenerate
 * box / natural size (caller then leaves rendering at the browser default).
 */
export function containScreenPxPerTexel(
  box: { width: number; height: number },
  naturalW: number,
  naturalH: number,
): number {
  if (naturalW <= 0 || naturalH <= 0 || box.width <= 0 || box.height <= 0) return 0;
  return Math.min(box.width / naturalW, box.height / naturalH);
}

/**
 * The shared "auto" rule: the CSS `image-rendering` a CPU image pane should use
 * for a given on-screen texel size. `"pixelated"` once a source texel covers
 * `>= threshold` screen px (pass `PIXEL_VALUE_MIN_SCREEN_PX`, matching
 * `GpuImagePane`'s `nearest`), else `undefined` (the browser default smoothing,
 * == the GPU's `linear`). Only meaningful for `interpolation === "auto"`; an
 * explicit `pixelated`/`crisp-edges` bypasses this.
 */
export function autoImageRendering(
  screenPxPerTexel: number,
  threshold: number,
): "pixelated" | undefined {
  return screenPxPerTexel >= threshold ? "pixelated" : undefined;
}
