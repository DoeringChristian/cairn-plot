/**
 * Diff engine (spec §cached): the cached, kernel-driven diff-compute + display
 * flow that replaces `renderCompare`'s runtime diff branch.
 *
 *   computeDiff(device, texA, texB, kernelId, params)
 *     → runs the kernel (pointwise = one fullscreen pass; multi-pass = its
 *       pass graph over pooled rgba16float intermediates) into a RESULT texture
 *       (rgba16float, `min(A,B)` resolution, RAW values — colormap applied only
 *       at display).
 *
 *   ensureDiff(device, texA, texB, kernelId, params, contentKeyA, contentKeyB)
 *     → the same, but memoized in a content-keyed LRU (VRAM budget). The key is
 *       (contentKeyA, contentKeyB, kernelId, paramsHash) — the pane's SOURCE
 *       content identity, NOT texture object identity — so viewport / exposure
 *       / colormap changes NEVER recompute (they only re-run the display blit).
 *
 *   renderDiffDisplay(device, target, result, kernel.displayRange, params)
 *     → samples the cached result texture through the uv-window, maps values via
 *       the kernel's `displayRange`, and applies the diff colormap LUT.
 *
 * Scalars (MSE/PSNR/MAE) are computed once per entry (via the device's GPU
 * reduction over the sources) and cached in the entry, fixing the legacy
 * remount-recompute.
 */
import type { BindGroup, Device, RenderPipeline, Surface, Texture, TextureFormat, BindGroupEntry } from "./types";
// Import from the registry INDEX (not the bare registry) so the built-in
// kernels are registered as a side effect before any lookup.
import {
  getDiffKernel,
  resolveKernelParams,
  type DiffKernel,
  type DisplayRange,
  type KernelBuildCtx,
} from "./kernels";
import { VERTEX_WGSL, SAMPLING_WGSL, SOURCE_MAP_WGSL } from "./kernels/prelude.wgsl";
import { LUT_FAMILY_WGSL, OUTPUT_ENCODE_WGSL, NORM_ID, type NormMode } from "../image/encodings/index.ts";
import { makeCpuMapSampler } from "./image-engine";
import { cacheFor, type DiffCacheEntry } from "./diff-cache";
import { type DiffCmapMode } from "./diff-cmap-mode";
import { computeCompareMapping, mappingKey, type CompareMapping } from "./compare-align";
import { meanSsimFromErrorMap } from "./ssim-metric";
import { ssimMeanFromLuminanceChunked, ssimLuminance, defaultYield, SSIM_CHUNK_ROWS } from "./kernels/ssim-reference";
import { guardedSsimScalar } from "./ssim-scalar-guard";

export { resolveDiffCmapMode } from "./diff-cmap-mode";
export type { DiffCmapMode } from "./diff-cmap-mode";

// ===========================================================================
// Pipeline caching (per device, per shader source, per target format)
// ===========================================================================
const pipelineCache = new WeakMap<Device, Map<string, RenderPipeline>>();

function getPipeline(device: Device, key: string, shaderWGSL: string, targetFormat: TextureFormat): RenderPipeline {
  let byKey = pipelineCache.get(device);
  if (!byKey) {
    byKey = new Map();
    pipelineCache.set(device, byKey);
  }
  const cacheKey = `${key}::${targetFormat}`;
  let p = byKey.get(cacheKey);
  if (!p) {
    p = device.createRenderPipeline({ shaderWGSL, targetFormat });
    byKey.set(cacheKey, p);
  }
  return p;
}

// ===========================================================================
// Pointwise wrapper shader: sample both sources at the fragment's pixel and
// write the raw kernel(a,b) result.
// ===========================================================================
function pointwiseShader(kernelSource: string): string {
  return `
${VERTEX_WGSL}
${SAMPLING_WGSL}
${SOURCE_MAP_WGSL}
@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_map: vec4<f32>;  // offAx, offAy, offBx, offBy
@group(0) @binding(11) var<uniform> u_res: vec4<f32>; // resultW, resultH, fitFill, 0
${kernelSource}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  // px is the RESULT/overlap-grid pixel. Each source is sampled through the
  // align/fit mapping (integer texel offset per source under crop; normalized-uv
  // bilinear rescale under fill) -- see SOURCE_MAP_WGSL / compare-align.ts.
  let px = vec2<i32>(in.position.xy);
  let a = mapSample(texA, px, u_map.x, u_map.y, u_res.x, u_res.y, u_res.z);
  let b = mapSample(texB, px, u_map.z, u_map.w, u_res.x, u_res.y, u_res.z);
  return kernel(a, b);
}
`;
}

