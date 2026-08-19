/**
 * DISPLAY-ENCODING REGISTRY GPU↔CPU parity harness (Phase 1 — curves).
 *
 * jsdom has no WebGPU, so — like every `*.browser.ts` harness here — this is a
 * browser page driven headlessly by `scripts/test-harness.mjs` (it lives under
 * `engine/__tests__/`, so the runner treats it as a parity proof and runs it by
 * default). It sets `#status` to PASS/FAIL.
 *
 * WHAT IT PROVES (mechanically, by ITERATING the registry). For EVERY encoding
 * in `image/encodings`, it renders a small float image through the REAL GPU path
 * (`renderImage` → the shader's registry-ASSEMBLED `applyOperator`) and asserts
 * the readback equals the encoding's own `cpu()` twin threaded through the shared
 * exposure + output-encode stages — the same functions the CPU renderer uses.
 * So `cpu` and `wgsl` (which live on ONE registry object) are checked to agree,
 * across the whole set, by construction. Non-HDR encodings render to an
 * `rgba8unorm` target (byte-exact within 1/255); the `extended*` encodings need
 * the HDR surface, so they render to an `rgba32float` target (float, looser eps).
 */
import { getSharedDevice } from "../device";
import { renderImage, type ImageParams, type ImageOperator } from "../image-engine";
import {
  applyExposure,
  outputEncode,
  extendedOutputEncode,
  resolveEncodeGamma,
  TONEMAP_GAMMA_DEFAULT,
  type RgbTriple,
} from "../../image/tonemap";
import {
  listEncodings,
  DEFAULT_ENCODE_PARAMS,
  type DisplayEncoding,
  type EncodeParams,
  type NormMode,
} from "../../image/encodings/index";
import { colormapFloatLUT } from "../../colormaps/lut";
import type { ColormapName } from "../../colormaps/lut";
import type { Device, Texture } from "../types";

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "green" : "red";
    el.appendChild(p);
  }
}

function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  document.title = pass ? "ENCODING REGISTRY PASS" : "ENCODING REGISTRY FAIL";
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const byteOf = (x: number): number => Math.round(clamp01(x) * 255);

/** Non-default PEAK to exercise the peak-parameterized curves' P uniform. */
const HARNESS_PEAK = 6;
const EV = 0; // keep exposure at identity: nonzero EV is covered by image-pass.

function buildSrcTexture(device: Device, pixels: number[][]): Texture {
  const tex = device.createTexture(pixels.length, 1, "rgba32float");
  const data = new Float32Array(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) data.set(pixels[i]!, i * 4);
  tex.write(data);
  return tex;
}

/** Scene-linear gradient incl. an HDR value (>1) — for the per-channel curves. */
const GRADIENT_PIXELS: number[][] = [
  [0.0, 0.0, 0.0, 1.0],
  [0.25, 0.5, 0.75, 1.0],
  [1.0, 1.0, 1.0, 1.0],
  [3.0, 2.0, 4.0, 1.0],
];

/** Signed values — normal-map territory ([-1,1] → [0,1]). */
const SIGNED_PIXELS: number[][] = [
  [-1.0, -0.5, 0.0, 1.0],
  [-0.25, 0.0, 0.25, 1.0],
  [0.5, 0.75, 1.0, 1.0],
  [1.0, -1.0, 0.5, 1.0],
];

/** SCALAR values — the LUT family reads channel 0. Spans [0,1] plus an
 *  over-range value (clamps to the last LUT row) so the whole ramp is exercised. */
const SCALAR_PIXELS: number[][] = [
  [0.0, 0, 0, 1.0],
  [0.2, 0, 0, 1.0],
  [0.5, 0, 0, 1.0],
  [0.8, 0, 0, 1.0],
  [1.0, 0, 0, 1.0],
  [1.5, 0, 0, 1.0],
];

const uvFull = { x: 0, y: 0, w: 1, h: 1 };

/** The CPU reference for one pixel: exposure → registry cpu twin → output-encode,
 *  using the SAME `resolveEncodeGamma` mapping the renderer packs. */
