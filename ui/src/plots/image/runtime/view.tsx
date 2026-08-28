import { useContext } from "react";

import { floatPixelsFrom } from "./pixel-buffer.ts";
import { ContentAspectFrame } from "../../../layout/ContentAspectFrame.tsx";
import { GridCellReporter, GridUniformAspectContext, finitePositive } from "../../../layout/grid-uniform-aspect.tsx";
import { resolveRenderMode, shapeDims } from "./contracts.ts";
import { useImageView } from "../../../state/settings/use-image-view.ts";
import { ChartFillContext, DEFAULT_CHART_HEIGHT } from "../../../host/standalone-helpers.tsx";
import type { ReactPlotViewProps } from "../../react-view.ts";
import { useImageBackend } from "./backend-select.ts";
import type { ImagePresentation, ImageSettings } from "../definition/register.ts";

/** Image surface host: framing, source compatibility, settings projection, backend selection. */
export function ImagePlotView({ presentation: p, settings, commands }: ReactPlotViewProps<ImagePresentation, ImageSettings>) {
  const fill = useContext(ChartFillContext);
  const gridUniform = useContext(GridUniformAspectContext);
  const [view, onViewChange] = useImageView(
    settings,
    commands.patch,
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
    colormap={p.colormap}
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
    zoom={view.zoom}
    pan={view.pan}
    onViewChange={onViewChange}
    syncedSettings={settings}
    setSyncedSettings={(patch) => commands.patch({ ...patch } as ImageSettings)}
    resetSettings={commands.reset}
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
