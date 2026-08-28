/**
 * HDR-activation proof harness (WebGPU engine, Sub-project 1 — "close the
 * last gap" task). Proves `engine/image-engine.ts`'s `renderImage()` HDR-out
 * path ACTUALLY preserves values above 1.0 to a real HDR (`rgba16float`)
 * target, and that the ordinary SDR path still clamps/tonemaps into `[0,1]`
 * exactly as before — the objective, backend-verifiable half of "HDR output
 * is really ON" (the other half — a human confirming a bright region reads
 * as brighter-than-paper-white on an HDR display — cannot be asserted from
 * code; screenshots clip HDR by construction, so that check is a manual
 * eyeball, not this harness's job).
 *
 * jsdom has no WebGPU, so — like every other `*.browser.ts` harness in this
 * directory — this is NOT a unit test, it's a browser page driven via
 * claude-in-chrome.
 *
 * ## Why this harness exists (beyond `image-pass.browser.ts`'s `hdrOut` case)
 * `image-pass.browser.ts`'s existing `hdrOut` case renders with `operator:
 * "aces"` — a tone-map curve that (by design) compresses into `[0,1]`, so it
 * never exercises a value SURVIVING past 1.0; `hdrOut:true` there only proves
 * the output-ENCODE stage is skipped, not that HDR range is preserved. This
 * harness renders the SAME hdrOut:true path with `operator: "linear"` (the
 * pure-identity operator `renderers/GpuImagePane.tsx`'s `useHdr` branch
 * actually selects — see `image/tonemap.ts`'s doc comment on that entry) and
 * asserts a pixel that started at 4.0 comes back >1.0, unclamped.
 *
 * CASES:
 *   1. HDR path: `operator:"linear"`, `hdrOut:true`, target `rgba16float`.
 *      A pixel of (4,4,4,1) survives readback ABOVE 1.0 (extended brightness,
 *      NOT clamped) but TRANSFER-ENCODED — extendedSrgbOetf(4)≈1.8248, NOT the
 *      raw 4.0. This is the display-profile fix: a float16 srgb/display-p3
 *      canvas stores non-linear signals per W3C ColorWeb-CG, so the hdrOut path
 *      ENCODES rather than writing raw scene-linear.
 *   2. SDR path: `operator:"srgb"` (GpuImagePane's SDR-fallback default),
 *      `hdrOut:false`, target `rgba8unorm` (a real display-surface format).
 *      The SAME (4,4,4,1) source pixel clamps+encodes to byte 255 on every
 *      channel — proving HDR and SDR are genuinely different code paths, not
 *      the same clamp happening to look different.
 *
 * RUNNING:
 *   1. Bundle this file to plain JS:
 *        cd cairn/ui && npx esbuild \
 *          src/plots/image/webgpu/__tests__/hdr-output.browser.ts \
 *          --bundle --format=esm \
 *          --outfile=src/plots/image/webgpu/__tests__/hdr-output.browser.bundle.js
 *   2. Serve over http (file:// is blocked for module scripts):
 *        cd cairn/ui/src/plots/image/webgpu/__tests__ && python3 -m http.server 8939
 *   3. Open in Chrome (claude-in-chrome) and read the PASS/FAIL lines from
 *      the DOM/console:
 *        http://localhost:8939/hdr-output.browser.html
 *
 * The generated `.bundle.js` is NOT committed (gitignored) — regenerate with
 * the command above whenever this harness or its imports change.
 */
import { getSharedWebGpuDevice } from "../device/device-provider.ts";
import { renderImage, type ImageParams } from "../image-engine";
import { extendedSrgbOetf, srgbEotf } from "../../runtime/tonemap";
import type { Device, Texture } from "../device/device-contract";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "HDR OUTPUT", resultFlag: "__hdrOutputTestResult" });

/** A 1x1 rgba32float source texture holding one pixel: (4, 4, 4, 1) — well past the SDR [0,1] range. */
function buildBrightSrcTexture(device: Device): Texture {
  const tex = device.createTexture(1, 1, "rgba32float");
  tex.write(new Float32Array([4, 4, 4, 1]));
  return tex;
}

const UV_FULL = { x: 0, y: 0, w: 1, h: 1 };

/** Case 1 — HDR path: renders to a real rgba16float target with operator:"linear" + hdrOut:true.
 *  Post-fix: the (4,4,4) source reads back ENCODED — extendedSrgbOetf(4)≈1.8248,
 *  still >1.0 (extended brightness preserved) but NOT the raw 4.0. */
