import type { PlotSizing, PlotSurfaceProps } from "../host/PlotSurface.tsx";
import { PlotSurface } from "../host/PlotSurface.tsx";
import { ensurePublicRenderers } from "./renderers.tsx";

ensurePublicRenderers();

export type PlotHostProps = PlotSurfaceProps;
export type { PlotSizing };

/**
 * The supported browser host. Callers provide authored content and a data
 * source; cell identity, settings, selection and backends remain private.
 */
export function PlotHost(props: PlotHostProps) {
  return <PlotSurface {...props} />;
}
