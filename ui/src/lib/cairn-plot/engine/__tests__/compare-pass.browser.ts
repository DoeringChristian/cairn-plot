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
import { getSharedDevice } from "../device";
import { renderCompose, computeMetrics, type CompareParams } from "../image-engine";
import { computeDiff, renderDiffDisplay } from "../diff-engine";
import { getDiffKernel } from "../kernels";
import { applyExposure, TONEMAP_OPERATORS, outputEncode, type RgbTriple } from "../../image/tonemap";
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
  (window as unknown as { __comparePassTestResult?: "pass" | "fail" }).__comparePassTestResult = pass ? "pass" : "fail";
  document.title = pass ? "COMPARE PASS PASS" : "COMPARE PASS FAIL";
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const byteOf = (x: number): number => Math.round(clamp01(x) * 255);

function processSide(px: number[], params: CompareParams): RgbTriple {
  const exposed: RgbTriple = [
    applyExposure(px[0]!, params.exposureEV),
    applyExposure(px[1]!, params.exposureEV),
    applyExposure(px[2]!, params.exposureEV),
  ];
  const opFn = TONEMAP_OPERATORS[params.operator] ?? TONEMAP_OPERATORS.srgb!;
  const toned = opFn(exposed);
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
  operator: "srgb",
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
function expectedDiffPixel(pxRef: number[], pxFg: number[], kernelId: string): RgbTriple {
  const range = getDiffKernel(kernelId)!.displayRange;
  const out: number[] = [];
  for (let c = 0; c < 3; c++) {
    const a = pxRef[c]!;
    const b = pxFg[c]!;
    const denom = Math.max(a, 1 / 255);
    let raw: number;
    switch (kernelId) {
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

async function runDiffCase(device: Device, kernelId: string): Promise<boolean> {
  const texRef = buildRowTexture(device, PIXELS_REF);
  const texFg = buildRowTexture(device, PIXELS_FG);
  const result = computeDiff(device, texRef, texFg, kernelId);
  const target = device.createTexture(WIDTH, 1, "rgba8unorm");
  const range = getDiffKernel(kernelId)!.displayRange;
  renderDiffDisplay(device, target, result, range, { uv: uvFull });
  const out = await device.readback(target);
  texRef.destroy();
  texFg.destroy();
  result.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[diff/${kernelId}] readback should be Uint8Array`);
    return false;
  }
  let allOk = true;
  for (let i = 0; i < WIDTH; i++) {
    const expected = expectedDiffPixel(PIXELS_REF[i]!, PIXELS_FG[i]!, kernelId);
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(out[i * 4 + c]! - byteOf(expected[c]!));
      if (diff > 2) {
        allOk = false;
        report(false, `[diff/${kernelId}] px[${i}].ch[${c}] expected=${byteOf(expected[c]!)} actual=${out[i * 4 + c]}`);
      }
    }
  }
  report(allOk, `[diff/${kernelId}] all pixels within 2/255 of raw-diff reference`);
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

async function runAll(device: Device): Promise<boolean> {
  report(true, `device.backend = ${device.backend}`);
  let ok = true;
  for (const split of [0.0, 0.25, 0.5, 0.75, 1.0]) {
    ok = (await runComposeCase(device, `split@${split}`, { ...BASE, mode: "split", split, alpha: 0.5 })) && ok;
  }
  for (const alpha of [0.0, 0.25, 0.5, 1.0]) {
    ok = (await runComposeCase(device, `blend@${alpha}`, { ...BASE, mode: "blend", split: 0.5, alpha })) && ok;
  }
  for (const k of ["signed", "absolute", "squared", "relative_signed", "relative_absolute", "relative_squared"]) {
    ok = (await runDiffCase(device, k)) && ok;
  }
  ok = (await runMetricsCase(device)) && ok;
  ok = (await runSwapGuardCase(device, "split@0.25", { ...BASE, mode: "split", split: 0.25, alpha: 0.5 })) && ok;
  ok = (await runSwapGuardCase(device, "blend@0.25", { ...BASE, mode: "blend", split: 0.5, alpha: 0.25 })) && ok;
  return ok;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    setOverallStatus(await runAll(device));
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
