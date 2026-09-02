/** Process-wide resource-retention knobs for long-lived host applications. */
let liveGpuPaneLimit = 12;
let retainedSourceTextureLimit = 6;
let gpuActiveSourceMaxBytes = 1024 * 1024 * 1024;
let gpuSharedSourceMaxBytes = 1280 * 1024 * 1024;
let gpuZeroRefSourceMaxBytes = 128 * 1024 * 1024;
let expandedUploadCacheMaxBytes = 512 * 1024 * 1024;
let offscreenCpuReleaseMs = 30_000;
let gpuDiffCacheMaxEntries = 128;
let gpuDiffCacheMaxBytes = 512 * 1024 * 1024;

function positiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`cairn-plot: ${label} must be a positive safe integer`);
  }
}

function nonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`cairn-plot: ${label} must be a non-negative safe integer`);
  }
}

export function getLiveGpuPaneLimit(): number {
  return liveGpuPaneLimit;
}

/** Configure how many WebGPU panes may retain live surfaces. This count remains
 * a secondary guard; source byte admission is the primary memory policy. */
export function setLiveGpuPaneLimit(limit: number): void {
  positiveInteger(limit, "live GPU pane limit");
  liveGpuPaneLimit = limit;
}

export function getGpuSourceTextureRetentionLimit(): number {
  return retainedSourceTextureLimit;
}

/** Per-pane keyed-membership count guard, secondary to page-wide byte limits. */
export function setGpuSourceTextureRetentionLimit(limit: number): void {
  positiveInteger(limit, "GPU source texture retention limit");
  retainedSourceTextureLimit = limit;
}

export interface GpuSourceTextureLimits {
  activeBytes: number;
  sharedBytes: number;
  zeroRefBytes: number;
}

export function getGpuSourceTextureLimits(): GpuSourceTextureLimits {
  return {
    activeBytes: gpuActiveSourceMaxBytes,
    sharedBytes: gpuSharedSourceMaxBytes,
    zeroRefBytes: gpuZeroRefSourceMaxBytes,
  };
}

/** Configure device-wide source texture budgets. Referenced textures are never
 * destroyed, so active/shared limits are soft for one oversize working set. */
export function setGpuSourceTextureLimits(limits: GpuSourceTextureLimits): void {
  positiveInteger(limits.activeBytes, "active GPU source texture byte limit");
  positiveInteger(limits.sharedBytes, "shared GPU source texture byte limit");
  nonNegativeInteger(limits.zeroRefBytes, "zero-ref GPU source texture byte limit");
  gpuActiveSourceMaxBytes = limits.activeBytes;
  gpuSharedSourceMaxBytes = limits.sharedBytes;
  gpuZeroRefSourceMaxBytes = limits.zeroRefBytes;
}

export function getExpandedUploadCacheByteLimit(): number {
  return expandedUploadCacheMaxBytes;
}

export function setExpandedUploadCacheByteLimit(bytes: number): void {
  nonNegativeInteger(bytes, "expanded CPU upload cache byte limit");
  expandedUploadCacheMaxBytes = bytes;
}

export function getOffscreenCpuReleaseMs(): number {
  return offscreenCpuReleaseMs;
}

export function setOffscreenCpuReleaseMs(timeoutMs: number): void {
  nonNegativeInteger(timeoutMs, "offscreen CPU release timeout");
  offscreenCpuReleaseMs = timeoutMs;
}

export function getGpuDiffCacheLimits(): { maxEntries: number; maxBytes: number } {
  return { maxEntries: gpuDiffCacheMaxEntries, maxBytes: gpuDiffCacheMaxBytes };
}

export function setGpuDiffCacheLimits(maxEntries: number, maxBytes: number): void {
  positiveInteger(maxEntries, "GPU diff cache entry limit");
  positiveInteger(maxBytes, "GPU diff cache byte limit");
  gpuDiffCacheMaxEntries = maxEntries;
  gpuDiffCacheMaxBytes = maxBytes;
}