const RESULT_FORMAT: TextureFormat = "rgba16float";

// Global count of actual kernel computations (cache misses). The pane /
// browser harness assert this does NOT increase on zoom / pan / exposure /
// colormap changes — proof that display is decoupled from recompute.
let computeCount = 0;
export function getDiffComputeCount(): number {
  return computeCount;
}

/**
 * Runs `kernelId` over `texA`/`texB` into a fresh rgba16float RESULT texture
 * (`min(A,B)` resolution, raw values). Caller owns the returned texture. This
 * is the un-cached primitive; use `ensureDiff` for the pane path.
 */
export function computeDiff(
  device: Device,
  texA: Texture,
  texB: Texture,
  kernelId: string,
  params?: Record<string, number>,
  mapping?: CompareMapping,
): Texture {
  const kernel = getDiffKernel(kernelId);
  if (!kernel) throw new Error(`computeDiff: unknown diff kernel "${kernelId}"`);
  // The RESULT grid + per-source sample mapping. Absent ⇒ legacy top-left crop
  // (result = min(A,B), zero offsets) — identical to the prior behavior.
  const map =
    mapping ??
    computeCompareMapping({ w: texA.width, h: texA.height }, { w: texB.width, h: texB.height }, "top-left", "crop", "b");
  const width = map.result.w;
  const height = map.result.h;
  const fitFill = map.fit === "fill" ? 1 : 0;
  const resolved = resolveKernelParams(kernel, params);
  computeCount++;

  if (kernel.kind === "pointwise") {
    const result = device.createTexture(width, height, RESULT_FORMAT);
    const pipeline = getPipeline(device, `pw:${kernel.id}`, pointwiseShader(kernel.source), RESULT_FORMAT);
    const uMap = new Float32Array([map.offsetA.x, map.offsetA.y, map.offsetB.x, map.offsetB.y]);
    const uRes = new Float32Array([width, height, fitFill, 0]);
    let bg: BindGroup | undefined;
    try {
      bg = device.createBindGroup(pipeline, [
        { binding: 0, resource: texA },
        { binding: 1, resource: texB },
        { binding: 2, resource: { uniform: uMap } },
        { binding: 3, resource: { uniform: uRes } },
      ]);
      device.renderFullscreen(result, pipeline, bg);
    } finally {
      bg?.destroy?.();
    }
    return result;
  }

  // Multi-pass: run the pass graph over pooled intermediates.
  const ctx: KernelBuildCtx = {
    width,
    height,
    params: resolved,
    sourceMap: { fill: map.fit === "fill", offsetA: map.offsetA, offsetB: map.offsetB },
  };
  const graph = kernel.buildPasses(ctx);
  const textures = new Map<string, Texture>([
    ["srcA", texA],
    ["srcB", texB],
  ]);
  const owned: Texture[] = [];
  try {
    for (const pass of graph.passes) {
      const out = device.createTexture(width, height, RESULT_FORMAT);
      owned.push(out);
      textures.set(pass.output, out);
      const pipeline = getPipeline(device, `mp:${kernel.id}:${pass.name}`, pass.shader, RESULT_FORMAT);
      const entries: BindGroupEntry[] = pass.inputs.map((ref, i) => {
        const tex = textures.get(ref);
        if (!tex) throw new Error(`computeDiff: pass "${pass.name}" input "${ref}" not produced yet`);
        return { binding: i, resource: tex };
      });
      if (pass.uniforms) entries.push(...pass.uniforms(ctx));
      let bg: BindGroup | undefined;
      try {
        bg = device.createBindGroup(pipeline, entries);
        device.renderFullscreen(out, pipeline, bg);
      } finally {
        bg?.destroy?.();
      }
    }
    const finalTex = textures.get(graph.final);
    if (!finalTex) throw new Error(`computeDiff: final ref "${graph.final}" not produced`);
    // Free every intermediate EXCEPT the final result.
    for (const t of owned) if (t !== finalTex) t.destroy();
    return finalTex;
  } catch (err) {
    for (const t of owned) t.destroy();
    throw err;
  }
}