function expectedRGB(px: number[], enc: DisplayEncoding, gamma: number | undefined, hdrOut: boolean): RgbTriple {
  const exposed: RgbTriple = [applyExposure(px[0]!, EV), applyExposure(px[1]!, EV), applyExposure(px[2]!, EV)];
  const toned = enc.cpu(exposed, 3, { ...DEFAULT_ENCODE_PARAMS, peak: HARNESS_PEAK });
  if (hdrOut) {
    return [extendedOutputEncode(toned[0], gamma), extendedOutputEncode(toned[1], gamma), extendedOutputEncode(toned[2], gamma)];
  }
  return [outputEncode(toned[0], gamma), outputEncode(toned[1], gamma), outputEncode(toned[2], gamma)];
}

async function runEncodingCase(device: Device, enc: DisplayEncoding): Promise<boolean> {
  const pixels = enc.kind === "remap" ? SIGNED_PIXELS : GRADIENT_PIXELS;
  const hdrOut = !!enc.needsHdrSurface;
  const gamma = resolveEncodeGamma(enc.id, TONEMAP_GAMMA_DEFAULT);
  const params: ImageParams = {
    exposureEV: EV,
    operator: enc.id as ImageOperator,
    isScalar: false,
    hdrOut,
    peak: HARNESS_PEAK,
    uv: uvFull,
    ...(gamma !== undefined ? { gamma } : {}),
  };

  const src = buildSrcTexture(device, pixels);
  const target = device.createTexture(pixels.length, 1, hdrOut ? "rgba32float" : "rgba8unorm");
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();

  let ok = true;
  if (hdrOut) {
    if (!(out instanceof Float32Array)) {
      report(false, `[${enc.id}] expected Float32Array readback for hdrOut, got ${out.constructor.name}`);
      return false;
    }
    const EPS = 0.01;
    for (let i = 0; i < pixels.length; i++) {
      const exp = expectedRGB(pixels[i]!, enc, gamma, true);
      for (let c = 0; c < 3; c++) {
        const diff = Math.abs(out[i * 4 + c]! - exp[c]!);
        if (diff > EPS) {
          ok = false;
          report(false, `[${enc.id}] px[${i}].ch[${c}] float expected=${exp[c]!.toFixed(4)} actual=${out[i * 4 + c]!.toFixed(4)} (diff=${diff.toFixed(4)})`);
        }
      }
    }
  } else {
    if (!(out instanceof Uint8Array)) {
      report(false, `[${enc.id}] expected Uint8Array readback, got ${out.constructor.name}`);
      return false;
    }
    for (let i = 0; i < pixels.length; i++) {
      const exp = expectedRGB(pixels[i]!, enc, gamma, false);
      for (let c = 0; c < 3; c++) {
        const eb = byteOf(exp[c]!);
        const ab = out[i * 4 + c]!;
        const diff = Math.abs(ab - eb);
        if (diff > 1) {
          ok = false;
          report(false, `[${enc.id}] px[${i}].ch[${c}] expected=${eb} actual=${ab} (diff=${diff})`);
        }
      }
    }
  }
  report(ok, `[${enc.id}] (${enc.kind}${hdrOut ? ", hdrOut" : ""}) GPU applyOperator === cpu twin`);
  return ok;
}

/**
 * LUT-family parity: render a SCALAR float image through the REAL GPU LUT family
 * (`renderImage` with `isScalar:true` + the encoding's bound `colormapFloatLUT`
 * table → the shader's shared `cairnLutColor`) and assert the readback equals the
 * encoding's `cpu` twin. Nearest filter + EV 0: byte-exact (within 1/255). This
 * covers task #86's float-image colormap AND proves each colormap's GPU sample
 * agrees with its CPU twin across the whole registered set.
 */
