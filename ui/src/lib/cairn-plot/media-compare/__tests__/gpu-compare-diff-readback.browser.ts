/**
 * Diff-mode TEV per-pixel readback harness (WebGPU, driven via claude-in-chrome
 * — jsdom has no WebGPU). Targets the reported bug: in a FLIP compare pane the
 * TEV per-pixel numbers read ZERO in regions where the displayed FLIP map is
 * clearly non-zero.
 *
 * It mounts the REAL `GpuComparePane` in diff/flip mode for four paths and, via
 * the pane's `__cairnCompareProbe` test seam, asserts the sampler the overlay
 * actually calls (`sampleDiff`) returns NON-ZERO metric values where the CPU
 * FLIP reference (`kernels/flip-reference.ts`) is non-zero — and matches it
 * within tolerance:
 *
 *   (a) small u8 pair        (128x96)   — control (the path already known-good)
 *   (b) LARGE u8 pair        (2048x2048)— the large-readback path
 *   (c) f16-bits float pair  (128x96)   — HDR-FLIP (auto-dispatched on float)
 *   (d) mode-menu round-trip (abs → flip) — switched INTO flip via the menu seam
 *
 * All four share ONE device (and thus ONE diff LRU), so the byte
 * accounting/eviction interplay of the big readback is exercised alongside the
 * small entries.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/lib/cairn-plot/media-compare/__tests__/gpu-compare-diff-readback.browser.ts \
 *        --bundle --format=esm --tsconfig=tsconfig.app.json \
 *        --outfile=src/lib/cairn-plot/media-compare/__tests__/gpu-compare-diff-readback.browser.bundle.js
 *   2. Serve: cd cairn/ui/src/lib/cairn-plot/media-compare/__tests__ && python3 -m http.server 8939
 *   3. Open in Chrome: http://localhost:8939/gpu-compare-diff-readback.browser.html
 *
 * The generated `.bundle.js` is NOT committed (gitignored).
 */
import React from "react";
import { createRoot } from "react-dom/client";
import GpuComparePane from "../GpuComparePane";
import { flipLDR } from "../../engine/kernels/flip-reference";
import { computeCompareMapping, type CompareAlign, type CompareFit } from "../../engine/compare-align";
import type { PixelSample, PixelValueNotation } from "../../primitives/PixelValueOverlay";
import type { CompareFloatSource } from "../compositor";

const h = React.createElement;

interface CompareProbe {
  sampleDiff: (px: number, py: number, n?: PixelValueNotation) => PixelSample | null;
  sampleFg: (px: number, py: number, n?: PixelValueNotation) => PixelSample | null;
  diffSamples: Float32Array | null;
  /** Framing/overlay grid: diff+crop → overlap dims, diff+fill / split/blend → primary. */
  dims: { w: number; h: number } | null;
  /** Primary/foreground source footprint (pre-framing). */
  primaryDims: { w: number; h: number } | null;
  diffResultDims: { w: number; h: number } | null;
  align: CompareAlign;
  fit: CompareFit;
  resolvedKernelId: string;
  compareMode: string;
}

declare global {
  interface Window {
    __diffReadbackResult?: "pass" | "fail";
    __cairnPlotUseGpuImage?: boolean;
  }
}

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "#3c3" : "#f55";
    el.appendChild(p);
  }
}

function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "#3c3" : "#f55";
  }
  window.__diffReadbackResult = pass ? "pass" : "fail";
  document.title = pass ? "DIFF-READBACK PASS" : "DIFF-READBACK FAIL";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 20000, stepMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return predicate();
}

