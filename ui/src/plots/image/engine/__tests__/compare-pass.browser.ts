/**
 * COMPOSE (split/blend) + cached-diff + metrics harness (WebGPU, driven via
 * claude-in-chrome — jsdom has no WebGPU). Updated for the diff-kernel spec:
 * split/blend go through `renderCompose` (the switch-free specialized
 * pipelines); diff goes through the cached kernel path
 * (`computeDiff` → `renderDiffDisplay`); metrics through `computeMetrics`.
 *
 * ## A/B-role reference (unchanged intent)
 * `PIXELS_REF` = reference/baseline (texA — split left / blend alpha=0 / diff
 * `a` operand); `PIXELS_FG` = foreground (texB). References are derived from the
 * LEGACY semantics (compositor.tsx split/blend; image/webgl-diff.ts diff `a`),
 * NOT from mirroring the shader, and a SWAP GUARD asserts asymmetric cases
 * disagree when texRef/texFg are swapped.
 *
 * ## Diff is now RAW (spec): computed on raw source texels, display-mapped at
 * blit time (no per-side exposure/tonemap in the diff path) — so the diff
 * reference here is `displayMap(kernel(rawRef, rawFg))`, independent of the
 * operator.
 *
 * RUNNING: bundle with esbuild, serve over http, open compare-pass.browser.html
 * (see the sibling *.browser.ts for the exact commands).
 */
import { getSharedWebGpuDevice } from "../webgpu/device-provider.ts";
import { renderCompose, renderImage, computeMetrics, type CompareParams, type ImageParams } from "../image-engine";
import { computeDiff, displayRangeForOperation, renderDiffDisplay } from "../diff-engine";
import { getImageOperation } from "../../model/operations/index.ts";
import { applyExposure, outputEncode, extendedOutputEncode, type RgbTriple } from "../../model/tonemap";
import { getDisplayOperation, DEFAULT_ENCODE_PARAMS, computeDataIndex, signedAnalyticColor, type NormMode } from "../../model/display-operations/index";
import { colormapFloatLUT } from "../../../../settings/colormaps/index";
import type { Device, Texture } from "../webgpu/device-contract";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "COMPARE PASS", resultFlag: "__comparePassTestResult" });

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const byteOf = (x: number): number => Math.round(clamp01(x) * 255);

function processSide(px: number[], params: CompareParams): RgbTriple {
  const exposed: RgbTriple = [
    applyExposure(px[0]!, params.exposureEV),
    applyExposure(px[1]!, params.exposureEV),
    applyExposure(px[2]!, params.exposureEV),
  ];
  // Apply the operator CURVE straight from the registry (the CPU source of truth
  // the GPU `applyOperator` mirrors); compose only uses the plain SDR curves, so
  // an unknown operator falls back to the srgb clamp.
  const opEnc = getDisplayOperation(params.displayOperationId)!;
  const toned = opEnc.cpu(exposed, 3, DEFAULT_ENCODE_PARAMS);
  return [outputEncode(toned[0], params.gamma), outputEncode(toned[1], params.gamma), outputEncode(toned[2], params.gamma)];
}

function expectedComposePixel(pxRef: number[], pxFg: number[], uvX: number, params: CompareParams): RgbTriple {
  const refColor = processSide(pxRef, params);
  const fgColor = processSide(pxFg, params);
  if (params.mode === "blend") {
    return [
      refColor[0] + (fgColor[0] - refColor[0]) * params.alpha,
      refColor[1] + (fgColor[1] - refColor[1]) * params.alpha,
      refColor[2] + (fgColor[2] - refColor[2]) * params.alpha,
    ];
  }
  return uvX < params.split ? refColor : fgColor;
}

function buildRowTexture(device: Device, pixels: number[][]): Texture {
  const width = pixels.length;
  const tex = device.createTexture(width, 1, "rgba32float");
  const data = new Float32Array(width * 4);
  for (let i = 0; i < pixels.length; i++) data.set(pixels[i]!, i * 4);
  tex.write(data);
  return tex;
}

const PIXELS_REF: number[][] = [
  [0.0, 0.1, 0.2, 1.0],
  [0.3, 0.4, 0.5, 1.0],
  [0.6, 0.7, 0.8, 1.0],
  [1.0, 1.2, 0.9, 1.0],
];
const PIXELS_FG: number[][] = [
  [0.2, 0.2, 0.2, 1.0],
  [0.1, 0.5, 0.3, 1.0],
  [0.9, 0.4, 0.7, 1.0],
  [0.5, 0.5, 0.5, 1.0],
];
const WIDTH = PIXELS_REF.length;
const uvXOfCol = (i: number): number => (i + 0.5) / WIDTH;
const uvFull = { x: 0, y: 0, w: 1, h: 1 };
const BASE: Omit<CompareParams, "mode" | "split" | "alpha"> = {
  exposureEV: 0,
  displayOperationId: "srgb",
  isScalar: false,
  hdrOut: false,
  uv: uvFull,
};

