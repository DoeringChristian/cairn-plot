/**
 * DEEP GPU-composite readback-vs-wasm-flatten harness — the primary deep depth
 * path for GPU panes (`engine/shaders/deep-composite.wgsl.ts` +
 * `webgpu/device.ts`'s `createDeepSampleBuffers`/`compositeDeep`).
 *
 * jsdom has no WebGPU, so — like every other `*.browser.ts` harness here — this
 * is NOT a unit test; it's a browser page driven via claude-in-chrome.
 *
 * PARITY: for the committed deep fixture, the GPU composite at a Z cutoff must
 * equal the WASM flatten at the SAME cutoff (`flatten_deep`) within f16
 * tolerance — both composite the identical premultiplied-OVER math and store to
 * f16 (the wasm emits half bits; the GPU target is `rgba16float`). Cases run at
 * zClip = zMax (full), a mid-Z cut, and a near-front cut. The wasm flatten is
 * the SAME source of truth the CPU/fallback pane uses, so this pins the two
 * paths together.
 *
 * TIMING: fetches the real `v2/Stereo/Trunks.exr` (part 0) and measures a
 * depth-slider tick at Trunks scale — the main-thread cost of
 * `compositeDeep(zClip)` + the display blit, plus a GPU-completion round trip.
 * Skipped (not failed) if the fetch is blocked.
 *
 * RUNNING:
 *   1. Bundle to plain JS:
 *        cd cairn/ui && npx esbuild \
 *          src/lib/cairn-plot/engine/__tests__/deep-composite.browser.ts \
 *          --bundle --format=esm \
 *          --outfile=src/lib/cairn-plot/engine/__tests__/deep-composite.browser.bundle.js
 *   2. Serve over http FROM THE ui/ ROOT (the fixture URL is resolved from
 *      import.meta.url, so it must be reachable):
 *        cd cairn/ui && python3 -m http.server 8937
 *   3. Open http://localhost:8937/src/lib/cairn-plot/engine/__tests__/deep-composite.browser.html
 *      in Chrome (claude-in-chrome) and read the PASS/FAIL + timing lines.
 *
 * The generated `.bundle.js` is NOT committed (gitignored) — regenerate with the
 * command above whenever this harness or its imports change.
 */
import { getSharedDevice } from "../device";
import { loadExrDecoder } from "../../image/decoders/wasm-inline/wasm-exr-inline";
import type { Device, Texture } from "../types";

const TRUNKS_URL = "https://raw.githubusercontent.com/AcademySoftwareFoundation/openexr-images/main/v2/Stereo/Trunks.exr";
const FIXTURE_URL = new URL("../../image/decoders/fixtures/deep-rgba-32x32.exr", import.meta.url).href;

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "green" : "red";
    el.appendChild(p);
  }
}
function info(message: string): void {
  console.log(message);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = message;
    p.style.color = "#0366d6";
    el.appendChild(p);
  }
}
function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  (window as unknown as { __deepCompositeTestResult?: "pass" | "fail" }).__deepCompositeTestResult = pass
    ? "pass"
    : "fail";
  document.title = pass ? "DEEP COMPOSITE PASS" : "DEEP COMPOSITE FAIL";
}

/** IEEE-754 binary16 bit pattern → number (widen wasm halfBits for comparison). */
function h2f(b: number): number {
  const s = (b & 0x8000) >> 15;
  const e = (b & 0x7c00) >> 10;
  const f = b & 0x03ff;
  let v: number;
  if (e === 0) v = (f / 1024) * 2 ** -14;
  else if (e === 0x1f) v = f ? NaN : Infinity;
  else v = (1 + f / 1024) * 2 ** (e - 15);
  return s ? -v : v;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

type Decoder = Awaited<ReturnType<typeof loadExrDecoder>>;

/** Upload a deep handle's CSR to the GPU, composite at `zClip`, read back RGBA floats. */
async function gpuComposite(
  device: Device,
  dec: Decoder,
  handle: number,
  zClip: number,
): Promise<{ data: Float32Array; width: number; height: number; target: Texture }> {
  const csr = dec.deep_gpu_csr(handle);
  const buffers = device.createDeepSampleBuffers!(csr);
  const target = device.createTexture(csr.width, csr.height, "rgba16float");
  device.compositeDeep!(buffers, target, zClip);
  const out = (await device.readback(target)) as Float32Array;
  buffers.destroy();
  return { data: out, width: csr.width, height: csr.height, target };
}

/** Compare GPU composite vs wasm flatten at `zClip` within f16 tolerance. */
async function parityCase(device: Device, dec: Decoder, bytes: Uint8Array, zClip: number, label: string): Promise<boolean> {
  const deep = dec.open_deep(bytes);
  if (!deep) {
    report(false, `[${label}] open_deep returned null (not deep?)`);
    return false;
  }
  const gpu = await gpuComposite(device, dec, deep.handle, zClip);
  const wasm = dec.flatten_deep(deep.handle, zClip);
  dec.free_deep(deep.handle);
  const half = wasm.halfBits!;
  const n = gpu.width * gpu.height * 4;
  const EPS = 4e-3; // ~a few f16 ULP near [0,1]
  let maxDiff = 0;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const a = gpu.data[i]!;
    const b = h2f(half[i]!);
    const d = Math.abs(a - b);
    if (d > maxDiff) maxDiff = d;
    if (d > EPS) bad++;
  }
  gpu.target.destroy();
  const ok = bad === 0;
  report(ok, `[${label}] zClip=${zClip}: GPU vs wasm maxDiff=${maxDiff.toExponential(2)} over-eps=${bad}/${n}`);
  return ok;
}