// ---- structured u8 pair (mirrors the demo's _render_pair: sinusoids + bright
// disks → strong edges FLIP keys off; prediction = 1px shift + dim + noise). ---
function makeU8Pair(w: number, h: number): { refRGBA: Uint8ClampedArray; predRGBA: Uint8ClampedArray } {
  const refRGB = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const yn = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const xn = x / (w - 1);
      const i = (y * w + x) * 3;
      refRGB[i] = 0.5 + 0.5 * Math.sin(6.0 * xn);
      refRGB[i + 1] = yn;
      refRGB[i + 2] = 0.5 + 0.5 * Math.cos(5.0 * yn);
    }
  }
  // a few bright disks
  const disks = [
    [0.3, 0.35], [0.6, 0.25], [0.45, 0.7], [0.7, 0.6], [0.25, 0.6], [0.55, 0.5],
  ];
  for (let y = 0; y < h; y++) {
    const yn = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const xn = x / (w - 1);
      const i = (y * w + x) * 3;
      let add = 0;
      for (const [cx, cy] of disks) {
        const r2 = (xn - cx!) ** 2 + (yn - cy!) ** 2;
        add += Math.exp(-r2 / 0.004);
      }
      refRGB[i] = Math.min(1, refRGB[i]! + add * 1.0);
      refRGB[i + 1] = Math.min(1, refRGB[i + 1]! + add * 0.9);
      refRGB[i + 2] = Math.min(1, refRGB[i + 2]! + add * 0.7);
    }
  }
  const refRGBA = new Uint8ClampedArray(w * h * 4);
  const predRGBA = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const o = (y * w + x) * 4;
      refRGBA[o] = Math.round(refRGB[i]! * 255);
      refRGBA[o + 1] = Math.round(refRGB[i + 1]! * 255);
      refRGBA[o + 2] = Math.round(refRGB[i + 2]! * 255);
      refRGBA[o + 3] = 255;
      // prediction: 1px horizontal shift + dim 0.95 + small deterministic noise
      const sx = (x + 1) % w;
      const si = (y * w + sx) * 3;
      const noise = ((((x * 131 + y * 17) % 21) - 10) / 10) * 0.05;
      predRGBA[o] = Math.round(Math.min(1, Math.max(0, refRGB[si]! * 0.95 + noise)) * 255);
      predRGBA[o + 1] = Math.round(Math.min(1, Math.max(0, refRGB[si + 1]! * 0.95 + noise)) * 255);
      predRGBA[o + 2] = Math.round(Math.min(1, Math.max(0, refRGB[si + 2]! * 0.95 + noise)) * 255);
      predRGBA[o + 3] = 255;
    }
  }
  return { refRGBA, predRGBA };
}

function rgbaToDataUrl(rgba: Uint8ClampedArray, w: number, h: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

// Decode a data URL back to the ImageData the pane will actually see, so the CPU
// reference uses byte-identical inputs (no PNG-roundtrip drift).
async function decodeUrl(url: string, w: number, h: number): Promise<Uint8ClampedArray> {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, w, h).data;
}

function rgbaToSRGB(rgba: Uint8ClampedArray, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = rgba[i * 4]! / 255;
    out[i * 3 + 1] = rgba[i * 4 + 1]! / 255;
    out[i * 3 + 2] = rgba[i * 4 + 2]! / 255;
  }
  return out;
}

// float32 → binary16 bit pattern (round-to-nearest-even), for the f16-bits path.
function f32ToHalf(val: number): number {
  const f = new Float32Array(1);
  const u = new Uint32Array(f.buffer);
  f[0] = val;
  const x = u[0]!;
  const sign = (x >> 16) & 0x8000;
  let mant = x & 0x007fffff;
  let exp = (x >> 23) & 0xff;
  if (exp === 255) return sign | 0x7c00 | (mant ? 0x200 : 0); // Inf/NaN
  exp = exp - 127 + 15;
  if (exp >= 31) return sign | 0x7c00; // overflow → Inf
  if (exp <= 0) {
    if (exp < -10) return sign;
    mant |= 0x00800000;
    const shift = 14 - exp;
    const half = sign | (mant >> shift);
    const round = (mant >> (shift - 1)) & 1;
    return half + round;
  }
  const half = sign | (exp << 10) | (mant >> 13);
  const round = (mant >> 12) & 1;
  return half + round;
}

