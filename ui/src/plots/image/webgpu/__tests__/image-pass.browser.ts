/**
 * IMAGE render-pass readback-vs-CPU-reference harness (Task 5 of the WebGPU
 * engine, Sub-project 1) — `engine/image-engine.ts`'s `renderImage()`.
 *
 * jsdom has no WebGPU, so — like every other `*.browser.ts` harness in this
 * directory — this is NOT a unit test, it's a browser page driven via
 * claude-in-chrome.
 *
 * PARITY-CRITICAL: every case's expected value is computed by IMPORTING the
 * real `applyExposure`/`TONEMAP_OPERATORS`/`outputEncode` from
 * `image/tonemap.ts` (the CPU source of truth) rather than reimplementing
 * that math in the test — the assertion is "GPU output === what the actual
 * CPU renderer's functions compute", not "GPU output matches my mental
 * model of tonemap.ts". The one GPU-only addition (scalar image + colormap
 * LUT: `image.wgsl.ts`'s doc comment explains no existing CPU renderer
 * applies a colormap at this pipeline point) is mirrored by hand in
 * `computeExpectedRGB` below, matching `image.wgsl.ts`'s fragment shader
 * line for line.
 *
 * CASES (each rendered to an offscreen `rgba8unorm` texture unless noted):
 *   1-4. Each operator (linear/srgb/reinhard/aces) at EV=0, on a 4-pixel
 *        scene-linear gradient that includes a value > 1.0 (HDR range).
 *   5. Nonzero EV (+1.5) on the same gradient, operator "srgb".
 *   6. Scalar image + a 256x4 colormap LUT (magma stops, converted to
 *      normalized RGBA float) — `isScalar: true`. The LUT sample IS the final
 *      display color: the colormap SHORT-CIRCUITS the operator + output-encode
 *      stages (the shared LUT family / diff-blit convention), so the LUT's own
 *      sRGB [0,1] values reach the surface UNCHANGED (no re-encode).
 *   7. LUT-index rounding parity: scalar values whose `*255` lands EXACTLY
 *      on a `k+0.5` boundary (0.5/1.5/127.5/254.5), against an alternating
 *      black/white LUT (`BOUNDARY_LUT`) so a wrong adjacent index is
 *      unmistakable. Catches the shader-native `round()` (WGSL:
 *      round-half-to-EVEN, GLSL: implementation-defined) disagreeing with
 *      the CPU reference's `Math.round` (round-half-up) — and disagreeing
 *      with EACH OTHER — exactly at these boundaries; a smooth LUT (like
 *      case 6's magma) can't catch this because neighboring stops are too
 *      close in color to distinguish an off-by-one index within 1/255.
 *   8. Gamma override (2.2) instead of the default sRGB OETF.
 *   9. `uv` viewport window (zoom/pan): samples only a sub-rect of a wider
 *      source texture, proving the windowing math (not just full-frame
 *      sampling) is wired correctly.
 *   10. `hdrOut: true` to an `rgba32float` target — the EXTENDED output-encode
 *      runs (a float16 srgb/display-p3 canvas stores transfer-encoded signals
 *      per W3C ColorWeb-CG); compared as floats (looser epsilon; no 8-bit
 *      quantization to absorb GPU-vs-CPU float32/float64 precision diffs).
 *   11. `hdrOut` ENCODE PROOF: a raw-linear input reads back ENCODED, NOT equal
 *      to the raw value (the fix) — asserts the render-target holds encoded
 *      values under the hdrOut path.
 *
 * RUNNING:
 *   1. Bundle this file to plain JS:
 *        cd cairn/ui && npx esbuild \
 *          src/plots/image/webgpu/__tests__/image-pass.browser.ts \
 *          --bundle --format=esm \
 *          --outfile=src/plots/image/webgpu/__tests__/image-pass.browser.bundle.js
 *   2. Serve over http (file:// is blocked for module scripts):
 *        cd cairn/ui/src/plots/image/webgpu/__tests__ && python3 -m http.server 8936
 *   3. Open http://localhost:8936/image-pass.browser.html in Chrome
 *      (claude-in-chrome) and read the PASS/FAIL lines from the DOM/console.
 *
 * The generated `.bundle.js` is NOT committed (gitignored) — regenerate with
 * the command above whenever this harness or its imports change.
 */
import { getSharedWebGpuDevice } from "../device/device-provider.ts";
import { releaseImageRenderState, renderImage, type ImageParams } from "../image-engine";
import {
  applyExposure,
  outputEncode,
  extendedOutputEncode,
  srgbEotf,
  applyDisplayAdjust,
  EXTENDED_TONEMAP_PEAK_DEFAULT,
  type RgbTriple,
} from "../../runtime/tonemap";
import { evaluateDisplayOperation, getCpuDisplayOperation } from "../../cpu/display-operations.ts";
import { DEFAULT_DISPLAY_PARAMETERS } from "../../runtime/display-settings.ts";
import { buildLUT, COLORMAP_STOPS } from "../../../../settings/colormaps/lut";
import type { Device, Texture } from "../device/device-contract";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "IMAGE PASS", resultFlag: "__imagePassTestResult" });
const getDisplayOperation = getCpuDisplayOperation;
const DEFAULT_ENCODE_PARAMS = DEFAULT_DISPLAY_PARAMETERS;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const byteOf = (x: number): number => Math.round(clamp01(x) * 255);

