/**
 * GPU REDUCTION FAMILY parity + perf harness (WebGPU — jsdom has no WebGPU, so
 * this is a headless-Chromium `*.browser.ts` the harness runner drives).
 *
 * Asserts the shared GPU tree-reduce (`engine/reduce/registry.ts`, via
 * `Device.reduceTextureChannelMean` / `reduceDiffSumSquaredAbs`) equals the CPU
 * twin / the hand loops it replaces — on real uploaded textures, over
 * odd/non-power-of-two regions, and with NaN inputs (propagation). Then it
 * MEASURES a 2048² reduction both ways and LOGS the evidence (readback bytes +
 * wall time; timing is logged, never asserted): the whole point of the family is
 * a KB partial readback instead of the ~64MB full-texture transfer + 4M-iter JS
 * loop.
 */
import { getSharedWebGpuDevice } from "../device/device-provider.ts";
import {
  cpuReduce,
  getReduceOp,
  getReduceProgram,
} from "../reduce/registry";
import { meanSsimFromErrorMap } from "../ssim-metric";
import type { Device, Texture } from "../device/device-contract";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "REDUCE" });

function info(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = message;
    p.style.color = "#8cf";
    el.appendChild(p);
  }
}

const CHANNEL = getReduceProgram("channel")!;
const DIFF = getReduceProgram("diffSqAbs")!;
const SUM = getReduceOp("sum")!;
const MEAN = getReduceOp("mean")!;

/** Upload an RGBA (4 floats/pixel) field as an rgba32float texture (verbatim). */
function uploadRGBA(device: Device, data: Float32Array, w: number, h: number): Texture {
  const tex = device.createTexture(w, h, "rgba32float");
  tex.write(data);
  return tex;
}

function makeRGBA(w: number, h: number, seed: number): Float32Array {
  const out = new Float32Array(w * h * 4);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = rnd();
    out[i * 4 + 1] = rnd();
    out[i * 4 + 2] = rnd();
    out[i * 4 + 3] = 1;
  }
  return out;
}

function loaderOf(...srcs: Float32Array[]) {
  return (i: number, x: number, y: number, w: number): readonly number[] => {
    const s = srcs[i]!;
    const o = (y * w + x) * 4;
    return [s[o] ?? 0, s[o + 1] ?? 0, s[o + 2] ?? 0, s[o + 3] ?? 0];
  };
}

const TOL_MEAN = 1e-5; // f32 GPU vs f64 CPU, small regions
const TOL_SUM_REL = 5e-4; // relative — sums accumulate f32 rounding over the region

/** channel/mean parity: GPU reduceTextureChannelMean == CPU twin == the loop. */
async function runChannelMeanCase(device: Device, w: number, h: number, seed: number): Promise<boolean> {
  const data = makeRGBA(w, h, seed);
  const tex = uploadRGBA(device, data, w, h);
  const gpuMean = await device.reduceTextureChannelMean!(tex, 0, w, h);
  tex.destroy();
  const [cpuMean] = cpuReduce(CHANNEL, MEAN, (i, x, y) => loaderOf(data)(i, x, y, w), w, h, { channel: 0 });
  // The loop being replaced (interpreting R as 1-SSIM): 1 - mean each side.
  const loopSsim = meanSsimFromErrorMap(data, w, h);
  const okTwin = Math.abs(gpuMean - cpuMean!) <= TOL_MEAN;
  const okLoop = Math.abs((1 - gpuMean) - loopSsim) <= TOL_MEAN;
  report(
    okTwin && okLoop,
    `[channel-mean ${w}x${h}] GPU=${gpuMean.toFixed(7)} CPUtwin=${cpuMean!.toFixed(7)} |Δ|=${Math.abs(gpuMean - cpuMean!).toExponential(2)} (tol ${TOL_MEAN})`,
  );
  return okTwin && okLoop;
}

