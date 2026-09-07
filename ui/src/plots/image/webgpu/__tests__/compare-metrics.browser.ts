/**
 * `computeMetrics` GPU↔CPU parity harness (WebGPU; jsdom has no WebGPU).
 *
 * `image-engine.ts`'s `computeMetrics` is the ONE seam the compare pane's
 * MSE/PSNR/MAE readout comes through (`view.tsx` → `pool.ts`'s
 * `PaneHandle.computeMetrics` → here), so it is a LIVE product path. It has two
 * branches and this page pins BOTH against a hand-rolled CPU reference:
 *
 *   - the DEFAULT top-left crop with zero offsets, which reduces on the GPU
 *     (`Device.reduceDiffSumSquaredAbs` → the reduction family's
 *     `diffSqAbs`/`sum` variant); and
 *   - any non-default `mapping` (an alignment offset, or `fit:"fill"`), which
 *     falls back to `readback()` + the mapped CPU reduce so the numbers honor
 *     the same align/fit mapping the displayed diff does.
 *
 * The reference is computed independently here from the fixture arrays (NOT by
 * calling back into the engine), so a regression in either reduction path shows
 * up as a numeric disagreement rather than as two mirrored bugs.
 *
 * This page carries the `[metrics]` proof that used to live in
 * `compare-pass.browser.ts`; the rest of that page drove `renderCompose` /
 * `renderDiffDisplay`, two dead engine exports whose WGSL had silently stopped
 * compiling, and was deleted with them.
 *
 * STILL UNPROVEN: this page only pins the MSE/PSNR/MAE *numbers*. The LIVE
 * diff-DISPLAY path (`pool.ts`'s `renderDiff` → `image-engine.ts`'s
 * `renderImage` with the identity op + a scalar colormap — what the compare
 * pane actually paints) has no per-pixel parity proof against its CPU twins
 * `computeDataIndex`, `signedAnalyticColor` (`plots/image/cpu/display-math.ts`)
 * and `extendedOutputEncode` (`plots/image/runtime/tonemap.ts`). A wrong pixel
 * color in that path could still ship undetected by any harness in this suite.
 *
 * RUNNING: `node scripts/test-harness.mjs --only compare-metrics` (the runner
 * bundles with esbuild, serves over http and reads `#status`).
 */
import { getSharedWebGpuDevice } from "../device/device-provider.ts";
import { computeMetrics } from "../image-engine";
import { computeCompareMapping, type ImageCompareAlign, type ImageCompareFit } from "../../runtime/compare-align";
import type { Device, Texture } from "../device/device-contract";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({
  title: "COMPARE METRICS",
  resultFlag: "__compareMetricsTestResult",
  colors: { pass: "#6f6", fail: "#f66" },
});

/** GPU reductions accumulate in a different order than the CPU loop, so compare
 *  to float-accumulation tolerance — tight enough that a wrong region, a wrong
 *  channel count or a dropped term cannot hide inside it. */
const TOL = 1e-5;
/** PSNR is logarithmic; 1e-5 of MSE is ~1e-4 dB. */
const TOL_DB = 1e-3;

type Rgba = [number, number, number, number];

/** Deterministic fixture: a smooth ramp plus a per-pixel wobble, so no two
 *  pixels share a value and a mis-indexed reduction cannot accidentally agree. */
function makeField(w: number, h: number, seed: number): Rgba[] {
  const out: Rgba[] = [];
  let s = (seed * 2654435761) >>> 0;
  const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < w * h; i++) {
    out.push([
      (i % w) / Math.max(1, w - 1),
      rnd(),
      // Deliberately over-range: the metrics run on RAW scene values, never on
      // display-clamped ones, so a stray clamp in the reduction is visible here.
      0.5 + 1.5 * rnd(),
      1,
    ]);
  }
  return out;
}

function uploadField(device: Device, pixels: Rgba[], w: number, h: number): Texture {
  const tex = device.createTexture(w, h, "rgba32float");
  const data = new Float32Array(w * h * 4);
  for (let i = 0; i < pixels.length; i++) data.set(pixels[i]!, i * 4);
  tex.write(data);
  return tex;
}