/** 256x4 (RGBA, [0,1]) magma LUT — reuses the real colormap stops from colormaps/lut.ts. */
function buildFloatColormap(): Float32Array {
  const bytes = buildLUT(COLORMAP_STOPS.magma); // Uint8Array(256*3), 0..255
  const out = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    out[i * 4 + 0] = bytes[i * 3 + 0]! / 255;
    out[i * 4 + 1] = bytes[i * 3 + 1]! / 255;
    out[i * 4 + 2] = bytes[i * 3 + 2]! / 255;
    out[i * 4 + 3] = 1;
  }
  return out;
}
const VIRIDIS_FLOAT_LUT = buildFloatColormap();

/**
 * Alternating black/white 256x4 LUT — every ADJACENT index pair differs
 * maximally (0 vs 1 per channel), so a LUT index that rounds to the WRONG
 * neighbor is unmistakable in the readback (diff ~255, not ~1), unlike a
 * smooth LUT (e.g. magma) where neighboring stops are too close in color
 * to distinguish an off-by-one index within the 1/255 comparison epsilon.
 */
function buildBoundaryColormap(): Float32Array {
  const out = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const v = i % 2 === 0 ? 0 : 1;
    out[i * 4 + 0] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 1;
  }
  return out;
}
const BOUNDARY_LUT = buildBoundaryColormap();

/**
 * JS mirror of `image.wgsl.ts`'s fragment shader, computed with the REAL
 * `applyExposure`/`TONEMAP_OPERATORS`/`outputEncode` from `image/tonemap.ts`
 * for the parity-critical stages. Returns display-linear-or-encoded RGB in
 * [0,1] (encoded unless `params.hdrOut`). `colormap` must be supplied when
 * `params.isScalar`.
 */
function computeExpectedRGB(px: number[], params: ImageParams, colormap?: Float32Array): RgbTriple {
  // FINAL display-space post-processing (u_bind14 / cairnDisplayAdjust): the
  // brightness/contrast/flipSign affine applied to the ENCODED color, mirroring
  // image.wgsl.ts's cairnDisplayAdjust via the REAL applyDisplayAdjust from
  // image/tonemap.ts (the CPU source of truth). Identity when all three are unset,
  // so every pre-existing case is unaffected.
  const adjust = {
    brightness: params.brightness ?? 0,
    contrast: params.contrast ?? 0,
    flipSign: params.flipSign ?? false,
  };
  const withAdjust = (rgb: RgbTriple): RgbTriple => applyDisplayAdjust(rgb, adjust);
  // 0) [SDR display-transfer path] sRGB-DECODE the source to linear FIRST
  //    (mirrors image.wgsl.ts's srgbDecode branch).
  const decoded: RgbTriple = params.srgbDecode
    ? [srgbEotf(px[0]!), srgbEotf(px[1]!), srgbEotf(px[2]!)]
    : [px[0]!, px[1]!, px[2]!];
  const exposed: RgbTriple = [
    applyExposure(decoded[0], params.exposureEV),
    applyExposure(decoded[1], params.exposureEV),
    applyExposure(decoded[2], params.exposureEV),
  ];

  if (params.isScalar) {
    // Colormap LUT family (data encoding): the sampled LUT value IS the final
    // DISPLAY color — the isScalar path SHORT-CIRCUITS the operator + output-
    // encode stages and returns straight to the surface (cmap-mode 0 / linear,
    // round-half-up NEAREST index; matches image.wgsl.ts's cairnLutColor + the
    // diff blit convention). The LUT holds sRGB-encoded colors, so no re-encode.
    const lut = colormap!;
    const idx = Math.max(0, Math.min(255, Math.round(clamp01(exposed[0]) * 255)));
    return withAdjust([lut[idx * 4 + 0]!, lut[idx * 4 + 1]!, lut[idx * 4 + 2]!]);
  }
  const rgb = exposed;

  // Peak-aware operator dispatch (mirrors image.wgsl.ts's applyOperator): apply
  // the operator CURVE straight from the registry (the CPU source of truth) — the
  // extended roll-off operators (extended-reinhard/-aces) read `peak`; the rest
  // ignore it. An unknown operator falls back to the srgb clamp.
  const opEnc = getDisplayOperation(params.displayOperationId)!;
  const toned = evaluateDisplayOperation(opEnc, rgb, 3, {
    ...DEFAULT_ENCODE_PARAMS,
    peak: params.peak ?? EXTENDED_TONEMAP_PEAK_DEFAULT,
  });

  if (params.hdrOut) {
    // The extended-surface path ENCODES (not skips): a float16 srgb/display-p3
    // canvas stores transfer-encoded signals per W3C ColorWeb-CG. Extended
    // (unclamped, origin-mirrored) sRGB OETF / power curve.
    return withAdjust([
      extendedOutputEncode(toned[0], params.gamma),
      extendedOutputEncode(toned[1], params.gamma),
      extendedOutputEncode(toned[2], params.gamma),
    ]);
  }
  return withAdjust([
    outputEncode(toned[0], params.gamma),
    outputEncode(toned[1], params.gamma),
    outputEncode(toned[2], params.gamma),
  ]);
}

function buildSrcTexture(device: Device, pixels: number[][]): Texture {
  const width = pixels.length;
  const tex = device.createTexture(width, 1, "rgba32float");
  const data = new Float32Array(width * 4);
  for (let i = 0; i < pixels.length; i++) data.set(pixels[i]!, i * 4);
  tex.write(data);
  return tex;
}