// ===========================================================================
// Result cache: content-keyed LRU with a VRAM budget. The cache itself lives in
// `./diff-cache.ts` (extracted so it is unit-testable under Node's type-stripper
// without this module's WebGPU/kernels graph — see `diff-cache.test.ts`). Its
// entry/byte caps are deliberately sized so a multi-pane compare card never
// thrashes; see `DEFAULT_MAX_ENTRIES` there.
// ===========================================================================
export type { DiffCacheEntry };

function paramsHash(kernel: DiffKernel, params?: Record<string, number>): string {
  const resolved = resolveKernelParams(kernel, params);
  const keys = Object.keys(resolved).sort();
  return keys.map((k) => `${k}=${resolved[k]}`).join(",");
}

export function diffCacheKey(
  contentKeyA: string,
  contentKeyB: string,
  kernelId: string,
  params?: Record<string, number>,
  mapping?: CompareMapping,
): string {
  const kernel = getDiffKernel(kernelId);
  const ph = kernel ? paramsHash(kernel, params) : "";
  // align/fit change the RESULT grid + sampling, so they must key the cache —
  // otherwise a re-diff at a new alignment would return a stale texture.
  const mk = mapping ? mappingKey(mapping) : "";
  return `${contentKeyA}|${contentKeyB}|${kernelId}|${ph}|${mk}`;
}

/**
 * NON-mutating residency peek: is the diff RESULT for (contentKeyA, contentKeyB,
 * kernelId, params, mapping) already cached on `device`? Derives the SAME key
 * `ensureDiff` would (including the default `mapping` from the operand dims when
 * omitted), then probes the cache without computing, uploading, or bumping LRU.
 * The pane's paint-atomic flip path calls this to decide whether a CACHED diff
 * (FLIP / HDR-FLIP / SSIM) can render pre-paint (result resident → a synchronous
 * blit) vs. must stay on the post-paint hold path (result absent → the flip would
 * trigger a multi-pass recompute on the critical path).
 */
export function hasDiff(
  device: Device,
  dimsA: { w: number; h: number },
  dimsB: { w: number; h: number },
  kernelId: string,
  params: Record<string, number> | undefined,
  contentKeyA: string,
  contentKeyB: string,
  mapping?: CompareMapping,
): boolean {
  const map =
    mapping ?? computeCompareMapping({ w: dimsA.w, h: dimsA.h }, { w: dimsB.w, h: dimsB.h }, "top-left", "crop", "b");
  const key = diffCacheKey(contentKeyA, contentKeyB, kernelId, params, map);
  return cacheFor(device).has(key);
}

/**
 * Returns the cached diff RESULT for (contentKeyA, contentKeyB, kernelId,
 * params), computing + caching it on a miss. The cache OWNS the returned
 * texture — callers must NOT destroy it. Recomputation happens only when the
 * key changes; viewport/exposure/colormap never touch this path.
 */
export function ensureDiff(
  device: Device,
  texA: Texture,
  texB: Texture,
  kernelId: string,
  params: Record<string, number> | undefined,
  contentKeyA: string,
  contentKeyB: string,
  mapping?: CompareMapping,
): DiffCacheEntry {
  const kernel = getDiffKernel(kernelId);
  if (!kernel) throw new Error(`ensureDiff: unknown diff kernel "${kernelId}"`);
  const cache = cacheFor(device);
  const map =
    mapping ??
    computeCompareMapping({ w: texA.width, h: texA.height }, { w: texB.width, h: texB.height }, "top-left", "crop", "b");
  const key = diffCacheKey(contentKeyA, contentKeyB, kernelId, params, map);
  const hit = cache.get(key);
  if (hit) return hit;

  const texture = computeDiff(device, texA, texB, kernelId, params, map);
  const width = map.result.w;
  const height = map.result.h;
  const entry: DiffCacheEntry = {
    texture,
    width,
    height,
    displayRange: kernel.displayRange,
    bytes: width * height * 8, // rgba16float
  };
  cache.set(key, entry);
  return entry;
}

