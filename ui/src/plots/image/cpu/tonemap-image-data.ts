/**
 * `cpu/tonemap-image-data.ts` — the CPU backend's two per-pixel display passes,
 * float→8-bit (`tonemapToImageData`) and 8-bit→8-bit (`sdrTransferToImageData`).
 *
 * They live here rather than in `cpu/view.tsx` so the content hook
 * (`use-cpu-content.ts`) — which the view imports — can call them without an
 * import cycle through the view. `cpu/view.tsx` re-exports both, so the historic
 * `import { tonemapToImageData } from "../cpu/view"` entry point is unchanged.
 */
import { shapeDims, finite, type FloatImageData } from "../runtime/contracts";
import { widenFloatPixels } from "../runtime/pixel-buffer.ts";
import {
  DEFAULT_DISPLAY_OPERATION_ID,
  applyExposureOffset,
  outputEncode,
  srgbEotf,
  resolveEncodeGamma,
  TONEMAP_GAMMA_DEFAULT,
  type RgbTriple,
} from "../runtime/tonemap";
import { getDisplayOperation, type ReduceMode } from "../definition/display-operations.ts";
import { DEFAULT_DISPLAY_PARAMETERS, defaultReduceMode, type DisplayParameters, type NormMode } from "../runtime/display-settings.ts";
import { getCpuDisplayOperation } from "./display-operations.ts";
import { getImageOperationEvaluator, type ImageOperationEvaluator } from "../resources/image-operation-evaluator.ts";

/** The CONTENT stage's CPU twin (Phase 1: identity — a passthrough). The CPU
 *  pane produces its per-texel content through the content-op registry, the SAME
 *  declaration the GPU shader's `cairnContent` assembles from. Identity returns
 *  the sampled source channels unchanged, so the pixel pipeline is byte-for-byte
 *  as before. */
const _identityOp = getImageOperationEvaluator("identity");
if (!_identityOp) {
  throw new Error("CpuImagePane: the CPU backend must implement the identity image operation");
}
const IDENTITY_CONTENT: ImageOperationEvaluator = _identityOp;

/**
 * Tone-map the float HDR buffer into an 8-bit RGBA `ImageData`. Pure — no DOM
 * beyond the `ImageData` allocation. Exposure → operator → output-encode per
 * pixel, exactly the pipeline documented in `tonemap.ts`.
 */
