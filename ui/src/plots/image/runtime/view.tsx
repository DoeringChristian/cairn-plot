import { useContext, useState } from "react";

import { ContentAspectFrame } from "../../../layout/ContentAspectFrame.tsx";
import { GridCellReporter, GridUniformAspectContext, finitePositive } from "../../../layout/grid-uniform-aspect.tsx";
import { resolveRenderMode, shapeDims } from "./contracts.ts";
import { useImageView } from "../../../state/settings/use-image-view.ts";
import { ChartFillContext, DEFAULT_CHART_HEIGHT } from "../../../host/standalone-helpers.tsx";
import { InStackedGridContext } from "../../../layout/stack/stack-context.ts";
import { InFullscreenOverlayContext } from "../../../primitives/components/FullscreenOverlayShell.tsx";
import type { ReactPlotViewProps } from "../../react-view.ts";
import { useImageBackend } from "./backend-select.ts";
import type { ImagePresentation, ImageSettings } from "../runtime/register.ts";
import type { Colormap } from "../../types.ts";
import type { ImageComparisonInput } from "./contracts.ts";
import { channelToolbarButton, type ChannelSelection } from "../components/channel-menu.ts";
import { ImageHostRuntimeContext } from "./host-context.ts";

/** Image surface host: framing, source compatibility, settings projection, backend selection. */
export function ImagePlotView({ presentation: p, settings, commands }: ReactPlotViewProps<ImagePresentation, ImageSettings>) {
  const fill = useContext(ChartFillContext);
  const gridUniform = useContext(GridUniformAspectContext);
  const inStack = useContext(InStackedGridContext);
  const inOverlay = useContext(InFullscreenOverlayContext);
  const hostRuntime = useContext(ImageHostRuntimeContext);
  const [view, onViewChange] = useImageView(
    settings,
    commands.patch,
    { zoom: 1, pan: { x: 0, y: 0 } },
  );
  const [webGpuFailed, setWebGpuFailed] = useState(false);
  const backend = useImageBackend(webGpuFailed ? "cpu" : resolveRenderMode());
  const Pane = backend.View;
  const source = p.source;
  const selectedComparisonOperation = p.comparison
    ? settings["compare.operation"] ??
      (p.comparison.presentation === "split" ? "split" : p.comparison.defaultOperation)
    : undefined;
  const comparison: ImageComparisonInput | undefined = p.comparison
    ? {
        b: p.comparison.foreground,
        operationId: selectedComparisonOperation === "split"
          ? p.comparison.defaultOperation
          : selectedComparisonOperation!,
        mode: selectedComparisonOperation === "split" ? "split" : "diff",
        splitPosition: settings["compare.split"] ?? p.comparison.defaultSplit,
        colormap: settings["image.encoding"] as Colormap | undefined,
        align: p.comparison.align,
        fit: p.comparison.fit,
        contentKeyA: p.comparison.contentKeyA,
        contentKeyB: p.comparison.contentKeyB,
        referenceLabel: p.comparison.referenceLabel,
        foregroundLabel: p.comparison.foregroundLabel,
        inStackedGrid: inStack,
        inOverlay,
        onComparisonOperationChange: (operationId) => commands.patch({ "compare.operation": operationId }),
        onCompareModeChange: (mode) => commands.patch({
          "compare.operation": mode === "split" ? "split" : p.comparison!.defaultOperation,
        }),
        onSplitPositionChange: (position) => commands.patch({ "compare.split": position }),
        compareModified:
          selectedComparisonOperation !==
            (p.comparison.presentation === "split" ? "split" : p.comparison.defaultOperation) ||
          (settings["compare.split"] ?? p.comparison.defaultSplit) !== p.comparison.defaultSplit,
      }
    : undefined;
  const channelSelection = settings["image.channelSelect"] as ChannelSelection | null | undefined;
  const channelMenu = p.channelTree
    ? channelToolbarButton(
        p.channelTree,
        channelSelection ?? p.authoredChannelSelection ?? {},
        (selection) => commands.patch({ "image.channelSelect": selection ?? null } as ImageSettings),
      )
    : undefined;
  const pane = <Pane
    source={source}
    compareSource={comparison}
    toolbar={p.toolbar}
    baselineUrl={p.baselineUrl ?? null}
    diffMode={p.diffMode ?? "none"}
    interpolation={p.interpolation ?? "auto"}
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
    channelMenu={channelMenu ?? undefined}
    channelModified={channelSelection != null}
    onChannelReset={() => commands.patch({ "image.channelSelect": null })}
    enlargeControl={hostRuntime.enlargeControl}
    inStackedGrid={inStack}
    onBackendFailure={backend.id === "webgpu" ? () => setWebGpuFailed(true) : undefined}
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