interface CaseResult {
  label: string;
  ok: boolean;
  out: Uint8Array | Float32Array | null;
}

/** Byte-target case (rgba8unorm): renders, reads back, compares each channel to computeExpectedRGB within 1/255. */
async function runByteCaseAsync(
  device: Device,
  label: string,
  pixels: number[][],
  params: ImageParams,
  colormap: Float32Array | undefined,
): Promise<CaseResult> {
  const src = buildSrcTexture(device, pixels);
  const target = device.createTexture(pixels.length, 1, "rgba8unorm");
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();

  if (!(out instanceof Uint8Array)) {
    report(false, `[${label}] readback() should return Uint8Array for rgba8unorm, got ${out.constructor.name}`);
    return { label, ok: false, out: null };
  }

  let allOk = true;
  for (let i = 0; i < pixels.length; i++) {
    const expected = computeExpectedRGB(pixels[i]!, params, colormap);
    for (let c = 0; c < 3; c++) {
      const expectedByte = byteOf(expected[c]!);
      const actualByte = out[i * 4 + c]!;
      const diff = Math.abs(actualByte - expectedByte);
      const ok = diff <= 1;
      if (!ok) allOk = false;
      report(ok, `[${label}] pixel[${i}].ch[${c}] expected=${expectedByte} actual=${actualByte} (diff=${diff})`);
    }
  }
  report(allOk, `[${label}] all pixels within 1/255 of tonemap.ts reference`);
  return { label, ok: allOk, out };
}

/** hdrOut case (rgba32float target): compared as floats with a looser epsilon (no 8-bit quantization). */
async function runHdrOutCase(device: Device, label: string, pixels: number[][], params: ImageParams): Promise<CaseResult> {
  const src = buildSrcTexture(device, pixels);
  const target = device.createTexture(pixels.length, 1, "rgba32float");
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();

  if (!(out instanceof Float32Array)) {
    report(false, `[${label}] readback() should return Float32Array for rgba32float, got ${out.constructor.name}`);
    return { label, ok: false, out: null };
  }

  const EPS = 0.01;
  let allOk = true;
  for (let i = 0; i < pixels.length; i++) {
    const expected = computeExpectedRGB(pixels[i]!, params);
    for (let c = 0; c < 3; c++) {
      const expectedVal = expected[c]!;
      const actualVal = out[i * 4 + c]!;
      const diff = Math.abs(actualVal - expectedVal);
      const ok = diff <= EPS;
      if (!ok) allOk = false;
      report(ok, `[${label}] pixel[${i}].ch[${c}] expected=${expectedVal.toFixed(4)} actual=${actualVal.toFixed(4)} (diff=${diff.toFixed(4)})`);
    }
  }
  report(allOk, `[${label}] all pixels within ${EPS} of tonemap.ts reference (float target)`);
  return { label, ok: allOk, out };
}

// Scene-linear gradient including an HDR value (>1.0) — used for the
// per-operator / nonzero-EV / gamma-override cases. r=g=b=v, a=1.
const GRADIENT_PIXELS: number[][] = [
  [0.0, 0.0, 0.0, 1.0],
  [0.25, 0.25, 0.25, 1.0],
  [1.0, 1.0, 1.0, 1.0],
  [3.0, 3.0, 3.0, 1.0],
];

// Scalar "value" channel (r only matters); includes a value >1.0 to exercise
// the pre-LUT-index clamp.
const SCALAR_PIXELS: number[][] = [
  [0.0, 0, 0, 1.0],
  [0.33, 0, 0, 1.0],
  [0.66, 0, 0, 1.0],
  [1.2, 0, 0, 1.0],
];

// Scalar values whose exposure-applied `*255` lands EXACTLY on a `k+0.5`
// index boundary (0.5, 1.5, 127.5, 254.5) — see `BOUNDARY_LUT`'s doc comment
// and CASES item 7 above. `k/255` reproduces `k+...` exactly through the
// float32 texture round-trip (verified: `Math.fround(Math.fround(k/255) *
// 255) === k+0.5` for all four values), so any mismatch is the shader's
// rounding choice, not incidental float32/float64 precision noise.
const BOUNDARY_SCALAR_PIXELS: number[][] = [
  [0.5 / 255, 0, 0, 1.0],
  [1.5 / 255, 0, 0, 1.0],
  [127.5 / 255, 0, 0, 1.0],
  [254.5 / 255, 0, 0, 1.0],
];

const uvFull = { x: 0, y: 0, w: 1, h: 1 };