async function runComposeCase(device: Device, label: string, params: CompareParams, swapped = false): Promise<boolean> {
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const target = device.createTexture(WIDTH, 1, "rgba8unorm");
  if (swapped) renderCompose(device, target, texFg, texRef, params);
  else renderCompose(device, target, texRef, texFg, params);
  const out = await device.readback(target);
  texRef.destroy();
  texFg.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[${label}] readback should be Uint8Array`);
    return false;
  }
  let allOk = true;
  for (let i = 0; i < WIDTH; i++) {
    const expected = expectedComposePixel(PIXELS_REF[i]!, PIXELS_FG[i]!, uvXOfCol(i), params);
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(out[i * 4 + c]! - byteOf(expected[c]!));
      if (diff > 1) {
        allOk = false;
        report(false, `[${label}] px[${i}].ch[${c}] diff=${diff}`);
      }
    }
  }
  report(allOk, `[${label}] all pixels within 1/255 of legacy-derived reference`);
  return allOk;
}

async function runSwapGuardCase(device: Device, label: string, params: CompareParams): Promise<boolean> {
  const disagreed = !(await runComposeCase(device, `${label} [SWAP GUARD]`, params, true));
  report(disagreed, `[${label}] swapped texRef/texFg DISAGREES with reference`);
  return disagreed;
}

// ---- diff (cached kernel path) --------------------------------------------
/** RAW diff (matches the pointwise kernels), then displayRange map (no
 *  colormap). `a` = reference/baseline. */
function expectedDiffPixel(pxRef: number[], pxFg: number[], operationId: string): RgbTriple {
  const range = displayRangeForOperation(getImageOperation(operationId)!.outputRange);
  const out: number[] = [];
  for (let c = 0; c < 3; c++) {
    const a = pxRef[c]!;
    const b = pxFg[c]!;
    const denom = Math.max(a, 1 / 255);
    let raw: number;
    switch (operationId) {
      case "signed": raw = a - b; break;
      case "absolute": raw = Math.abs(a - b); break;
      case "squared": raw = (a - b) * (a - b); break;
      case "relative_signed": raw = (a - b) / denom; break;
      case "relative_absolute": raw = Math.abs(a - b) / denom; break;
      case "relative_squared": raw = ((a - b) * (a - b)) / (denom * denom); break;
      default: raw = Math.abs(a - b);
    }
    const disp = range === "signed" || range === "relative" ? (raw + 1) / 2 : raw;
    out.push(clamp01(disp));
  }
  return out as unknown as RgbTriple;
}

async function runDiffCase(device: Device, operationId: string): Promise<boolean> {
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const result = computeDiff(device, texRef, texFg, operationId);
  const target = device.createTexture(WIDTH, 1, "rgba8unorm");
  const range = displayRangeForOperation(getImageOperation(operationId)!.outputRange);
  renderDiffDisplay(device, target, result, range, { uv: uvFull });
  const out = await device.readback(target);
  texRef.destroy();
  texFg.destroy();
  result.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[diff/${operationId}] readback should be Uint8Array`);
    return false;
  }
  let allOk = true;
  for (let i = 0; i < WIDTH; i++) {
    const expected = expectedDiffPixel(PIXELS_REF[i]!, PIXELS_FG[i]!, operationId);
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(out[i * 4 + c]! - byteOf(expected[c]!));
      if (diff > 2) {
        allOk = false;
        report(false, `[diff/${operationId}] px[${i}].ch[${c}] expected=${byteOf(expected[c]!)} actual=${out[i * 4 + c]}`);
      }
    }
  }
  report(allOk, `[diff/${operationId}] all pixels within 2/255 of raw-diff reference`);
  return allOk;
}

// ---- diff DISPLAY colormap NORM parity (compare-pane-on-DISPLAY follow-up) --
// `renderDiffDisplay` now threads the DATA-encoding NORM (linear/log/power)
// through the SAME `cairnDataIndex` the image LUT path uses, before the colormap
// LUT. Prove the GPU diff-display colormap index === the CPU `computeDataIndex`
// twin: build an ABSOLUTE-error diff (unit range), blit it through a magma LUT
// (cmapMode `linear`, nearest) with each norm, and compare each pixel to a
// hand-rolled reference (clamp → avg → computeDataIndex → nearest float-LUT tap).
const MAGMA_LUT = colormapFloatLUT("magma");
/** Nearest float-LUT tap — mirrors the WGSL `cairnLutSampleNearest`
 *  (round-half-up index), reading the SAME `colormapFloatLUT` the GPU binds. */
