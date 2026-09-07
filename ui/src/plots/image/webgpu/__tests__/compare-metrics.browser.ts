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
 * It also carries the `[equiv/srgb-operand]` proof that the two OPERAND UPLOAD
 * formats are interchangeable — `rgba8unorm-srgb` from a decoded `ImageBitmap`
 * against the scene-linear `rgba32float` field it replaced — which is what lets
 * the pane stop expanding 8-bit comparison operands on the CPU. See
 * `runSrgbOperandEquivalence`.
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
import { passthroughWGSL } from "../shaders/passthrough.wgsl.ts";
import { imageDataToSceneField } from "../../resources/scene-field.ts";
import { srgbOetf } from "../../runtime/tonemap";
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
/**
 * Tolerance for the GPU's sRGB DECODE against the exact IEC 61966-2-1 EOTF
 * (`srgbEotf`) — three orders looser than {@link TOL}, and deliberately so.
 *
 * A GPU's sRGB texture decode is NOT required to reproduce the EOTF to float
 * precision: the WebGPU/Vulkan/Metal specs all allow implementation tolerance
 * there, and hardware uses a reduced-precision table. Measured on Apple
 * Metal-3 (Chrome), the worst deviation over all 256 code values is ~1.2e-4
 * absolute (code 80: 0.08034 vs the exact 0.08022) — 1.5e-3 RELATIVE, and
 * about 6% of the gap between two adjacent 8-bit code values there. So this
 * number is a bound on the HARDWARE, not on the code under test, and it is set
 * high enough to hold on any conformant GPU rather than pinned to one vendor's
 * table. The tight, hardware-independent statement — that the decode still
 * identifies the source byte uniquely — is the `srgbOetf` round-trip assertion
 * in the case below, which is exact.
 */
const SRGB_DECODE_TOL = 5e-4;

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

/**
 * SRGB-FORMAT OPERAND EQUIVALENCE (design §3.3).
 *
 * Comparison operands used to reach the GPU as scene-linear `rgba32float`,
 * expanded from the decoded 8-bit bytes by `imageDataToSceneField` — a scalar
 * JS loop calling the sRGB EOTF per channel, then four times the upload bytes.
 * They now upload as `rgba8unorm-srgb` straight from the decoded `ImageBitmap`,
 * because WebGPU's `textureLoad` on an sRGB-format SAMPLED texture returns
 * exactly those scene-linear values — the hardware performs the EOTF. Every
 * comparison kernel binds its operands as `texture_2d<f32>` and reads them with
 * `textureLoad`, so nothing downstream had to change.
 *
 * That last sentence is a claim about the GPU, and this case is its proof: the
 * SAME 8-bit fixture goes up both ways — as `rgba8unorm-srgb` from an
 * `ImageBitmap` via `copyExternalImageToTexture`, and as `rgba32float` from
 * `imageDataToSceneField` — both textures are read through the SAME trivial
 * `textureLoad` pass (`passthroughWGSL` into an `rgba32float` target), and the
 * two readbacks are compared three ways:
 *
 *   - RGB re-encodes (`srgbOetf`, round to 8 bits) to the EXACT source code
 *     value — hardware-independent, and the real statement: the GPU decode
 *     loses nothing the 8-bit source carried;
 *   - RGB agrees with the exact EOTF within {@link SRGB_DECODE_TOL} — a bound
 *     on the hardware's decode table, see that constant;
 *   - alpha agrees BIT-EXACTLY (an sRGB format leaves alpha linear, exactly as
 *     `imageDataToSceneField` did).
 *
 * A premultiply, a row flip or a colour-space conversion introduced by
 * `copyExternalImageToTexture` would show up here as a per-channel delta rather
 * than as a silently shifted metric on a live compare pane.
 */
