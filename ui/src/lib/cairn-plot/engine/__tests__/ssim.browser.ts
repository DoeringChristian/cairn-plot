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
import { computeDiff, ensureDiff, renderDiffDisplay, getDiffComputeCount } from "../diff-engine";
import { ssim } from "../kernels/ssim-reference";
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
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const g = gpu[i * 4]!; // 1-SSIM written to all channels
    const expected = 1 - cpu.ssim[i]!;
    const d = Math.abs(g - expected);
    if (d > worst) worst = d;
    sum += g;
  }
  const ok = worst <= TOL;
  report(ok, `[ssim ${w}x${h}] worst |GPU-CPU|=${worst.toFixed(4)} (tol ${TOL}) mean(1-SSIM)=${(sum / (w * h)).toFixed(4)}`);
  return ok;
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
    ok = (await runCacheContract(device)) && ok;
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
