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
import { VERTEX_WGSL, SAMPLING_WGSL } from "./kernels/prelude.wgsl";
import { computeMetrics, type DiffMetrics } from "./image-engine";

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
@group(0) @binding(0) var texA: texture_2d<f32>;
@group(0) @binding(3) var texB: texture_2d<f32>;
${kernelSource}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let dimsA = vec2<i32>(textureDimensions(texA));
  let dimsB = vec2<i32>(textureDimensions(texB));
  let px = vec2<i32>(in.position.xy);
  let a = textureLoad(texA, clamp(px, vec2<i32>(0), dimsA - vec2<i32>(1)), 0);
  let b = textureLoad(texB, clamp(px, vec2<i32>(0), dimsB - vec2<i32>(1)), 0);
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
): Texture {
  const kernel = getDiffKernel(kernelId);
  if (!kernel) throw new Error(`computeDiff: unknown diff kernel "${kernelId}"`);
  const width = Math.min(texA.width, texB.width);
  const height = Math.min(texA.height, texB.height);
  const resolved = resolveKernelParams(kernel, params);
  computeCount++;

  if (kernel.kind === "pointwise") {
    const result = device.createTexture(width, height, RESULT_FORMAT);
    const pipeline = getPipeline(device, `pw:${kernel.id}`, pointwiseShader(kernel.source), RESULT_FORMAT);
    let bg: BindGroup | undefined;
    try {
      bg = device.createBindGroup(pipeline, [
        { binding: 0, resource: texA },
        { binding: 1, resource: texB },
      ]);
      device.renderFullscreen(result, pipeline, bg);
    } finally {
      bg?.destroy?.();
    }
    return result;
  }

  // Multi-pass: run the pass graph over pooled intermediates.
  const ctx: KernelBuildCtx = { width, height, params: resolved };
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
// Result cache: content-keyed LRU with a VRAM budget.
// ===========================================================================
export interface DiffCacheEntry {
  texture: Texture;
  width: number;
  height: number;
  displayRange: DisplayRange;
  bytes: number;
  /** Lazily-computed + cached MSE/PSNR/MAE over the SOURCES (kernel-independent). */
  scalars?: DiffMetrics;
  scalarsPending?: Promise<DiffMetrics>;
}

const DEFAULT_MAX_ENTRIES = 8;
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024; // 256 MB

class DiffCache {
  private readonly map = new Map<string, DiffCacheEntry>(); // insertion-order = LRU order
  private totalBytes = 0;
  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {}

  get(key: string): DiffCacheEntry | undefined {
    const e = this.map.get(key);
    if (e) {
      // bump to most-recently-used
      this.map.delete(key);
      this.map.set(key, e);
    }
    return e;
  }

  set(key: string, entry: DiffCacheEntry): void {
    const existing = this.map.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      existing.texture.destroy();
      this.map.delete(key);
    }
    this.map.set(key, entry);
    this.totalBytes += entry.bytes;
    this.evict();
  }

  private evict(): void {
    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestKey = this.map.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const e = this.map.get(oldestKey)!;
      // Never evict the single entry that is over budget on its own — keep at
      // least one so the current view still has a result.
      if (this.map.size === 1) break;
      this.map.delete(oldestKey);
      this.totalBytes -= e.bytes;
      e.texture.destroy();
    }
  }

  clear(): void {
    for (const e of this.map.values()) e.texture.destroy();
    this.map.clear();
    this.totalBytes = 0;
  }

  get size(): number {
    return this.map.size;
  }
}