/** Median of an array. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

async function timingCase(device: Device, dec: Decoder): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = await fetchBytes(TRUNKS_URL);
  } catch (err) {
    info(`[timing] SKIPPED — could not fetch Trunks.exr (${err instanceof Error ? err.message : String(err)})`);
    return;
  }
  const deep = dec.open_deep(bytes);
  if (!deep) {
    info("[timing] SKIPPED — Trunks did not open as deep");
    return;
  }
  const csr = dec.deep_gpu_csr(deep.handle);
  dec.free_deep(deep.handle);
  const buffers = device.createDeepSampleBuffers!(csr);
  const target = device.createTexture(csr.width, csr.height, "rgba16float");
  const gpuMB = (csr.offsets.byteLength + csr.colors.byteLength + csr.zs.byteLength) / (1024 * 1024);
  info(
    `[timing] Trunks ${csr.width}x${csr.height}, ${csr.total} samples, GPU buffers ≈ ${gpuMB.toFixed(2)} MB`,
  );

  // Main-thread ISSUE cost of one depth tick (writeBuffer + pass + submit).
  const issue: number[] = [];
  for (let i = 0; i < 40; i++) {
    const z = deep.zMin + (deep.zMax - deep.zMin) * (i / 40);
    const t0 = performance.now();
    device.compositeDeep!(buffers, target, z);
    issue.push(performance.now() - t0);
  }
  info(`[timing] compositeDeep ISSUE (main thread) median = ${median(issue).toFixed(3)} ms`);

  // GPU composite-pass time, isolated from the (expensive, one-off) readback:
  // time N back-to-back composites + one readback (T_N) vs a single composite +
  // one readback (T_1); the per-composite GPU time is (T_N - T_1)/(N-1), which
  // cancels the readback + fixed submit overhead. The DISPLAY path does no
  // readback at all — this is the pure per-tick GPU cost that must overlap 60fps.
  const timeBatch = async (n: number): Promise<number> => {
    const runs: number[] = [];
    for (let r = 0; r < 6; r++) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const z = deep.zMin + (deep.zMax - deep.zMin) * ((i + 1) / (n + 1));
        device.compositeDeep!(buffers, target, z);
      }
      await device.readback(target); // one sync point flushes all n composites
      runs.push(performance.now() - t0);
    }
    return median(runs);
  };
  const N = 60;
  const tN = await timeBatch(N);
  const t1 = await timeBatch(1);
  const perComposite = (tN - t1) / (N - 1);
  info(`[timing] GPU composite pass (readback-isolated) ≈ ${perComposite.toFixed(3)} ms/tick`);
  info(`[timing]   (batch-of-${N}=${tN.toFixed(1)}ms, single=${t1.toFixed(1)}ms incl. one 12.5 MB readback)`);
  buffers.destroy();
  target.destroy();
}

async function main(): Promise<void> {
  try {
    const device = await getSharedDevice();
    report(true, `device.backend = ${device.backend}`);
    const dec = await loadExrDecoder();
    const bytes = await fetchBytes(FIXTURE_URL);
    const deep = dec.open_deep(bytes)!;
    const zMin = deep.zMin;
    const zMax = deep.zMax;
    dec.free_deep(deep.handle);

    let ok = true;
    ok = (await parityCase(device, dec, bytes, zMax, "full/zMax")) && ok;
    ok = (await parityCase(device, dec, bytes, 7, "mid/z=7")) && ok;
    ok = (await parityCase(device, dec, bytes, (zMin + 7) / 2, "near-front")) && ok;

    await timingCase(device, dec);

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