async function runSrgbOperandEquivalence(device: Device): Promise<boolean> {
  const w = 64;
  const h = 64;
  // Every one of the 256 code values appears in each colour channel (4096
  // pixels, strides coprime with 256), so the whole transfer curve is covered —
  // including the linear segment below 0.04045 where the EOTF changes form.
  const bytes = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    bytes[i * 4] = i % 256;
    bytes[i * 4 + 1] = (i * 7 + 13) % 256;
    bytes[i * 4 + 2] = (i * 61 + 197) % 256;
    bytes[i * 4 + 3] = (i * 5 + 3) % 256;
  }
  const image = new ImageData(bytes, w, h);

  // The bitmap the product uploads: unpremultiplied, no colour-space
  // conversion — the same options `resources/decoded-image.ts` decodes with.
  const bitmap = await createImageBitmap(image, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const texSrgb = device.createTexture(w, h, "rgba8unorm-srgb");
  texSrgb.write(bitmap);

  // The path it replaces: the CPU sRGB→linear expansion, uploaded as floats.
  const field = imageDataToSceneField(image);
  const texFloat = device.createTexture(w, h, "rgba32float");
  texFloat.write(field.pixels);

  const gpu = await loadThroughPass(device, texSrgb, w, h);
  const cpu = await loadThroughPass(device, texFloat, w, h);
  texSrgb.destroy();
  texFloat.destroy();
  bitmap.close();

  if (gpu.length !== cpu.length || gpu.length !== w * h * 4) {
    report(false, `[equiv/srgb-operand] readback lengths ${gpu.length} / ${cpu.length} (expected ${w * h * 4})`);
    return false;
  }
  let maxRgb = 0;
  let worstRgbAt = -1;
  let codeMismatches = 0;
  let firstCodeAt = -1;
  let alphaMismatches = 0;
  let firstAlphaAt = -1;
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) {
      const at = i * 4 + c;
      const d = Math.abs(gpu[at]! - cpu[at]!);
      if (d > maxRgb) {
        maxRgb = d;
        worstRgbAt = at;
      }
      // THE HARDWARE-INDEPENDENT GATE (see the tolerance note below): re-encode
      // what the GPU handed back and it must land on the SOURCE code value
      // exactly — the sRGB format loses nothing the 8-bit source carried.
      if (Math.round(255 * srgbOetf(gpu[at]!)) !== bytes[at]!) {
        codeMismatches++;
        if (firstCodeAt < 0) firstCodeAt = at;
      }
    }
    if (gpu[i * 4 + 3]! !== cpu[i * 4 + 3]!) {
      alphaMismatches++;
      if (firstAlphaAt < 0) firstAlphaAt = i;
    }
  }
  // A degenerate fixture (an all-black upload on either side) would make the
  // agreement vacuous — pin that both readbacks carry real, differing values.
  let nonTrivial = false;
  for (let i = 0; i < gpu.length; i += 4) {
    if (gpu[i]! > 0.5 && gpu[i]! < 1) { nonTrivial = true; break; }
  }
  report(nonTrivial, `[equiv/srgb-operand] fixture is non-degenerate (the sRGB upload carries mid-range linear values)`);
  const codeOk = codeMismatches === 0;
  report(
    codeOk,
    `[equiv/srgb-operand] all ${w * h * 3} rgb samples re-encode to their EXACT source code value` +
      (codeOk
        ? ""
        : ` — ${codeMismatches} mismatch(es), first at sample ${firstCodeAt} (srgb=${gpu[firstCodeAt]!.toPrecision(9)} re-encodes to ${Math.round(255 * srgbOetf(gpu[firstCodeAt]!))}, source byte ${bytes[firstCodeAt]})`),
  );
  const rgbOk = maxRgb <= SRGB_DECODE_TOL;
  report(
    rgbOk,
    `[equiv/srgb-operand] rgb max|Δ| vs the exact EOTF ${maxRgb.toExponential(2)} <= ${SRGB_DECODE_TOL.toExponential(0)}` +
      (worstRgbAt >= 0
        ? ` (worst at texel ${Math.floor(worstRgbAt / 4)} ch${worstRgbAt % 4}, code ${bytes[worstRgbAt]}: srgb=${gpu[worstRgbAt]!.toPrecision(9)} scene-field=${cpu[worstRgbAt]!.toPrecision(9)})`
        : ""),
  );
  const alphaOk = alphaMismatches === 0;
  report(
    alphaOk,
    `[equiv/srgb-operand] alpha bit-exact on all ${w * h} texels` +
      (alphaOk ? "" : ` — ${alphaMismatches} mismatch(es), first at texel ${firstAlphaAt} (srgb=${gpu[firstAlphaAt * 4 + 3]} scene-field=${cpu[firstAlphaAt * 4 + 3]})`),
  );
  return rgbOk && codeOk && alphaOk && nonTrivial;
}

/** The trivial `textureLoad` copy every comparison kernel's operand read stands
 *  in for: one fullscreen pass into an `rgba32float` target, read back as
 *  floats. Whatever the source FORMAT, this returns the values a kernel sees. */
async function loadThroughPass(device: Device, source: Texture, w: number, h: number): Promise<Float32Array> {
  const target = device.createTexture(w, h, "rgba32float");
  const pipeline = device.createRenderPipeline({ shaderWGSL: passthroughWGSL, targetFormat: "rgba32float" });
  const bindGroup = device.createBindGroup(pipeline, [{ binding: 0, resource: source }]);
  device.renderFullscreen(target, pipeline, bindGroup);
  const out = await device.readback(target);
  bindGroup.destroy?.();
  target.destroy();
  if (!(out instanceof Float32Array)) throw new Error(`expected Float32Array from an rgba32float readback, got ${out.constructor.name}`);
  return out;
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
  // Its own try/catch: an unsupported texture format throws out of
  // `createTexture`, and that must read as ONE failing proof rather than
  // abandoning the metrics cases above it.
  try {
    ok = (await runSrgbOperandEquivalence(device)) && ok;
  } catch (err) {
    report(false, `[equiv/srgb-operand] threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    ok = false;
  }
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
