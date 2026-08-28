export { PlotHost, type PlotHostProps } from "./PlotHost.tsx";
export { mountPlot, type MountedPlot } from "./mountPlot.tsx";
export { createEndpointDataSource } from "../lib/cairn-plot/store/data-sources.ts";
export type { DataSource } from "../lib/cairn-plot/store/data-sources.ts";
export type { PlotSession } from "../state/session/plot-session.ts";
export type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotDescriptor,
  PlotLeafNode,
  PlotNode,
  PlotSpec,
  SharedProps,
} from "../../../packages/spec/src/index.ts";