export function tonemapToImageData(
  hdr: FloatImageData,
  tonemap: string,
  exposure: number,
  gamma?: number,
  offset: number = 0,
  colormap: string | null = null,
  // DATA-encoding norm + bounds (Phase 4) — the colormap-only extras. `norm`
  // reshapes the LUT index (linear/log/power; `normExponent` is the power
  // exponent); `colorMin`/`colorMax` (both set) engage the min/max BOUNDS skin
  // INSTEAD of the exposure/offset sensitivity (never composed). Defaults
  // reproduce the Phase-2 behavior (linear, no bounds) bit-for-bit.
  norm: NormMode = "linear",
  colorMin?: number,
  colorMax?: number,
  normExponent: number = 1,
  // Multi-channel REDUCE (the multi-channel-colormap follow-up) — how a k>1
  // colormap source collapses to the scalar the LUT indexes. Unset → the k-based
  // default (`defaultReduceMode`). Ignored for k=1 (the scalar IS the channel)
  // and when no colormap is active.
  reduce?: ReduceMode,
): ImageData {
  const { h, w, c } = shapeDims(hdr.shape);
  // TURBO false-color (the tev-exact follow-up) indexes the bound turbo table at
  // tev's FIXED log2 mapping (`turboDataIndex`) instead of `computeDataIndex`, and
  // defaults `reduce` to MEAN (tev averages RGB) regardless of k.
  const colormapDefinition = colormap != null ? getDisplayOperation(colormap) : undefined;
  const colormapOperation = colormap != null ? getCpuDisplayOperation(colormap) : undefined;
  const reduceMode: ReduceMode = reduce ?? colormapDefinition?.defaultReduce ?? defaultReduceMode(c);
  // COLORMAP (LUT family, CPU twin — Phase 2/4): when a colormap is active the
  // SCALAR channel (channel 0) indexes the colormap LUT and the DISPLAY color is
  // written straight out — the tone-map operator + output-encode are SHORT-
  // CIRCUITED (the LUT holds display sRGB), matching the GPU `cairnLutColor`
  // family + the diff blit. The index runs through `computeDataIndex` (the norm
  // reshape + optional bounds affine — the CPU source of truth the WGSL
  // `cairnDataIndex` mirrors). cmap-mode `linear`.
  // ANALYTIC colormap (tev-style signed red-green) — computed color, no LUT. The
  // reduced signed scalar → signedAnalyticColor (neg→red, pos→green, 2*|v|,
  // UNCLAMPED) → SHARED output-encode (like a curve), NOT a baked-sRGB LUT sample.
  // This CPU fallback writes an 8-bit ImageData, so |v|>1 clamps here (the extended
  // >1 survival is the GPU/HDR-surface path); |v|<=1 matches the GPU exactly.
  const analyticCmap = colormapOperation?.kind === "analytic";
  // TURBO bakes its own FIXED index (`turboDataIndex`), bypassing the norm/bounds
  // path — so its params (norm/bounds) are inert on this branch.
  const cmapBoundsOn =
    typeof colorMin === "number" && Number.isFinite(colorMin) &&
    typeof colorMax === "number" && Number.isFinite(colorMax);
  const cmapDataParams: DisplayParameters = {
    exposure,
    offset,
    peak: 4,
    gamma: normExponent,
    norm,
    ...(cmapBoundsOn ? { min: colorMin, max: colorMax } : {}),
  };
  // F16 pipeline: this is the CPU tone-map FALLBACK path (used when the GPU
  // backend is unavailable), so a `"f16-bits"` buffer is widened to f32 ONCE
  // for the whole frame here (via the self-describing pixel buffer) rather
  // than kept half — the GPU path keeps the bits; only this fallback pays.
  const src = widenFloatPixels(hdr.pixels);
  // Resolve the operator CURVE straight from the registry (the single source of
  // truth). Every curve works on this SDR surface; the output conversion below
  // performs the surface-specific clamp.
  const curveDefinition = getDisplayOperation(tonemap);
  const opEnc =
    curveDefinition && curveDefinition.category !== "colormap"
      ? getCpuDisplayOperation(tonemap)!
      : getCpuDisplayOperation(DEFAULT_DISPLAY_OPERATION_ID)!;
  const op = (rgb: RgbTriple): RgbTriple => {
    const params = { ...DEFAULT_DISPLAY_PARAMETERS, peak: 1 };
    return opEnc.evaluate(rgb, 3, params);
  };
  const out = new Uint8ClampedArray(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const base = i * c;
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (c === 1) {
      r = g = b = finite(src[base]!);
    } else if (c === 3) {
      r = finite(src[base]!);
      g = finite(src[base + 1]!);
      b = finite(src[base + 2]!);
    } else {
      // c === 4 (rgba); alpha passes through the encode as a plain [0,1] value.
      r = finite(src[base]!);
      g = finite(src[base + 1]!);
      b = finite(src[base + 2]!);
      a = finite(src[base + 3]!);
    }

    // CONTENT stage (Phase 1: identity) — the sampled source color enters the
    // display pipeline through the content-op registry's `cpu` twin, mirroring
    // the GPU shader's `cairnContent`. Identity is a passthrough, so [r,g,b] is
    // unchanged (alpha is a coverage value, handled separately below).
    const content = IDENTITY_CONTENT.evaluate([[r, g, b]], c);
    r = content[0]!;
    g = content[1]!;
    b = content[2]!;

    // 1) exposure + offset (TEV) in scene-linear, 2) tone-map HDR→[0,1],
    //    3) output-encode. Offset is added after exposure, before the operator.
    const lit: RgbTriple = [
      applyExposureOffset(r, exposure, offset),
      applyExposureOffset(g, exposure, offset),
      applyExposureOffset(b, exposure, offset),
    ];
    const o = i * 4;
    if (analyticCmap) {
      // The (exposure/offset-adjusted) color channels REDUCE to a signed scalar,
      // then the analytic color runs through the SAME output-encode as a curve.
      const [lr, lg, lb] = colormapOperation!.evaluate(lit, c, { ...cmapDataParams, reduce: reduceMode });
      // sRGB OETF (no gamma) — matches the GPU analytic branch's hasGamma=false.
      out[o] = 255 * outputEncode(lr);
      out[o + 1] = 255 * outputEncode(lg);
      out[o + 2] = 255 * outputEncode(lb);
      out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
      continue;
    }
    if (colormapOperation?.kind === "lut") {
      // Multi-channel follow-up: the color channels are first REDUCED to a scalar
      // (luminance/mean — `reduceToScalar`, the shared CPU source of truth the WGSL
      // `cairnReduceScalar` mirrors), then data index → LUT → display color
      // directly (no operator/encode). The BOUNDS skin reduces the RAW channels
      // (`r,g,b`); otherwise the exposure/offset sensitivity (`lit`) — the two are
      // never composed. At k=1 the reduce returns channel 0 unchanged.
      const [cr, cg, cb] = colormapOperation.evaluate(cmapBoundsOn ? [r, g, b] : lit, c, { ...cmapDataParams, reduce: reduceMode });
      out[o] = 255 * cr;
      out[o + 1] = 255 * cg;
      out[o + 2] = 255 * cb;
      out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
      continue;
    }
    const [tr, tg, tb] = op(lit);
    out[o] = 255 * outputEncode(tr, gamma);
    out[o + 1] = 255 * outputEncode(tg, gamma);
    out[o + 2] = 255 * outputEncode(tb, gamma);
    // Alpha is a coverage value, not light — clamp to [0,1], no tone-map.
    out[o + 3] = 255 * (a < 0 ? 0 : a > 1 ? 1 : a);
  }
  return makeImageData(out, w, h);
}