const caches = new WeakMap<Device, DiffCache>();
function cacheFor(device: Device): DiffCache {
  let c = caches.get(device);
  if (!c) {
    c = new DiffCache();
    caches.set(device, c);
  }
  return c;
}

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
): string {
  const kernel = getDiffKernel(kernelId);
  const ph = kernel ? paramsHash(kernel, params) : "";
  return `${contentKeyA}|${contentKeyB}|${kernelId}|${ph}`;
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
): DiffCacheEntry {
  const kernel = getDiffKernel(kernelId);
  if (!kernel) throw new Error(`ensureDiff: unknown diff kernel "${kernelId}"`);
  const cache = cacheFor(device);
  const key = diffCacheKey(contentKeyA, contentKeyB, kernelId, params);
  const hit = cache.get(key);
  if (hit) return hit;

  const texture = computeDiff(device, texA, texB, kernelId, params);
  const width = Math.min(texA.width, texB.width);
  const height = Math.min(texA.height, texB.height);
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

/** Lazily compute + cache the entry's MSE/PSNR/MAE (over the two sources). */
export async function ensureDiffScalars(
  device: Device,
  entry: DiffCacheEntry,
  texA: Texture,
  texB: Texture,
): Promise<DiffMetrics> {
  if (entry.scalars) return entry.scalars;
  if (!entry.scalarsPending) {
    entry.scalarsPending = computeMetrics(device, texA, texB).then((m) => {
      entry.scalars = m;
      return m;
    });
  }
  return entry.scalarsPending;
}

/** Test/introspection: current cache entry count for a device. */
export function diffCacheSize(device: Device): number {
  return cacheFor(device).size;
}

/** Test/teardown: drop + destroy all cached entries for a device. */
export function clearDiffCache(device: Device): void {
  caches.get(device)?.clear();
}

// ===========================================================================
// Display blit: sample the cached RESULT texture through the uv-window, map via
// displayRange, apply the diff colormap.
// ===========================================================================
const DISPLAY_SHADER = `
${VERTEX_WGSL}
${SAMPLING_WGSL}
@group(0) @binding(0) var resultTex: texture_2d<f32>;
@group(0) @binding(3) var lut: texture_2d<f32>;
@group(0) @binding(8) var<uniform> u_uv: vec4<f32>;   // uvRect.xy, uvRect.wh
@group(0) @binding(11) var<uniform> u_disp: vec4<f32>; // displayRangeId, cmapModeId, useColormap, filterMode

@fragment fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(0.999999));
  let uvRect = u_uv;
  let rawSrcUV = uvRect.xy + uv * uvRect.zw;
  if (rawSrcUV.x < 0.0 || rawSrcUV.x >= 1.0 || rawSrcUV.y < 0.0 || rawSrcUV.y >= 1.0) {
    return vec4<f32>(0.0);
  }
  let srcUV = clamp(rawSrcUV, vec2<f32>(0.0), vec2<f32>(0.999999));
  let dims = vec2<f32>(textureDimensions(resultTex));
  let filterLinear = u_disp.w > 0.5;
  var raw: vec4<f32>;
  if (filterLinear) {
    raw = sampleBilinearOf(resultTex, srcUV, dims);
  } else {
    raw = textureLoad(resultTex, vec2<i32>(srcUV * dims), 0);
  }
  let displayRangeId = i32(round(u_disp.x));
  var v = raw.rgb;
  if (displayRangeId == 1 || displayRangeId == 2) {
    v = (v + vec3<f32>(1.0)) * 0.5; // signed / relative -> [0,1] about 0.5
  }
  let disp = clamp(v, vec3<f32>(0.0), vec3<f32>(1.0));
  let cmapModeId = i32(round(u_disp.y));
  let useColormap = u_disp.z > 0.5;
  var outColor: vec3<f32>;
  if (useColormap) {
    let avg = (disp.r + disp.g + disp.b) / 3.0;
    var idx = avg;
    if (cmapModeId == 2) { idx = 0.5 + avg * 0.5; } // "positive"
    outColor = sampleLUT(lut, idx);
  } else {
    outColor = disp;
  }
  return vec4<f32>(outColor, 1.0);
}
`;

const DISPLAY_RANGE_ID: Record<DisplayRange, number> = { unit: 0, signed: 1, relative: 2 };
export type DiffCmapMode = "linear" | "signed" | "positive";
const CMAP_MODE_ID: Record<DiffCmapMode, number> = { linear: 0, signed: 1, positive: 2 };

export interface DiffDisplayParams {
  /** Source-space [0,1] viewport window (zoom/pan): sampled UV = uv.xy + rawUV*uv.wh. */
  uv: { x: number; y: number; w: number; h: number };
  /** Colormap index mode; default `"positive"` (matches the legacy diff blit). */
  cmapMode?: DiffCmapMode;
  /** 256x4 RGBA-float LUT; when absent the raw per-channel display value is shown. */
  colormap?: Float32Array;
  /** Source filter, like ImageParams.filter. Default `"linear"`. */
  filter?: "nearest" | "linear";
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
  let bg: BindGroup | undefined;
  try {
    bg = device.createBindGroup(pipeline, [
      { binding: 0, resource: result },
      { binding: 1, resource: lut },
      { binding: 2, resource: { uniform: uvRect } },
      { binding: 3, resource: { uniform: dispVec } },
    ]);
    device.renderFullscreen(target, pipeline, bg);
  } finally {
    bg?.destroy?.();
    lut.destroy();
  }
}
