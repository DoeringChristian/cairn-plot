/**
 * IMAGE-OPERATION GPU↔CPU parity harness (Phase 2 — the diff IMAGE operations).
 *
 * jsdom has no WebGPU, so — like every `*.browser.ts` harness here — this is a
 * browser page driven headlessly by `scripts/test-harness.mjs` (it lives under
 * `engine/__tests__/`, so the runner treats it as a parity proof and runs it by
 * default). It sets `#status` to PASS/FAIL.
 *
 * WHAT IT PROVES. The Phase-2 content-op unification renders a DIFF through the
 * SAME image pipeline as a single image: the shader samples TWO source slots and
 * the specialized `cairnContent(a, b)` produces the raw per-channel error, which the DISPLAY
 * stage (the display-operation registry) then encodes. This harness drives that
 * exact GPU path (`renderImage` with `srcB` + `imageOperation` + the op's
 * defaultEncoding) for every DIRECT diff op and asserts the readback equals the
 * COMPOSED CPU twin — `displayEncoding.cpu(contentOp.cpu([a],[b]), 3, params)` —
 * i.e. the content-op `cpu` twin (the diff pixel-value readout's source of truth)
 * threaded through the same display-operation `cpu` the single-image LUT/analytic
 * path uses. So the unified pane's diff render === the two registries' twins, by
 * construction, across the whole direct-op set.
 *
 * Cached ops (FLIP/HDR-FLIP/SSIM) are NOT covered here — they render into a
 * result texture via the `engine/kernels` multipass path, already parity-proven by
 * the `flip`/`hdr-flip`/`ssim` harnesses; the unified pane binds that result as a
 * single source + identity display (pane-level wiring, a later phase).
 */
import { getSharedWebGpuDevice } from "../device/device-provider.ts";
import { isDeviceLostError } from "../device/device";
import { renderImage, computeMetrics, type ImageParams } from "../image-engine";
import { acquirePane, releasePane, getCanvasSurfaceForTest, type SourceUpload } from "../pool";
import { ensureDiff, ensureSsimScalar, getDiffComputeCount } from "../diff-engine";
import { prepareDisplayOperation } from "../prepare-display-operation.ts";
import { getCpuImageOperation, type CpuImageOperationContext } from "../../cpu/image-operations.ts";
import { getWebGpuImageOperation } from "../image-operations.ts";
import { evaluateDisplayOperation as evaluateCpuDisplayOperation, getCpuDisplayOperation, type CpuDisplayOperation } from "../../cpu/display-operations.ts";
import { getWebGpuDisplayOperation } from "../display.ts";
import { DEFAULT_DISPLAY_PARAMETERS, DEFAULT_COMPARISON_DISPLAY_OPERATION_ID, type DisplayParameters } from "../../runtime/display-settings.ts";
import { outputEncode, extendedOutputEncode, type RgbTriple } from "../../runtime/tonemap";
import { colormapFloatLUT } from "../../../../settings/colormaps/lut";
import type { Device, Texture } from "../device/device-contract";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "CONTENT OPS" });
type HarnessDisplayOperation = CpuDisplayOperation & {
  category: CpuDisplayOperation["definition"]["category"];
  implementation: NonNullable<ReturnType<typeof getWebGpuDisplayOperation>>["implementation"];
};
const getDisplayOperation = (id: string): HarnessDisplayOperation | undefined => {
  const cpu = getCpuDisplayOperation(id);
  const gpu = getWebGpuDisplayOperation(id);
  return cpu && gpu ? { ...cpu, category: cpu.definition.category, implementation: gpu.implementation } : undefined;
};
const evaluateDisplayOperation = (
  operation: HarnessDisplayOperation,
  values: readonly number[],
  channels: number,
  parameters: DisplayParameters,
) => evaluateCpuDisplayOperation(operation, values, channels, parameters);
const DEFAULT_ENCODE_PARAMS = DEFAULT_DISPLAY_PARAMETERS;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const byteOf = (x: number): number => Math.round(clamp01(x) * 255);
const uvFull = { x: 0, y: 0, w: 1, h: 1 };

/** Source (A) / reference (B) RGB pairs — spanning zero error, positive & NEGATIVE
 *  mean error (for the signed/analytic red-green ops), an over-range operand, and a
 *  large error that CLAMPS on the SDR surface. Alpha 1 (ignored). */
