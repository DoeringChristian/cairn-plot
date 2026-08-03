/**
 * SSIM: GPU multi-pass kernel vs CPU reference harness (WebGPU, driven via
 * claude-in-chrome — jsdom has no WebGPU). This is the SECOND side of the
 * two-sided SSIM verification (spec §diff-kernels): the node test
 * (`kernels/ssim-reference.test.ts`) pins the CPU reference to scikit-image's
 * `structural_similarity`; this harness asserts the GPU kernel
 * (`kernels/ssim.wgsl.ts`, run via `computeDiff`) agrees with that CPU
 * reference within tolerance on fixture pairs.
 *
 * The kernel OUTPUT is the error map `1 - SSIM`, so the GPU value is compared
 * against `1 - cpuSsim`. GPU stores the moment/statistic intermediates in
 * rgba16float (spec-mandated), so the GPU<->CPU tolerance is looser than the
 * CPU<->skimage one.
 *
 * It also asserts the CACHE contract: after the first `ensureDiff`, re-issuing
 * the SAME (contentKey, kernel, params) — and re-blitting through a different
 * uv-window (simulating zoom/pan) — does NOT increase the compute counter
 * (`getDiffComputeCount`), proving display is decoupled from recompute.
 *
 * RUNNING: bundle with esbuild, serve over http, open ssim.browser.html (same
 * commands as the sibling *.browser.ts).
 */
import { getSharedDevice } from "../device";
import { computeDiff, ensureDiff, ensureSsimScalar, renderDiffDisplay, getDiffComputeCount } from "../diff-engine";
import { ssim } from "../kernels/ssim-reference";
import { meanSsimFromErrorMap, formatSsim } from "../ssim-metric";
import { computeCompareMapping, type CompareAlign, type CompareFit } from "../compare-align";
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
  (window as unknown as { __ssimTestResult?: "pass" | "fail" }).__ssimTestResult = pass ? "pass" : "fail";
  document.title = pass ? "SSIM PASS" : "SSIM FAIL";
}

// Deterministic small sRGB fixture pairs (W*H*3, [0,1]).
function makePair(w: number, h: number, seed: number): { ref: Float32Array; test: Float32Array } {
  const ref = new Float32Array(w * h * 3);
  const test = new Float32Array(w * h * 3);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < w * h; i++) {
    const r = rnd(), g = rnd(), b = rnd();
    ref[i * 3] = r; ref[i * 3 + 1] = g; ref[i * 3 + 2] = b;
    test[i * 3] = Math.min(1, Math.max(0, r + (rnd() - 0.5) * 0.25));
    test[i * 3 + 1] = Math.min(1, Math.max(0, g + (rnd() - 0.5) * 0.25));
    test[i * 3 + 2] = Math.min(1, Math.max(0, b + (rnd() - 0.5) * 0.25));
  }
  return { ref, test };
}

// A distinct, smoothly-STRUCTURED natural-ish sRGB image (low-frequency
// sinusoids, seed-varied frequency/phase) — NOT white noise, so it has real
// local structure that survives the Gaussian and yields a non-trivial SSIM map.
// Used for the mismatched-size cases: two different-size, DISTINCT-structure
// operands, so a wrong source-map (the bug: one operand edge-clamped instead of
// aligned/rescaled) would visibly diverge from the reference. (length w*h*3)
function makeImage(w: number, h: number, seed: number): Float32Array {
  const img = new Float32Array(w * h * 3);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const fx = 2 + rnd() * 4, fy = 2 + rnd() * 4, ph = rnd() * 6.283;
  const fx2 = 1 + rnd() * 3, fy2 = 1 + rnd() * 3;
  const PI = Math.PI;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = w > 1 ? x / (w - 1) : 0;
      const v = h > 1 ? y / (h - 1) : 0;
      const r = 0.5 + 0.4 * Math.sin(fx * PI * u + ph) * Math.cos(fy * PI * v);
      const g = 0.5 + 0.4 * Math.cos(fx2 * PI * v + ph) * Math.sin(fy2 * PI * u);
      const b = 0.5 + 0.3 * Math.sin((fx + fy) * PI * (u + v) * 0.5);
      const i = (y * w + x) * 3;
      img[i] = clamp01(r); img[i + 1] = clamp01(g); img[i + 2] = clamp01(b);
    }
  }
  return img;
}

