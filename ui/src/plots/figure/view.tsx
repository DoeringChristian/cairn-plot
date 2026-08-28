/**
 * The Plotly `figure` standalone adapter — the ONE renderer the `figure` addon
 * (`plot-figure-addon.tsx` → `figure.iife.js`) carries. It STATICALLY imports
 * the pure `Figure` renderer (and thus `plotly.js-dist-min`, ~4.8M), so this
 * module is the sole Plotly entry point and Plotly lives only in the addon
 * bundle — never in core.
 *
 * Two consumers:
 *   - the **inline figure addon** (`plot-figure-addon.tsx`) imports
 *     `FigureStandalone` directly → Plotly bundled into `figure.iife.js`;
 *   - the **code-split server build** (`plot-main.tsx`) `React.lazy`-imports
 *     this module → Plotly stays in its own async `/assets` chunk.
 *
 * `ChartBox` comes from `plot-standalone-helpers` (dependency-light) rather
 * than `plot-renderers`, so importing this module does NOT drag the 2D
 * renderers into the addon bundle.
 */
import Figure from "./backends/plotly/Figure";
import type { FigureInteractionSettings } from "./backends/plotly/Figure";
import type { PlotlyFigureLike } from "../types.ts";
import { ChartBox } from "../../host/standalone-helpers";
import type { SettingsRecord } from "../contracts.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

export interface FigurePresentation extends Record<string, unknown> {
  readonly figure?: PlotlyFigureLike;
  readonly settings?: Partial<FigureInteractionSettings>;
  readonly height?: number;
}

const DEFAULT_FIGURE_SETTINGS = {
  displayModeBar: true,
  scrollZoom: false,
  hoverMode: "closest" as const,
  dragMode: "zoom" as const,
  showLegend: true,
};

export function FigureStandalone(p: FigurePresentation) {
  const { height, figure, settings, ...rest } = p;
  return (
    <ChartBox height={height}>
      <Figure
        figure={figure ?? { data: [], layout: {} }}
        settings={{ ...DEFAULT_FIGURE_SETTINGS, ...(settings ?? {}) }}
        style={{ width: "100%", height: "100%" }}
        {...rest}
      />
    </ChartBox>
  );
}

/** Typed plot view; Plotly remains an implementation detail of this addon. */
export function FigurePlotView({ presentation }: ReactPlotViewProps<FigurePresentation, SettingsRecord>) {
  return <FigureStandalone {...presentation} />;
}

export default FigureStandalone;