// A synthetic HDR (linear float) pair with a bright core → HDR-FLIP has real
// structure once its exposure sweep pulls the core in.
function makeHdrPair(w: number, h: number): { refBits: Uint16Array; predBits: Uint16Array } {
  const refBits = new Uint16Array(w * h * 3);
  const predBits = new Uint16Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const yn = (y / (h - 1)) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const xn = (x / (w - 1)) * 2 - 1;
      const r2 = xn * xn + yn * yn;
      const bg = 0.15 + 0.45 * Math.max(0, 1 - r2);
      const core = 8.0 * Math.exp(-r2 / 0.02);
      const lum = bg + core;
      const i = (y * w + x) * 3;
      refBits[i] = f32ToHalf(lum);
      refBits[i + 1] = f32ToHalf(lum * 0.85);
      refBits[i + 2] = f32ToHalf(lum * 0.6);
      // prediction: perturb + extra hot blob in R (only revealed by exposure sweep)
      const perturb = 1 + 0.12 * ((((x * 91 + y * 13) % 20) - 10) / 10);
      const extra = 3.0 * Math.exp(-r2 / 0.02);
      predBits[i] = f32ToHalf(Math.max(0, lum * perturb + extra));
      predBits[i + 1] = f32ToHalf(Math.max(0, lum * 0.85 * perturb));
      predBits[i + 2] = f32ToHalf(Math.max(0, lum * 0.6 * perturb));
    }
  }
  return { refBits, predBits };
}

function floatSource(bits: Uint16Array, w: number, h: number, key: string): CompareFloatSource {
  return { data: bits, width: w, height: h, channels: 3, contentKey: key, precision: "f16-bits" };
}

function val(s: PixelSample | null): number | null {
  if (!s || !s.lines.length) return null;
  const v = parseFloat(s.lines[0]!);
  return Number.isFinite(v) ? v : null;
}

interface Handle {
  container: HTMLDivElement;
  probe: () => CompareProbe | null;
  canvas: () => HTMLCanvasElement | null;
  setKernel: (id: string) => void;
  unmount: () => void;
}

// Read the pane's WebGPU canvas alpha: the blit writes alpha=1 for in-crop
// fragments and vec4(0) (alpha=0) beyond the crop, so the OPAQUE fraction tells
// us the displayed diff is confined to the top-left crop (vs the pre-fix blit,
// which stretched the result over the whole footprint → opaque everywhere).
async function readCanvasOpaque(canvas: HTMLCanvasElement): Promise<{ frac: number; cx: number; cy: number }> {
  const bmp = await createImageBitmap(canvas);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let opaque = 0, sx = 0, sy = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3]! > 200) {
        opaque++;
        sx += x;
        sy += y;
      }
    }
  }
  const total = c.width * c.height;
  return { frac: opaque / total, cx: opaque ? sx / opaque / c.width : 0.5, cy: opaque ? sy / opaque / c.height : 0.5 };
}

