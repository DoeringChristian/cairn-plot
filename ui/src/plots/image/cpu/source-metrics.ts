import type { ImageCompareAlign, ImageCompareFit, ImageSource } from "../definition/content.ts";
import { computeCompareMapping } from "../runtime/compare-align.ts";
import { floatPixelReader } from "../runtime/pixel-buffer.ts";
import { imageDataToSceneField } from "../resources/scene-field.ts";
import { loadImageData } from "../resources/load-image-data.ts";
import { SSIM_LUM, ssimFromLuminance } from "../runtime/ssim-reference.ts";
import { flipLDR } from "../runtime/flip-reference.ts";
import { flipHDR } from "../runtime/hdr-flip-reference.ts";
import { outputEncode } from "../runtime/tonemap.ts";
import { getGpuDiffCacheLimits } from "../../../resources/runtime-config.ts";
import { registerRuntimePolicyHook } from "../../../resources/runtime-policy-hooks.ts";

export interface CpuSourceMetrics {
  mse: number;
  psnr: number;
  mae: number;
  /** Present only when the selected comparison operation is SSIM. */
  ssim?: number;
  /** Scalar error field for CPU-rendered FLIP/SSIM. */
  errorMap?: Float32Array;
  width?: number;
  height?: number;
  channels?: 1 | 3;
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0;

interface SceneField {
  pixels: Float32Array;
  width: number;
  height: number;
}

async function sourceToSceneField(source: ImageSource): Promise<SceneField | null> {
  if (source.dtype === "uint8") {
    if (!source.url) return null;
    const image = await loadImageData(source.url);
    return image ? imageDataToSceneField(image) : null;
  }

  const shape = source.shape;
  if (shape.length !== 2 && shape.length !== 3) return null;
  const height = shape[0] ?? 0;
  const width = shape[1] ?? 0;
  const channels = shape.length === 2 ? 1 : (shape[2] ?? 0);
  if (width <= 0 || height <= 0 || ![1, 3, 4].includes(channels)) return null;
  const read = floatPixelReader(source.pixels);
  const pixels = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const src = i * channels;
    const dst = i * 4;
    if (channels === 1) {
      const value = finite(read(src));
      pixels[dst] = value;
      pixels[dst + 1] = value;
      pixels[dst + 2] = value;
    } else {
      pixels[dst] = finite(read(src));
      pixels[dst + 1] = finite(read(src + 1));
      pixels[dst + 2] = finite(read(src + 2));
    }
    pixels[dst + 3] = channels === 4 ? finite(read(src + 3)) : 1;
  }
  return { pixels, width, height };
}

function mappedSampler(
  field: SceneField,
  offset: { x: number; y: number },
  fill: boolean,
  resultWidth: number,
  resultHeight: number,
): (x: number, y: number, out: number[]) => void {
  const { pixels, width, height } = field;
  const at = (x: number, y: number, channel: number) => pixels[(y * width + x) * 4 + channel] ?? 0;
  if (!fill) {
    return (x, y, out) => {
      const sx = Math.min(Math.max(x + offset.x, 0), width - 1);
      const sy = Math.min(Math.max(y + offset.y, 0), height - 1);
      out[0] = at(sx, sy, 0);
      out[1] = at(sx, sy, 1);
      out[2] = at(sx, sy, 2);
    };
  }
  return (x, y, out) => {
    const tx = ((x + 0.5) / resultWidth) * width - 0.5;
    const ty = ((y + 0.5) / resultHeight) * height - 0.5;
    const bx = Math.floor(tx);
    const by = Math.floor(ty);
    const fx = tx - bx;
    const fy = ty - by;
    const x0 = Math.min(Math.max(bx, 0), width - 1);
    const x1 = Math.min(Math.max(bx + 1, 0), width - 1);
    const y0 = Math.min(Math.max(by, 0), height - 1);
    const y1 = Math.min(Math.max(by + 1, 0), height - 1);
    for (let channel = 0; channel < 3; channel++) {
      const top = at(x0, y0, channel) + (at(x1, y0, channel) - at(x0, y0, channel)) * fx;
      const bottom = at(x0, y1, channel) + (at(x1, y1, channel) - at(x0, y1, channel)) * fx;
      out[channel] = top + (bottom - top) * fy;
    }
  };
}