const clampI = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// CPU replica of SOURCE_MAP_WGSL's `mapSample`: resample a source (w*h*3) onto
// the RESULT grid so the reference SSIM sees exactly what the GPU moment passes
// sample. CROP = integer texel `result + offset` (clamped); FILL = bilinear over
// the full source at uv `(px+0.5)/result` (matching SAMPLING_WGSL's
// `sampleBilinearOf`). Returns a result-grid sRGB array (resW*resH*3).
function mapSourceToResult(
  src: Float32Array, sw: number, sh: number,
  resW: number, resH: number, offX: number, offY: number, fill: boolean,
): Float32Array {
  const out = new Float32Array(resW * resH * 3);
  const at = (xx: number, yy: number, c: number) => src[(yy * sw + xx) * 3 + c]!;
  for (let y = 0; y < resH; y++) {
    for (let x = 0; x < resW; x++) {
      const o = (y * resW + x) * 3;
      if (fill) {
        const tx = ((x + 0.5) / resW) * sw - 0.5;
        const ty = ((y + 0.5) / resH) * sh - 0.5;
        const bx = Math.floor(tx), by = Math.floor(ty);
        const fxr = tx - bx, fyr = ty - by;
        const x0 = clampI(bx, 0, sw - 1), x1 = clampI(bx + 1, 0, sw - 1);
        const y0 = clampI(by, 0, sh - 1), y1 = clampI(by + 1, 0, sh - 1);
        for (let c = 0; c < 3; c++) {
          const top = at(x0, y0, c) * (1 - fxr) + at(x1, y0, c) * fxr;
          const bot = at(x0, y1, c) * (1 - fxr) + at(x1, y1, c) * fxr;
          out[o + c] = top * (1 - fyr) + bot * fyr;
        }
      } else {
        const sx = clampI(x + offX, 0, sw - 1), sy = clampI(y + offY, 0, sh - 1);
        out[o] = at(sx, sy, 0); out[o + 1] = at(sx, sy, 1); out[o + 2] = at(sx, sy, 2);
      }
    }
  }
  return out;
}

function uploadRGBA(device: Device, rgb: Float32Array, w: number, h: number): Texture {
  const tex = device.createTexture(w, h, "rgba32float");
  const data = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[i * 3]!;
    data[i * 4 + 1] = rgb[i * 3 + 1]!;
    data[i * 4 + 2] = rgb[i * 3 + 2]!;
    data[i * 4 + 3] = 1;
  }
  tex.write(data);
  return tex;
}

const TOL = 2e-2; // GPU (rgba16float intermediates) vs CPU (f64) reference

// Mean-SSIM (scalar chip) tolerance: averaging the 1-SSIM map over the region
// cancels most of the per-pixel rgba16float noise, so the MEAN sits far inside
// the per-pixel floor. Kept comfortably above the observed residual.
const TOL_MEAN = 5e-3;
const TOL_MEAN_MISMATCH = 1.2e-2;

// Distinct-operand (mismatched-size) tolerance. The mismatched cases compare two
// INDEPENDENT natural-structure images (mean 1-SSIM ≈ 1 — near/below SSIM=0,
// where the (A1·A2)/(B1·B2) ratio is most sensitive to the rgba16float moment
// storage), so the GPU-vs-f64 worst-pixel floor is ~0.02–0.025, vs ~0.003 for
// the correlated equal-size pairs above. This is pure f16 precision, NOT a
// mapping error: the CROP cases below sample exact INTEGER texels (mapSample's
// crop path == the CPU replica bit-for-bit), yet still sit at ~0.019 — a wrong
// source-map on these anticorrelated operands would diverge by O(1), not 0.02.
const TOL_MISMATCH = 3.5e-2;