async function runHdrCase(device: Device): Promise<boolean> {
  const src = buildBrightSrcTexture(device);
  const target = device.createTexture(1, 1, "rgba16float");
  const params: ImageParams = { exposureEV: 0, displayOperationId: "linear", isScalar: false, hdrOut: true, uv: UV_FULL };
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();

  if (!(out instanceof Float32Array)) {
    report(false, `[hdr] readback() should return Float32Array for rgba16float, got ${(out as { constructor: { name: string } }).constructor.name}`);
    return false;
  }
  const expected = extendedSrgbOetf(4); // ≈1.8248
  let ok = true;
  for (let c = 0; c < 3; c++) {
    const v = out[c]!;
    const chOk = Math.abs(v - expected) <= 0.02; // float16 round-trip tolerance near 1.8
    if (!chOk) ok = false;
    report(chOk, `[hdr] ch[${c}] expected~=${expected.toFixed(4)} (ENCODED, not raw 4.0) actual=${v.toFixed(4)}`);
  }
  const survivedPast1 = out[0]! > 1.0 && out[1]! > 1.0 && out[2]! > 1.0;
  report(survivedPast1, `[hdr] value survives PAST 1.0 (extended brightness, not clamped) — rgb=(${out[0]!.toFixed(3)}, ${out[1]!.toFixed(3)}, ${out[2]!.toFixed(3)})`);
  const notRawLinear = Math.abs(out[0]! - 4.0) > 1.0;
  report(notRawLinear, `[hdr] value is ENCODED (${out[0]!.toFixed(3)}), NOT raw scene-linear 4.0 — the display-profile fix`);
  return ok && survivedPast1 && notRawLinear;
}

/** Case 2 — SDR path: renders the SAME source pixel to a real rgba8unorm target with operator:"srgb" + hdrOut:false. */
async function runSdrCase(device: Device): Promise<boolean> {
  const src = buildBrightSrcTexture(device);
  const target = device.createTexture(1, 1, "rgba8unorm");
  const params: ImageParams = { exposureEV: 0, displayOperationId: "srgb", isScalar: false, hdrOut: false, uv: UV_FULL };
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();

  if (!(out instanceof Uint8Array)) {
    report(false, `[sdr] readback() should return Uint8Array for rgba8unorm, got ${(out as { constructor: { name: string } }).constructor.name}`);
    return false;
  }
  let ok = true;
  for (let c = 0; c < 3; c++) {
    const v = out[c]!;
    // clamp(4,0,1) -> 1.0, srgbOetf(1.0) -> 1.0, *255 -> 255 exactly.
    const chOk = v === 255;
    if (!chOk) ok = false;
    report(chOk, `[sdr] ch[${c}] expected=255 (clamped+tonemapped) actual=${v}`);
  }
  return ok;
}

/** Case 3 (§B UNIFIED) — an 8-bit SDR SOURCE through the FULL unified pipeline:
 *  a u8 255-white pixel, sRGB-DECODED to scene-linear (srgbDecode:true), at EV+1,
 *  operator "linear" (peak 4), hdrOut:true, target rgba16float. Proves an
 *  8-bit source genuinely EXCEEDS SDR white on an HDR display ("unified no matter
 *  what the input data was"): 255 → srgbEotf(1.0)=1.0 linear → EV+1 → 2.0 linear
 *  (below the P=4 ceiling) → extendedSrgbOetf(2.0)≈1.353 (encoded, ABOVE 1.0). */
async function runSdrExtendedCase(device: Device): Promise<boolean> {
  const src = device.createTexture(1, 1, "rgba8unorm");
  src.write(new Uint8Array([255, 255, 255, 255]));
  const target = device.createTexture(1, 1, "rgba16float");
  const params: ImageParams = {
    exposureEV: 1,
    displayOperationId: "linear",
    isScalar: false,
    hdrOut: true,
    srgbDecode: true,
    peak: 4,
    uv: UV_FULL,
  };
  renderImage(device, target, src, params);
  const out = await device.readback(target);
  src.destroy();
  target.destroy();
  if (!(out instanceof Float32Array)) {
    report(false, `[sdr-ext] readback should be Float32Array for rgba16float`);
    return false;
  }
  const decodedLinear = srgbEotf(1.0); // = 1.0
  const expected = extendedSrgbOetf(decodedLinear * 2 ** 1); // extendedSrgbOetf(2.0)
  let ok = true;
  for (let c = 0; c < 3; c++) {
    const v = out[c]!;
    const chOk = Math.abs(v - expected) <= 0.02;
    if (!chOk) ok = false;
    report(chOk, `[sdr-ext] ch[${c}] expected~=${expected.toFixed(4)} actual=${v.toFixed(4)}`);
  }
  const survivedPast1 = out[0]! > 1.0;
  report(survivedPast1, `[sdr-ext] u8 255-white at EV+1 encodes ABOVE SDR white (${out[0]!.toFixed(3)}) — an 8-bit source reaches extended output`);
  return ok && survivedPast1;
}

async function main(): Promise<void> {
  try {
    const device = await getSharedWebGpuDevice();
    report(true, `getSharedWebGpuDevice() resolved backend="${device.backend}", capabilities.hdr=${device.capabilities.hdr}`);

    if (!device.capabilities.hdr) {
      // A WebGPU device without HDR support has no extended-range target to
      // prove anything with. Report a clean SKIP rather than a false FAIL.
      report(true, "[hdr] SKIPPED — backend has no HDR capability (capabilities.hdr=false); nothing to prove here");
      setOverallStatus(true);
      return;
    }

    const hdrOk = await runHdrCase(device);
    const sdrOk = await runSdrCase(device);
    const sdrExtOk = await runSdrExtendedCase(device);
    const allOk = hdrOk && sdrOk && sdrExtOk;
    report(allOk, `HDR value (>1.0, extended-ENCODED), SDR value (clamped to 255), and 8-bit-source-extended value (>1.0) are all as expected — HDR output is real AND unified across source bit depth (§B)`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `Uncaught error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    setOverallStatus(false);
  }
}

main();
