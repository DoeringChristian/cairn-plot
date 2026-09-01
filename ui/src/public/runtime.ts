import { setRuntimeCacheBudget } from "../resources/cache.ts";
import {
  setGpuDiffCacheLimits,
  setGpuSourceTextureRetentionLimit,
  setLiveGpuPaneLimit,
} from "../resources/runtime-config.ts";

export interface RuntimeConfiguration {
  decodedCacheBytes?: number;
  gpu?: {
    livePaneLimit?: number;
    sourceTexturesPerPane?: number;
    diffEntries?: number;
    diffBytes?: number;
  };
}

/** Configure host-level resource policy through one validated public call. */
export function configureRuntime(configuration: RuntimeConfiguration): void {
  if (configuration.decodedCacheBytes !== undefined) {
    setRuntimeCacheBudget(configuration.decodedCacheBytes);
  }
  const gpu = configuration.gpu;
  if (!gpu) return;
  if (gpu.livePaneLimit !== undefined) setLiveGpuPaneLimit(gpu.livePaneLimit);
  if (gpu.sourceTexturesPerPane !== undefined) {
    setGpuSourceTextureRetentionLimit(gpu.sourceTexturesPerPane);
  }
  if (gpu.diffEntries !== undefined || gpu.diffBytes !== undefined) {
    if (gpu.diffEntries === undefined || gpu.diffBytes === undefined) {
      throw new Error("cairn-plot: diffEntries and diffBytes must be configured together");
    }
    setGpuDiffCacheLimits(gpu.diffEntries, gpu.diffBytes);
  }
}
