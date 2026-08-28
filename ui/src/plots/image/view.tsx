import { useContext } from "react";

import { floatPixelsFrom } from "../../lib/cairn-plot/image/pixel-buffer.ts";
import { ContentAspectFrame } from "../../lib/cairn-plot/renderers/ContentAspectFrame.tsx";
import { GridCellReporter, GridUniformAspectContext, finitePositive } from "../../lib/cairn-plot/renderers/grid-uniform-aspect.tsx";
import { resolveRenderMode, shapeDims } from "../../lib/cairn-plot/renderers/image-backend.ts";
import { useImageView } from "../../lib/cairn-plot/settings/use-image-view.ts";
import { ChartFillContext, DEFAULT_CHART_HEIGHT } from "../../plot-standalone-helpers.tsx";
import type { PlotViewProps } from "../view-props.ts";
import { useImageBackend } from "./backend-select.ts";

/** Image surface host: framing, source compatibility, settings projection, backend selection. */
export function ImagePlotView(p: PlotViewProps) {
  const fill = useContext(ChartFillContext);
  const gridUniform = useContext(GridUniformAspectContext);
  const [viewport, onViewportChange] = useImageView(
    p.syncedSettings,
    p.setSyncedSettings,
    { zoom: p.zoom ?? 1, pan: p.pan ?? { x: 0, y: 0 } },
  );
  const Pane = useImageBackend(resolveRenderMode(p.renderMode));
  const source = p.source ?? (p.hdr
    ? {
        dtype: "float" as const,
        pixels: floatPixelsFrom(p.hdr.data, p.hdr.precision),
        shape: p.hdr.shape,
        numpyDtype: p.hdr.dtype,
        deep: p.hdr.deep,
      }
    : { dtype: "uint8" as const, url: p.imageUrl ?? null });
  const pane = <Pane
    source={source}
    compareSource={p.compareSource}
    toolbar={p.toolbar}
    baselineUrl={p.baselineUrl ?? null}
    diffMode={p.diffMode ?? "none"}
    interpolation={p.interpolation ?? "auto"}
    colormap={p.colormap ?? "none"}
    tonemap={p.tonemap}
    exposure={p.exposure}
    offset={p.offset}
    peak={p.peak}
    gamma={p.gamma}
    processing={p.processing}
    showAxes={p.showAxes ?? false}
    label={p.label ?? ""}
    overlay={p.overlay}
    overlaySettings={p.overlaySettings}
    pixelValueNotation={p.pixelValueNotation}
    zoom={viewport.zoom}
    pan={viewport.pan}
    onViewportChange={onViewportChange}
    syncedSettings={p.syncedSettings}
    setSyncedSettings={p.setSyncedSettings}
    resetViewportSettings={p.resetViewportSettings}
    channelMenu={p.channelMenu}
    channelModified={p.channelModified}
    onChannelReset={p.onChannelReset}
    enlargeControl={p.enlargeControl}
    inStackedGrid={p.inStackedGrid}
  />;
  const dims = source.dtype === "float" && source.shape.length >= 2 ? shapeDims(source.shape) : null;
  const knownAspect = dims ? finitePositive(dims.w / dims.h) : null;
  if (gridUniform) return <GridCellReporter seedAspect={knownAspect}>{pane}</GridCellReporter>;
  const outerHeight: number | string = fill || source.dtype !== "float"
    ? "100%"
    : (p.height ?? DEFAULT_CHART_HEIGHT);
  return <ContentAspectFrame outerHeight={outerHeight} contentAspect={knownAspect}>
    {pane}
  </ContentAspectFrame>;
}
