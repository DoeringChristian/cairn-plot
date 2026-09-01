export interface WebGpuComparisonStats {
  diffHits: Record<string, number>;
  diffMisses: Record<string, number>;
  diffEvictions: number;
  sourceRebinds: number;
  sourceUploads: number;
  cachedPresents: Record<string, number>;
}

const stats: WebGpuComparisonStats = {
  diffHits: {},
  diffMisses: {},
  diffEvictions: 0,
  sourceRebinds: 0,
  sourceUploads: 0,
  cachedPresents: {},
};

function bump(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export const recordDiffHit = (operation: string): void => bump(stats.diffHits, operation);
export const recordDiffMiss = (operation: string): void => bump(stats.diffMisses, operation);
export const recordDiffEviction = (): void => { stats.diffEvictions++; };
export const recordSourceRebind = (): void => { stats.sourceRebinds++; };
export const recordSourceUpload = (): void => { stats.sourceUploads++; };
export const recordCachedPresent = (operation: string): void => bump(stats.cachedPresents, operation);

export function getWebGpuComparisonStats(): WebGpuComparisonStats {
  return structuredClone(stats);
}

export function resetWebGpuComparisonStats(): void {
  stats.diffHits = {};
  stats.diffMisses = {};
  stats.diffEvictions = 0;
  stats.sourceRebinds = 0;
  stats.sourceUploads = 0;
  stats.cachedPresents = {};
}
