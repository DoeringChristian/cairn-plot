/**
 * CONTENT-OP GPU↔CPU parity harness (Phase 2 — the diff CONTENT ops).
 *
 * jsdom has no WebGPU, so — like every `*.browser.ts` harness here — this is a
 * browser page driven headlessly by `scripts/test-harness.mjs` (it lives under
 * `engine/__tests__/`, so the runner treats it as a parity proof and runs it by
 * default). It sets `#status` to PASS/FAIL.
 *
 * WHAT IT PROVES. The Phase-2 content-op unification renders a DIFF through the
 * SAME image pipeline as a single image: the shader samples TWO source slots and
 * `cairnContent(a, b, opId)` produces the raw per-channel error, which the DISPLAY
 * stage (the display-encoding registry) then encodes. This harness drives that
 * exact GPU path (`renderImage` with `srcB` + `contentOpId` + the op's
 * defaultEncoding) for every DIRECT diff op and asserts the readback equals the
 * COMPOSED CPU twin — `displayEncoding.cpu(contentOp.cpu([a],[b]), 3, params)` —
 * i.e. the content-op `cpu` twin (the diff pixel-value readout's source of truth)
 * threaded through the same display-encoding `cpu` the single-image LUT/analytic
 * path uses. So the unified pane's diff render === the two registries' twins, by
 * construction, across the whole direct-op set.
 *
 * Cached ops (FLIP/HDR-FLIP/SSIM) are NOT covered here — they render into a
 * result texture via the `engine/kernels` multipass path, already parity-proven by
 * the `flip`/`hdr-flip`/`ssim` harnesses; the unified pane binds that result as a
 * single source + identity display (pane-level wiring, a later phase).
 */
import { getSharedDevice } from "../device";
import { renderImage, type ImageParams, type ImageOperator } from "../image-engine";
import { getContentOp, isDirectContentOp, contentOpId } from "../../image/content-ops/index";
import { getEncoding, DEFAULT_ENCODE_PARAMS } from "../../image/encodings/index";
import { outputEncode, type RgbTriple } from "../../image/tonemap";
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
  document.title = pass ? "CONTENT OPS PASS" : "CONTENT OPS FAIL";
}

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
async function runDiffOpCase(device: Device, opId: string): Promise<boolean> {
  const op = getContentOp(opId);
  if (!op || !isDirectContentOp(op)) {
    report(false, `[${opId}] not a registered direct content op`);
    return false;
  }
  const signed = op.outputRange === "R";
  const enc = getEncoding(op.defaultEncoding);
  if (!enc) {
    report(false, `[${opId}] default encoding "${op.defaultEncoding}" is not registered`);
    return false;
  }
  const encParams = { ...DEFAULT_ENCODE_PARAMS, reduce: "mean" as const };

  const texA = buildTex(device, PAIRS.map((p) => p.a));
  const texB = buildTex(device, PAIRS.map((p) => p.b));
  const target = device.createTexture(PAIRS.length, 1, "rgba8unorm");

  const params: ImageParams = {
    exposureEV: 0,
    operator: "linear" as ImageOperator, // moot: isScalar short-circuits it
    isScalar: true,
    srcB: texB,
    contentOpId: contentOpId(opId),
    reduce: "mean",
    channelCount: 3,
    hdrOut: false,
    uv: uvFull,
    filter: "nearest",
    ...(signed
      ? { analytic: true } // red-green: computed color, no LUT bound
      : { turbo: true, colormap: colormapFloatLUT((enc.lutName ?? enc.id) as ColormapName) }),
  };
  renderImage(device, target, texA, params);
  const out = await device.readback(target);
  texA.destroy();
  texB.destroy();
  target.destroy();

  if (!(out instanceof Uint8Array)) {
    report(false, `[${opId}] expected Uint8Array readback, got ${out.constructor.name}`);
    return false;
  }

  let ok = true;
  for (let i = 0; i < PAIRS.length; i++) {
    // CONTENT twin: the op's per-channel raw diff (the readout source of truth).
    const content = op.cpu([PAIRS[i]!.a, PAIRS[i]!.b], 3);
    // DISPLAY twin: the op's defaultEncoding cpu (reduce → colormap/analytic).
    let exp: RgbTriple;
    if (signed) {
      // red-green analytic cpu returns SCENE-LINEAR; thread the SAME sRGB
      // output-encode the GPU analytic branch applies.
      const lin = enc.cpu(content, 3, encParams);
      exp = [outputEncode(lin[0], undefined), outputEncode(lin[1], undefined), outputEncode(lin[2], undefined)];
    } else {
      // turbo table cpu returns DISPLAY-sRGB directly (LUT holds encoded colors).
      exp = enc.cpu(content, 3, encParams);
    }
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(
          false,
          `[${opId}] px[${i}] a=${JSON.stringify(PAIRS[i]!.a.slice(0, 3))} b=${JSON.stringify(PAIRS[i]!.b.slice(0, 3))} ch[${c}] expected=${eb} actual=${ab}`,
        );
      }
    }
  }
  report(ok, `[${opId}] (${signed ? "signed→red-green" : "magnitude→turbo"}) GPU cairnContent + display === composed cpu twin`);
  return ok;
}

/** IDENTITY sanity: opId 0 with a placeholder second slot renders the single
 *  source unchanged (turbo of the raw scalar) — the second slot never leaks in. */
async function runIdentityInertCase(device: Device): Promise<boolean> {
  const scalars = [[0.0, 0, 0, 1], [0.25, 0, 0, 1], [0.5, 0, 0, 1], [1.0, 0, 0, 1]];
  const enc = getEncoding("turbo")!;
  const texA = buildTex(device, scalars);
  const target = device.createTexture(scalars.length, 1, "rgba8unorm");
  // No srcB → placeholder; contentOpId 0 (identity) ignores it.
  const params: ImageParams = {
    exposureEV: 0,
    operator: "linear" as ImageOperator,
    isScalar: true,
    turbo: true,
    colormap: colormapFloatLUT("turbo"),
    contentOpId: 0,
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
    const exp = enc.cpu([scalars[i]![0]!], 1, { ...DEFAULT_ENCODE_PARAMS });
    for (let c = 0; c < 3; c++) {
      const eb = byteOf(exp[c]!);
      const ab = out[i * 4 + c]!;
      if (Math.abs(ab - eb) > 1) {
        ok = false;
        report(false, `[identity-inert] px[${i}].ch[${c}] expected=${eb} actual=${ab}`);
      }
    }
  }
  report(ok, `[identity] opId 0 ignores the (placeholder) second slot — single-source render unchanged`);
  return ok;
}

const DIRECT_DIFF_OPS = ["absolute", "signed", "squared", "relative_absolute", "relative_signed", "relative_squared"];

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    report(true, `device.backend = ${device.backend}`);
    let allOk = true;
    if (!(await runIdentityInertCase(device))) allOk = false;
    for (const opId of DIRECT_DIFF_OPS) {
      if (!(await runDiffOpCase(device, opId))) allOk = false;
    }
    report(allOk, `all ${DIRECT_DIFF_OPS.length} direct diff ops: GPU cairnContent + display === composed cpu twin`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
