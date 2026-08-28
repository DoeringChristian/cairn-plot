import type { PlotSurfaceProps } from "../plot-surface.tsx";
import { PlotSurface } from "../plot-surface.tsx";
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