async function runAllCases(device: Device, label: string): Promise<Map<string, CaseResult>> {
  const results = new Map<string, CaseResult>();

  report(true, `[${label}] device.backend = ${device.backend}`);

  const operators = ["linear", "srgb", "reinhard", "aces"];
  for (const op of operators) {
    const caseLabel = `${label}/operator=${op}`;
    const params: ImageParams = { exposureEV: 0, displayOperationId: op, isScalar: false, hdrOut: false, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, GRADIENT_PIXELS, params, undefined));
  }

  {
    const caseLabel = `${label}/nonzero-EV`;
    const params: ImageParams = { exposureEV: 1.5, displayOperationId: "srgb", isScalar: false, hdrOut: false, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, GRADIENT_PIXELS, params, undefined));
  }

  {
    // Scalar + colormap, texel-aligned + `filter:"nearest"` — this pins the
    // NEAREST LUT contract (crisp per-texel color, the pixelated-zoom path). The
    // computeExpectedRGB reference uses the round-half-up nearest index, so
    // forcing `nearest` here keeps it byte-exact; the LINEAR (smooth-zoom) LUT
    // path is covered by the dedicated blend case below.
    const caseLabel = `${label}/scalar+colormap`;
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: "linear",
      isScalar: true,
      hdrOut: false,
      uv: uvFull,
      filter: "nearest",
      colormap: VIRIDIS_FLOAT_LUT,
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SCALAR_PIXELS, params, VIRIDIS_FLOAT_LUT));
  }

  {
    // LUT-index rounding parity boundary case — see CASES item 7 above and
    // BOUNDARY_LUT/BOUNDARY_SCALAR_PIXELS's doc comments. `filter:"nearest"`:
    // the round-half-up index contract is the NEAREST-path (pixelated-zoom)
    // behavior; the LINEAR path deliberately blends adjacent entries instead
    // (see the linear-blend case below).
    const caseLabel = `${label}/lut-rounding-boundary`;
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: "linear",
      isScalar: true,
      hdrOut: false,
      uv: uvFull,
      filter: "nearest",
      colormap: BOUNDARY_LUT,
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, BOUNDARY_SCALAR_PIXELS, params, BOUNDARY_LUT));
  }

  {
    // REGRESSION (colormap-interpolation bug): with a colormap active and
    // `filter:"linear"` (moderate zoom), an output pixel sampled BETWEEN two
    // source texels must be a LUT BLEND, not either texel's exact colormapped
    // color. Before the fix the interpolated scalar snapped to ONE nearest LUT
    // entry, so the false-color image showed blocky per-texel cells even though
    // the plain (non-LUT) path was smooth at the same zoom.
    //
    // Source = 2 texels [127/255, 128/255]; BOUNDARY_LUT is alternating
    // black/white so lut[127]=white(1), lut[128]=black(0) differ maximally. A
    // 3-wide output samples its MIDDLE pixel at source-uv 0.5 → bilinear scalar
    // 127.5/255 → idxF 127.5. LINEAR LUT blends white+black by 0.5 = 0.5. The LUT
    // family writes the sampled DISPLAY value straight to the surface (no
    // re-encode — the shared family / diff-blit convention), so the blend is
    // byte 128 — strictly BETWEEN the two texels' colors (0 and 255). The OLD
    // nearest code returned lut[128]=0 (a solid block).
    const caseLabel = `${label}/scalar+colormap/linear-blends-lut`;
    const src = buildSrcTexture(device, [
      [127 / 255, 0, 0, 1.0],
      [128 / 255, 0, 0, 1.0],
    ]);
    const target = device.createTexture(3, 1, "rgba8unorm");
    renderImage(device, target, src, {
      exposureEV: 0,
      displayOperationId: "linear",
      isScalar: true,
      hdrOut: false,
      uv: uvFull,
      filter: "linear",
      colormap: BOUNDARY_LUT,
    });
    const out = await device.readback(target);
    src.destroy();
    target.destroy();
    let ok = out instanceof Uint8Array;
    if (out instanceof Uint8Array) {
      const mid = out[1 * 4 + 0]!; // middle output pixel, R channel
      const isBlend = mid > 20 && mid < 235; // strictly between black(0) and white(255)
      const nearExpected = Math.abs(mid - 128) <= 3; // 0.5 display blend, written unchanged
      ok = isBlend && nearExpected;
      report(isBlend, `[${caseLabel}] middle pixel is a LUT blend (0<${mid}<255, not a nearest snap)`);
      report(nearExpected, `[${caseLabel}] middle pixel ≈128 (0.5 LUT blend, no re-encode), got ${mid}`);
    } else {
      report(false, `[${caseLabel}] readback should be Uint8Array`);
    }
    results.set(caseLabel, { label: caseLabel, ok, out: out instanceof Uint8Array ? out : null });
  }

  {
    const caseLabel = `${label}/gamma-override`;
    const params: ImageParams = { exposureEV: 0, displayOperationId: "aces", gamma: 2.2, isScalar: false, hdrOut: false, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, GRADIENT_PIXELS, params, undefined));
  }

  // Gamma DISPLAY OPERATOR (tev "Gamma"): operator "gamma" (id 8) is the SAME
  // clamp RANGE-MAP as linear/srgb; the γ power curve `pow(x, 1/γ)` is applied at
  // the output-encode stage via the gamma uniform. Two γ (default 2.2 + a
  // non-default 1.8) — golden 0.5^(1/2.2) ≈ 0.7297 is exercised via the 0.5
  // pixel below (checked GPU-vs-TS through the real outputEncode).
  const GAMMA_PIXELS: number[][] = [
    [0.0, 0.0, 0.0, 1.0],
    [0.25, 0.25, 0.25, 1.0],
    [0.5, 0.5, 0.5, 1.0],
    [1.0, 1.0, 1.0, 1.0],
  ];
  for (const g of [2.2, 1.8]) {
    const caseLabel = `${label}/operator=gamma/γ=${g}`;
    const params: ImageParams = { exposureEV: 0, displayOperationId: "gamma", gamma: g, isScalar: false, hdrOut: false, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, GAMMA_PIXELS, params, undefined));
  }

  {
    // Menu "Linear" = clamp + IDENTITY encode (gamma:1) — the raw-linear/tev
    // gamma-1 look, DISTINCT from "srgb" (which sRGB-encodes). Verifies the
    // renderer's operator→encode mapping (resolveEncodeGamma linear→1).
    const caseLabel = `${label}/operator=linear-identity`;
    const params: ImageParams = { exposureEV: 0, displayOperationId: "linear", gamma: 1, isScalar: false, hdrOut: false, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, GAMMA_PIXELS, params, undefined));
  }

  // 8-BIT DISPLAY-TRANSFER path (srgbDecode:true): the source pixels are sRGB
  // CODE values; the shader sRGB-DECODEs them to linear FIRST, then applies the
  // transfer. SRGB_CODE_PIXELS holds sRGB-encoded gradient values.
  const SRGB_CODE_PIXELS: number[][] = [
    [0.0, 0.0, 0.0, 1.0],
    [0.25, 0.25, 0.25, 1.0],
    [0.5, 0.5, 0.5, 1.0],
    [0.735, 0.735, 0.735, 1.0], // ≈ srgbOetf(0.5)
  ];
  {
    // sRGB transfer on an 8-bit source = decode then re-encode = IDENTITY
    // round-trip (recovers the input sRGB code, within 1/255).
    const caseLabel = `${label}/srgbDecode/operator=srgb-roundtrip`;
    const params: ImageParams = { exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }
  {
    // Gamma transfer on an 8-bit source: sRGB-DECODE → pow(x, 1/γ). CPU/GPU
    // parity through the same srgbEotf + outputEncode.
    const caseLabel = `${label}/srgbDecode/operator=gamma/γ=2.2`;
    const params: ImageParams = { exposureEV: 0, displayOperationId: "gamma", gamma: 2.2, isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }

  // DISPLAY-space post-processing (u_bind14 / cairnDisplayAdjust): the 8-bit
  // `processing` block's brightness/contrast/flipSign, applied as a FINAL affine
  // in the ENCODED display space AFTER the output-encode — the numeric mirror of
  // the CPU SDR pane's CSS filter (audit H1). Each case renders the plain 8-bit
  // path (srgbDecode + operator srgb, an identity sRGB round-trip so the encoded
  // color equals the source code value) and asserts the GPU readback equals
  // computeExpectedRGB — which now applies the REAL applyDisplayAdjust from
  // image/tonemap.ts. Values are chosen to also exercise the [0,1] clamp on both
  // sides (brightness pushes ch>1, contrast pushes ch<0), proving the surface/
  // readback clamp matches CSS rasterization. Deltas relative to the un-processed
  // srgb-roundtrip case above prove the stage is actually WIRED, not ignored.
  {
    const caseLabel = `${label}/processing/brightness`;
    const params: ImageParams = {
      exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull,
      brightness: 0.5, // brightness(1.5): 0.735→1.10 clamps to 1.0 on both sides
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }
  {
    const caseLabel = `${label}/processing/contrast`;
    const params: ImageParams = {
      exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull,
      contrast: 0.5, // contrast(1.5): 0.0→-0.25 clamps to 0 on both sides
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }
  {
    const caseLabel = `${label}/processing/flipSign`;
    const params: ImageParams = {
      exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull,
      flipSign: true, // invert(1): out = 1 - in
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }
  {
    // Combined brightness + contrast + flipSign, applied in list order
    // (brightness → contrast → invert) — pins the STAGE ORDER, not just each knob.
    const caseLabel = `${label}/processing/combined`;
    const params: ImageParams = {
      exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull,
      brightness: 0.2, contrast: 0.3, flipSign: true,
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }
  {
    // Processing on the SCALAR + colormap path (u_bind14 is applied after the LUT
    // sample too — the CPU SDR pane's CSS filter also runs over a colormapped
    // element). brightness=0.25 scales the magma LUT display color; parity via the
    // same applyDisplayAdjust over the LUT reference.
    const caseLabel = `${label}/processing/scalar-colormap-brightness`;
    const params: ImageParams = {
      exposureEV: 0, displayOperationId: "linear", isScalar: true, hdrOut: false, uv: uvFull,
      filter: "nearest", colormap: VIRIDIS_FLOAT_LUT, brightness: 0.25,
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SCALAR_PIXELS, params, VIRIDIS_FLOAT_LUT));
  }
  {
    // IDENTITY GUARD: brightness=0, contrast=0, flipSign=false must reproduce the
    // plain srgb-roundtrip byte-for-byte (the zero-filled default path). Proves the
    // stage is a true no-op when unset, so no existing case shifts.
    const caseLabel = `${label}/processing/identity-is-noop`;
    const params: ImageParams = {
      exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true, uv: uvFull,
      brightness: 0, contrast: 0, flipSign: false,
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, SRGB_CODE_PIXELS, params, undefined));
  }

  {
    // uv viewport window: an 4-pixel source, sample only the sub-rect that
    // covers source column index 2 ([0.5, 0.75) of the [0,1] width), into a
    // 1x1 target — the whole target must read back as pixel[2]'s value.
    const caseLabel = `${label}/uv-window`;
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: "linear",
      isScalar: false,
      hdrOut: false,
      uv: { x: 0.5, y: 0, w: 0.25, h: 1 },
    };
    const src = buildSrcTexture(device, GRADIENT_PIXELS);
    const target = device.createTexture(1, 1, "rgba8unorm");
    renderImage(device, target, src, params);
    const out = await device.readback(target);
    src.destroy();
    target.destroy();
    let ok = out instanceof Uint8Array;
    if (out instanceof Uint8Array) {
      const expected = computeExpectedRGB(GRADIENT_PIXELS[2]!, params);
      for (let c = 0; c < 3; c++) {
        const expectedByte = byteOf(expected[c]!);
        const actualByte = out[c]!;
        const diff = Math.abs(actualByte - expectedByte);
        const chOk = diff <= 1;
        if (!chOk) ok = false;
        report(chOk, `[${caseLabel}] ch[${c}] expected=${expectedByte} actual=${actualByte} (diff=${diff})`);
      }
    } else {
      report(false, `[${caseLabel}] readback() should return Uint8Array, got ${(out as { constructor: { name: string } }).constructor.name}`);
    }
    report(ok, `[${caseLabel}] uv window sampled source column 2 correctly`);
    results.set(caseLabel, { label: caseLabel, ok, out: out instanceof Uint8Array ? out : null });
  }

  {
    const caseLabel = `${label}/hdrOut`;
    const params: ImageParams = { exposureEV: 0.5, displayOperationId: "aces", isScalar: false, hdrOut: true, uv: uvFull };
    const r = await runHdrOutCase(device, caseLabel, GRADIENT_PIXELS, params);
    results.set(caseLabel, r);
  }

  {
    // ENCODE PROOF (the display-profile fix): under hdrOut the render-target must
    // hold TRANSFER-ENCODED values (extended sRGB OETF), NOT raw scene-linear. A
    // single 4.0 pixel with operator "linear" (identity): the render-target
    // reads back extendedSrgbOetf(4)≈1.8248 (encoded, still >1 = extended
    // brightness) — DISTINCT from the raw 4.0. runHdrOutCase already asserts the
    // value equals computeExpectedRGB (now the extended encode); here we ALSO
    // assert it is NOT the raw-linear value.
    const caseLabel = `${label}/hdrOut/encode-proof`;
    const BRIGHT: number[][] = [[4, 4, 4, 1]];
    const encParams: ImageParams = { exposureEV: 0, displayOperationId: "linear", isScalar: false, hdrOut: true, uv: uvFull };
    const encoded = await runHdrOutCase(device, `${caseLabel}/encoded`, BRIGHT, encParams);
    results.set(`${caseLabel}/encoded`, encoded);
    if (encoded.out instanceof Float32Array) {
      const v = encoded.out[0]!;
      const isEncoded = Math.abs(v - 1.8247963) <= 0.01 && Math.abs(v - 4.0) > 1.0;
      report(isEncoded, `[${caseLabel}] hdrOut render-target is ENCODED (${v.toFixed(4)}≈1.8248), NOT raw-linear 4.0`);
      if (!isEncoded) results.set(`${caseLabel}/assert`, { label: caseLabel, ok: false, out: null });
    }
  }

  // Extended HDR operators (peak-parameterized) — hdrOut float target, so
  // values above 1.0 survive. Each is checked GPU-vs-TS through the SAME
  // `applyDisplayCurveIdTriple` the shader's `applyOperator` mirrors, at a
  // non-default peak to exercise the P uniform. GRADIENT_PIXELS includes 3.0
  // (HDR), so extended-reinhard/-aces produce >1 display-linear light; for
  // extended-clamp (managed linear) every gradient value is < 6, so this pins
  // the GPU identity region (the specialized linear pipeline keeps y=x below P).
  for (const op of ["linear", "reinhard", "aces"]) {
    const caseLabel = `${label}/hdrOut/${op}/peak=6`;
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: op,
      isScalar: false,
      hdrOut: true,
      peak: 6,
      uv: uvFull,
    };
    results.set(caseLabel, await runHdrOutCase(device, caseLabel, GRADIENT_PIXELS, params));
  }

  {
    // Extended · Linear (managed) HARD-CEILING region on the GPU: peak=2 so the
    // gradient's 3.0 pixel clips to exactly 2.0 (min(3,2)) while 0/0.25/1 pass
    // through unchanged — proving the shader's `extendedClampCurve` min() runs,
    // not just the identity branch. GPU-vs-TS via the same
    // `applyDisplayCurveIdTriple`.
    const caseLabel = `${label}/hdrOut/extended-clamp/peak=2-ceiling`;
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: "linear",
      isScalar: false,
      hdrOut: true,
      peak: 2,
      uv: uvFull,
    };
    results.set(caseLabel, await runHdrOutCase(device, caseLabel, GRADIENT_PIXELS, params));
  }

  {
    // SDR-preview of an extended roll-off operator: hdrOut:false so the shader's
    // output-encode runs, producing clamped SDR bytes (the "preview the SDR
    // rendition on an HDR display" path).
    const caseLabel = `${label}/extended-aces-sdr-preview/peak=4`;
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: "aces",
      isScalar: false,
      hdrOut: false,
      peak: 4,
      uv: uvFull,
    };
    results.set(caseLabel, await runByteCaseAsync(device, caseLabel, GRADIENT_PIXELS, params, undefined));
  }

  // ---------------------------------------------------------------------
  // Q18: out-of-bounds (zoomed OUT past the image) -> fully transparent,
  // NOT the old clamped-edge smear. A zoomed-out `uv` window (`w`/`h` > 1,
  // `x`/`y` < 0) samples a 2-pixel source into a 4-pixel target: pixel 0
  // (fully outside [0,1] on the left) must read back alpha=0 AND rgb=0 (the
  // shader's `vec4(0.0)` early-return, not clamp-to-edge repeating pixel 0's
  // color); pixels 1-2 land inside [0,1] and must be non-transparent.
  // ---------------------------------------------------------------------
  {
    const caseLabel = `${label}/oob-transparent`;
    const pixels = [
      [1.0, 0.0, 0.0, 1.0], // red
      [0.0, 1.0, 0.0, 1.0], // green
    ];
    const src = buildSrcTexture(device, pixels);
    const target = device.createTexture(4, 1, "rgba8unorm");
    // uv window: x=-1, w=2 -> covers source-space [-1,1] across a 4-wide
    // target (each target texel = 0.5 source-space wide). Target texel 0
    // covers source-space [-1,-0.5] (fully OOB); texel 3 covers [0.5,1]
    // (fully OOB on the right, since [0,1) is the in-bounds half-open range
    // and srcUV==1.0 is out); texels 1-2 cover [-0.5,0.5) -> in-bounds
    // (texel 1 samples the negative half but its OWN fragment uv lands at
    // 0.25/0.75 of the window which maps inside [0,1) — see per-fragment
    // math below).
    const params: ImageParams = { exposureEV: 0, displayOperationId: "linear", isScalar: false, hdrOut: false, uv: { x: -1, y: 0, w: 2, h: 1 } };
    renderImage(device, target, src, params);
    const out = await device.readback(target);
    src.destroy();
    target.destroy();
    let ok = out instanceof Uint8Array;
    if (out instanceof Uint8Array) {
      // Fragment i's uv.x = (i+0.5)/4; srcUV.x = -1 + uv.x*2.
      //   i=0: uv.x=0.125 -> srcUV.x=-0.75 (OOB, < 0)
      //   i=1: uv.x=0.375 -> srcUV.x=-0.25 (OOB, < 0)
      //   i=2: uv.x=0.625 -> srcUV.x= 0.25 (in bounds)
      //   i=3: uv.x=0.875 -> srcUV.x= 0.75 (in bounds)
      const expectOOB = [true, true, false, false];
      for (let i = 0; i < 4; i++) {
        const a = out[i * 4 + 3]!;
        const isTransparent = a === 0;
        const chOk = isTransparent === expectOOB[i];
        if (!chOk) ok = false;
        report(
          chOk,
          `[${caseLabel}] texel[${i}] alpha=${a} expected ${expectOOB[i] ? "transparent (0)" : "opaque (255)"}`,
        );
        if (!expectOOB[i]) {
          // In-bounds texels must also carry non-zero RGB (not the OOB
          // vec4(0.0) early-return's zeroed color channels either).
          const rgbSum = out[i * 4]! + out[i * 4 + 1]! + out[i * 4 + 2]!;
          const rgbOk = rgbSum > 0;
          if (!rgbOk) ok = false;
          report(rgbOk, `[${caseLabel}] texel[${i}] in-bounds rgb sum=${rgbSum} expected >0`);
        }
      }
    } else {
      report(false, `[${caseLabel}] readback() should return Uint8Array, got ${(out as { constructor: { name: string } }).constructor.name}`);
    }
    report(ok, `[${caseLabel}] zoomed-out OOB texels are fully transparent, in-bounds texels are not`);
    results.set(caseLabel, { label: caseLabel, ok, out: out instanceof Uint8Array ? out : null });
  }

  // ---------------------------------------------------------------------
  // Source alpha survives the display pipeline. The render target is configured
  // for premultiplied-alpha presentation, so RGB must be multiplied by alpha
  // while the alpha channel itself remains the source coverage value.
  // ---------------------------------------------------------------------
  {
    const caseLabel = `${label}/source-alpha-premultiplied`;
    const pixels = [
      [1.0, 0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0, 0.5],
      [0.0, 0.0, 1.0, 1.0],
    ];
    const src = buildSrcTexture(device, pixels);
    const target = device.createTexture(3, 1, "rgba8unorm");
    const params: ImageParams = { exposureEV: 0, displayOperationId: "linear", isScalar: false, hdrOut: false, uv: uvFull };
    renderImage(device, target, src, params);
    const out = await device.readback(target);
    src.destroy();
    target.destroy();
    let ok = out instanceof Uint8Array;
    if (out instanceof Uint8Array) {
      const expected = [
        [0, 0, 0, 0],
        [0, 128, 0, 128],
        [0, 0, 255, 255],
      ];
      for (let i = 0; i < expected.length; i++) {
        for (let c = 0; c < 4; c++) {
          const diff = Math.abs(out[i * 4 + c]! - expected[i]![c]!);
          const chOk = diff <= 1;
          if (!chOk) ok = false;
          report(chOk, `[${caseLabel}] pixel[${i}].rgba[${c}] expected=${expected[i]![c]} actual=${out[i * 4 + c]} diff=${diff}`);
        }
      }
    } else {
      report(false, `[${caseLabel}] readback() should return Uint8Array, got ${(out as { constructor: { name: string } }).constructor.name}`);
    }
    report(ok, `[${caseLabel}] source alpha is preserved and RGB is premultiplied`);
    results.set(caseLabel, { label: caseLabel, ok, out: out instanceof Uint8Array ? out : null });
  }

  // ---------------------------------------------------------------------
  // Q20: filter:"nearest" vs filter:"linear" produce DIFFERENT results at a
  // non-texel-aligned sample point over a sharp black/white step, and
  // "linear" produces a blended midtone while "nearest" produces a pure
  // black-or-white value (no interpolation) — proving the shader actually
  // switched sampling modes, not just accepted-and-ignored the uniform.
  // ---------------------------------------------------------------------
  {
    const caseLabel = `${label}/filter-nearest-vs-linear`;
    const stepPixels = [
      [0.0, 0.0, 0.0, 1.0], // texel 0: black
      [1.0, 1.0, 1.0, 1.0], // texel 1: white
    ];
    const src = buildSrcTexture(device, stepPixels);
    // 1x1 target, uv window covering the WHOLE source (x=0,w=1): the single
    // fragment's uv.x=0.5 -> srcUV.x=0.5 -> texel-space coordinate
    // 0.5*2-0.5=0.5 -> exactly halfway between texel 0 and texel 1 (frac=0.5)
    // for bilinear, vs. floor(0.5*2)=1 (texel 1, white) for nearest.
    const uv = { x: 0, y: 0, w: 1, h: 1 };
    for (const filter of ["nearest", "linear"] as const) {
      const target = device.createTexture(1, 1, "rgba8unorm");
      // gamma:1 makes output-encode an identity (pow(x,1)=x) instead of the
      // sRGB OETF, so the bilinear-blended 0.5 raw sample survives to the
      // readback as ~127/255 unchanged — isolating the SAMPLING behavior
      // this case tests from the (unrelated, already-covered-elsewhere)
      // output-encode curve.
      const params: ImageParams = { exposureEV: 0, displayOperationId: "linear", gamma: 1, isScalar: false, hdrOut: false, uv, filter };
      renderImage(device, target, src, params);
      const out = await device.readback(target);
      target.destroy();
      if (!(out instanceof Uint8Array)) {
        report(false, `[${caseLabel}/${filter}] readback() should return Uint8Array`);
        results.set(`${caseLabel}/${filter}`, { label: caseLabel, ok: false, out: null });
        continue;
      }
      const v = out[0]!;
      const ok =
        filter === "nearest"
          ? v <= 5 || v >= 250 // pure black or white, no blend
          : Math.abs(v - 127) <= 10; // ~50% blend of black+white
      report(ok, `[${caseLabel}/${filter}] value=${v} expected ${filter === "nearest" ? "pure black/white (no blend)" : "~127 (50% blend)"}`);
      results.set(`${caseLabel}/${filter}`, { label: caseLabel, ok, out });
    }
    src.destroy();
  }

  // Interactive hot path: once a canvas-surface display binding is warm, an
  // exposure-only update must write uniforms and draw without allocating any
  // texture/bind group or compiling another pipeline.
  {
    const caseLabel = `${label}/exposure-retains-display-resources`;
    const canvas = document.createElement("canvas");
    const surface = device.createSurface(canvas, { hdr: false });
    surface.configure(8, 8);
    const src = buildSrcTexture(device, [[0.25, 0.25, 0.25, 1]]);
    const params: ImageParams = {
      exposureEV: 0,
      displayOperationId: "turbo",
      colormap: VIRIDIS_FLOAT_LUT,
      isScalar: true,
      hdrOut: false,
      uv: { x: 0, y: 0, w: 1, h: 1 },
    };
    const originalTexture = device.createTexture;
    const originalPipeline = device.createRenderPipeline;
    const originalBindGroup = device.createBindGroup;
    let textures = 0;
    let pipelines = 0;
    let bindGroups = 0;
    device.createTexture = (...args) => {
      textures++;
      return originalTexture.call(device, ...args);
    };
    device.createRenderPipeline = (...args) => {
      pipelines++;
      return originalPipeline.call(device, ...args);
    };
    device.createBindGroup = (...args) => {
      bindGroups++;
      return originalBindGroup.call(device, ...args);
    };
    let ok = false;
    try {
      renderImage(device, surface, src, params);
      const warm = { textures, pipelines, bindGroups };
      renderImage(device, surface, src, { ...params, exposureEV: 1.5 });
      ok = textures === warm.textures && pipelines === warm.pipelines && bindGroups === warm.bindGroups;
      report(ok, `[${caseLabel}] exposure update allocations textures=${textures - warm.textures}, pipelines=${pipelines - warm.pipelines}, bindGroups=${bindGroups - warm.bindGroups}`);
    } finally {
      device.createTexture = originalTexture;
      device.createRenderPipeline = originalPipeline;
      device.createBindGroup = originalBindGroup;
      releaseImageRenderState(surface);
      src.destroy();
    }
    results.set(caseLabel, { label: caseLabel, ok, out: null });
  }

  return results;
}

function allResultsOk(results: Map<string, CaseResult>): boolean {
  for (const r of results.values()) if (!r.ok) return false;
  return true;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedWebGpuDevice();
    const results = await runAllCases(device, "shared");
    const sharedOk = allResultsOk(results);

    setOverallStatus(sharedOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