/**
 * Mean SSIM scalar for the metrics chip. Mean SSIM = 1 − mean(1 − SSIM) over the
 * SAME mapped/compared region the other metrics reduce over (overlap under crop,
 * common grid under fill — passed via `mapping`, or the legacy top-left min-crop
 * when omitted). Sourced cheapest-first:
 *   (a) diff + `ssim` already displayed → the `ssim` RESULT is already cached
 *       (`ensureDiff` hit) and its readback already retained (the TEV path), so
 *       this call averages it for ZERO extra GPU work.
 *   (b) any OTHER GPU mode (split/blend, or a different diff kernel) → run the
 *       `ssim` kernel ONCE through the content+mapping-keyed diff cache, then
 *       average — a one-shot compute the cache then holds.
 *   (c) the GPU `ssim` path throws (a device without the multipass kernel /
 *       readback) → CPU `ssim-reference.ts` over the source readbacks, mapped
 *       identically (`makeCpuMapSampler`). Async either way — the caller shows
 *       `SSIM —` until it resolves and never blocks.
 * The result is memoized on the `ssim` entry (`ssimMean`); the CPU fallback is
 * not cached (it only runs on a degraded device where there is no entry).
 */
// One-in-flight + result guard for the mean-SSIM scalar — the hard backstop for
// the reported SSIM hang. `ensureDiff` already memoized the GPU-SUCCESS path;
// the guard additionally collapses the CPU-throw path (previously uncached +
// unguarded) and defeats a render-storm that re-fires the metrics effect: ALL
// calls for a given (sources, mapped region) share ONE in-flight compute, so
// even an infinite loop triggers at most one SSIM computation per content+
// mapping. See `ssim-scalar-guard.ts`.
export { getSsimComputeCount } from "./ssim-scalar-guard";

function ssimScalarCacheKey(contentKeyA: string, contentKeyB: string, mapping?: CompareMapping): string {
  return `${contentKeyA}|${contentKeyB}|${mapping ? mappingKey(mapping) : ""}`;
}

export function ensureSsimScalar(
  device: Device,
  texA: Texture,
  texB: Texture,
  contentKeyA: string,
  contentKeyB: string,
  mapping?: CompareMapping,
): Promise<number> {
  return guardedSsimScalar(device, ssimScalarCacheKey(contentKeyA, contentKeyB, mapping), () =>
    computeSsimScalar(device, texA, texB, contentKeyA, contentKeyB, mapping),
  );
}

/** The actual cheapest-first SSIM scalar computation, run at most once per key by the guard. */
async function computeSsimScalar(
  device: Device,
  texA: Texture,
  texB: Texture,
  contentKeyA: string,
  contentKeyB: string,
  mapping?: CompareMapping,
): Promise<number> {
  try {
    // (a)/(b): the content+mapping cache key makes this ONE compute across the
    // pane's lifetime; in diff+ssim it returns the very entry already displayed.
    const entry = ensureDiff(device, texA, texB, "ssim", undefined, contentKeyA, contentKeyB, mapping);
    if (entry.ssimMean !== undefined) return entry.ssimMean;
    if (!entry.ssimMeanPending) {
      entry.ssimMeanPending = ensureDiffResultReadback(device, entry).then((samples) => {
        const m = meanSsimFromErrorMap(samples, entry.width, entry.height);
        entry.ssimMean = m;
        return m;
      });
    }
    return await entry.ssimMeanPending;
  } catch {
    // (c) Defensive CPU fallback (mirrors computeMetrics' readback fallback).
    // CHUNKED so it never blocks the main thread synchronously — it yields
    // between scanline batches while the chip shows `SSIM —`.
    return ssimScalarReference(device, texA, texB, mapping);
  }
}

/**
 * CPU mean-SSIM over the mapped region via the pinned reference
 * (`ssim-reference.ts`), reading back both source textures and resampling each
 * onto the RESULT grid with the SAME mapping the GPU moment passes apply
 * (`makeCpuMapSampler`). Averages the FULL-region SSIM map (not skimage's
 * interior crop) so it covers the same region as the other metrics.
 */
