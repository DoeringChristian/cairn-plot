import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
// @ts-expect-error - plotly.js-dist-min has no bundled types, but is runtime-compatible with the factory.
import Plotly from "plotly.js-dist-min";
import type { PlotlyFigureLike } from "../../../types";
import { applyViewOverrides, extractViewState, type SharedView } from "./view-overrides";
import {
  FALLBACK_PALETTE,
  readPlotPalette,
  themedLayout,
  type PlotPalette,
} from "./plot-theme";

const Plot = createPlotlyComponent(Plotly);

// Bug B: react-plotly.js's <Plot> already wraps its internal Plotly.react
// call in a promise chain (see react-plotly.js/factory.js `updatePlotly`)
// and forwards any rejection to `onError` — but WITHOUT an `onError` prop it
// silently swallows the error instead of surfacing it. A degenerate axis
// (single point / all-equal values / log axis with non-positive data) or a
// relayout on a zero-size container can make Plotly's internal scale
// computation throw ("Something went wrong with axis scaling"); wiring
// `onError` on every <Plot> here turns that from a silent no-op (or, for a
// manual `Plotly.relayout` reset-view call, a genuinely uncaught promise
// rejection) into a handled, logged warning so a bad step never crashes the
// card.
function onPlotlyError(err: unknown) {
  console.warn("Figure: plotly render error (recovered)", err);
}

export type HoverMode = "closest" | "x unified" | "y unified" | "none";
export type DragMode = "zoom" | "pan" | "select" | "lasso" | "none";

export interface FigureInteractionSettings {
  displayModeBar: boolean;
  scrollZoom: boolean;
  hoverMode: HoverMode;
  dragMode: DragMode;
  showLegend: boolean;
}

// Shared view state (axis ranges / scene camera) synced across comparison
// panes lives in the pure `view-overrides` module so it can be unit-tested
// without loading plotly.js; re-exported here so existing importers of
// `.../Figure` keep working unchanged.
export type { SharedView } from "./view-overrides";
export { extractViewState, deepMerge, applyViewOverrides, mergeRelayout } from "./view-overrides";

/**
 * Track the host page's resolved palette, so the figure is legible on whatever
 * background it is dropped onto.
 *
 * The figure's backgrounds are transparent (see `plot-theme.ts`), which means
 * its foreground colours have to come from the host rather than from a
 * constant — the bug this replaced was a hardcoded light-theme `font.color` on
 * a figure that had already adopted a dark page's background.
 *
 * Re-reads whenever the theme could have changed: the OS/browser scheme
 * (`prefers-color-scheme`, which `cp.Report`'s default `theme="auto"` follows),
 * and `class`/`data-theme`/`style` mutations on `<html>`/`<body>` (how the cairn
 * app and a pinned report theme switch). A resize/route change cannot alter
 * colours, so nothing else needs to listen.
 */
function useHostPalette(ref: React.RefObject<HTMLElement | null>): PlotPalette {
  const [palette, setPalette] = useState<PlotPalette>(FALLBACK_PALETTE);
  useEffect(() => {
    const read = () => {
      const next = readPlotPalette(ref.current);
      // Compare by value: a MutationObserver fires for plenty of changes that
      // do not touch colour, and a fresh object every time would re-render the
      // plot (and reset its view) for nothing.
      setPalette((prev) =>
        prev.fg === next.fg &&
        prev.muted === next.muted &&
        prev.border === next.border &&
        prev.elevated === next.elevated
          ? prev
          : next,
      );
    };
    read();

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", read);

    const observer = new MutationObserver(read);
    for (const node of [document.documentElement, document.body]) {
      if (node) {
        observer.observe(node, {
          attributes: true,
          attributeFilter: ["class", "data-theme", "style"],
        });
      }
    }
    return () => {
      mq?.removeEventListener?.("change", read);
      observer.disconnect();
    };
  }, [ref]);
  return palette;
}

export interface FigureProps {
  figure: PlotlyFigureLike;
  settings: FigureInteractionSettings;
  viewOverrides?: SharedView;
  onRelayout?: (v: SharedView) => void;
  revision?: number;
  style?: React.CSSProperties;
  className?: string;
  /**
   * Attach a live `plotly_relayouting` DOM listener (fires continuously
   * during 3D camera drag) in addition to the end-of-interaction
   * `onRelayout` prop — used by comparison panes for real-time cross-pane
   * sync. Off by default (matches the pre-extraction behavior, where only
   * the multi-pane `FigurePane` had this listener).
   */
  enableLiveRelayout?: boolean;
}

/**
 * Pure Plotly figure renderer — data via props only. Owns all direct
 * react-plotly.js/Plotly usage (the single `<Plot>` call site consolidates
 * what were previously three duplicated call sites in
 * `FigureInteractiveCard.tsx`).
 */
export default function Figure({
  figure,
  settings,
  viewOverrides,
  onRelayout,
  revision,
  style,
  className,
  enableLiveRelayout,
}: FigureProps) {
  // Attach plotly_relayouting for real-time sync during 3D drag rotation
  // (comparison panes only — see `enableLiveRelayout` doc above). Declared here
  // rather than below because the theme read measures this same container.
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const palette = useHostPalette(plotContainerRef);

  const baseLayout = useMemo(() => {
    // `themedLayout` supplies the host's colours as DEFAULTS; anything the
    // figure's author set explicitly wins over them (fixed width/height and
    // autosize are handled in there too).
    const layout = themedLayout((figure.layout ?? {}) as Record<string, unknown>, palette);
    layout.hovermode = settings.hoverMode === "none" ? false : settings.hoverMode;
    layout.dragmode = settings.dragMode === "none" ? false : settings.dragMode;
    layout.showlegend = settings.showLegend;
    return layout;
  }, [figure.layout, palette, settings.hoverMode, settings.dragMode, settings.showLegend]);

  // Apply shared view overrides (synced zoom/pan/camera from other panes).
  const mergedLayout = useMemo(
    () => (viewOverrides && Object.keys(viewOverrides).length > 0
      ? applyViewOverrides(baseLayout, viewOverrides)
      : baseLayout),
    [baseLayout, viewOverrides],
  );

  const handleRelayout = useCallback(
    (e: Readonly<Plotly.PlotRelayoutEvent>) => {
      if (!onRelayout) return;
      const view = extractViewState(e as unknown as Record<string, unknown>);
      if (view) onRelayout(view);
    },
    [onRelayout],
  );

  useEffect(() => {
    if (!enableLiveRelayout || !onRelayout) return;
    const el = plotContainerRef.current?.querySelector(".js-plotly-plot") as Plotly.PlotlyHTMLElement | null;
    if (!el?.on) return;
    const handler = (e: Plotly.PlotRelayoutEvent) => {
      const view = extractViewState(e as unknown as Record<string, unknown>);
      if (view) onRelayout(view);
    };
    el.on("plotly_relayouting", handler);
    return () => el.removeAllListeners?.("plotly_relayouting");
  });

  const plotlyConfig = useMemo(
    () => ({
      displayModeBar: settings.displayModeBar,
      scrollZoom: settings.scrollZoom,
      responsive: true,
    }),
    [settings.displayModeBar, settings.scrollZoom],
  );

  return (
    <div ref={plotContainerRef} className={className ?? "rounded bg-bg h-full"} style={style}>
      <Plot
        data={(figure.data ?? []) as Plotly.Data[]}
        layout={mergedLayout as Partial<Plotly.Layout>}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: "100%", height: "100%" }}
        onRelayout={handleRelayout}
        revision={revision}
        onError={onPlotlyError}
      />
    </div>
  );
}