async function runLutCase(device: Device, enc: DisplayEncoding): Promise<boolean> {
  const lut = colormapFloatLUT((enc.lutName ?? enc.id) as ColormapName);
  const params: ImageParams = {
    exposureEV: EV,
    operator: "linear" as ImageOperator, // moot: isScalar short-circuits the operator
    isScalar: true,
    colormap: lut,
    hdrOut: false,
    uv: uvFull,
    filter: "nearest",
  };
  const src = buildSrcTexture(device, SCALAR_PIXELS);
  const target = device.createTexture(SCALAR_PIXELS.length, 1, "rgba8unorm");
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[${enc.id}] expected Uint8Array readback, got ${out.constructor.name}`);
    return false;
  }
  let ok = true;
  for (let i = 0; i < SCALAR_PIXELS.length; i++) {
    // cpu twin: the (exposure-adjusted) scalar → display sRGB triple (cmap-mode
    // linear). EV 0 so the exposed scalar is the raw channel-0 value.
    const exp = enc.cpu([applyExposure(SCALAR_PIXELS[i]![0]!, EV)], 1, {
      ...DEFAULT_ENCODE_PARAMS,
    });
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(false, `[${enc.id}] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
      }
    }
  }
  report(ok, `[${enc.id}] (lut) GPU LUT family === cpu twin`);
  return ok;
}

/**
 * Phase-4 DATA-encoding parity: the same SCALAR-image LUT render, but with a
 * NORM (log/power) and/or a min/max BOUNDS affine engaged — proving the GPU
 * `cairnDataIndex` (norm reshape + bounds) matches the CPU `computeDataIndex`
 * twin the encoding's `cpu` threads through. `power` seeds the exponent via the
 * `gamma` param (which the engine packs into the shared gamma uniform the lut
 * path reuses); `bounds` passes `normMin`/`normMax` (the descriptor colorRange
 * skin). Nearest filter + EV 0 → byte-exact (within 1/255).
 */
async function runLutNormCase(
  device: Device,
  enc: DisplayEncoding,
  variant: string,
  encParams: EncodeParams,
): Promise<boolean> {
  const lut = colormapFloatLUT((enc.lutName ?? enc.id) as ColormapName);
  const params: ImageParams = {
    exposureEV: EV,
    operator: "linear" as ImageOperator,
    isScalar: true,
    colormap: lut,
    hdrOut: false,
    uv: uvFull,
    filter: "nearest",
    norm: encParams.norm,
    ...(encParams.norm === "power" ? { gamma: encParams.gamma } : {}),
    ...(typeof encParams.min === "number" ? { normMin: encParams.min } : {}),
    ...(typeof encParams.max === "number" ? { normMax: encParams.max } : {}),
  };
  const src = buildSrcTexture(device, SCALAR_PIXELS);
  const target = device.createTexture(SCALAR_PIXELS.length, 1, "rgba8unorm");
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[${enc.id}/${variant}] expected Uint8Array readback, got ${out.constructor.name}`);
    return false;
  }
  let ok = true;
  for (let i = 0; i < SCALAR_PIXELS.length; i++) {
    const exp = enc.cpu([applyExposure(SCALAR_PIXELS[i]![0]!, EV)], 1, encParams);
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(false, `[${enc.id}/${variant}] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
      }
    }
  }
  report(ok, `[${enc.id}/${variant}] (lut norm) GPU cairnDataIndex === cpu twin`);
  return ok;
}

/** MULTI-CHANNEL (k=3) pixels — distinct per-channel values so luminance and mean
 *  reduce to DIFFERENT scalars (proving the GPU reduction matches the cpu twin per
 *  mode, not by coincidence). Alpha is 1 (ignored by the reduction). */
const MULTI_PIXELS: number[][] = [
  [0.0, 0.0, 0.0, 1.0],
  [0.2, 0.5, 0.8, 1.0],
  [0.9, 0.1, 0.3, 1.0],
  [1.0, 0.0, 0.0, 1.0],
  [0.0, 1.0, 0.0, 1.0],
];