interface Metrics { mse: number; psnr: number; mae: number }

/**
 * The CPU reference. `offsetA`/`offsetB` are the integer texel offsets a `crop`
 * mapping applies to each source for RESULT pixel (0,0) — mirroring
 * `makeCpuMapSampler`'s crop branch — and `w`/`h` are the RESULT grid. Averages
 * over RGB only (alpha is not part of the comparison).
 */
function cpuMetrics(
  a: Rgba[], aw: number,
  b: Rgba[], bw: number,
  w: number, h: number,
  offsetA: { x: number; y: number },
  offsetB: { x: number; y: number },
): Metrics {
  let sumSq = 0;
  let sumAbs = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pa = a[(y + offsetA.y) * aw + (x + offsetA.x)]!;
      const pb = b[(y + offsetB.y) * bw + (x + offsetB.x)]!;
      for (let c = 0; c < 3; c++) {
        const d = pa[c]! - pb[c]!;
        sumSq += d * d;
        sumAbs += Math.abs(d);
      }
    }
  }
  const n = w * h * 3;
  const mse = sumSq / n;
  return { mse, mae: sumAbs / n, psnr: mse <= 0 ? Infinity : 10 * Math.log10(1 / mse) };
}

function checkAgainst(label: string, got: Metrics, ref: Metrics): boolean {
  const dMse = Math.abs(got.mse - ref.mse);
  const dMae = Math.abs(got.mae - ref.mae);
  const dPsnr = Math.abs(got.psnr - ref.psnr);
  const ok = dMse <= TOL && dMae <= TOL && dPsnr <= TOL_DB;
  report(
    ok,
    `[${label}] mse gpu=${got.mse.toFixed(8)} cpu=${ref.mse.toFixed(8)} (Δ${dMse.toExponential(2)}) · ` +
      `mae gpu=${got.mae.toFixed(8)} cpu=${ref.mae.toFixed(8)} (Δ${dMae.toExponential(2)}) · ` +
      `psnr gpu=${got.psnr.toFixed(6)}dB cpu=${ref.psnr.toFixed(6)}dB (Δ${dPsnr.toExponential(2)})`,
  );
  return ok;
}

/** The DEFAULT mapping (equal dims, top-left crop, zero offsets) — the GPU
 *  reduction fast path. */
async function runDefaultCase(device: Device, w: number, h: number, seed: number): Promise<boolean> {
  const a = makeField(w, h, seed);
  const b = makeField(w, h, seed + 977);
  const texA = uploadField(device, a, w, h);
  const texB = uploadField(device, b, w, h);
  const got = await computeMetrics(device, texA, texB);
  texA.destroy();
  texB.destroy();
  const ref = cpuMetrics(a, w, b, w, w, h, { x: 0, y: 0 }, { x: 0, y: 0 });
  // The reference must be a real, non-degenerate comparison: an all-zero MSE
  // would make the parity assertion vacuous.
  const meaningful = ref.mse > 1e-3 && Number.isFinite(ref.psnr);
  report(meaningful, `[metrics/${w}x${h}] reference is non-degenerate (mse=${ref.mse.toFixed(6)})`);
  return checkAgainst(`metrics/${w}x${h}`, got, ref) && meaningful;
}

/** A ZERO-error pair: MSE and MAE must be exactly 0 and PSNR exactly Infinity
 *  (the `mse <= 0` branch of `metricsFromSums`). */
async function runIdenticalCase(device: Device): Promise<boolean> {
  const w = 12, h = 9;
  const a = makeField(w, h, 31);
  const texA = uploadField(device, a, w, h);
  const texB = uploadField(device, a, w, h);
  const got = await computeMetrics(device, texA, texB);
  texA.destroy();
  texB.destroy();
  const ok = got.mse === 0 && got.mae === 0 && got.psnr === Infinity;
  report(ok, `[metrics/identical] mse=${got.mse} mae=${got.mae} psnr=${got.psnr}`);
  return ok;
}