/**
 * The comparison operations this reference path serves, by PUBLIC operation id
 * (`definition/image-operations.ts`) rather than by a per-pixel evaluator.
 *
 * `cpu/capabilities.ts` reads this list instead of repeating it, so the CPU
 * backend cannot advertise a metric operation this module does not implement.
 */
export const CPU_METRIC_OPERATION_IDS = ["flip", "flip-hdr", "ssim"] as const;

export type CpuMetricOperationId = (typeof CPU_METRIC_OPERATION_IDS)[number];

export interface ComputeCpuSourceMetricsOptions {
  reference: ImageSource;
  foreground: ImageSource;
  align?: ImageCompareAlign;
  fit?: ImageCompareFit;
  operation?: "signed" | "absolute" | "squared" | "relative_signed" | "relative_absolute" | "relative_squared" | CpuMetricOperationId;
}

/** Exact native-resolution CPU twin of the WebGPU comparison metrics path. */
async function computeCpuSourceMetricsUncached(options: ComputeCpuSourceMetricsOptions): Promise<CpuSourceMetrics | null> {
  const [reference, foreground] = await Promise.all([
    sourceToSceneField(options.reference),
    sourceToSceneField(options.foreground),
  ]);
  if (!reference || !foreground) return null;

  const mapping = computeCompareMapping(
    { w: reference.width, h: reference.height },
    { w: foreground.width, h: foreground.height },
    options.align ?? "top-left",
    options.fit ?? "crop",
    "b",
  );
  const width = mapping.result.w;
  const height = mapping.result.h;
  const count = width * height;
  if (count <= 0) return { mse: 0, psnr: Infinity, mae: 0 };

  const sampleReference = mappedSampler(reference, mapping.offsetA, mapping.fit === "fill", width, height);
  const sampleForeground = mappedSampler(foreground, mapping.offsetB, mapping.fit === "fill", width, height);
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const lumaA = options.operation === "ssim" ? new Float64Array(count) : null;
  const lumaB = options.operation === "ssim" ? new Float64Array(count) : null;
  const flipA = options.operation === "flip" || options.operation === "flip-hdr" ? new Float32Array(count * 3) : null;
  const flipB = options.operation === "flip" || options.operation === "flip-hdr" ? new Float32Array(count * 3) : null;
  const pointwise = options.operation && !(CPU_METRIC_OPERATION_IDS as readonly string[]).includes(options.operation)
    ? new Float32Array(count * 3)
    : null;
  let sumSquared = 0;
  let sumAbsolute = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sampleReference(x, y, a);
      sampleForeground(x, y, b);
      const index = y * width + x;
      for (let channel = 0; channel < 3; channel++) {
        const difference = a[channel]! - b[channel]!;
        sumSquared += difference * difference;
        sumAbsolute += Math.abs(difference);
        if (pointwise) {
          const denominator = Math.max(a[channel]!, 1e-6);
          switch (options.operation) {
            case "signed": pointwise[index * 3 + channel] = difference; break;
            case "absolute": pointwise[index * 3 + channel] = Math.abs(difference); break;
            case "squared": pointwise[index * 3 + channel] = difference * difference; break;
            case "relative_signed": pointwise[index * 3 + channel] = difference / denominator; break;
            case "relative_absolute": pointwise[index * 3 + channel] = Math.abs(difference) / denominator; break;
            case "relative_squared": pointwise[index * 3 + channel] = (difference / denominator) ** 2; break;
          }
        }
      }
      if (lumaA && lumaB) {
        lumaA[index] = Math.min(1, Math.max(0, SSIM_LUM[0] * a[0]! + SSIM_LUM[1] * a[1]! + SSIM_LUM[2] * a[2]!));
        lumaB[index] = Math.min(1, Math.max(0, SSIM_LUM[0] * b[0]! + SSIM_LUM[1] * b[1]! + SSIM_LUM[2] * b[2]!));
      }
      if (flipA && flipB) {
        for (let channel = 0; channel < 3; channel++) {
          flipA[index * 3 + channel] = options.operation === "flip-hdr"
            ? Math.max(0, a[channel]!)
            : outputEncode(Math.min(1, Math.max(0, a[channel]!)));
          flipB[index * 3 + channel] = options.operation === "flip-hdr"
            ? Math.max(0, b[channel]!)
            : outputEncode(Math.min(1, Math.max(0, b[channel]!)));
        }
      }
    }
    // Keep exact large-image CPU comparisons responsive between scanline batches.
    if ((y + 1) % 64 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const channelCount = count * 3;
  const mse = sumSquared / channelCount;
  const result: CpuSourceMetrics = {
    mse,
    psnr: mse <= 0 ? Infinity : 10 * Math.log10(1 / mse),
    mae: sumAbsolute / channelCount,
  };
  if (lumaA && lumaB) {
    const ssim = ssimFromLuminance(lumaA, lumaB, width, height);
    const errorMap = new Float32Array(count);
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const value = ssim.ssim[i]!;
      sum += value;
      errorMap[i] = 1 - value;
    }
    result.ssim = sum / count;
    result.errorMap = errorMap;
    result.width = width;
    result.height = height;
    result.channels = 1;
  } else if (flipA && flipB) {
    result.errorMap = options.operation === "flip-hdr"
      ? flipHDR(flipA, flipB, width, height)
      : flipLDR(flipA, flipB, width, height);
    result.width = width;
    result.height = height;
    result.channels = 1;
  } else if (pointwise) {
    result.errorMap = pointwise;
    result.width = width;
    result.height = height;
    result.channels = 3;
  }
  return result;
}

