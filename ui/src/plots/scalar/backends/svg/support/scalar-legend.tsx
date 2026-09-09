// Internal satellite of ScalarPlot. Exported for ScalarPlot's use only —
// intentionally NOT re-exported from the public cairn-plot barrels.
//
// The interactive (visibility) legend — swatch+label rows with click-toggle /
// double-click-isolate — is the shared `PlotLegend` primitive. This wrapper
// adds selection-aware dimming, selected-swatch emphasis, and the LEGACY
// select-on-click mode kept for hosts that pass no `visibility`.

import PlotLegend, {
  HIDDEN_OPACITY,
  type LegendItem,
} from "../../../../../primitives/components/PlotLegend";
import type { SeriesVisibility } from "../../../../../host/hooks/use-series-visibility";

export interface LegendSeries {
  key: string;
  label: string;
  color: string;
}

export function CustomLegend({
  series,
  onSelect,
  onHover,
  selectedKeys,
  visibility,
}: {
  series: LegendSeries[];
  onSelect?: (seriesKey: string) => void;
  /**
   * Pointing at a chip emphasises that series in the chart. ScalarPlot routes
   * this to the same imperative `data-emph` updater its own mouse-move uses,
   * so legend hover — like chart hover — costs no re-render.
   */
  onHover?: (seriesKey: string | null) => void;
  selectedKeys?: Set<string>;
  /**
   * S6 interactive-legend state. When provided, a chip click TOGGLES that
   * series' visibility and a double-click ISOLATES it (Plotly parity); hidden
   * series render at ~0.35 opacity with a struck-through label. Run-selection
   * (`onSelect`) then lives on the line itself, not the legend. When omitted,
   * the legacy behavior (chip click = select run) is preserved.
   */
  visibility?: SeriesVisibility;
}) {
  const hasSel = selectedKeys != null && selectedKeys.size > 0;

  // Hover is delegated on the wrapper rather than bound per chip: the shared
  // PlotLegend primitive owns the chip markup and stays hover-agnostic (every
  // other chart's legend uses it too). Each chip carries `data-series-key`, so
  // the series is read off the DOM rather than inferred from a row position.
  //
  // The wrapper also swallows click and double-click: the legend sits INSIDE
  // the plot's root div, whose handlers select a run on click and reset the
  // view on double-click. Toggling or isolating a series must do neither.
  const wrapperProps = {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
    ...(onHover
      ? {
          onMouseOver: (e: React.MouseEvent) => {
            const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-series-key]");
            onHover(chip?.dataset.seriesKey ?? null);
          },
          onMouseLeave: () => onHover(null),
        }
      : {}),
  };

  // Interactive (visibility) mode → the shared PlotLegend primitive drives the
  // toggle/isolate interaction; the scalar-specific visuals ride the override
  // hooks. Opacity: hidden always wins (Plotly dim); otherwise fall back to the
  // selection-dim (non-selected series dim while a run is selected). The
  // selected series keeps the taller (3px) squared-off swatch.
  if (visibility) {
    return (
      <div {...wrapperProps}>
        <PlotLegend
          items={series as LegendItem[]}
          visibility={visibility}
          chipOpacity={(item, hidden) =>
            hidden
              ? HIDDEN_OPACITY
              : hasSel && !selectedKeys!.has(item.key)
                ? HIDDEN_OPACITY
                : 1
          }
          swatchHeight={(item) => (selectedKeys?.has(item.key) ? 3 : 2)}
          swatchRadius={0}
        />
      </div>
    );
  }

  // Legacy select-on-click mode (no visibility API): a chip click selects the
  // run; no toggle/isolate.
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1" {...wrapperProps}>
      {series.map((s) => {
        const isSelected = selectedKeys?.has(s.key) ?? false;
        const opacity = hasSel && !isSelected ? HIDDEN_OPACITY : 1;
        return (
          <li
            key={s.key}
            data-series-key={s.key}
            className="inline-flex items-center gap-1 text-[11px] text-fg-muted"
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-fg"
              style={{ opacity }}
              onClick={onSelect ? () => onSelect(s.key) : undefined}
              aria-pressed={isSelected}
              title="Click to select this run"
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 10,
                  height: isSelected ? 3 : 2,
                  background: s.color,
                  marginRight: 2,
                }}
              />
              <span>{s.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
