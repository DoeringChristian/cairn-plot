import type { PlotSurfaceProps } from "../host/PlotSurface.tsx";
import { PlotSurface } from "../host/PlotSurface.tsx";
import { ensurePublicRenderers } from "./renderers.tsx";

ensurePublicRenderers();

export type PlotHostProps = PlotSurfaceProps;

/**
 * The supported browser host. Callers provide authored content and a data
 * source; viewport identity, settings, selection and renderers remain private.
 */
export function PlotHost(props: PlotHostProps) {
  return <PlotSurface {...props} />;
}
