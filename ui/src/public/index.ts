export { PlotHost, type PlotHostProps } from "./PlotHost.tsx";
export { mountPlot, type MountedPlot } from "./mountPlot.tsx";
export { createEndpointDataSource } from "../resources/data/data-source.ts";
export type { DataSource } from "../resources/data/data-source.ts";
export { setRuntimeCacheBudget } from "../resources/cache.ts";
export {
  setGpuDiffCacheLimits,
  setGpuSourceTextureRetentionLimit,
  setLiveGpuPaneLimit,
} from "../resources/runtime-config.ts";
export type { PlotSession } from "../state/session/plot-session.ts";
export type { SessionPersistence } from "../state/session/session-persistence.ts";
export type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotSpec,
  PlotLeafNode,
  PlotNode,
  SharedProps,
} from "../../../packages/spec/src/index.ts";
