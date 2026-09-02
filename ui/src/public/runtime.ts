import { setRuntimeCacheBudget } from "../resources/cache.ts";
import {
  setExpandedUploadCacheByteLimit,
  setGpuDiffCacheLimits,
  setGpuSourceTextureLimits,
  setGpuSourceTextureRetentionLimit,
  setLiveGpuPaneLimit,
  setOffscreenCpuReleaseMs,
} from "../resources/runtime-config.ts";
import { setExpandedUploadCacheBudget } from "../plots/image/webgpu/expanded-upload-cache.ts";

export interface RuntimeConfiguration {
  /** Decoded artifact/preparation cache budget. */
  decodedCacheBytes?: number;
  /** Device-upload-ready expanded CPU buffers (not raw decoded pixels). */
  expandedUploadCacheBytes?: number;
  /** Release reconstructible upload ownership after this long offscreen. */
  offscreenCpuReleaseMs?: number;
  gpu?: {
    /** Secondary count guard for live panes. */
    livePaneLimit?: number;
    /** Secondary per-pane count guard for keyed texture memberships. */
    sourceTexturesPerPane?: number;
    /** Soft limit for unique source textures referenced by live panes. */
    activeSourceBytes?: number;
    /** Soft total limit for the device-wide keyed source texture cache. */
    sharedSourceBytes?: number;
    /** LRU retention budget for unreferenced keyed source textures. */
    zeroRefSourceBytes?: number;
    diffEntries?: number;
    diffBytes?: number;
  };
}

/** Configure host-level resource policy through one validated public call. */
export function configureRuntime(configuration: RuntimeConfiguration): void {
  if (configuration == null || typeof configuration !== "object") {
    throw new Error("cairn-plot: runtime configuration must be an object");
  }
  if (configuration.decodedCacheBytes !== undefined) {
    setRuntimeCacheBudget(configuration.decodedCacheBytes);
  }
  if (configuration.expandedUploadCacheBytes !== undefined) {
    setExpandedUploadCacheByteLimit(configuration.expandedUploadCacheBytes);
    setExpandedUploadCacheBudget(configuration.expandedUploadCacheBytes);
  }
  if (configuration.offscreenCpuReleaseMs !== undefined) {
    setOffscreenCpuReleaseMs(configuration.offscreenCpuReleaseMs);
  }
  const gpu = configuration.gpu;
  if (!gpu) return;
  if (gpu.livePaneLimit !== undefined) setLiveGpuPaneLimit(gpu.livePaneLimit);
  if (gpu.sourceTexturesPerPane !== undefined) {
    setGpuSourceTextureRetentionLimit(gpu.sourceTexturesPerPane);
  }
  const sourceLimitsSpecified =
    gpu.activeSourceBytes !== undefined ||
    gpu.sharedSourceBytes !== undefined ||
    gpu.zeroRefSourceBytes !== undefined;
  if (sourceLimitsSpecified) {
    if (
      gpu.activeSourceBytes === undefined ||
      gpu.sharedSourceBytes === undefined ||
      gpu.zeroRefSourceBytes === undefined
    ) {
      throw new Error(
        "cairn-plot: activeSourceBytes, sharedSourceBytes, and zeroRefSourceBytes must be configured together",
      );
    }
    setGpuSourceTextureLimits({
      activeBytes: gpu.activeSourceBytes,
      sharedBytes: gpu.sharedSourceBytes,
      zeroRefBytes: gpu.zeroRefSourceBytes,
    });
  }
  if (gpu.diffEntries !== undefined || gpu.diffBytes !== undefined) {
    if (gpu.diffEntries === undefined || gpu.diffBytes === undefined) {
      throw new Error("cairn-plot: diffEntries and diffBytes must be configured together");
    }
    setGpuDiffCacheLimits(gpu.diffEntries, gpu.diffBytes);
  }
}