async function ssimScalarReference(
  device: Device,
  texA: Texture,
  texB: Texture,
  mapping?: CompareMapping,
): Promise<number> {
  const map =
    mapping ??
    computeCompareMapping({ w: texA.width, h: texA.height }, { w: texB.width, h: texB.height }, "top-left", "crop", "b");
  const width = map.result.w;
  const height = map.result.h;
  const n = width * height;
  if (n <= 0) return NaN;
  const a = await device.readback(texA);
  const b = await device.readback(texB);
  const normA = a instanceof Uint8Array ? 255 : 1;
  const normB = b instanceof Uint8Array ? 255 : 1;
  const fill = map.fit === "fill";
  const sampleA = makeCpuMapSampler(a, texA.width, texA.height, normA, map.offsetA, fill, width, height);
  const sampleB = makeCpuMapSampler(b, texB.width, texB.height, normB, map.offsetB, fill, width, height);
  const lumX = new Float64Array(n);
  const lumY = new Float64Array(n);
  const va = [0, 0, 0];
  const vb = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sampleA(x, y, va);
      sampleB(x, y, vb);
      const i = y * width + x;
      lumX[i] = ssimLuminance(va[0]!, va[1]!, va[2]!);
      lumY[i] = ssimLuminance(vb[0]!, vb[1]!, vb[2]!);
    }
    // Yield between scanline batches so the luminance sampling can't block.
    if ((y + 1) % SSIM_CHUNK_ROWS === 0) await defaultYield();
  }
  // Full-region mean SSIM via the CHUNKED (yielding) blur path — same math as
  // the synchronous reference, but it hands the main thread back between batches.
  return ssimMeanFromLuminanceChunked(lumX, lumY, width, height);
}

// NOTE: `ensureDiffScalars` (the entry-cached MSE/PSNR/MAE helper) was removed
// in Phase 4 — its only consumer was the deleted `GpuComparePane`. The unified
// pane computes metrics through the pool (`PaneHandle.computeMetrics`, which
// calls `image-engine.ts`'s `computeMetrics` directly).

/**
 * Lazily read back the entry's diff RESULT texture into a CPU `Float32Array`
 * (RGBA, row-major, result resolution) and cache it IN the entry. Used by the
 * TEV overlay to show the METRIC value(s) per pixel in diff mode. Idempotent +
 * memoized: repeated calls (zoom/pan/colormap redraws) return the cached array
 * without a second GPU readback, and this NEVER calls `computeDiff`, so
 * `getDiffComputeCount()` does not move.
 */
export async function ensureDiffResultReadback(
  device: Device,
  entry: DiffCacheEntry,
): Promise<Float32Array> {
  if (entry.resultSamples) return entry.resultSamples;
  if (!entry.resultSamplesPending) {
    entry.resultSamplesPending = device.readback(entry.texture).then((buf) => {
      // rgba16float readback returns a Float32Array; be defensive for any other.
      const arr = buf instanceof Float32Array ? buf : Float32Array.from(buf);
      entry.resultSamples = arr;
      // Charge the retained readback against the LRU byte budget (fix: these
      // full-frame arrays were previously uncounted, so ~8 could pile up).
      cacheFor(device).accountReadbackBytes(entry, arr.byteLength);
      return arr;
    });
  }
  return entry.resultSamplesPending;
}