async function runSsimCase(device: Device, w: number, h: number, seed: number): Promise<boolean> {
  const { ref, test } = makePair(w, h, seed);
  const texRef = uploadRGBA(device, ref, w, h);
  const texTest = uploadRGBA(device, test, w, h);
  const result = computeDiff(device, texRef, texTest, "ssim");
  const gpu = await device.readback(result);
  texRef.destroy();
  texTest.destroy();
  result.destroy();
  if (!(gpu instanceof Float32Array)) {
    report(false, `[ssim ${w}x${h}] readback should be Float32Array`);
    return false;
  }
  const cpu = ssim(ref, test, w, h);
  let worst = 0;
  let cpuSsimSum = 0;
  for (let i = 0; i < w * h; i++) {
    const g = gpu[i * 4]!; // 1-SSIM written to all channels
    const expected = 1 - cpu.ssim[i]!;
    const d = Math.abs(g - expected);
    if (d > worst) worst = d;
    cpuSsimSum += cpu.ssim[i]!;
  }
  const ok = worst <= TOL;
  report(ok, `[ssim ${w}x${h}] worst |GPU-CPU|=${worst.toFixed(4)} (tol ${TOL})`);
  // Scalar mean-SSIM (chip): the SHIPPED reduction (`meanSsimFromErrorMap` over
  // the GPU readback) must match mean(SSIM) of the CPU reference over the same
  // full region.
  const gpuMean = meanSsimFromErrorMap(gpu, w, h);
  const cpuMean = cpuSsimSum / (w * h);
  const meanOk = Math.abs(gpuMean - cpuMean) <= TOL_MEAN;
  report(
    meanOk,
    `[ssim ${w}x${h}] mean SSIM GPU=${gpuMean.toFixed(4)} CPU=${cpuMean.toFixed(4)} |Δ|=${Math.abs(gpuMean - cpuMean).toFixed(4)} (tol ${TOL_MEAN})`,
  );
  return ok && meanOk;
}

/**
 * The SHIPPED scalar path end-to-end: `ensureSsimScalar` over uploaded textures
 * (the exact call `GpuComparePane` makes for its metrics chip). Asserts (1) an
 * IDENTICAL pair yields an exact `"1.0000"` displayed (task point 4), and (2) a
 * perturbed pair's scalar matches the CPU reference mean within tolerance.
 */
async function runScalarCase(device: Device, w: number, h: number, seed: number): Promise<boolean> {
  const { ref, test } = makePair(w, h, seed);
  const texRef = uploadRGBA(device, ref, w, h);
  const texTest = uploadRGBA(device, test, w, h);

  // (1) identical → displayed value is an exact 1.0000.
  const same = await ensureSsimScalar(device, texRef, texRef, `id#${seed}`, `id#${seed}`);
  const sameText = formatSsim(same);
  const identicalOk = sameText === "1.0000";
  report(identicalOk, `[ssim-scalar ${w}x${h}] identical mean=${same.toFixed(6)} displayed="${sameText}" (want "1.0000")`);

  // (2) perturbed → matches the CPU reference mean over the full region.
  const scalar = await ensureSsimScalar(device, texRef, texTest, `ref#${seed}`, `test#${seed}`);
  const cpu = ssim(ref, test, w, h);
  let cpuSum = 0;
  for (let i = 0; i < w * h; i++) cpuSum += cpu.ssim[i]!;
  const cpuMean = cpuSum / (w * h);
  const scalarOk = Math.abs(scalar - cpuMean) <= TOL_MEAN;
  report(
    scalarOk,
    `[ssim-scalar ${w}x${h}] ensureSsimScalar=${scalar.toFixed(4)} CPU=${cpuMean.toFixed(4)} |Δ|=${Math.abs(scalar - cpuMean).toFixed(4)} (tol ${TOL_MEAN})`,
  );
  texRef.destroy();
  texTest.destroy();
  return identicalOk && scalarOk;
}

/**
 * MISMATCHED-size parity: two DISTINCT-structure operands at different
 * resolutions, compared under a real align/fit mapping (non-top-left crop or
 * fill). The GPU moment passes must apply the SAME source-map the reference does
 * (`mapSourceToResult`); this is the case the equal-size fixtures never exercised
 * and the SSIM source-map bug (one operand edge-clamped → the error map shows
 * only the other operand's structure) lived in.
 */