function mountPane(opts: {
  id: string;
  imageUrl: string | null;
  baselineUrl: string | null;
  imageFloat?: CompareFloatSource;
  baselineFloat?: CompareFloatSource;
  diffKernel: string;
  align?: CompareAlign;
  fit?: CompareFit;
}): Handle {
  const container = document.createElement("div");
  container.id = opts.id;
  container.style.width = "320px";
  container.style.height = "240px";
  container.style.display = "inline-block";
  container.style.margin = "4px";
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(
    h(GpuComparePane, {
      imageUrl: opts.imageUrl,
      baselineUrl: opts.baselineUrl,
      imageFloat: opts.imageFloat,
      baselineFloat: opts.baselineFloat,
      mode: "diff",
      diffKernel: opts.diffKernel,
      align: opts.align,
      fit: opts.fit,
      splitPosition: 0.5,
      blendAlpha: 0.5,
      colormap: "magma",
      zoom: 1,
      pan: { x: 0, y: 0 },
      label: opts.id,
    }),
  );
  // The probe/kernel seams live on the pane's INNER `paneRef` element (the
  // padded viewport box), NOT the outer `data-gpu-compare-pane` root — so walk
  // descendants for whichever node actually carries them.
  type SeamEl = HTMLElement & {
    __cairnCompareProbe?: CompareProbe;
    __cairnDiffKernel?: { set: (id: string) => void };
  };
  const paneEl = (): SeamEl | null => {
    for (const n of Array.from(container.querySelectorAll("*")) as SeamEl[]) {
      if (n.__cairnCompareProbe || n.__cairnDiffKernel) return n;
    }
    return null;
  };
  return {
    container,
    probe: () => paneEl()?.__cairnCompareProbe ?? null,
    canvas: () => container.querySelector("canvas[data-gpu-compare-canvas]") as HTMLCanvasElement | null,
    setKernel: (id: string) => paneEl()?.__cairnDiffKernel?.set(id),
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

// Assert sampleDiff returns non-zero metric where the readback map is non-zero,
// and (for u8) matches the CPU FLIP reference within tolerance.
async function assertCase(
  name: string,
  handle: Handle,
  cpuFlip: Float32Array | null,
  w: number,
  h: number,
): Promise<boolean> {
  const ready = await waitFor(() => {
    const p = handle.probe();
    return !!p && !!p.diffSamples && !!p.dims && p.compareMode === "diff";
  });
  if (!ready) {
    report(false, `[${name}] pane never produced a diff readback`);
    return false;
  }
  const p = handle.probe()!;
  const arr = p.diffSamples!;
  const dims = p.dims!;
  let ok = true;
  const dimsOk = dims.w === w && dims.h === h;
  report(dimsOk, `[${name}] dims=${dims.w}x${dims.h} (expected ${w}x${h}), kernel=${p.resolvedKernelId}`);
  ok = ok && dimsOk;

  // 1) the readback map itself must carry real (non-zero) values.
  let nonZero = 0;
  let maxV = 0;
  for (let i = 0; i < w * h; i++) {
    const v = arr[i * 4] ?? 0;
    if (v > 1e-4) nonZero++;
    if (v > maxV) maxV = v;
  }
  const frac = nonZero / (w * h);
  const mapOk = frac > 0.02 && maxV > 0.02;
  report(mapOk, `[${name}] readback map non-zero fraction=${(frac * 100).toFixed(1)}% max=${maxV.toFixed(4)}`);
  ok = ok && mapOk;

  // 2) at the pixels with the LARGEST readback value, sampleDiff must return a
  //    matching NON-ZERO number (the reported bug: it returns 0 there).
  const idx: number[] = [];
  for (let i = 0; i < w * h; i++) idx.push(i);
  idx.sort((a, b) => (arr[b * 4] ?? 0) - (arr[a * 4] ?? 0));
  let probedZero = 0;
  let probedMismatch = 0;
  const samples = Math.min(12, idx.length);
  for (let k = 0; k < samples; k++) {
    const pix = idx[k]!;
    const px = pix % w;
    const py = Math.floor(pix / w);
    const expected = arr[pix * 4] ?? 0;
    if (expected < 0.02) break;
    const got = val(p.sampleDiff(px, py));
    if (got === null || Math.abs(got) < 1e-4) {
      probedZero++;
      if (probedZero <= 3) report(false, `[${name}] sampleDiff(${px},${py})=${got} but readback=${expected.toFixed(4)} (ZERO BUG)`);
    } else if (Math.abs(got - expected) > 1e-3) {
      probedMismatch++;
      if (probedMismatch <= 3) report(false, `[${name}] sampleDiff(${px},${py})=${got.toFixed(4)} != readback ${expected.toFixed(4)}`);
    }
  }
  const probeOk = probedZero === 0 && probedMismatch === 0;
  report(probeOk, `[${name}] sampleDiff at ${samples} hottest pixels: ${probedZero} zero, ${probedMismatch} mismatch`);
  ok = ok && probeOk;

  // 3) (u8 only) the printed number must actually BE the FLIP metric (matches
  //    the CPU reference) — guards against "numbers come from the source image".
  if (cpuFlip) {
    let worst = 0;
    let checked = 0;
    for (let k = 0; k < Math.min(20, idx.length); k++) {
      const pix = idx[k]!;
      const px = pix % w;
      const py = Math.floor(pix / w);
      const got = val(p.sampleDiff(px, py));
      if (got === null) continue;
      const d = Math.abs(got - cpuFlip[pix]!);
      if (d > worst) worst = d;
      checked++;
    }
    const refOk = checked > 0 && worst <= 0.05;
    report(refOk, `[${name}] printed number == CPU FLIP metric (worst |diff|=${worst.toFixed(4)}, checked ${checked})`);
    ok = ok && refOk;
  }
  return ok;
}

// A CPU replica of SOURCE_MAP_WGSL's `mapSample` for one 8-bit RGBA source:
// RESULT pixel (x,y) → the source's R (normalized), via an integer texel offset
// (crop) or normalized-uv bilinear rescale (fill). Mirrors the GPU/CPU mapping.
function mapSampleR(
  dec: Uint8ClampedArray,
  sw: number,
  sh: number,
  offX: number,
  offY: number,
  fill: boolean,
  rw: number,
  rh: number,
): (x: number, y: number) => number {
  const at = (sx: number, sy: number) => (dec[(sy * sw + sx) * 4] ?? 0) / 255;
  if (!fill) {
    return (x, y) => at(Math.min(Math.max(x + offX, 0), sw - 1), Math.min(Math.max(y + offY, 0), sh - 1));
  }
  const maxX = sw - 1;
  const maxY = sh - 1;
  return (x, y) => {
    const tx = ((x + 0.5) / rw) * sw - 0.5;
    const ty = ((y + 0.5) / rh) * sh - 0.5;
    const bx = Math.floor(tx);
    const by = Math.floor(ty);
    const fx = tx - bx;
    const fy = ty - by;
    const x0 = Math.min(Math.max(bx, 0), maxX);
    const x1 = Math.min(Math.max(bx + 1, 0), maxX);
    const y0 = Math.min(Math.max(by, 0), maxY);
    const y1 = Math.min(Math.max(by + 1, 0), maxY);
    const top = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * fx;
    const bot = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * fx;
    return top + (bot - top) * fy;
  };
}

// CPU |ref - pred| (R channel) over the RESULT grid under the SAME align/fit
// mapping the pane uses — the reference the `absolute` readback must reproduce.
// `a` = ref (offsetA), `b` = pred/foreground (offsetB, the primary under fill).
function cpuAbsMapped(
  refDec: Uint8ClampedArray,
  refW: number,
  refH: number,
  predDec: Uint8ClampedArray,
  predW: number,
  predH: number,
  align: CompareAlign,
  fit: CompareFit,
): { rw: number; rh: number; out: Float32Array } {
  const m = computeCompareMapping({ w: refW, h: refH }, { w: predW, h: predH }, align, fit, "b");
  const rw = m.result.w;
  const rh = m.result.h;
  const fill = fit === "fill";
  const sa = mapSampleR(refDec, refW, refH, m.offsetA.x, m.offsetA.y, fill, rw, rh);
  const sb = mapSampleR(predDec, predW, predH, m.offsetB.x, m.offsetB.y, fill, rw, rh);
  const out = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      out[y * rw + x] = Math.abs(sa(x, y) - sb(x, y));
    }
  }
  return { rw, rh, out };
}