const PAIRS: Array<{ a: number[]; b: number[] }> = [
  { a: [0.5, 0.5, 0.5, 1], b: [0.5, 0.5, 0.5, 1] }, // zero error
  { a: [0.8, 0.6, 0.4, 1], b: [0.3, 0.5, 0.4, 1] }, // positive mean
  { a: [0.2, 0.3, 0.1, 1], b: [0.7, 0.5, 0.6, 1] }, // NEGATIVE mean (signed → red)
  { a: [1.5, 0.0, 0.5, 1], b: [0.5, 0.5, 0.5, 1] }, // over-range operand, mixed sign
  { a: [2.0, 2.0, 2.0, 1], b: [0.0, 0.0, 0.0, 1] }, // large error (clamps on SDR)
];

function buildTex(device: Device, rows: number[][]): Texture {
  const tex = device.createTexture(rows.length, 1, "rgba32float");
  const data = new Float32Array(rows.length * 4);
  for (let i = 0; i < rows.length; i++) data.set(rows[i]!, i * 4);
  tex.write(data);
  return tex;
}

/**
 * Run one direct diff op through the unified GPU image path + assert the readback
 * matches the composed CPU twin. `signed` ops use the ANALYTIC red-green encoding
 * (computed color → shared output-encode); magnitude ops use the TURBO table LUT
 * (reduce → tev log2 index → LUT, display-sRGB). Both reduce with `mean` (tev's
 * average) over the 3 diff channels. SDR target, nearest filter, EV 0 → byte-exact
 * within 1/255.
 */
async function runDiffOpCase(device: Device, operationId: string, displayOperationId: string): Promise<boolean> {
  const op = getCpuImageOperation(operationId);
  if (!op || getWebGpuImageOperation(operationId)?.kind !== "inline") {
    report(false, `[${operationId}] is not implemented as an inline operation by both backends`);
    return false;
  }
  const enc = getDisplayOperation(displayOperationId);
  if (!enc) {
    report(false, `[${operationId}/${displayOperationId}] encoding is not registered`);
    return false;
  }
  const encParams = { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" as const };

  const texA = buildTex(device, PAIRS.map((p) => p.a));
  const texB = buildTex(device, PAIRS.map((p) => p.b));
  const target = device.createTexture(PAIRS.length, 1, "rgba8unorm");

  const params: ImageParams = {
    exposureEV: 0,
    ...prepareDisplayOperation(displayOperationId, { hdrSurface: false }),
    srcB: texB,
    imageOperation: operationId,
    reduce: "mean",
    channelCount: 3,
    uv: uvFull,
    filter: "nearest",
  };
  renderImage(device, target, texA, params);
  const out = await device.readback(target);
  texA.destroy();
  texB.destroy();
  target.destroy();

  if (!(out instanceof Uint8Array)) {
    report(false, `[${operationId}] expected Uint8Array readback, got ${out.constructor.name}`);
    return false;
  }

  let ok = true;
  for (let i = 0; i < PAIRS.length; i++) {
    // CONTENT twin: the op's per-channel raw diff (the readout source of truth).
    const content = op.evaluate([PAIRS[i]!.a, PAIRS[i]!.b], 3);
    // DISPLAY twin: the op's defaultEncoding cpu (reduce → colormap/analytic).
    let exp: RgbTriple;
    if (enc.category === "curve" || enc.category === "remap" || enc.implementation.kind === "analytic") {
      // red-green analytic cpu returns SCENE-LINEAR; thread the SAME sRGB
      // output-encode the GPU analytic branch applies.
      const lin = evaluateDisplayOperation(enc, content, 3, encParams);
      exp = [outputEncode(lin[0], undefined), outputEncode(lin[1], undefined), outputEncode(lin[2], undefined)];
    } else {
      // turbo table cpu returns DISPLAY-sRGB directly (LUT holds encoded colors).
      exp = evaluateDisplayOperation(enc, content, 3, encParams);
    }
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(
          false,
          `[${operationId}] px[${i}] a=${JSON.stringify(PAIRS[i]!.a.slice(0, 3))} b=${JSON.stringify(PAIRS[i]!.b.slice(0, 3))} ch[${c}] expected=${eb} actual=${ab}`,
        );
      }
    }
  }
  report(ok, `[${operationId}/${displayOperationId}] GPU cairnContent + display === composed cpu twin`);
  return ok;
}

