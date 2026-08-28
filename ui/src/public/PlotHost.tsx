import type { PlotSurfaceProps } from "../host/PlotSurface.tsx";
import { PlotSurface } from "../host/PlotSurface.tsx";
import { ensurePublicRenderers } from "./renderers.tsx";

ensurePublicRenderers();

export type PlotHostProps = PlotSurfaceProps;

/**
 * The supported browser host. Callers provide authored content and a data
 * source; cell identity, settings, selection and backends remain private.
 */
export function PlotHost(props: PlotHostProps) {
  return <PlotSurface {...props} />;
}