/** diffSqAbs/sum parity: GPU reduceDiffSumSquaredAbs == CPU twin == the loop. */
async function runDiffSumCase(device: Device, w: number, h: number, seedA: number, seedB: number): Promise<boolean> {
  const a = makeRGBA(w, h, seedA);
  const b = makeRGBA(w, h, seedB);
  const texA = uploadRGBA(device, a, w, h);
  const texB = uploadRGBA(device, b, w, h);
  const { sumSq, sumAbs } = await device.reduceDiffSumSquaredAbs!(texA, texB, w, h);
  texA.destroy();
  texB.destroy();
  const [cpuSq, cpuAbs] = cpuReduce(DIFF, SUM, (i, x, y) => loaderOf(a, b)(i, x, y, w), w, h);
  const relSq = Math.abs(sumSq - cpuSq!) / Math.max(1e-6, Math.abs(cpuSq!));
  const relAbs = Math.abs(sumAbs - cpuAbs!) / Math.max(1e-6, Math.abs(cpuAbs!));
  const ok = relSq <= TOL_SUM_REL && relAbs <= TOL_SUM_REL;
  report(
    ok,
    `[diff-sum ${w}x${h}] sumSq GPU=${sumSq.toFixed(4)} CPU=${cpuSq!.toFixed(4)} rel=${relSq.toExponential(2)}; sumAbs rel=${relAbs.toExponential(2)} (tol ${TOL_SUM_REL})`,
  );
  return ok;
}

/** NaN propagation: a single NaN sample → NaN scalar (both reductions). */
async function runNaNCase(device: Device): Promise<boolean> {
  const w = 32;
  const h = 24;
  const data = makeRGBA(w, h, 17);
  data[(10 * w + 7) * 4] = NaN; // NaN in R
  const tex = uploadRGBA(device, data, w, h);
  const gpuMean = await device.reduceTextureChannelMean!(tex, 0, w, h);
  const b = makeRGBA(w, h, 71);
  const texB = uploadRGBA(device, b, w, h);
  const { sumSq } = await device.reduceDiffSumSquaredAbs!(tex, texB, w, h);
  tex.destroy();
  texB.destroy();
  const ok = Number.isNaN(gpuMean) && Number.isNaN(sumSq);
  report(ok, `[nan] channel-mean NaN=${Number.isNaN(gpuMean)}, diff-sumSq NaN=${Number.isNaN(sumSq)} (both must propagate)`);
  return ok;
}

/** Perf evidence for a 2048² reduction: BEFORE (full readback + JS loop) vs
 *  AFTER (GPU tree-reduce + KB partial readback). Logged, never asserted. */
async function runPerf(device: Device): Promise<boolean> {
  const w = 2048;
  const h = 2048;
  const data = makeRGBA(w, h, 123);
  const tex = uploadRGBA(device, data, w, h);

  // BEFORE: the old SSIM-mean path — read the FULL result texture to CPU, loop.
  const t0 = performance.now();
  const samples = await device.readback(tex);
  const readbackBytes = (samples as Float32Array).byteLength;
  const beforeMean = meanSsimFromErrorMap(samples as Float32Array, w, h);
  const beforeMs = performance.now() - t0;

  // AFTER: the shared GPU reduction — KB partial readback, no full transfer.
  const t1 = performance.now();
  const afterMean = 1 - (await device.reduceTextureChannelMean!(tex, 0, w, h));
  const afterMs = performance.now() - t1;
  tex.destroy();

  const numWorkgroups = Math.ceil((w * h) / 256);
  const afterBytes = numWorkgroups * 1 * 4; // 1 lane f32 per workgroup
  info(
    `[perf 2048²] BEFORE readback=${(readbackBytes / 1e6).toFixed(1)}MB + JS loop = ${beforeMs.toFixed(1)}ms; ` +
      `AFTER partial=${(afterBytes / 1024).toFixed(0)}KB GPU-reduce = ${afterMs.toFixed(1)}ms; ` +
      `bytes ${(readbackBytes / afterBytes).toFixed(0)}× less`,
  );
  const agree = Math.abs(beforeMean - afterMean) <= 1e-4;
  report(agree, `[perf 2048²] BEFORE mean=${beforeMean.toFixed(6)} AFTER mean=${afterMean.toFixed(6)} (must agree)`);
  return agree;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedWebGpuDevice();
    report(true, `device.backend = ${device.backend}`);
    let ok = true;
    if (!device.reduceTextureChannelMean || !device.reduceDiffSumSquaredAbs) {
      report(false, "device is missing the reduction methods");
      setOverallStatus(false);
      return;
    }
    // Odd / non-power-of-two sizes (workgroup-tail handling).
    for (const [w, h, s] of [
      [1, 1, 2],
      [3, 5, 4],
      [17, 1, 6],
      [37, 11, 8],
      [255, 3, 10],
      [257, 2, 12],
      [64, 64, 14],
    ] as const) {
      ok = (await runChannelMeanCase(device, w, h, s)) && ok;
      ok = (await runDiffSumCase(device, w, h, s, s + 1000)) && ok;
    }
    ok = (await runNaNCase(device)) && ok;
    ok = (await runPerf(device)) && ok;
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