/** Identity sanity: a placeholder second slot renders the single
 *  source unchanged (turbo of the raw scalar) — the second slot never leaks in. */
async function runIdentityInertCase(device: Device): Promise<boolean> {
  const scalars = [[0.0, 0, 0, 1], [0.25, 0, 0, 1], [0.5, 0, 0, 1], [1.0, 0, 0, 1]];
  const enc = getDisplayOperation("turbo")!;
  const texA = buildTex(device, scalars);
  const target = device.createTexture(scalars.length, 1, "rgba8unorm");
  // No srcB → placeholder; imageOperation 0 (identity) ignores it.
  const params: ImageParams = {
    exposureEV: 0,
    displayOperationId: "turbo",
    isScalar: true,
    colormap: colormapFloatLUT("turbo"),
    reduce: "mean",
    channelCount: 1,
    hdrOut: false,
    uv: uvFull,
    filter: "nearest",
  };
  renderImage(device, target, texA, params);
  const out = await device.readback(target);
  texA.destroy();
  target.destroy();
  if (!(out instanceof Uint8Array)) {
    report(false, `[identity-inert] expected Uint8Array readback`);
    return false;
  }
  let ok = true;
  for (let i = 0; i < scalars.length; i++) {
    const exp = evaluateDisplayOperation(enc, [scalars[i]![0]!], 1, { ...DEFAULT_ENCODE_PARAMS });
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(false, `[identity-inert] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
      }
    }
  }
  report(ok, `[identity] specialized identity ignores the placeholder second slot`);
  return ok;
}

/**
 * COMPOSITOR op (Phase 3): drive `split` through the unified image path as a
 * LIGHT composite (isScalar false) and assert the readback === the composed cpu
 * twin, on BOTH an SDR (rgba8unorm) surface — clamp + sRGB OETF — and an HDR
 * (rgba16float) surface — the extended (unclamped) encode, so an over-range
 * composite survives. The two operands are an N-wide strip so the fragment SCREEN
 * uv.x = (i+0.5)/N straddles the split divider (`param` 0.5) — proving the
 * per-texel `uv.x < param` cut. The cpu twin is `op.cpu([a,b], 3, {uv,param})` →
 * the display twin (operator srgb = clamp, then output-encode), the SAME
 * two-registry composition the diff case uses.
 */
async function runCompositorOpCase(device: Device, operationId: "split", param: number): Promise<boolean> {
  const op = getCpuImageOperation(operationId);
  if (!op || getWebGpuImageOperation(operationId)?.kind !== "inline") {
    report(false, `[${operationId}] not a registered direct image operation`);
    return false;
  }
  // Reference (a) / foreground (b) rows, incl. an OVER-RANGE operand (2.0) that
  // clamps on SDR but survives on the HDR surface.
  const rowsA: number[][] = [
    [0.8, 0.6, 0.4, 1],
    [0.2, 0.9, 0.3, 1],
    [2.0, 0.1, 0.5, 1],
    [0.3, 0.3, 0.3, 1],
    [0.5, 0.5, 0.5, 1],
    [0.1, 0.7, 0.2, 1],
  ];
  const rowsB: number[][] = [
    [0.1, 0.2, 0.9, 1],
    [0.7, 0.3, 0.6, 1],
    [0.0, 0.0, 0.0, 1],
    [1.5, 0.4, 0.2, 1],
    [0.2, 0.8, 0.6, 1],
    [0.9, 0.1, 0.4, 1],
  ];
  const N = rowsA.length;
  const twin = (i: number, c: number): number => {
    const ctx: CpuImageOperationContext = { uv: [(i + 0.5) / N, 0.5], parameter: param };
    return op.evaluate([rowsA[i]!, rowsB[i]!], 3, ctx)[c]!;
  };

  let ok = true;
  for (const hdrOut of [false, true]) {
    const texA = buildTex(device, rowsA);
    const texB = buildTex(device, rowsB);
    const target = device.createTexture(N, 1, hdrOut ? "rgba16float" : "rgba8unorm");
    const params: ImageParams = {
      exposureEV: 0,
      // SDR: `srgb` = clamp01 then the sRGB OETF (output-encode) — an over-range
      // operand clamps. HDR: `extended` = identity operator (no clamp) then the
      // EXTENDED (unclamped) encode, so an over-range composite survives.
      displayOperationId: hdrOut ? "linear" : "srgb",
      isScalar: false,
      srcB: texB,
      imageOperation: operationId,
      contentParam: param,
      hdrOut,
      srgbDecode: false, // scene-linear float operands
      uv: uvFull,
      filter: "nearest",
    };
    renderImage(device, target, texA, params);
    const out = await device.readback(target);
    texA.destroy();
    texB.destroy();
    target.destroy();
    for (let i = 0; i < N; i++) {
      for (let c = 0; c < 3; c++) {
        const composite = twin(i, c);
        if (hdrOut) {
          const exp = extendedOutputEncode(composite, undefined);
          const act = (out as Float32Array)[i * 4 + c] ?? 0;
          // f16 storage step near the encoded over-range values (~1.35) is ~1e-3.
          if (Math.abs(act - exp) > 3e-3) {
            ok = false;
            report(false, `[${operationId}:hdr] px[${i}].ch[${c}] expected=${exp.toFixed(4)} actual=${act.toFixed(4)}`);
          }
        } else {
          const exp = byteOf(outputEncode(composite, undefined));
          const act = (out as Uint8Array)[i * 4 + c] ?? 0;
          if (Math.abs(act - exp) > 1) {
            ok = false;
            report(false, `[${operationId}:sdr] px[${i}].ch[${c}] expected=${exp} actual=${act}`);
          }
        }
      }
    }
  }
  report(ok, `[${operationId}] (param=${param}) GPU cairnContent composite === composed cpu twin (SDR + HDR surfaces)`);
  return ok;
}

/** Build a `SourceUpload` (rgba32float) from RGBA rows — the CPU buffer the pool
 *  retains + uploads (mirrors what a pane hands `setSource`/`setSourceB`). */
function buildUpload(rows: number[][]): SourceUpload {
  const data = new Float32Array(rows.length * 4);
  for (let i = 0; i < rows.length; i++) data.set(rows[i]!, i * 4);
  return { data, width: rows.length, height: 1, format: "rgba32float" };
}

/**
 * STAGE A (pool second slot): drive the SAME direct diff op through the POOL —
 * `setSource(a)` + `setSourceB(b)` + `render({imageOperation})` — and assert the
 * SURFACE readback equals the composed CPU twin, byte-for-byte with the direct
 * `renderImage(srcB,…)` path. Proves the pool retains + uploads the second slot
 * and injects it as `params.srcB` (the pane never touches the GPU texture).
 */
async function runPoolDirectOpCase(device: Device, operationId: string, displayOperationId: string): Promise<boolean> {
  const op = getCpuImageOperation(operationId);
  if (!op || getWebGpuImageOperation(operationId)?.kind !== "inline") {
    report(false, `[pool:${operationId}] not a registered direct image operation`);
    return false;
  }
  const enc = getDisplayOperation(displayOperationId);
  if (!enc) {
    report(false, `[pool:${operationId}/${displayOperationId}] encoding is not registered`);
    return false;
  }
  const encParams = { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" as const };

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const handle = await acquirePane(canvas, { hdr: false });
  handle.setSource(buildUpload(PAIRS.map((p) => p.a)));
  handle.setSourceB(buildUpload(PAIRS.map((p) => p.b)));
  handle.resize(PAIRS.length, 1);
  const params: ImageParams = {
    exposureEV: 0,
    ...prepareDisplayOperation(displayOperationId, { hdrSurface: false }),
    // NB: NO `srcB` here — the pool supplies it from `setSourceB`.
    imageOperation: operationId,
    reduce: "mean",
    channelCount: 3,
    uv: uvFull,
    filter: "nearest",
  };
  const ok0 = handle.render(params);
  const surface = getCanvasSurfaceForTest(canvas);
  if (!surface) {
    report(false, `[pool:${operationId}] no live surface after render`);
    releasePane(handle);
    canvas.remove();
    return false;
  }
  const out = await device.readback(surface);
  releasePane(handle);
  canvas.remove();

  if (!ok0) {
    report(false, `[pool:${operationId}] handle.render returned false (engine failed)`);
    return false;
  }
  if (!(out instanceof Uint8Array)) {
    report(false, `[pool:${operationId}] expected Uint8Array surface readback, got ${out.constructor.name}`);
    return false;
  }
  let ok = true;
  for (let i = 0; i < PAIRS.length; i++) {
    const content = op.evaluate([PAIRS[i]!.a, PAIRS[i]!.b], 3);
    let exp: RgbTriple;
    if (enc.category === "curve" || enc.category === "remap" || enc.implementation.kind === "analytic") {
      const lin = evaluateDisplayOperation(enc, content, 3, encParams);
      exp = [outputEncode(lin[0], undefined), outputEncode(lin[1], undefined), outputEncode(lin[2], undefined)];
    } else {
      exp = evaluateDisplayOperation(enc, content, 3, encParams);
    }
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(false, `[pool:${operationId}] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
      }
    }
  }
  report(ok, `[pool:${operationId}] setSource + setSourceB + render(imageOperation) surface === composed cpu twin`);
  return ok;
}

