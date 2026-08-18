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
} from "../../image/encodings/index";
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

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    report(true, `device.backend = ${device.backend}`);
    const encodings = listEncodings();
    report(true, `iterating ${encodings.length} registry encoding(s)`);
    let allOk = true;
    for (const enc of encodings) {
      const ok = await runEncodingCase(device, enc);
      if (!ok) allOk = false;
    }
    report(allOk, `all ${encodings.length} encodings: GPU curve === registry cpu twin`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