// Mismatched-size diff (align/fit): fg and ref differ in size. Under the align/
// fit mapping the diff RESULT is the overlap grid (crop) or the primary grid
// (fill); the pane FRAMES on that RESULT grid (requirement 2), so the home view
// FILLS the viewport with the diff — no transparent dead band — and the TEV grid
// spans exactly the result. Asserts: (i) framing == result dims (not primary);
// (ii) every in-frame sampleDiff matches the CPU abs reference computed under the
// SAME mapping; (iii) the display fills the frame (opaque, centered), vs the old
// top-left crop stripe; (iv) a probe BEYOND the result returns null (defensive).
async function assertDiffFramed(
  name: string,
  handle: Handle,
  primaryW: number,
  primaryH: number,
  resultW: number,
  resultH: number,
  cpuAbs: Float32Array,
): Promise<boolean> {
  const ready = await waitFor(() => {
    const pr = handle.probe();
    return !!pr && !!pr.diffSamples && !!pr.diffResultDims && pr.compareMode === "diff";
  });
  if (!ready) {
    report(false, `[${name}] pane never produced a diff readback`);
    return false;
  }
  const p = handle.probe()!;
  const arr = p.diffSamples!;
  const dims = p.dims!;
  const rdims = p.diffResultDims!;
  const pdims = p.primaryDims!;
  let ok = true;

  // (i) FRAMING == RESULT/overlap dims (the requirement-2 reframe) — the pane no
  //     longer frames on the larger primary footprint.
  const shapeOk =
    dims.w === resultW && dims.h === resultH &&
    rdims.w === resultW && rdims.h === resultH &&
    pdims.w === primaryW && pdims.h === primaryH;
  report(
    shapeOk,
    `[${name}] framing=${dims.w}x${dims.h} == result=${rdims.w}x${rdims.h} (primary=${pdims.w}x${pdims.h}); align=${p.align}, fit=${p.fit}`,
  );
  ok = ok && shapeOk;

  const rw = rdims.w, rh = rdims.h;
  const idx: number[] = [];
  for (let i = 0; i < rw * rh; i++) idx.push(i);
  idx.sort((a, b) => (arr[b * 4] ?? 0) - (arr[a * 4] ?? 0));

  // (ii) every in-frame sampleDiff returns the non-zero metric, indexed at the
  //      RESULT stride (no zero-bug, no mis-index).
  let zero = 0, mism = 0;
  const N = Math.min(12, idx.length);
  for (let k = 0; k < N; k++) {
    const pix = idx[k]!;
    const px = pix % rw, py = Math.floor(pix / rw);
    const expected = arr[pix * 4] ?? 0;
    if (expected < 0.02) break;
    const got = val(p.sampleDiff(px, py));
    if (got === null || Math.abs(got) < 1e-4) {
      zero++;
      if (zero <= 3) report(false, `[${name}] sampleDiff(${px},${py})=${got} but readback=${expected.toFixed(4)} (ZERO BUG)`);
    } else if (Math.abs(got - expected) > 1e-3) {
      mism++;
      if (mism <= 3) report(false, `[${name}] sampleDiff(${px},${py})=${got.toFixed(4)} != readback ${expected.toFixed(4)}`);
    }
  }
  const inOk = zero === 0 && mism === 0;
  report(inOk, `[${name}] in-frame sampleDiff at ${N} hottest pixels: ${zero} zero, ${mism} mismatch`);
  ok = ok && inOk;

  // (iii) the printed number IS the diff metric computed under the SAME align/fit
  //       mapping (matches the CPU abs reference) — proves the offsets/fill mapped
  //       the SOURCES correctly, not source px, not a stale top-left crop.
  let worst = 0, checked = 0;
  for (let k = 0; k < Math.min(24, idx.length); k++) {
    const pix = idx[k]!;
    const px = pix % rw, py = Math.floor(pix / rw);
    const got = val(p.sampleDiff(px, py));
    if (got === null) continue;
    const d = Math.abs(got - cpuAbs[py * rw + px]!);
    if (d > worst) worst = d;
    checked++;
  }
  const refOk = checked > 0 && worst <= 0.03;
  report(refOk, `[${name}] printed number == CPU abs metric under mapping (worst |diff|=${worst.toFixed(4)}, checked ${checked})`);
  ok = ok && refOk;

  // (iv) a probe BEYOND the result stride has no value → null (never a fake 0).
  let outNonNull = 0, outChecked = 0;
  for (const [px, py] of [[rw, 0], [0, rh], [rw + 5, rh + 5], [rw, rh]] as [number, number][]) {
    outChecked++;
    if (p.sampleDiff(px, py) !== null) outNonNull++;
  }
  const outOk = outNonNull === 0;
  report(outOk, `[${name}] beyond-result sampleDiff is null: ${outNonNull}/${outChecked} non-null (must be 0)`);
  ok = ok && outOk;

  // (v) DISPLAY: the diff FILLS + CENTERS the frame at home (requirement 2 — no
  //     dead band). At zoom 1 the result-aspect image is letterbox-fit into the
  //     pane, so the diff spans the fit rect (opaque well above zero) with a
  //     CENTERED centroid — the decisive contrast with the OLD top-left min-crop
  //     stripe (centroid up-and-left of center, e.g. ~0.25). The centered
  //     centroid is the discriminator; opaque just confirms the diff is present.
  const canvasEl = handle.canvas();
  if (canvasEl) {
    await sleep(200);
    const disp = await readCanvasOpaque(canvasEl);
    const fracOk = disp.frac > 0.4; // present + letterbox-fit (old crop sat lower AND off-center)
    const centerOk = Math.abs(disp.cx - 0.5) < 0.12 && Math.abs(disp.cy - 0.5) < 0.15;
    report(
      fracOk && centerOk,
      `[${name}] display opaque=${(disp.frac * 100).toFixed(1)}% (fills frame), centroid=(${disp.cx.toFixed(2)},${disp.cy.toFixed(2)}) — centered, no dead band`,
    );
    ok = ok && fracOk && centerOk;
  }

  return ok;
}