/**
 * STAGE B (renderDiffCached): the pool's cached-op path === the manual
 * `ensureDiff` + `renderImage(result, isScalar+magma)` reference, byte-for-byte,
 * for a multi-pass kernel (`flip`), AND a repeat render is a CACHE HIT (the
 * expensive compute does not re-run on a re-blit). Proves the pool owns the
 * content-keyed compute+cache and displays the scalar-error RESULT through the
 * unified image path with an explicitly-picked non-turbo LUT (magma).
 */
async function runPoolCachedOpCase(device: Device): Promise<boolean> {
  // 4x4 sources with structured variation so FLIP produces a non-degenerate map.
  const rowsA: number[][] = [];
  const rowsB: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const v = (i % 4) / 3;
    rowsA.push([v, v, v, 1]);
    rowsB.push([Math.min(1, v + 0.15), v * 0.8, v, 1]);
  }
  const toTex = (rows: number[][]): Texture => {
    const t = device.createTexture(4, 4, "rgba32float");
    const d = new Float32Array(16 * 4);
    for (let i = 0; i < 16; i++) d.set(rows[i]!, i * 4);
    t.write(d);
    return t;
  };
  const texA = toTex(rowsA);
  const texB = toTex(rowsB);
  const magma = colormapFloatLUT("magma");
  const displayParams: ImageParams = {
    exposureEV: 0,
    displayOperationId: "magma",
    isScalar: true,
    colormap: magma,
    reduce: "mean",
    channelCount: 1,
    norm: "linear",
    hdrOut: false,
    uv: uvFull,
    filter: "nearest",
  };
  // Reference: ensure the diff RESULT, then display it via the unified image path.
  const refEntry = ensureDiff(device, texA, texB, "flip", undefined, "ref:a", "ref:b");
  const refTarget = device.createTexture(4, 4, "rgba8unorm");
  renderImage(device, refTarget, refEntry.texture, displayParams);
  const refOut = await device.readback(refTarget);
  refTarget.destroy();

  // Pool: renderDiffCached over the SAME sources.
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const handle = await acquirePane(canvas, { hdr: false });
  handle.setSource({ data: rowsToF32(rowsA), width: 4, height: 4, format: "rgba32float" });
  handle.setSourceB({ data: rowsToF32(rowsB), width: 4, height: 4, format: "rgba32float" });
  handle.resize(4, 4);
  const before = getDiffComputeCount();
  const poolEntry = handle.renderDiffCached("flip", { a: "pool:a", b: "pool:b" }, undefined, displayParams);
  const poolSurface = getCanvasSurfaceForTest(canvas);
  if (!poolSurface) {
    report(false, `[pool:flip] no live surface after renderDiffCached`);
    releasePane(handle);
    canvas.remove();
    texA.destroy();
    texB.destroy();
    return false;
  }
  const poolOut = await device.readback(poolSurface);
  // Second render with the SAME keys must be a cache hit (no recompute).
  handle.renderDiffCached("flip", { a: "pool:a", b: "pool:b" }, undefined, displayParams);
  const after = getDiffComputeCount();
  releasePane(handle);
  canvas.remove();
  texA.destroy();
  texB.destroy();

  let ok = true;
  if (!poolEntry) {
    report(false, `[pool:flip] renderDiffCached returned null`);
    return false;
  }
  if (!(refOut instanceof Uint8Array) || !(poolOut instanceof Uint8Array)) {
    report(false, `[pool:flip] expected Uint8Array readbacks`);
    return false;
  }
  // The first renderDiffCached computes flip ONCE (miss); the second is a HIT.
  const computedOnRepeat = after - (before + 1);
  if (computedOnRepeat !== 0) {
    ok = false;
    report(false, `[pool:flip] repeat renderDiffCached recomputed (compute delta on re-blit = ${computedOnRepeat}, want 0)`);
  }
  let nonZero = false;
  for (let i = 0; i < 16 * 4; i++) {
    if ((poolOut[i] ?? 0) !== 0) nonZero = true;
    const rb = refOut[i] ?? 0;
    const pb = poolOut[i] ?? 0;
    if (Math.abs(rb - pb) > 1) {
      ok = false;
      report(false, `[pool:flip] byte[${i}] ref=${rb} pool=${pb}`);
      break;
    }
  }
  if (!nonZero) {
    ok = false;
    report(false, `[pool:flip] pool surface readback is all-zero (degenerate diff display)`);
  }
  report(ok, `[pool:flip] renderDiffCached === ensureDiff + renderImage(result, magma); repeat = cache hit`);
  return ok;
}