function lutNearest(t: number): [number, number, number] {
  const row = Math.min(255, Math.max(0, Math.floor(clamp01(t) * 255 + 0.5)));
  return [MAGMA_LUT[row * 4]!, MAGMA_LUT[row * 4 + 1]!, MAGMA_LUT[row * 4 + 2]!];
}
async function runDiffDisplayNormCase(device: Device, norm: NormMode, gamma: number): Promise<boolean> {
  const operationId = "absolute"; // unit displayRange → disp = clamp01(raw)
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const result = computeDiff(device, texRef, texFg, operationId);
  const target = device.createTexture(WIDTH, 1, "rgba8unorm");
  renderDiffDisplay(device, target, result, "unit", {
    uv: uvFull,
    cmapMode: "linear",
    colormap: MAGMA_LUT,
    filter: "nearest",
    norm,
    ...(norm === "power" ? { gamma } : {}),
  });
  const out = await device.readback(target);
  texRef.destroy();
  texFg.destroy();
  result.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[diff-display/norm=${norm}] readback should be Uint8Array`);
    return false;
  }
  const p = { ...DEFAULT_ENCODE_PARAMS, norm, gamma };
  let allOk = true;
  for (let i = 0; i < WIDTH; i++) {
    let avg = 0;
    for (let c = 0; c < 3; c++) avg += clamp01(Math.abs(PIXELS_REF[i]![c]! - PIXELS_FG[i]![c]!));
    avg /= 3;
    const idx = computeDataIndex(avg, p);
    const rgb = lutNearest(idx);
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(out[i * 4 + c]! - byteOf(rgb[c]!));
      if (d > 2) {
        allOk = false;
        report(false, `[diff-display/norm=${norm}] px[${i}].ch[${c}] expected=${byteOf(rgb[c]!)} actual=${out[i * 4 + c]}`);
      }
    }
  }
  report(allOk, `[diff-display/norm=${norm}${norm === "power" ? `@${gamma}` : ""}] GPU colormap index === cpu computeDataIndex twin`);
  return allOk;
}

// ---- diff DISPLAY ANALYTIC parity (tev-style signed red-green follow-up) -----
// `renderDiffDisplay` with `analytic:true` COMPUTES the signed color from the RAW
// metric (mean over channels — tev's average(col)), BYPASSING the (v+1)/2 fold +
// clamp + LUT, then output-encodes. Prove the GPU === the CPU twin
// (signedAnalyticColor + outputEncode/extendedOutputEncode) on BOTH surfaces: SDR
// (clamps) and HDR (|v|>1 survives — row 3's mean error 0.53 → green 1.07).
async function runDiffDisplayAnalyticCase(device: Device, hdrOut: boolean): Promise<boolean> {
  const operationId = "signed"; // result stores raw a-b per channel (signed range)
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const result = computeDiff(device, texRef, texFg, operationId);
  const target = device.createTexture(WIDTH, 1, hdrOut ? "rgba16float" : "rgba8unorm");
  renderDiffDisplay(device, target, result, "signed", {
    uv: uvFull,
    analytic: true,
    filter: "nearest",
  });
  const out = await device.readback(target);
  texRef.destroy();
  texFg.destroy();
  result.destroy();
  target.destroy();
  let allOk = true;
  for (let i = 0; i < WIDTH; i++) {
    let sAvg = 0;
    for (let c = 0; c < 3; c++) sAvg += PIXELS_REF[i]![c]! - PIXELS_FG[i]![c]!;
    sAvg /= 3;
    const lin = signedAnalyticColor(sAvg);
    for (let c = 0; c < 3; c++) {
      const exp = hdrOut ? extendedOutputEncode(lin[c]!, undefined) : outputEncode(lin[c]!, undefined);
      const actual = out[i * 4 + c]!;
      const d = hdrOut ? Math.abs(actual - exp) : Math.abs(actual - byteOf(exp));
      if (d > (hdrOut ? 0.01 : 2)) {
        allOk = false;
        report(false, `[diff-display/analytic${hdrOut ? "-hdr" : ""}] px[${i}].ch[${c}] expected=${hdrOut ? exp.toFixed(4) : byteOf(exp)} actual=${actual}`);
      }
    }
  }
  report(allOk, `[diff-display/analytic${hdrOut ? "-hdr" : ""}] GPU cairnSignedAnalyticColor === cpu twin${hdrOut ? " (>1 survives)" : ""}`);
  return allOk;
}

// ---- diff DISPLAY LINEAR SCALAR (HDR-native) parity (scalar-none follow-up) -------
// The diff `None` (no false-color, raw per-channel) is the compare-pane twin of the
// single-image linear scalar path. On an HDR target the FOLDED value now rides the
// SHARED extended output-encode (so |v|>1 survives) instead of writing raw-clamped;
// on SDR it stays byte-identical (covered by runDiffCase). Prove the GPU HDR path
// === the CPU twin (extendedOutputEncode of the folded value).
async function runDiffDisplayGrayNoneHdrCase(device: Device): Promise<boolean> {
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const result = computeDiff(device, texRef, texFg, "signed");
  const target = device.createTexture(WIDTH, 1, "rgba16float");
  renderDiffDisplay(device, target, result, "signed", { uv: uvFull, filter: "nearest" });
  const out = await device.readback(target);
  texRef.destroy();
  texFg.destroy();
  result.destroy();
  target.destroy();
  let allOk = true;
  for (let i = 0; i < WIDTH; i++) {
    for (let c = 0; c < 3; c++) {
      const raw = PIXELS_REF[i]![c]! - PIXELS_FG[i]![c]!;
      const folded = (raw + 1) / 2; // signed displayRange fold, UNCLAMPED on HDR
      const exp = extendedOutputEncode(folded, undefined);
      const actual = out[i * 4 + c]!;
      if (Math.abs(actual - exp) > 0.01) {
        allOk = false;
        report(false, `[diff-display/none-hdr] px[${i}].ch[${c}] expected=${exp.toFixed(4)} actual=${actual.toFixed(4)}`);
      }
    }
  }
  report(allOk, `[diff-display/none-hdr] GPU raw diff === cpu extendedOutputEncode twin`);
  return allOk;
}

function cpuMetrics(a: number[][], b: number[][]): { mse: number; psnr: number; mae: number } {
  let sumSq = 0;
  let sumAbs = 0;
  const n = a.length * 3;
  for (let i = 0; i < a.length; i++)
    for (let c = 0; c < 3; c++) {
      const d = a[i]![c]! - b[i]![c]!;
      sumSq += d * d;
      sumAbs += Math.abs(d);
    }
  const mse = sumSq / n;
  return { mse, mae: sumAbs / n, psnr: mse <= 0 ? Infinity : 10 * Math.log10(1 / mse) };
}

async function runMetricsCase(device: Device): Promise<boolean> {
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const got = await computeMetrics(device, texRef, texFg);
  texRef.destroy();
  texFg.destroy();
  const ref = cpuMetrics(PIXELS_REF, PIXELS_FG);
  const ok = Math.abs(got.mse - ref.mse) <= 1e-4 && Math.abs(got.mae - ref.mae) <= 1e-4;
  report(ok, `[metrics] mse gpu=${got.mse.toFixed(6)} cpu=${ref.mse.toFixed(6)}`);
  return ok;
}

// ---- §A UNIFIED TONE-MAP: compose == single-pane parity --------------------
/**
 * The core §A proof: the split/blend COMPOSE pass applies the unified tone-map
 * operator EXACTLY as the single-image `renderImage` pass does. GPU-vs-GPU (no
 * CPU reference): render the foreground operand through `renderImage`, and
 * through `renderCompose` with `split:0` (uv.x<0 is false everywhere → the whole
 * frame shows colorB = the foreground), and assert byte-identical output. Covers
 * SDR operators, an extended HDR-out operator (rgba16float target), and the
 * sRGB-DECODE path (a u8-style operand decoded to linear) — the exact pipeline a
 * compare pane now runs. `imageParams.srgbDecode` maps to the compose side's
 * per-side `srgbDecodeB` so the two paths decode identically.
 */
async function runComposeEqualsSinglePane(
  device: Device,
  label: string,
  imageParams: Omit<ImageParams, "uv">,
  hdrTarget: boolean,
): Promise<boolean> {
  const texRef = buildRowTexture(device, PIXELS_REF); // ignored at split:0
  const texFg = buildRowTexture(device, PIXELS_FG);
  const fmt = hdrTarget ? "rgba16float" : "rgba8unorm";
  const targetImg = device.createTexture(WIDTH, 1, fmt);
  const targetCompose = device.createTexture(WIDTH, 1, fmt);
  const ip: ImageParams = { ...imageParams, uv: uvFull };
  renderImage(device, targetImg, texFg, ip);
  const cp: CompareParams = {
    ...imageParams,
    uv: uvFull,
    mode: "split",
    split: 0, // all foreground (colorB)
    alpha: 1,
    srgbDecodeB: imageParams.srgbDecode,
  };
  renderCompose(device, targetCompose, texRef, texFg, cp);
  const a = await device.readback(targetImg);
  const b = await device.readback(targetCompose);
  texRef.destroy();
  texFg.destroy();
  targetImg.destroy();
  targetCompose.destroy();
  let allOk = true;
  const tol = hdrTarget ? 0.01 : 1;
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    if (diff > tol) {
      allOk = false;
      report(false, `[${label}] idx ${i}: image=${a[i]} compose=${b[i]} diff=${diff}`);
    }
  }
  report(allOk, `[${label}] compose(split:0) === single-pane renderImage — operator applied identically`);
  return allOk;
}

async function runAll(device: Device): Promise<boolean> {
  report(true, `device.backend = ${device.backend}`);
  let ok = true;
  for (const split of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    ok = (await runComposeCase(device, `split@${split}`, { ...BASE, mode: "split", split, alpha: 0.5 })) && ok;
  }
  for (const alpha of [0.0, 0.25, 0.5, 1.0]) {
    ok = (await runComposeCase(device, `blend@${alpha}`, { ...BASE, mode: "blend", split: 0.5, alpha })) && ok;
  }
  // §A: the compose pass tone-maps identically to the single-image pass.
  ok = (await runComposeEqualsSinglePane(device, "unify/srgb", { exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false }, false)) && ok;
  ok = (await runComposeEqualsSinglePane(device, "unify/reinhard@EV1", { exposureEV: 1, displayOperationId: "reinhard", isScalar: false, hdrOut: false }, false)) && ok;
  ok = (await runComposeEqualsSinglePane(device, "unify/aces", { exposureEV: 0, displayOperationId: "aces", isScalar: false, hdrOut: false }, false)) && ok;
  ok = (await runComposeEqualsSinglePane(device, "unify/srgb+decode", { exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, srgbDecode: true }, false)) && ok;
  if (device.capabilities.hdr) {
    ok = (await runComposeEqualsSinglePane(device, "unify/extended-clamp@EV1/hdrOut", { exposureEV: 1, displayOperationId: "extended-clamp", isScalar: false, hdrOut: true, peak: 4 }, true)) && ok;
    ok = (await runComposeEqualsSinglePane(device, "unify/extended-reinhard/hdrOut", { exposureEV: 0, displayOperationId: "extended-reinhard", isScalar: false, hdrOut: true, peak: 4 }, true)) && ok;
    // §B on the compose path: a u8-style operand decoded to linear, extended out.
    ok = (await runComposeEqualsSinglePane(device, "unify/extended-clamp+decode@EV1/hdrOut", { exposureEV: 1, displayOperationId: "extended-clamp", isScalar: false, hdrOut: true, peak: 4, srgbDecode: true }, true)) && ok;
  }
  for (const k of ["signed", "absolute", "squared", "relative_signed", "relative_absolute", "relative_squared"]) {
    ok = (await runDiffCase(device, k)) && ok;
  }
  // Diff-display colormap NORM parity (linear must reproduce the pre-follow-up
  // behavior; log/power exercise the newly-threaded cairnDataIndex).
  ok = (await runDiffDisplayNormCase(device, "linear", 1)) && ok;
  ok = (await runDiffDisplayNormCase(device, "log", 1)) && ok;
  ok = (await runDiffDisplayNormCase(device, "power", 2)) && ok;
  ok = (await runDiffDisplayNormCase(device, "power", 0.5)) && ok;
  // Diff-display ANALYTIC (tev-style signed red-green): SDR (clamps) + HDR (>1).
  ok = (await runDiffDisplayAnalyticCase(device, false)) && ok;
  if (device.capabilities.hdr) {
    ok = (await runDiffDisplayAnalyticCase(device, true)) && ok;
    // Diff-display LINEAR SCALAR HDR-native (the scalar-none follow-up): raw diff rides
    // the extended output-encode so over-range survives (SDR covered by runDiffCase).
    ok = (await runDiffDisplayGrayNoneHdrCase(device)) && ok;
  }
  ok = (await runMetricsCase(device)) && ok;
  ok = (await runSwapGuardCase(device, "split@0.25", { ...BASE, mode: "split", split: 0.25, alpha: 0.5 })) && ok;
  ok = (await runSwapGuardCase(device, "blend@0.25", { ...BASE, mode: "blend", split: 0.5, alpha: 0.25 })) && ok;
  return ok;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedWebGpuDevice();
    setOverallStatus(await runAll(device));
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