/**
 * Multi-channel-colormap parity (the follow-up): render a k=3 float image through
 * the REAL GPU LUT family with `channelCount:3` + a `reduce` mode, so the shader's
 * `cairnReduceScalar` (ℝ³→scalar) runs before `cairnDataIndex`. Assert the readback
 * equals the encoding's `cpu` twin threaded through the SAME `reduceToScalar`
 * (`enc.cpu(rgb, 3, {reduce})`). Nearest filter + EV 0 → byte-exact (within 1/255).
 */
async function runLutReduceCase(
  device: Device,
  enc: DisplayEncoding,
  mode: "luminance" | "mean",
): Promise<boolean> {
  const lut = colormapFloatLUT((enc.lutName ?? enc.id) as ColormapName);
  const params: ImageParams = {
    exposureEV: EV,
    operator: "linear" as ImageOperator,
    isScalar: true,
    colormap: lut,
    hdrOut: false,
    uv: uvFull,
    filter: "nearest",
    channelCount: 3,
    reduce: mode,
  };
  const src = buildSrcTexture(device, MULTI_PIXELS);
  const target = device.createTexture(MULTI_PIXELS.length, 1, "rgba8unorm");
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[${enc.id}/reduce-${mode}] expected Uint8Array readback, got ${out.constructor.name}`);
    return false;
  }
  let ok = true;
  for (let i = 0; i < MULTI_PIXELS.length; i++) {
    const px = MULTI_PIXELS[i]!;
    // cpu twin: the raw RGB triple (EV 0) → reduce (mode) → LUT display color.
    const exp = enc.cpu([px[0]!, px[1]!, px[2]!], 3, { ...DEFAULT_ENCODE_PARAMS, reduce: mode });
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(false, `[${enc.id}/reduce-${mode}] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
      }
    }
  }
  report(ok, `[${enc.id}/reduce-${mode}] (lut k=3 reduce) GPU cairnReduceScalar === cpu twin`);
  return ok;
}

/** SIGNED scalar values for the ANALYTIC (tev-style red-green) entry — channel 0
 *  carries the signed error; the ±1.0 endpoints give amplitude `2*|v| = 2.0`, a
 *  `>1` over-range value that MUST survive on the HDR path (extended encode) and
 *  clamp on SDR. */
const ANALYTIC_PIXELS: number[][] = [
  [-1.0, 0, 0, 1.0], // strong negative → red 2.0 (>1)
  [-0.3, 0, 0, 1.0], // red 0.6
  [0.0, 0, 0, 1.0], // zero → black
  [0.4, 0, 0, 1.0], // green 0.8
  [1.0, 0, 0, 1.0], // strong positive → green 2.0 (>1)
];

/**
 * ANALYTIC-encoding parity (the tev-style signed red-green follow-up): render the
 * signed SCALAR pixels through the REAL GPU `isScalar` + `analytic` path (no LUT
 * bound → the shader dispatches `cairnSignedAnalyticColor` + the shared
 * output-encode) and assert the readback equals the encoding's `cpu` twin
 * (SCENE-LINEAR) threaded through the SAME `outputEncode`/`extendedOutputEncode`
 * the curves use. Runs BOTH surfaces: SDR (`rgba8unorm`, byte-exact) where the
 * `2.0` amplitude CLAMPS, and HDR (`rgba32float`, float eps) where it SURVIVES
 * past 1 — the directive's ">1 amplitude on the HDR path" case.
 */