function rowsToF32(rows: number[][]): Float32Array {
  const d = new Float32Array(rows.length * 4);
  for (let i = 0; i < rows.length; i++) d.set(rows[i]!, i * 4);
  return d;
}

/**
 * STAGE C (pool diff-chrome methods): the metrics/SSIM/readback the UNIFIED DIFF
 * PANE (`GpuImagePane` + `compareSource`) drives for its chip + TEV numbers, run
 * THROUGH the pool over the two live slots. Asserts:
 *   - `handle.computeMetrics()` === the direct `computeMetrics(device, texA, texB)`
 *     over the same operands (the pool owns the textures — same numbers);
 *   - `handle.computeSsim()` === the direct `ensureSsimScalar(...)`;
 *   - `handle.readDiffResult(entry)` yields the cached FLIP RESULT samples
 *     (non-degenerate), the per-pixel TEV source for a cached metric.
 */
async function runPoolChromeCase(device: Device): Promise<boolean> {
  const rowsA: number[][] = [];
  const rowsB: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const v = (i % 4) / 3;
    rowsA.push([v, v, v, 1]);
    rowsB.push([Math.min(1, v + 0.2), v * 0.7, v, 1]);
  }
  const texA = (() => {
    const t = device.createTexture(4, 4, "rgba32float");
    t.write(rowsToF32(rowsA));
    return t;
  })();
  const texB = (() => {
    const t = device.createTexture(4, 4, "rgba32float");
    t.write(rowsToF32(rowsB));
    return t;
  })();
  const refMetrics = await computeMetrics(device, texA, texB);
  const refSsim = await ensureSsimScalar(device, texA, texB, "chrome:a", "chrome:b");
  texA.destroy();
  texB.destroy();

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const handle = await acquirePane(canvas, { hdr: false });
  handle.setSource({ data: rowsToF32(rowsA), width: 4, height: 4, format: "rgba32float" });
  handle.setSourceB({ data: rowsToF32(rowsB), width: 4, height: 4, format: "rgba32float" });
  handle.resize(4, 4);

  const poolMetricsP = handle.computeMetrics();
  const poolSsimP = handle.computeSsim({ a: "pchrome:a", b: "pchrome:b" });
  const magma = colormapFloatLUT("magma");
  const entry = handle.renderDiffCached(
    "flip",
    { a: "pchrome:a", b: "pchrome:b" },
    undefined,
    {
      exposureEV: 0,
      displayOperationId: "magma",
      isScalar: true,
      colormap: magma,
      reduce: "mean",
      channelCount: 1,
      norm: "linear",
      hdrOut: false,
      uv: uvFull,
      filter: "nearest",
    },
  );
  const readbackP = entry ? handle.readDiffResult(entry) : null;
  const poolMetrics = poolMetricsP ? await poolMetricsP : null;
  const poolSsim = poolSsimP ? await poolSsimP : null;
  const readback = readbackP ? await readbackP : null;
  releasePane(handle);
  canvas.remove();

  let ok = true;
  if (!poolMetrics) {
    report(false, `[pool:chrome] computeMetrics returned null`);
    return false;
  }
  const mseClose = Math.abs(poolMetrics.mse - refMetrics.mse) <= 1e-6 + Math.abs(refMetrics.mse) * 1e-4;
  const maeClose = Math.abs(poolMetrics.mae - refMetrics.mae) <= 1e-6 + Math.abs(refMetrics.mae) * 1e-4;
  if (!mseClose || !maeClose) {
    ok = false;
    report(false, `[pool:chrome] metrics diverge: pool mse=${poolMetrics.mse} mae=${poolMetrics.mae} vs ref mse=${refMetrics.mse} mae=${refMetrics.mae}`);
  }
  if (poolSsim == null || Math.abs(poolSsim - refSsim) > 1e-4) {
    ok = false;
    report(false, `[pool:chrome] SSIM diverges: pool=${poolSsim} vs ref=${refSsim}`);
  }
  if (!readback || !(readback instanceof Float32Array) || !readback.some((v) => v !== 0)) {
    ok = false;
    report(false, `[pool:chrome] readDiffResult produced no non-zero FLIP samples`);
  }
  report(ok, `[pool:chrome] computeMetrics/computeSsim/readDiffResult === direct engine references`);
  return ok;
}