// ===========================================================================
// Display blit: sample the cached RESULT texture through the uv-window, map via
// displayRange, apply the diff colormap.
// ===========================================================================
const DISPLAY_SHADER = `
${VERTEX_WGSL}
${SAMPLING_WGSL}
${LUT_FAMILY_WGSL}
${OUTPUT_ENCODE_WGSL}
@group(0) @binding(0) var resultTex: texture_2d<f32>;
@group(0) @binding(3) var lut: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_uv: vec4<f32>;   // uvRect.xy, uvRect.wh
@group(0) @binding(11) var<uniform> u_disp: vec4<f32>; // displayRangeId, cmapModeId, useColormap, filterMode
@group(0) @binding(14) var<uniform> u_expo: vec4<f32>; // exposureEV, offset, powerExp(gamma), 0
@group(0) @binding(17) var<uniform> u_src: vec4<f32>;  // primaryW, primaryH, ANALYTIC(.z), hdrOut(.w)
@group(0) @binding(20) var<uniform> u_norm: vec4<f32>; // normModeId, boundsMin, boundsMax, boundsActive (DATA-encoding norm/bounds — the compare-pane-on-DISPLAY follow-up)

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_uv;
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let dims = vec2<f32>(textureDimensions(resultTex));
  // The diff RESULT is min-cropped to min(A,B), TOP-LEFT aligned. The pane's
  // uv-rect and this fragment's srcUV live in the PRIMARY source's normalized
  // space (u_src.xy = the primary/foreground dims that drive the overlay grid
  // and viewport). Map srcUV to a PRIMARY pixel and show the result 1:1 in the
  // crop's top-left; a fragment beyond the crop (primary pixel >= result dims)
  // has NO diff value, so it is transparent -- matching sampleDiff, which
  // returns null there (never a fake zero). For an EQUAL-size pair primaryDims
  // == dims, so this collapses to the identity mapping (unchanged behavior).
  let primaryDims = select(dims, u_src.xy, u_src.x > 0.5);
  let primaryPixel = srcUV * primaryDims;
  if (primaryPixel.x >= dims.x || primaryPixel.y >= dims.y) {
    return vec4<f32>(0.0);
  }
  let filterLinear = u_disp.w > 0.5;
  var raw: vec4<f32>;
  if (filterLinear) {
    raw = sampleBilinearOf(resultTex, primaryPixel / dims, dims);
  } else {
    raw = textureLoad(resultTex, vec2<i32>(primaryPixel), 0);
  }
  let displayRangeId = i32(round(u_disp.x));
  let analytic = u_src.z > 0.5;
  let hdrOut = u_src.w > 0.5;
  // Exposure/offset adjust the RAW metric value BEFORE the cmap-mode index
  // mapping and LUT — i.e. they change the colormap SENSITIVITY (value * 2^EV +
  // offset), not the final RGB. Display-only: the cached diff RESULT is never
  // touched, so this never triggers a recompute.
  var v = raw.rgb * exp2(u_expo.x) + vec3<f32>(u_expo.y);
  if (analytic) {
    // ANALYTIC signed error (tev-style red-green): the RAW signed metric (mean
    // over channels — tev's average(col)) → cairnSignedAnalyticColor (negative →
    // red, positive → green, amplitude 2*|v|), UNCLAMPED, then the SHARED
    // output-encode. BYPASSES the (v+1)/2 displayRange fold + the clamp + the LUT:
    // the signed value must survive raw. On the HDR surface |v|>1 error survives
    // (extended encode); on SDR it clamps — |v|<=1 renders the same on both.
    let sAvg = (v.r + v.g + v.b) / 3.0;
    let lin = cairnSignedAnalyticColor(sAvg);
    if (hdrOut) {
      return vec4<f32>(
        extendedOutputEncodeF(lin.r, 0.0, false),
        extendedOutputEncodeF(lin.g, 0.0, false),
        extendedOutputEncodeF(lin.b, 0.0, false),
        1.0,
      );
    }
    return vec4<f32>(
      outputEncodeF(lin.r, 0.0, false),
      outputEncodeF(lin.g, 0.0, false),
      outputEncodeF(lin.b, 0.0, false),
      1.0,
    );
  }
  if (displayRangeId == 1 || displayRangeId == 2) {
    v = (v + vec3<f32>(1.0)) * 0.5; // signed / relative -> [0,1] about 0.5
  }
  let disp = clamp(v, vec3<f32>(0.0), vec3<f32>(1.0));
  let cmapModeId = i32(round(u_disp.y));
  let useColormap = u_disp.z > 0.5;
  var outColor: vec3<f32>;
  if (useColormap) {
    // The SHARED LUT family (image/encodings' cairnLutColor) — the SAME family
    // the single-image isScalar path uses. It folds the index per cmap-mode
    // (2 = positive: zero on a diverging map's neutral midpoint; 0/1 use the
    // full ramp) and mirrors the source filter (linear at moderate zoom so the
    // smooth diff magnitude doesn't snap to one of 256 discrete bins, nearest
    // at the pixelated zoom for crisp per-texel color). The diff path's private
    // LUT sampling/index plumbing folded INTO this family.
    let avg = (disp.r + disp.g + disp.b) / 3.0;
    // DATA-encoding NORM/BOUNDS (the compare-pane-on-DISPLAY follow-up): reshape
    // the normalized error index through the SAME cairnDataIndex the image LUT
    // path uses (linear/log/power + optional min/max bounds), byte-parallel with
    // the CPU computeDataIndex. norm=linear + boundsActive=false → dataIdx==avg,
    // so the pre-follow-up diff colormap is reproduced bit-for-bit. The power
    // exponent reuses u_expo.z (the gamma slot), free on the lut path.
    let dataIdx = cairnDataIndex(avg, i32(round(u_norm.x)), u_norm.y, u_norm.z, u_norm.w > 0.5, u_expo.z);
    outColor = cairnLutColor(lut, dataIdx, cmapModeId, filterLinear);
  } else {
    // GRAY NONE (raw per-channel diff, no false-color) — the compare-pane twin of
    // the single-image gray-none path. On an HDR target the FOLDED value v (pre-
    // clamp) rides the SHARED extended output-encode so over-range (|v|>1) error
    // SURVIVES; on SDR it stays the legacy raw-clamped code value (disp), byte-
    // identical to before (the SDR diff-none has never sRGB-encoded — it shows the
    // raw magnitude as a code value; unifying that transfer is out of scope).
    if (hdrOut) {
      return vec4<f32>(
        extendedOutputEncodeF(v.r, 0.0, false),
        extendedOutputEncodeF(v.g, 0.0, false),
        extendedOutputEncodeF(v.b, 0.0, false),
        1.0,
      );
    }
    outColor = disp;
  }
  return vec4<f32>(outColor, 1.0);
}
`;

