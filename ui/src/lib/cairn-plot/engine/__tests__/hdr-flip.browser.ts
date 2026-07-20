/**
 * HDR-FLIP: GPU multi-pass kernel vs CPU reference harness (WebGPU, driven via
 * claude-in-chrome — jsdom has no WebGPU). This is the SECOND side of the
 * two-sided HDR-FLIP verification (spec addendum): the node test
 * (`kernels/hdr-flip-reference.test.ts`) pins the CPU reference to the official
 * `flip-evaluator` HDR values; this harness asserts the GPU kernel
 * (`kernels/hdr-flip.ts`, run via `computeDiff("hdr-flip", …)`) agrees with that
 * CPU reference within tolerance on synthetic float HDR fixture pairs.
 *
 * Both sides use the SAME exposure range (`computeHdrFlipExposures`, computed on
 * the CPU from the reference luminance and passed to the GPU kernel as params),
 * so any GPU↔CPU residual is purely the rgba16float-intermediate precision of
 * the per-exposure LDR-FLIP core (same as `flip.browser.ts`), not an exposure
 * mismatch.
 *
 * It also asserts the CACHE contract: after the first `ensureDiff`, re-issuing
 * the SAME (contentKey, kernel, params) — and re-blitting through a different
 * uv-window (zoom/pan) — does NOT increase the compute counter.
 *
 * RUNNING: bundle with esbuild, serve over http, open hdr-flip.browser.html
 * (same commands as the sibling *.browser.ts).
 */
import { getSharedDevice } from "../device";
import { computeDiff, ensureDiff, renderDiffDisplay, getDiffComputeCount } from "../diff-engine";
import { flipHDR, computeHdrFlipExposures } from "../kernels/hdr-flip-reference";
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
  (window as unknown as { __hdrFlipTestResult?: "pass" | "fail" }).__hdrFlipTestResult = pass ? "pass" : "fail";
  document.title = pass ? "HDR-FLIP PASS" : "HDR-FLIP FAIL";
}

// Deterministic small LINEAR-float HDR fixture pairs (W*H*3): dim background +
// a bright gaussian core, with a highlight-localized test error.
function makeHdrPair(w: number, h: number, seed: number): { ref: Float32Array; test: Float32Array } {
  const ref = new Float32Array(w * h * 3);
  const test = new Float32Array(w * h * 3);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cx = w * 0.5;
  const cy = h * 0.45;
  const peak = 6 + 3 * rnd();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const g = Math.exp(-(((x - cx) / (0.28 * w)) ** 2 + ((y - cy) / (0.28 * h)) ** 2));
      const bg = 0.02 + 0.38 * rnd();
      const chans = [1, 0.9, 0.6];
      for (let c = 0; c < 3; c++) {
        const rv = bg + peak * chans[c]! * g;
        ref[i * 3 + c] = rv;
        let tv = rv * (1 + 0.18 * (rnd() - 0.5));
        if (c === 0) tv += 0.5 * g; // highlight-localized error
        test[i * 3 + c] = Math.max(0, tv);
      }
    }
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

const PPD = 67;
const TOL = 3e-2; // GPU (rgba16float intermediates) vs CPU (f64) reference

async function runHdrFlipCase(device: Device, w: number, h: number, seed: number): Promise<boolean> {
  const { ref, test } = makeHdrPair(w, h, seed);
  const texRef = uploadRGBA(device, ref, w, h);
  const texTest = uploadRGBA(device, test, w, h);
  // texA = reference (srcA), texB = test (srcB) — same as the pane's binding.
  const exp = computeHdrFlipExposures(ref, w, h, 3);
  const params = {
    ppd: PPD,
    startExposure: exp.startExposure,
    stopExposure: exp.stopExposure,
    numExposures: exp.numExposures,
  };
  const result = computeDiff(device, texRef, texTest, "hdr-flip", params);
  const gpu = await device.readback(result);
  texRef.destroy();
  texTest.destroy();
  result.destroy();
  if (!(gpu instanceof Float32Array)) {
    report(false, `[hdr-flip ${w}x${h}] readback should be Float32Array`);
    return false;
  }
  const cpu = flipHDR(ref, test, w, h, PPD);
  let worst = 0;
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    const gv = gpu[i * 4]!; // flip written to all channels
    const d = Math.abs(gv - cpu[i]!);
    if (d > worst) worst = d;
    sum += gv;
  }
  const ok = worst <= TOL;
  report(
    ok,
    `[hdr-flip ${w}x${h}] nExp=${exp.numExposures} worst|GPU-CPU|=${worst.toFixed(4)} (tol ${TOL}) meanGPU=${(sum / (w * h)).toFixed(4)}`,
  );
  return ok;
}

async function runCacheContract(device: Device): Promise<boolean> {
  const w = 14;
  const h = 12;
  const { ref, test } = makeHdrPair(w, h, 99);
  const texRef = uploadRGBA(device, ref, w, h);
  const texTest = uploadRGBA(device, test, w, h);
  const target = device.createTexture(w, h, "rgba8unorm");
  const exp = computeHdrFlipExposures(ref, w, h, 3);
  const params = {
    ppd: PPD,
    startExposure: exp.startExposure,
    stopExposure: exp.stopExposure,
    numExposures: exp.numExposures,
  };
  const before = getDiffComputeCount();
  const e1 = ensureDiff(device, texRef, texTest, "hdr-flip", params, "ref#hdr", "test#hdr");
  const afterFirst = getDiffComputeCount();
  for (const win of [
    { x: 0, y: 0, w: 1, h: 1 },
    { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    { x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
  ]) {
    renderDiffDisplay(device, target, e1.texture, e1.displayRange, { uv: win });
  }
  const e2 = ensureDiff(device, texRef, texTest, "hdr-flip", params, "ref#hdr", "test#hdr");
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
    ok = (await runHdrFlipCase(device, 16, 16, 1)) && ok;
    ok = (await runHdrFlipCase(device, 20, 14, 7)) && ok;
    ok = (await runHdrFlipCase(device, 12, 18, 42)) && ok;
    ok = (await runCacheContract(device)) && ok;
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