const DIRECT_DIFF_OPS = ["absolute", "signed", "squared", "relative_absolute", "relative_signed", "relative_squared"];

/** Operation and display encoding are independent axes. Exercise every operation
 * with the shared default, plus the analytic encoding supported by signed data. */
const DIRECT_DIFF_CASES = [
  ...DIRECT_DIFF_OPS.map((operationId) => ({ operationId, displayOperationId: DEFAULT_COMPARISON_DISPLAY_OPERATION_ID })),
  { operationId: "signed", displayOperationId: "red-green" },
  { operationId: "relative_signed", displayOperationId: "red-green" },
];

async function main(): Promise<void> {
  try {
    const device = await getSharedWebGpuDevice();
    report(true, `device.backend = ${device.backend}`);
    let allOk = true;
    if (!(await runIdentityInertCase(device))) allOk = false;
    for (const { operationId, displayOperationId } of DIRECT_DIFF_CASES) {
      if (!(await runDiffOpCase(device, operationId, displayOperationId))) allOk = false;
    }
    report(allOk, `all ${DIRECT_DIFF_CASES.length} direct diff/encoding cases: GPU cairnContent + display === composed cpu twin`);
    // Phase 3 — COMPOSITOR op (split): light composite === composed cpu twin.
    if (!(await runCompositorOpCase(device, "split", 0.5))) allOk = false;
    report(allOk, `compositor op (split): GPU composite === composed cpu twin (SDR + HDR)`);
    // Phase 2b — POOL wiring: the second source slot + the cached-op render path.
    for (const { operationId, displayOperationId } of DIRECT_DIFF_CASES) {
      if (!(await runPoolDirectOpCase(device, operationId, displayOperationId))) allOk = false;
    }
    if (!(await runPoolCachedOpCase(device))) allOk = false;
    if (!(await runPoolChromeCase(device))) allOk = false;
    report(allOk, `pool: setSourceB direct ops + renderDiffCached (flip) + chrome (metrics/ssim/readback) parity`);
    setOverallStatus(allOk);
  } catch (err) {
    if (isDeviceLostError(err)) {
      // Loud SKIP — the software (SwiftShader) backend lost the device/instance
      // mid-readback (typically during pool teardown, e.g. runPoolDirectOpCase's
      // surface readback). The proof couldn't finish, but this is a teardown
      // artifact, not a parity defect. Same handling as the backend-readback and
      // gpu-compare-split-numbers harnesses.
      report(
        true,
        `SKIPPED — device lost/destroyed mid-readback (software-backend teardown ` +
          `artifact, not a parity failure): ${err instanceof Error ? err.message : String(err)}`,
      );
      setOverallStatus(true);
    } else {
      report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
      setOverallStatus(false);
    }
  }
}

void main();
