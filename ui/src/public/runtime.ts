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
import { applyRuntimePolicyHooks } from "../resources/runtime-policy-hooks.ts";

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

function finiteNonNegative(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`cairn-plot: ${label} must be a finite non-negative number`);
  }
}

function safeInteger(value: unknown, label: string, positive: boolean): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error(
      `cairn-plot: ${label} must be a ${positive ? "positive" : "non-negative"} safe integer`,
    );
  }
}

/** Validate the complete call before any process-wide setting/cache is mutated. */
function validateConfiguration(configuration: RuntimeConfiguration): void {
  if (configuration == null || typeof configuration !== "object" || Array.isArray(configuration)) {
    throw new Error("cairn-plot: runtime configuration must be an object");
  }
  if (configuration.decodedCacheBytes !== undefined) {
    finiteNonNegative(configuration.decodedCacheBytes, "cache budget");
  }
  if (configuration.expandedUploadCacheBytes !== undefined) {
    safeInteger(configuration.expandedUploadCacheBytes, "expanded CPU upload cache byte limit", false);
  }
  if (configuration.offscreenCpuReleaseMs !== undefined) {
    safeInteger(configuration.offscreenCpuReleaseMs, "offscreen CPU release timeout", false);
  }
  const gpu = configuration.gpu;
  if (gpu === undefined) return;
  if (gpu == null || typeof gpu !== "object" || Array.isArray(gpu)) {
    throw new Error("cairn-plot: runtime gpu configuration must be an object");
  }
  if (gpu.livePaneLimit !== undefined) safeInteger(gpu.livePaneLimit, "live GPU pane limit", true);
  if (gpu.sourceTexturesPerPane !== undefined) {
    safeInteger(gpu.sourceTexturesPerPane, "GPU source texture retention limit", true);
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
    safeInteger(gpu.activeSourceBytes, "active GPU source texture byte limit", true);
    safeInteger(gpu.sharedSourceBytes, "shared GPU source texture byte limit", true);
    safeInteger(gpu.zeroRefSourceBytes, "zero-ref GPU source texture byte limit", false);
  }
  if (gpu.diffEntries !== undefined || gpu.diffBytes !== undefined) {
    if (gpu.diffEntries === undefined || gpu.diffBytes === undefined) {
      throw new Error("cairn-plot: diffEntries and diffBytes must be configured together");
    }
    safeInteger(gpu.diffEntries, "GPU diff cache entry limit", true);
    safeInteger(gpu.diffBytes, "GPU diff cache byte limit", true);
  }
}

/** Configure host-level resource policy through one atomic validated public call. */
export function configureRuntime(configuration: RuntimeConfiguration): void {
  validateConfiguration(configuration);
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
  if (gpu) {
    if (gpu.livePaneLimit !== undefined) setLiveGpuPaneLimit(gpu.livePaneLimit);
    if (gpu.sourceTexturesPerPane !== undefined) {
      setGpuSourceTextureRetentionLimit(gpu.sourceTexturesPerPane);
    }
    if (
      gpu.activeSourceBytes !== undefined &&
      gpu.sharedSourceBytes !== undefined &&
      gpu.zeroRefSourceBytes !== undefined
    ) {
      setGpuSourceTextureLimits({
        activeBytes: gpu.activeSourceBytes,
        sharedBytes: gpu.sharedSourceBytes,
        zeroRefBytes: gpu.zeroRefSourceBytes,
      });
    }
    if (gpu.diffEntries !== undefined && gpu.diffBytes !== undefined) {
      setGpuDiffCacheLimits(gpu.diffEntries, gpu.diffBytes);
    }
  }
  applyRuntimePolicyHooks();
}