async function runAnalyticCase(device: Device, enc: DisplayEncoding): Promise<boolean> {
  let ok = true;
  for (const hdrOut of [false, true]) {
    const params: ImageParams = {
      exposureEV: EV,
      operator: "linear" as ImageOperator, // moot: isScalar+analytic short-circuits it
      isScalar: true,
      analytic: true,
      hdrOut,
      uv: uvFull,
      filter: "nearest",
    };
    const src = buildSrcTexture(device, ANALYTIC_PIXELS);
    const target = device.createTexture(ANALYTIC_PIXELS.length, 1, hdrOut ? "rgba32float" : "rgba8unorm");
    renderImage(device, target, src, params);
    const out = await device.readback(target);
    src.destroy();
    target.destroy();
    for (let i = 0; i < ANALYTIC_PIXELS.length; i++) {
      // cpu twin: signed scalar → LINEAR analytic color (unclamped), then the SAME
      // output-encode the GPU applies (sRGB OETF; extended on the HDR surface).
      const lin = enc.cpu([applyExposure(ANALYTIC_PIXELS[i]![0]!, EV)], 1, { ...DEFAULT_ENCODE_PARAMS });
      if (hdrOut) {
        if (!(out instanceof Float32Array)) {
          report(false, `[${enc.id}/analytic-hdr] expected Float32Array readback`);
          return false;
        }
        for (let c = 0; c < 3; c++) {
          const exp = extendedOutputEncode(lin[c]!, undefined);
          const diff = Math.abs(out[i * 4 + c]! - exp);
          if (diff > 0.01) {
            ok = false;
            report(false, `[${enc.id}/analytic-hdr] px[${i}].ch[${c}] expected=${exp.toFixed(4)} actual=${out[i * 4 + c]!.toFixed(4)}`);
          }
        }
      } else {
        if (!(out instanceof Uint8Array)) {
          report(false, `[${enc.id}/analytic-sdr] expected Uint8Array readback`);
          return false;
        }
        for (let c = 0; c < 3; c++) {
          const eb = byteOf(outputEncode(lin[c]!, undefined));
          const ab = out[i * 4 + c]!;
          if (Math.abs(ab - eb) > 1) {
            ok = false;
            report(false, `[${enc.id}/analytic-sdr] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
          }
        }
      }
    }
  }
  report(ok, `[${enc.id}] (analytic) GPU cairnSignedAnalyticColor === cpu twin (SDR clamps, HDR survives >1)`);
  return ok;
}

/** The norm/bounds variants exercised per lut (Phase 4). */
const LUT_NORM_VARIANTS: Array<{ variant: string; params: EncodeParams }> = [
  { variant: "log", params: { ...DEFAULT_ENCODE_PARAMS, norm: "log" as NormMode } },
  { variant: "power2", params: { ...DEFAULT_ENCODE_PARAMS, norm: "power" as NormMode, gamma: 2 } },
  { variant: "power0.5", params: { ...DEFAULT_ENCODE_PARAMS, norm: "power" as NormMode, gamma: 0.5 } },
  { variant: "bounds", params: { ...DEFAULT_ENCODE_PARAMS, min: 0.2, max: 1.2 } },
  { variant: "bounds+log", params: { ...DEFAULT_ENCODE_PARAMS, min: 0.2, max: 1.2, norm: "log" as NormMode } },
];

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    report(true, `device.backend = ${device.backend}`);
    const encodings = listEncodings();
    report(true, `iterating ${encodings.length} registry encoding(s)`);
    let allOk = true;
    for (const enc of encodings) {
      // ANALYTIC entries (tev-style red-green) COMPUTE their color (no LUT bind),
      // route through output-encode, and declare no norm/bounds — so they get the
      // dedicated signed SDR+HDR case, NOT the LUT-family path/variants.
      if (enc.analytic) {
        if (!(await runAnalyticCase(device, enc))) allOk = false;
        continue;
      }
      const ok = enc.kind === "lut" ? await runLutCase(device, enc) : await runEncodingCase(device, enc);
      if (!ok) allOk = false;
      // Phase 4: every lut also runs the norm/bounds variants (cairnDataIndex).
      if (enc.kind === "lut") {
        for (const { variant, params } of LUT_NORM_VARIANTS) {
          const vok = await runLutNormCase(device, enc, variant, params);
          if (!vok) allOk = false;
        }
        // Multi-channel follow-up: k=3 luminance + mean reduce (cairnReduceScalar).
        for (const mode of ["luminance", "mean"] as const) {
          const rok = await runLutReduceCase(device, enc, mode);
          if (!rok) allOk = false;
        }
      }
    }
    report(allOk, `all ${encodings.length} encodings: GPU === registry cpu twin`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