const DISPLAY_RANGE_ID: Record<DisplayRange, number> = { unit: 0, signed: 1, relative: 2 };
const CMAP_MODE_ID: Record<DiffCmapMode, number> = { linear: 0, signed: 1, positive: 2 };

export interface DiffDisplayParams {
  /** Source-space [0,1] viewport window (zoom/pan): sampled UV = uv.xy + rawUV*uv.wh. */
  uv: { x: number; y: number; w: number; h: number };
  /** Colormap index mode; default `"positive"` (matches the legacy diff blit). */
  cmapMode?: DiffCmapMode;
  /**
   * ANALYTIC signed error colormap (the tev-style red-green follow-up). When true
   * the blit COMPUTES the color (`cairnSignedAnalyticColor`: negative → red,
   * positive → green, amplitude `2*|v|`, UNCLAMPED) from the RAW signed metric —
   * BYPASSING the `(v+1)/2` displayRange fold, the clamp, and the LUT/cmapMode —
   * then runs it through the shared output-encode. On an HDR `target` the
   * over-range (`|v|>1`) error survives; on SDR it clamps (`|v|<=1` matches).
   * `colormap`/`cmapMode`/`norm` are ignored under it. Unset = false. */
  analytic?: boolean;
  /** 256x4 RGBA-float LUT; when absent the raw per-channel display value is shown. */
  colormap?: Float32Array;
  /** Source filter, like ImageParams.filter. Default `"linear"`. */
  filter?: "nearest" | "linear";
  /** Exposure in EV stops applied to the RAW metric value BEFORE the cmap-mode
   *  index mapping + LUT (`value * 2^EV`) — changes colormap sensitivity, not the
   *  final RGB. Display-only; never recomputes the cached result. Default 0. */
  exposureEV?: number;
  /** Additive offset applied after exposure, before the cmap index mapping.
   *  Display-only. Default 0. */
  offset?: number;
  /**
   * DATA-encoding NORM (the compare-pane-on-DISPLAY follow-up) — the nonlinear
   * reshape of the normalized error index INSIDE the colormap (`linear`/`log`/
   * `power`), threaded through the SAME `cairnDataIndex` the image LUT path uses
   * (byte-parallel with the CPU `computeDataIndex`). Only meaningful when a
   * `colormap` is bound; `"linear"` (default) is the identity, so the pre-
   * follow-up diff colormap is unchanged. `power` reuses {@link gamma} as its
   * exponent (free on the lut path). */
  norm?: NormMode;
  /** DATA-encoding BOUNDS min — the ALTERNATIVE domain affine to exposure/offset
   *  (bounds-first). Active iff BOTH {@link normMin}/{@link normMax} are finite:
   *  the index becomes `(value - normMin)/(normMax - normMin)`. Unset → the
   *  exposure/offset sensitivity skin (the common compare case). */
  normMin?: number;
  normMax?: number;
  /** Power-norm exponent (reuses the image LUT path's `gamma` slot). Only read
   *  when `norm:"power"`; `<= 0` falls back to 1. Default 1. */
  gamma?: number;
  /**
   * The PRIMARY (foreground) source footprint the uv-window is expressed in —
   * the same dims that drive the pane's overlay grid + viewport. The diff RESULT
   * texture is min-cropped to `min(A,B)` and TOP-LEFT aligned inside this
   * footprint, so the blit maps `uv → primary pixel` and shows the result 1:1 in
   * the crop, leaving the region beyond the crop transparent (matching
   * `sampleDiff`, which returns null there — never a fake "0"). Omit for an
   * EQUAL-size pair: the mapping then collapses to the result texture's own dims
   * (identity — unchanged behavior). */
  sourceDims?: { w: number; h: number };
}