/**
 * MISMATCHED dims under a non-top-left alignment: the mapping is no longer the
 * zero-offset default, so `computeMetrics` takes the readback + mapped CPU
 * reduce branch. The reduction must cover the ANCHORED overlap only — a
 * regression that silently reduced the top-left corner instead disagrees here.
 */
async function runMappedCase(
  device: Device,
  align: ImageCompareAlign,
  fit: ImageCompareFit,
): Promise<boolean> {
  const aw = 16, ah = 12;
  const bw = 10, bh = 7;
  const a = makeField(aw, ah, 7);
  const b = makeField(bw, bh, 4001);
  const texA = uploadField(device, a, aw, ah);
  const texB = uploadField(device, b, bw, bh);
  const mapping = computeCompareMapping({ w: aw, h: ah }, { w: bw, h: bh }, align, fit, "b");
  const got = await computeMetrics(device, texA, texB, mapping);
  texA.destroy();
  texB.destroy();
  const label = `metrics/${fit}@${align}`;
  if (fit === "fill") {
    // Under fill both sources are bilinearly rescaled onto the primary grid;
    // that resampling reference lives in `makeCpuMapSampler` and is proven by
    // the SSIM/FLIP pages. Here we only pin the SHAPE of the result: the fill
    // mapping must produce a finite, non-zero, self-consistent metric over the
    // primary (B) grid rather than silently collapsing to the crop overlap.
    const consistent = Math.abs(got.psnr - 10 * Math.log10(1 / got.mse)) <= TOL_DB;
    const ok = Number.isFinite(got.mse) && got.mse > 1e-3 && Number.isFinite(got.mae) && got.mae > 1e-3 && consistent;
    report(ok, `[${label}] mse=${got.mse.toFixed(8)} mae=${got.mae.toFixed(8)} psnr=${got.psnr.toFixed(6)}dB, psnr===10log10(1/mse)`);
    return ok;
  }
  const ref = cpuMetrics(a, aw, b, bw, mapping.result.w, mapping.result.h, mapping.offsetA, mapping.offsetB);
  const anchored = mapping.offsetA.x !== 0 || mapping.offsetA.y !== 0;
  report(anchored, `[${label}] mapping is genuinely non-default (offsetA=${mapping.offsetA.x},${mapping.offsetA.y}, result=${mapping.result.w}x${mapping.result.h})`);
  return checkAgainst(label, got, ref) && anchored;
}

/**
 * The three metrics are not independent: `metricsFromSums` derives PSNR from
 * MSE with a single formula. Pin that identity on a live result so a future
 * change cannot let the readout drift between the number and its dB form.
 */
async function runInternalConsistency(device: Device): Promise<boolean> {
  const w = 20, h = 15;
  const a = makeField(w, h, 123);
  const b = makeField(w, h, 456);
  const texA = uploadField(device, a, w, h);
  const texB = uploadField(device, b, w, h);
  const got = await computeMetrics(device, texA, texB);
  texA.destroy();
  texB.destroy();
  const expected = 10 * Math.log10(1 / got.mse);
  const ok = Math.abs(got.psnr - expected) <= TOL_DB && got.mae > 0 && got.mse > 0;
  report(ok, `[metrics/consistency] psnr=${got.psnr.toFixed(6)}dB === 10·log10(1/mse)=${expected.toFixed(6)}dB`);
  return ok;
}

async function runAll(device: Device): Promise<boolean> {
  report(true, `device.backend = ${device.backend}`);
  let ok = true;
  // Several sizes: a single-row strip, a non-square grid, and a size that is not
  // a multiple of the reduction workgroup so the tail partial is exercised.
  ok = (await runDefaultCase(device, 4, 1, 11)) && ok;
  ok = (await runDefaultCase(device, 16, 16, 12)) && ok;
  ok = (await runDefaultCase(device, 37, 23, 13)) && ok;
  ok = (await runIdenticalCase(device)) && ok;
  ok = (await runMappedCase(device, "center", "crop")) && ok;
  ok = (await runMappedCase(device, "bottom-right", "crop")) && ok;
  ok = (await runMappedCase(device, "top-left", "fill")) && ok;
  ok = (await runInternalConsistency(device)) && ok;
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
