// Internal satellite of ScalarPlot. Exported for ScalarPlot's use only —
// intentionally NOT re-exported from the public cairn-plot barrels.
//
// The interactive (visibility) legend — swatch+label rows with click-toggle /
// double-click-isolate — is the shared `PlotLegend` primitive. This wrapper
// adds ScalarPlot's extras: the promote/demote trailing button, the
// selection-aware dim, the selected-swatch emphasis, and the LEGACY
// select-on-click mode kept for hosts that pass no `visibility`.

import PlotLegend, {
  HIDDEN_OPACITY,
  type LegendItem,
} from "../../primitives/PlotLegend";
import type { PromotedSeriesConfig } from "../../types";
import type { SeriesVisibility } from "../../hooks/use-series-visibility";

export interface LegendSeries {
  key: string;
  label: string;
  color: string;
}

export function CustomLegend({
  series,
  promoted,
  onToggle,
  onSelect,
  selectedKeys,
  visibility,
}: {
  series: LegendSeries[];
  promoted: Record<string, PromotedSeriesConfig>;
  onToggle: (key: string) => void;
  onSelect?: (seriesKey: string) => void;
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

  // The promote/demote button trails every chip in both modes.
  const promoteButton = (key: string) => {
    const isPromoted = !!promoted[key];
    return (
      <button
        type="button"
        onClick={() => onToggle(key)}
        className={`ml-1 inline-flex h-4 w-4 items-center justify-center rounded text-xs hover:bg-bg-hover ${
          isPromoted ? "text-accent" : "text-fg-muted"
        }`}
        title={isPromoted ? "Demote (single Y axis)" : "Promote to own Y axis"}
      >
        <i className="fa-solid fa-arrows-up-down" aria-hidden="true" />
      </button>
    );
  };

  // Interactive (visibility) mode → the shared PlotLegend primitive drives the
  // toggle/isolate interaction; the scalar-specific visuals ride the override
  // hooks. Opacity: hidden always wins (Plotly dim); otherwise fall back to the
  // selection-dim (non-selected series dim while a run is selected). The
  // selected series keeps the taller (3px) squared-off swatch.
  if (visibility) {
    return (
      <PlotLegend
        items={series as LegendItem[]}
        visibility={visibility}
        chipTrailing={(item) => promoteButton(item.key)}
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
    );
  }

  // Legacy select-on-click mode (no visibility API): a chip click selects the
  // run; no toggle/isolate.
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
      {series.map((s) => {
        const isSelected = selectedKeys?.has(s.key) ?? false;
        const opacity = hasSel && !isSelected ? HIDDEN_OPACITY : 1;
        return (
          <li
            key={s.key}
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
            {promoteButton(s.key)}
          </li>
        );
      })}
    </ul>
  );
}