function buildLutTexture(device: Device, colormap: Float32Array | undefined): Texture {
  if (colormap) {
    if (colormap.length !== 256 * 4) {
      throw new Error(`renderDiffDisplay: colormap must be 256*4 floats, got ${colormap.length}`);
    }
    const tex = device.createTexture(256, 1, "rgba32float");
    tex.write(colormap);
    return tex;
  }
  const tex = device.createTexture(1, 1, "rgba32float");
  tex.write(new Float32Array([0, 0, 0, 1]));
  return tex;
}

function targetFormatOf(target: Surface | Texture): TextureFormat {
  if ("canvas" in target) return (target as Surface).hdr ? "rgba16float" : "rgba8unorm";
  return (target as Texture).format;
}

/**
 * Blits a cached diff RESULT texture to `target` through the uv-window, mapping
 * raw values via `displayRange` and (optionally) the diff colormap. This is the
 * ONLY thing that re-runs on zoom/pan/exposure/colormap change — the result
 * texture is never recomputed here.
 */
export function renderDiffDisplay(
  device: Device,
  target: Surface | Texture,
  result: Texture,
  displayRange: DisplayRange,
  params: DiffDisplayParams,
): void {
  const targetFormat = targetFormatOf(target);
  const pipeline = getPipeline(device, "diff-display", DISPLAY_SHADER, targetFormat);
  const lut = buildLutTexture(device, params.colormap);
  const uvRect = new Float32Array([params.uv.x, params.uv.y, params.uv.w, params.uv.h]);
  const dispVec = new Float32Array([
    DISPLAY_RANGE_ID[displayRange],
    CMAP_MODE_ID[params.cmapMode ?? "positive"],
    params.colormap ? 1 : 0,
    params.filter === "nearest" ? 0 : 1,
  ]);
  // u_expo.z carries the power-norm exponent (the gamma slot), read only on the
  // `power` norm branch of cairnDataIndex — free on the lut path.
  const expoVec = new Float32Array([params.exposureEV ?? 0, params.offset ?? 0, params.gamma ?? 1, 0]);
  // Primary/foreground footprint for the min-crop top-left mapping (see
  // `sourceDims` doc). `0` → the shader falls back to the result texture's own
  // dims (identity), so an equal-size pair is unchanged. .z = ANALYTIC flag
  // (tev-style signed color); .w = hdrOut (the target is an extended HDR surface,
  // so the analytic output-encode lets |v|>1 survive).
  const analyticFlag = params.analytic ? 1 : 0;
  const hdrOutFlag = targetFormat === "rgba16float" ? 1 : 0;
  const srcVec = new Float32Array([params.sourceDims?.w ?? 0, params.sourceDims?.h ?? 0, analyticFlag, hdrOutFlag]);
  // u_norm — DATA-encoding norm/bounds, packed exactly like image-engine's
  // u_bind9: [normModeId, boundsMin, boundsMax, boundsActive]. boundsActive iff
  // BOTH bounds are finite (the min/max skin; else the exposure/offset skin).
  const hasBounds =
    typeof params.normMin === "number" && Number.isFinite(params.normMin) &&
    typeof params.normMax === "number" && Number.isFinite(params.normMax);
  const normVec = new Float32Array([
    NORM_ID[params.norm ?? "linear"] ?? 0,
    hasBounds ? (params.normMin as number) : 0,
    hasBounds ? (params.normMax as number) : 0,
    hasBounds ? 1 : 0,
  ]);
  let bg: BindGroup | undefined;
  try {
    bg = device.createBindGroup(pipeline, [
      { binding: 0, resource: result },
      { binding: 1, resource: lut },
      { binding: 2, resource: { uniform: uvRect } },
      { binding: 3, resource: { uniform: dispVec } },
      { binding: 4, resource: { uniform: expoVec } },
      { binding: 5, resource: { uniform: srcVec } },
      { binding: 6, resource: { uniform: normVec } },
    ]);
    device.renderFullscreen(target, pipeline, bg);
  } finally {
    bg?.destroy?.();
    lut.destroy();
  }
}