async function runMismatchCase(
  device: Device,
  aw: number, ah: number, bw: number, bh: number,
  align: CompareAlign, fit: CompareFit, seedA: number, seedB: number,
): Promise<boolean> {
  const a = makeImage(aw, ah, seedA);
  const b = makeImage(bw, bh, seedB);
  const texA = uploadRGBA(device, a, aw, ah);
  const texB = uploadRGBA(device, b, bw, bh);
  const map = computeCompareMapping({ w: aw, h: ah }, { w: bw, h: bh }, align, fit, "b");
  const result = computeDiff(device, texA, texB, "ssim", undefined, map);
  const gpu = await device.readback(result);
  texA.destroy();
  texB.destroy();
  result.destroy();
  const tag = `[ssim ${aw}x${ah} vs ${bw}x${bh} ${fit}/${align}]`;
  if (!(gpu instanceof Float32Array)) {
    report(false, `${tag} readback should be Float32Array`);
    return false;
  }
  const { w: rw, h: rh } = map.result;
  const fill = map.fit === "fill";
  const mappedA = mapSourceToResult(a, aw, ah, rw, rh, map.offsetA.x, map.offsetA.y, fill);
  const mappedB = mapSourceToResult(b, bw, bh, rw, rh, map.offsetB.x, map.offsetB.y, fill);
  const cpu = ssim(mappedA, mappedB, rw, rh);
  let worst = 0;
  let cpuSsimSum = 0;
  for (let i = 0; i < rw * rh; i++) {
    const g = gpu[i * 4]!;
    const expected = 1 - cpu.ssim[i]!;
    const d = Math.abs(g - expected);
    if (d > worst) worst = d;
    cpuSsimSum += cpu.ssim[i]!;
  }
  const ok = worst <= TOL_MISMATCH;
  report(ok, `${tag} result ${rw}x${rh} worst |GPU-CPU|=${worst.toFixed(4)} (tol ${TOL_MISMATCH})`);
  // Scalar mean-SSIM over the MAPPED region matches the CPU-replicated mapping's
  // mean (task point 4: "mean over a mismatched-size mapped region matches the
  // CPU-replicated mapping"). Same reduction the chip ships.
  const gpuMean = meanSsimFromErrorMap(gpu, rw, rh);
  const cpuMean = cpuSsimSum / (rw * rh);
  const meanOk = Math.abs(gpuMean - cpuMean) <= TOL_MEAN_MISMATCH;
  report(
    meanOk,
    `${tag} mean SSIM GPU=${gpuMean.toFixed(4)} CPU=${cpuMean.toFixed(4)} |Δ|=${Math.abs(gpuMean - cpuMean).toFixed(4)} (tol ${TOL_MEAN_MISMATCH})`,
  );
  return ok && meanOk;
}

async function runCacheContract(device: Device): Promise<boolean> {
  const w = 14, h = 14;
  const { ref, test } = makePair(w, h, 99);
  const texRef = uploadRGBA(device, ref, w, h);
  const texTest = uploadRGBA(device, test, w, h);
  const target = device.createTexture(w, h, "rgba8unorm");
  const before = getDiffComputeCount();
  const e1 = ensureDiff(device, texRef, texTest, "ssim", undefined, "ref#1", "test#1");
  const afterFirst = getDiffComputeCount();
  // Re-display through several "zoom/pan" windows — must NOT recompute.
  for (const win of [
    { x: 0, y: 0, w: 1, h: 1 },
    { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    { x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
  ]) {
    renderDiffDisplay(device, target, e1.texture, e1.displayRange, { uv: win });
  }
  const e2 = ensureDiff(device, texRef, texTest, "ssim", undefined, "ref#1", "test#1");
  const afterSecond = getDiffComputeCount();
  texRef.destroy();
  texTest.destroy();
  target.destroy();
  const computedOnce = afterFirst - before === 1;
  const noRecompute = afterSecond === afterFirst && e2 === e1;
  report(computedOnce, `[cache] first ensureDiff computed exactly once (delta=${afterFirst - before})`);
  report(noRecompute, `[cache] re-display (zoom/pan) + re-ensure did NOT recompute (count stable at ${afterSecond})`);
  return computedOnce && noRecompute;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    report(true, `device.backend = ${device.backend}`);
    let ok = true;
    ok = (await runSsimCase(device, 14, 14, 1)) && ok;
    ok = (await runSsimCase(device, 18, 16, 7)) && ok;
    ok = (await runSsimCase(device, 24, 20, 42)) && ok;
    // Mismatched-size parity (the SSIM source-map bug's home): non-top-left crop
    // (exercises the per-source alignment OFFSET) and fill (exercises the
    // bilinear rescale of the non-primary operand).
    ok = (await runMismatchCase(device, 24, 20, 18, 16, "center", "crop", 3, 8)) && ok;
    ok = (await runMismatchCase(device, 24, 20, 18, 16, "bottom-right", "crop", 5, 11)) && ok;
    ok = (await runMismatchCase(device, 24, 20, 16, 16, "top-left", "fill", 6, 13)) && ok;
    // Scalar chip path (ensureSsimScalar): identical → exactly 1.0000, and a
    // perturbed pair matches the CPU reference mean.
    ok = (await runScalarCase(device, 16, 16, 5)) && ok;
    ok = (await runScalarCase(device, 22, 18, 23)) && ok;
    ok = (await runCacheContract(device)) && ok;
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
