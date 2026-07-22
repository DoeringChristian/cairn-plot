/**
 * CPU TS reference implementation of SSIM (Wang et al. 2004, "Image Quality
 * Assessment: From Error Visibility to Structural Similarity").
 *
 * This is a plain-loops, small-image-scale port that mirrors what
 * scikit-image's `structural_similarity` computes, so it can be pinned against
 * that library on committed fixtures (`ssim-reference.test.ts` /
 * `__fixtures__/ssim.json`) and is itself the reference of truth the GPU
 * multi-pass kernel (`ssim.wgsl.ts`) is verified against in the browser harness
 * (`engine/__tests__/ssim.browser.ts`).
 *
 * ## Pipeline (standard SSIM, matched to skimage)
 *   1. sRGB [0,1] -> linear RGB -> Rec.709 LUMINANCE Y in [0,1] (the repo's
 *      luminance convention — the Y row of FLIP's linRGB->XYZ matrix, i.e.
 *      [0.2126, 0.7152, 0.0722], matching `hdr-flip-reference.ts`'s LUM). The
 *      SSIM statistics run on this single luminance plane.
 *   2. Gaussian-weighted local statistics via a SEPARABLE 11-tap Gaussian
 *      (sigma=1.5, radius=5, normalized to sum 1) applied as two 1D passes
 *      (horizontal then vertical) with REFLECT boundary — bit-for-bit what
 *      scipy.ndimage.gaussian_filter (skimage's `gaussian_weights=True`,
 *      `truncate=3.5`) does per axis.
 *   3. means ux,uy; variances vx = E[x^2]-ux^2, vy = E[y^2]-uy^2; covariance
 *      vxy = E[xy]-ux*uy (cov_norm = 1, i.e. `use_sample_covariance=False`).
 *   4. SSIM = (2 ux uy + C1)(2 vxy + C2) / ((ux^2+uy^2+C1)(vx+vy+C2)),
 *      C1 = (K1 L)^2, C2 = (K2 L)^2, K1=0.01, K2=0.03, L=1 (data_range=1).
 *
 * The DISPLAYED / cached kernel value is the ERROR map `1 - SSIM` (see
 * `ssim.wgsl.ts`); this reference exposes the raw SSIM map + the interior-crop
 * mean SSIM (skimage's `mssim`, cropped by `pad=5` to drop border pixels whose
 * window ran off the edge) so both can be pinned against skimage.
 */

// SSIM constants (Wang et al. / skimage defaults).
export const SSIM_K1 = 0.01;
export const SSIM_K2 = 0.03;
export const SSIM_L = 1; // dynamic range (data_range=1; luminance is [0,1]).
export const SSIM_SIGMA = 1.5;
export const SSIM_RADIUS = 5; // int(truncate*sigma+0.5) = int(3.5*1.5+0.5) = 5 -> 11-tap.

/** Rec.709 luminance weights (linear), matching `hdr-flip-reference.ts`'s LUM. */
export const SSIM_LUM: readonly [number, number, number] = [0.2126, 0.7152, 0.0722];

function srgb2linear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB [0,1] triple -> linear Rec.709 luminance, clamped to [0,1]. */
export function ssimLuminance(r: number, g: number, b: number): number {
  const y = SSIM_LUM[0] * srgb2linear(r) + SSIM_LUM[1] * srgb2linear(g) + SSIM_LUM[2] * srgb2linear(b);
  return Math.min(1, Math.max(0, y));
}

/** Normalized 1D Gaussian weights over [-radius, radius] (scipy convention). */
export function gaussianKernel1d(sigma: number, radius: number): Float64Array {
  const n = 2 * radius + 1;
  const w = new Float64Array(n);
  let sum = 0;
  for (let i = -radius, k = 0; i <= radius; i++, k++) {
    const g = Math.exp((-0.5 * i * i) / (sigma * sigma));
    w[k] = g;
    sum += g;
  }
  for (let i = 0; i < n; i++) w[i] = w[i]! / sum;
  return w;
}

/** scipy 'reflect' (half-sample symmetric) index mapping: (d c b a | a b c d | d c b a). */
function reflectIndex(i: number, n: number): number {
  if (n === 1) return 0;
  const period = 2 * n;
  let p = ((i % period) + period) % period;
  if (p >= n) p = period - 1 - p;
  return p;
}