/**
 * Apply an SDR DISPLAY TRANSFER (tev sRGB · Gamma · Linear) to an already-sRGB
 * 8-bit `ImageData`, returning a new `ImageData`. Mirrors the GPU shader's plain-
 * SDR path (`srgbDecode → clamp → output-encode`) at EV=0/offset=0, so the CPU
 * fallback matches `GpuImagePane` to within 8-bit rounding:
 *   linear = srgbEotf(v/255) → clamp01 → out = 255·outputEncode(linear, gEnc)
 * where `gEnc = resolveEncodeGamma(operator, γ)` (gamma → γ, linear → 1/identity,
 * srgb → undefined/sRGB OETF). For `srgb` at EV=0/offset=0 this is a bit-exact
 * round-trip, so the content hook skips it entirely there. Alpha passes through.
 */
export function sdrTransferToImageData(
  src: ImageData,
  operator: string,
  gamma?: number,
  exposureEV = 0,
  offset = 0,
): ImageData {
  const gEnc = resolveEncodeGamma(operator, gamma ?? TONEMAP_GAMMA_DEFAULT);
  const out = new Uint8ClampedArray(src.data.length);
  const d = src.data;
  for (let i = 0; i < d.length; i += 4) {
    out[i] = 255 * outputEncode(applyExposureOffset(srgbEotf(d[i]! / 255), exposureEV, offset), gEnc);
    out[i + 1] = 255 * outputEncode(applyExposureOffset(srgbEotf(d[i + 1]! / 255), exposureEV, offset), gEnc);
    out[i + 2] = 255 * outputEncode(applyExposureOffset(srgbEotf(d[i + 2]! / 255), exposureEV, offset), gEnc);
    out[i + 3] = d[i + 3]!;
  }
  return makeImageData(out, src.width, src.height);
}

/** `new ImageData` where the global exists (browsers); a plain object of the
 *  same shape otherwise (`node:test`), which is all the pure callers read. */
function makeImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  // The lib's `ImageData` ctor is typed on `Uint8ClampedArray<ArrayBuffer>`; a
  // parameter of the plain alias widens to `ArrayBufferLike`, hence the cast.
  if (typeof ImageData !== "undefined") return new ImageData(data as ImageData["data"], width, height);
  return { data, width, height } as ImageData;
}
