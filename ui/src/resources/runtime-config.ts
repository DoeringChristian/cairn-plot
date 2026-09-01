/** Process-wide resource-retention knobs for long-lived host applications. */
let liveGpuPaneLimit = 12;
let retainedSourceTextureLimit = 6;
let gpuDiffCacheMaxEntries = 128;
let gpuDiffCacheMaxBytes = 512 * 1024 * 1024;

export function getLiveGpuPaneLimit(): number {
  return liveGpuPaneLimit;
}

/** Configure how many simultaneously visible WebGPU panes may retain their
 * surfaces and uploaded sources before the global pool starts parking panes. */
export function setLiveGpuPaneLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("cairn-plot: live GPU pane limit must be a positive integer");
  }
  liveGpuPaneLimit = limit;
}

/** Number of uploaded source textures retained per live WebGPU pane. */
export function getGpuSourceTextureRetentionLimit(): number {
  return retainedSourceTextureLimit;
}

/** Configure instant GPU flip-back depth. Hosts with long iteration sequences
 * may raise this above the conservative embed default of six. */
export function setGpuSourceTextureRetentionLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("cairn-plot: GPU source texture retention limit must be a positive integer");
  }
  retainedSourceTextureLimit = limit;
}

export function getGpuDiffCacheLimits(): { maxEntries: number; maxBytes: number } {
  return { maxEntries: gpuDiffCacheMaxEntries, maxBytes: gpuDiffCacheMaxBytes };
}

/** Configure the page-wide content-keyed GPU metric-result cache before the
 * first image pane mounts. */
export function setGpuDiffCacheLimits(maxEntries: number, maxBytes: number): void {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("cairn-plot: GPU diff cache entry limit must be a positive integer");
  }
  if (!Number.isFinite(maxBytes) || maxBytes < 1) {
    throw new Error("cairn-plot: GPU diff cache byte limit must be positive and finite");
  }
  gpuDiffCacheMaxEntries = maxEntries;
  gpuDiffCacheMaxBytes = maxBytes;
}