/** Separable Gaussian blur (two 1D passes, reflect boundary) of a W*H plane. */
function gaussianBlur(plane: Float64Array, W: number, H: number, w: Float64Array, radius: number): Float64Array {
  // Horizontal pass.
  const tmp = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let k = -radius, ki = 0; k <= radius; k++, ki++) {
        acc += w[ki]! * plane[y * W + reflectIndex(x + k, W)]!;
      }
      tmp[y * W + x] = acc;
    }
  }
  // Vertical pass.
  const out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let k = -radius, ki = 0; k <= radius; k++, ki++) {
        acc += w[ki]! * tmp[reflectIndex(y + k, H) * W + x]!;
      }
      out[y * W + x] = acc;
    }
  }
  return out;
}

export interface SsimResult {
  /** Per-pixel SSIM map, length W*H (row-major). */
  ssim: Float32Array;
  /** Mean SSIM over the interior crop (skimage's `mssim`, border `pad=radius` dropped). */
  mssim: number;
}

/**
 * Compute the SSIM map for two sRGB images. `refSRGB`/`testSRGB` are length
 * `W*H*3` (interleaved RGB, no alpha), values in [0,1] sRGB. Returns the raw
 * SSIM map + the interior-crop mean (matching skimage `structural_similarity(
 * ..., gaussian_weights=True, sigma=1.5, use_sample_covariance=False,
 * data_range=1)`).
 */
export function ssim(
  refSRGB: ArrayLike<number>,
  testSRGB: ArrayLike<number>,
  W: number,
  H: number,
): SsimResult {
  return ssimFromLuminance(
    lumaPlane(refSRGB, W, H),
    lumaPlane(testSRGB, W, H),
    W,
    H,
  );
}

/** sRGB interleaved RGB -> luminance plane (length W*H). */
export function lumaPlane(srgb: ArrayLike<number>, W: number, H: number): Float64Array {
  const N = W * H;
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = ssimLuminance(srgb[i * 3]!, srgb[i * 3 + 1]!, srgb[i * 3 + 2]!);
  }
  return out;
}

/**
 * SSIM directly from two luminance planes (each length W*H, values in [0,1]).
 * This is the core scikit-image pins against — the test feeds skimage the SAME
 * luminance planes this function receives.
 */
export function ssimFromLuminance(x: Float64Array, y: Float64Array, W: number, H: number): SsimResult {
  const N = W * H;
  const w = gaussianKernel1d(SSIM_SIGMA, SSIM_RADIUS);
  const xx = new Float64Array(N);
  const yy = new Float64Array(N);
  const xy = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    xx[i] = x[i]! * x[i]!;
    yy[i] = y[i]! * y[i]!;
    xy[i] = x[i]! * y[i]!;
  }
  const ux = gaussianBlur(x, W, H, w, SSIM_RADIUS);
  const uy = gaussianBlur(y, W, H, w, SSIM_RADIUS);
  const uxx = gaussianBlur(xx, W, H, w, SSIM_RADIUS);
  const uyy = gaussianBlur(yy, W, H, w, SSIM_RADIUS);
  const uxy = gaussianBlur(xy, W, H, w, SSIM_RADIUS);

  const C1 = (SSIM_K1 * SSIM_L) ** 2;
  const C2 = (SSIM_K2 * SSIM_L) ** 2;
  const map = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const vx = uxx[i]! - ux[i]! * ux[i]!;
    const vy = uyy[i]! - uy[i]! * uy[i]!;
    const vxy = uxy[i]! - ux[i]! * uy[i]!;
    const A1 = 2 * ux[i]! * uy[i]! + C1;
    const A2 = 2 * vxy + C2;
    const B1 = ux[i]! * ux[i]! + uy[i]! * uy[i]! + C1;
    const B2 = vx + vy + C2;
    map[i] = (A1 * A2) / (B1 * B2);
  }

  // skimage crops `pad = radius` border pixels before averaging (mssim).
  const pad = SSIM_RADIUS;
  let sum = 0;
  let count = 0;
  for (let yy2 = pad; yy2 < H - pad; yy2++) {
    for (let xx2 = pad; xx2 < W - pad; xx2++) {
      sum += map[yy2 * W + xx2]!;
      count++;
    }
  }
  const mssim = count > 0 ? sum / count : NaN;
  return { ssim: map, mssim };
}