// Share StrictMode/remount work by immutable content identity. FLIP/SSIM fields
// are retained under the same byte/count policy as derived GPU diff fields.
interface MetricCacheEntry {
  promise: Promise<CpuSourceMetrics | null>;
  /** -1 while computing; pending entries are never evicted mid-computation. */
  bytes: number;
}

const metricsCache = new Map<string, MetricCacheEntry>();
let metricsCacheBytes = 0;

function trimMetricsCache(): void {
  const { maxEntries, maxBytes } = getGpuDiffCacheLimits();
  while (metricsCache.size > maxEntries || metricsCacheBytes > maxBytes) {
    let victim: [string, MetricCacheEntry] | undefined;
    for (const candidate of metricsCache) {
      if (candidate[1].bytes >= 0) {
        victim = candidate;
        break;
      }
    }
    if (!victim) return;
    metricsCache.delete(victim[0]);
    metricsCacheBytes -= victim[1].bytes;
  }
}

registerRuntimePolicyHook(trimMetricsCache);

export function getCpuComparisonCacheSnapshot(): { entries: number; bytes: number; pending: number } {
  let pending = 0;
  for (const entry of metricsCache.values()) if (entry.bytes < 0) pending++;
  return { entries: metricsCache.size, bytes: metricsCacheBytes, pending };
}

export function computeCpuSourceMetrics(options: ComputeCpuSourceMetricsOptions): Promise<CpuSourceMetrics | null> {
  const referenceKey = options.reference.contentKey;
  const foregroundKey = options.foreground.contentKey;
  if (!referenceKey || !foregroundKey) return computeCpuSourceMetricsUncached(options);
  const key = JSON.stringify([
    referenceKey,
    foregroundKey,
    options.align ?? "top-left",
    options.fit ?? "crop",
    options.operation ?? "source",
  ]);
  const cached = metricsCache.get(key);
  if (cached) {
    metricsCache.delete(key);
    metricsCache.set(key, cached);
    return cached.promise;
  }
  const entry: MetricCacheEntry = { promise: Promise.resolve(null), bytes: -1 };
  entry.promise = computeCpuSourceMetricsUncached(options).then((result) => {
    entry.bytes = result?.errorMap?.byteLength ?? 0;
    metricsCacheBytes += entry.bytes;
    trimMetricsCache();
    return result;
  }).catch((error) => {
    metricsCache.delete(key);
    throw error;
  });
  metricsCache.set(key, entry);
  trimMetricsCache();
  return entry.promise;
}
