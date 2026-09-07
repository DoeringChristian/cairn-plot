import { recordContextLossEvent } from "../../../engines/context-loss-diagnostics.ts";
import { useContext, useState } from "react";

import { ContentAspectFrame } from "../../../layout/ContentAspectFrame.tsx";
import { GridCellReporter, GridUniformAspectContext, finitePositive } from "../../../layout/grid-uniform-aspect.tsx";
import { shapeDims } from "./contracts.ts";
import { useImageView } from "../../../state/settings/use-image-view.ts";
import { ChartFillContext, DEFAULT_CHART_HEIGHT } from "../../../host/standalone-helpers.tsx";
import { InStackedGridContext } from "../../../layout/stack/stack-context.ts";
import { InFullscreenOverlayContext } from "../../../primitives/components/FullscreenOverlayShell.tsx";
import type { ReactPlotViewProps } from "../../react-view.ts";
import type { ImagePresentation, ImageSettings } from "../runtime/register.ts";
import type { ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "./contracts.ts";
import type { ImageComparisonInput } from "./contracts.ts";
import { channelToolbarButton, type ChannelSelection } from "../components/channel-menu.ts";
import { ImageHostRuntimeContext } from "./host-context.ts";
import { comparisonOperationSettingsPatch } from "./operation-display-defaults.ts";
import { comparisonMenuOptions } from "./comparison-menu.ts";
import { migrateCompareSettings } from "../definition/settings.ts";
import { resolveComparisonSelection } from "./comparison-selection.ts";

/** Thin image adapter: framing and projection into the host-selected backend. */
export interface ImagePlotViewProps extends ReactPlotViewProps<ImagePresentation, ImageSettings> {
  /** Selected by the generic plot host, never by image settings or content. */
  readonly backend: ImageBackend<ImageBackendView>;
  /** Technology failure fallback; operation choices never trigger this path. */
  readonly failureFallback?: ImageBackend<ImageBackendView>;
}

export function ImagePlotView({
  presentation: p,
  settings: rawSettings,
  commands,
  backend,
  failureFallback,
}: ImagePlotViewProps) {
  // Sessions and descriptors older than the `flip`/`flip-hdr` split still carry
  // `compare.flipMode`; every read of cell settings goes through the migration,
  // which returns the same object when there is nothing to rewrite.
  const settings = migrateCompareSettings(rawSettings);
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
  const activeBackend = webGpuFailed && failureFallback ? failureFallback : backend;
  const Pane = activeBackend.View;
  const source = p.source;
  // The ONE menu, and the ONE resolution of the selection over it. Both the
  // rendered ids and the write callbacks below read `sel` — nothing here
  // recomputes a projection or a default of its own.
  const comparisonOptions = p.comparison ? comparisonMenuOptions(activeBackend.capabilities) : [];
  const sel = p.comparison
    ? resolveComparisonSelection({
        selected: settings["compare.operation"],
        presentation: p.comparison.presentation,
        cellDefaults: p.comparison.cellDefaults,
        splitSetting: settings["compare.split"],
        options: comparisonOptions,
        capabilities: activeBackend.capabilities,
      })
    : undefined;
  const comparison: ImageComparisonInput | undefined = p.comparison && sel
    ? {
        b: p.comparison.foreground,
        operationOptions: comparisonOptions,
        operationId: sel.operationId,
        mode: sel.mode,
        splitPosition: settings["compare.split"] ?? sel.defaultSplit,
        align: p.comparison.align,
        fit: p.comparison.fit,
        contentKeyA: p.comparison.contentKeyA,
        contentKeyB: p.comparison.contentKeyB,
        referenceLabel: p.comparison.referenceLabel,
        foregroundLabel: p.comparison.foregroundLabel,
        inStackedGrid: inStack,
        inOverlay,
        // The display default a patch preserves-or-replaces is the one the user
        // is LOOKING at, so both callbacks pass the EFFECTIVE operation — with
        // the raw id the encoding of an unrendered kernel would decide whether
        // the visible encoding counts as a customization.
        onComparisonOperationChange: (operationId) => commands.patch(comparisonOperationSettingsPatch({
          previousOperation: sel.effective,
          nextOperation: operationId,
          currentEncoding: settings["image.encoding"],
        })),
        onCompareModeChange: (mode) => {
          // Guard on the RENDERED mode: re-picking the mode the menu already
          // shows is not a user change, whether it got there from the store or
          // from a capability projection.
          if (mode === sel.mode) return;
          commands.patch(comparisonOperationSettingsPatch({
            previousOperation: sel.effective,
            // Leaving split restores HOME's operation — unless HOME IS split,
            // in which case the seeded menu kernel is the only real choice.
            nextOperation: mode === "split"
              ? "split"
              : sel.authoredDefault === "split" ? sel.operationId : sel.authoredDefault,
            currentEncoding: settings["image.encoding"],
          }));
        },
        onSplitPositionChange: (position) => commands.patch({ "compare.split": position }),
        compareModified: sel.compareModified,
        fallback: sel.fallback,
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
    onBackendFailure={failureFallback ? () => {
      // Diagnostics only (no-op unless a harness armed the capture): the GPU
      // backend gave up and this cell now renders on the fallback backend.
      recordContextLossEvent("webgpu-backend-fallback", { from: backend.id, to: failureFallback.id });
      setWebGpuFailed(true);
    } : undefined}
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
