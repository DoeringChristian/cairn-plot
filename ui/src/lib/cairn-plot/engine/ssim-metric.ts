/**
 * Scalar mean-SSIM helpers for the compare metrics chip (alongside MSE/PSNR/MAE).
 *
 * The `ssim` diff kernel's RESULT texture stores the per-pixel ERROR field
 * `1 − SSIM` (replicated across R/G/B; see `kernels/ssim.wgsl.ts`). The chip's
 * scalar is the MEAN SSIM over exactly the mapped/compared region (the same
 * crop/fill window the other metrics reduce over):
 *
 *     mean SSIM = 1 − mean(1 − SSIM) = mean(SSIM)
 *
 * These two functions are pure (no GPU, no DOM) so the formatting + reduction
 * are unit-testable in node (`ssim-metric.test.ts`); the GPU sourcing +
 * caching lives in `diff-engine.ts` (`ensureSsimScalar`), and the wiring in
 * `media-compare/GpuComparePane.tsx`.
 */

/**
 * Mean SSIM from an `ssim`-kernel RESULT readback (`device.readback`): an RGBA
 * `Float32Array` (row-major, 4 floats/pixel) whose R channel is `1 − SSIM`.
 * Averages `1 − SSIM` over the FULL `width*height` result grid — which is
 * exactly the mapped/compared region (overlap under crop, common grid under
 * fill) — and returns `1 − mean`, i.e. the mean SSIM. Returns `NaN` for an
 * empty region (nothing to compare).
 *
 * The SHIPPED scalar path now reduces this mean ON THE GPU
 * (`Device.reduceTextureChannelMean` — the reduction family's `channel`/`mean`
 * variant over the R channel, a KB partial-buffer readback instead of the full
 * ~64MB texture transfer this loop needed). This function survives as (a) the
 * CPU-average FALLBACK for a device without the GPU reduction
 * (`diff-engine.ts`'s `reduceSsimMean`), and (b) the PARITY REFERENCE the
 * reduction harness asserts the GPU result against. NaN PROPAGATES (`sumErr +=
 * s`; `?? 0` guards only out-of-range `undefined`, never a NaN sample) —
 * matching the GPU reduction's additive NaN propagation.
 */
export function meanSsimFromErrorMap(samples: Float32Array, width: number, height: number): number {
  const n = width * height;
  if (n <= 0) return NaN;
  let sumErr = 0;
  for (let i = 0; i < n; i++) sumErr += samples[i * 4] ?? 0;
  return 1 - sumErr / n;
}

/**
 * Chip formatting for the mean-SSIM scalar, consistent with the chip's other
 * entries (fixed-precision numerics). Four decimals — SSIM lives in ≈[0,1], so
 * identical inputs read as an exact `"1.0000"`. `null`/`undefined`/`NaN` (the
 * scalar is still resolving, or there is no comparison region) render as an
 * em-dash so the chip shows `SSIM —` without blocking.
 */
export function formatSsim(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "—" : v.toFixed(4);
}