async function main(): Promise<void> {
  window.__cairnPlotUseGpuImage = true;
  try {
    // --- (a) small u8 control + (b) big u8 + (c) f16 float: mount together so the
    // shared diff LRU sees the 2048 readback alongside the small entries. ---
    const smallW = 128, smallH = 96;
    const small = makeU8Pair(smallW, smallH);
    const smallRefUrl = rgbaToDataUrl(small.refRGBA, smallW, smallH);
    const smallPredUrl = rgbaToDataUrl(small.predRGBA, smallW, smallH);
    const smallRefDec = await decodeUrl(smallRefUrl, smallW, smallH);
    const smallPredDec = await decodeUrl(smallPredUrl, smallW, smallH);
    const smallCpu = flipLDR(rgbaToSRGB(smallRefDec, smallW * smallH), rgbaToSRGB(smallPredDec, smallW * smallH), smallW, smallH, 67);

    const bigW = 2048, bigH = 2048;
    const big = makeU8Pair(bigW, bigH);
    const bigRefUrl = rgbaToDataUrl(big.refRGBA, bigW, bigH);
    const bigPredUrl = rgbaToDataUrl(big.predRGBA, bigW, bigH);

    const hdrW = 128, hdrH = 96;
    const hdr = makeHdrPair(hdrW, hdrH);

    const smallH2 = mountPane({ id: "small-u8", imageUrl: smallPredUrl, baselineUrl: smallRefUrl, diffKernel: "flip" });
    const bigH2 = mountPane({ id: "big-u8", imageUrl: bigPredUrl, baselineUrl: bigRefUrl, diffKernel: "flip" });
    const hdrH2 = mountPane({
      id: "hdr-float",
      imageUrl: null,
      baselineUrl: null,
      imageFloat: floatSource(hdr.predBits, hdrW, hdrH, "hdr-pred#1"),
      baselineFloat: floatSource(hdr.refBits, hdrW, hdrH, "hdr-ref#1"),
      diffKernel: "flip",
    });

    let ok = true;
    ok = (await assertCase("a/small-u8", smallH2, smallCpu, smallW, smallH)) && ok;
    ok = (await assertCase("b/big-u8-2048", bigH2, null, bigW, bigH)) && ok;
    ok = (await assertCase("c/hdr-float", hdrH2, null, hdrW, hdrH)) && ok;

    // --- (d) mode-menu round-trip: mount in ABS, switch INTO flip via the menu
    // seam, then assert the flip readback drives the numbers. ---
    const modeH2 = mountPane({ id: "mode-switch", imageUrl: smallPredUrl, baselineUrl: smallRefUrl, diffKernel: "absolute" });
    await waitFor(() => {
      const pr = modeH2.probe();
      return !!pr && pr.resolvedKernelId === "absolute" && !!pr.diffSamples;
    });
    modeH2.setKernel("flip");
    await sleep(300);
    ok = (await assertCase("d/mode-switch-to-flip", modeH2, smallCpu, smallW, smallH)) && ok;

    // --- Mismatched-size operands (align/fit): fg (160x120) vs ref (96x64),
    // `abs` kernel. Shared decoded sources for the three mapping variants. ---
    const fgW = 160, fgH = 120, refW = 96, refH = 64;
    const mmFg = makeU8Pair(fgW, fgH); // use its "pred" as the foreground
    const mmRef = makeU8Pair(refW, refH); // use its "ref" as the baseline
    const mmFgUrl = rgbaToDataUrl(mmFg.predRGBA, fgW, fgH);
    const mmRefUrl = rgbaToDataUrl(mmRef.refRGBA, refW, refH);
    const mmFgDec = await decodeUrl(mmFgUrl, fgW, fgH);
    const mmRefDec = await decodeUrl(mmRefUrl, refW, refH);

    // (e) top-left crop (the historical reported-bug pair) — now DIFF-FRAMED on
    //     the 96x64 overlap: numbers correct, display fills the frame.
    const eTL = cpuAbsMapped(mmRefDec, refW, refH, mmFgDec, fgW, fgH, "top-left", "crop");
    const tlH2 = mountPane({ id: "mismatched-abs-tl", imageUrl: mmFgUrl, baselineUrl: mmRefUrl, diffKernel: "absolute" });
    ok = (await assertDiffFramed("e/mismatched-top-left-crop", tlH2, fgW, fgH, eTL.rw, eTL.rh, eTL.out)) && ok;

    // (f) CENTER crop — same 96x64 overlap, but each source is sampled from its
    //     CENTERED window (offsetB={32,28} into the 160x120 fg). Numbers must
    //     match the CPU abs computed under the CENTER offsets, not top-left.
    const eCtr = cpuAbsMapped(mmRefDec, refW, refH, mmFgDec, fgW, fgH, "center", "crop");
    const ctrH2 = mountPane({ id: "mismatched-abs-center", imageUrl: mmFgUrl, baselineUrl: mmRefUrl, diffKernel: "absolute", align: "center" });
    ok = (await assertDiffFramed("f/mismatched-center-crop", ctrH2, fgW, fgH, eCtr.rw, eCtr.rh, eCtr.out)) && ok;

    // (g) FILL — no crop: RESULT = PRIMARY (fg) 160x120; ref is bilinearly
    //     rescaled to it, fg maps 1:1. Numbers must match the CPU bilinear-fill
    //     abs reference; framing = primary; display fills the frame.
    const eFill = cpuAbsMapped(mmRefDec, refW, refH, mmFgDec, fgW, fgH, "top-left", "fill");
    const fillH2 = mountPane({ id: "mismatched-abs-fill", imageUrl: mmFgUrl, baselineUrl: mmRefUrl, diffKernel: "absolute", fit: "fill" });
    ok = (await assertDiffFramed("g/mismatched-fill", fillH2, fgW, fgH, eFill.rw, eFill.rh, eFill.out)) && ok;

    smallH2.unmount();
    bigH2.unmount();
    hdrH2.unmount();
    modeH2.unmount();
    tlH2.unmount();
    ctrH2.unmount();
    fillH2.unmount();

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
