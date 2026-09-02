import { expandedUploadCache } from "../plots/image/webgpu/expanded-upload-cache.ts";
import {
  getGpuPoolMemorySnapshot,
  resetGpuPoolMemoryStats,
} from "../plots/image/webgpu/pool.ts";
import {
  getWebGpuComparisonStats,
  resetWebGpuComparisonStats,
} from "../plots/image/webgpu/perf-stats.ts";

export interface MemoryDiagnosticSnapshot {
  panes: ReturnType<typeof getGpuPoolMemorySnapshot>["panes"];
  gpuSources: ReturnType<typeof getGpuPoolMemorySnapshot>["sourceTextures"];
  expandedCpuUploads: ReturnType<typeof expandedUploadCache.snapshot>;
  uploads: { count: number; bytes: number; rebinds: number };
  diff: ReturnType<typeof getGpuPoolMemorySnapshot>["diff"];
  counters: ReturnType<typeof getGpuPoolMemorySnapshot>["counters"] & {
    diffEvictions: number;
  };
}

/** Supported ownership-oriented memory snapshot. Gauges are always live. */
export function getMemoryDiagnosticSnapshot(): MemoryDiagnosticSnapshot {
  const pool = getGpuPoolMemorySnapshot();
  const perf = getWebGpuComparisonStats();
  return {
    panes: pool.panes,
    gpuSources: pool.sourceTextures,
    expandedCpuUploads: expandedUploadCache.snapshot(),
    uploads: {
      count: perf.sourceUploads,
      bytes: perf.sourceUploadBytes,
      rebinds: perf.sourceRebinds,
    },
    diff: pool.diff,
    counters: { ...pool.counters, diffEvictions: perf.diffEvictions },
  };
}

/** Reset cumulative event counters only. Live ownership gauges are unchanged. */
export function resetMemoryDiagnosticStats(): void {
  resetGpuPoolMemoryStats();
  resetWebGpuComparisonStats();
}
