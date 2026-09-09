import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  CartesianGrid,
  Customized,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AxisScale, Series, ChartViewState } from "../../../types";
import type { AxisSource } from "../../../transforms/x-axis";
import { resolveAxisDomain } from "../../../transforms/domain";
import { PreparedSeriesCache, type PreparedSeries } from "../../prepared-series";
import { buildRenderRows } from "../../render-rows";
import { formatXTick } from "../../../../primitives/format";
import { AXIS, GRID, paddedDomain } from "../../../../public/theme";
import { useModifierKey } from "../../../../host/hooks/use-modifier-key";
import { useSeriesVisibility } from "../../../../host/hooks/use-series-visibility";
import PlotToolbar from "../../../../primitives/components/PlotToolbar";
import { CustomLegend } from "./support/scalar-legend";
import { CustomTooltip } from "./support/scalar-tooltip";
import { usePlotGestures, type PlotOffset } from "./support/use-plot-gestures";
import { useScalarController } from "./support/use-scalar-controller";

const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 4 } as const;

/** Prepared series for one render, plus the bookkeeping that hangs off them. */
interface Prepared {
  /** One per input series, in `series` order (index-aligned with it). */
  main: PreparedSeries[];
  /** `main` plus the legacy `${key}__raw` overlays — what actually gets drawn. */
  all: PreparedSeries[];
  /** Keys whose faint overlay comes from the LEGACY pre-smoothed contract. */
  legacyRaw: Set<string>;
  /** Every key in `all`, for pruning the cache when a series leaves the data. */
  liveKeys: Set<string>;
}

export interface ScalarPlotProps {
  series: Series[];
  xAxis: AxisSource;
  xScale: AxisScale;
  yScale: AxisScale;
  xRange: [number | null, number | null];
  yRange: [number | null, number | null];
  view: ChartViewState;
  onViewChange: (v: ChartViewState) => void;
  /**
   * EMA weight on the previous point (0 = off). Pass RAW series: the plot
   * smooths them itself and draws the unsmoothed values as the faint overlay.
   * Omit it entirely to keep the legacy contract — pre-smoothed `points` with
   * the raw values in `rawPoints`.
   */
  smoothing?: number;
  /** Percentile band of y kept when drawing; defaults to `[0, 100]` (all). */
  outlierPct?: [number, number];
  lineType?: "linear" | "monotone" | "step" | "stepBefore" | "stepAfter";
  showLegend?: boolean;
  tooltip?: { showContext?: boolean; showWallTime?: boolean };
  selectedSeriesKeys?: Set<string>;
  onSeriesClick?: (seriesKey: string) => void;
  className?: string;
}

export default function ScalarPlot({
  series,
  xAxis,
  xScale,
  yScale,
  xRange,
  yRange,
  view,
  onViewChange,
  smoothing,
  outlierPct,
  lineType = "linear",
  showLegend = true,
  tooltip,
  selectedSeriesKeys,
  onSeriesClick,
  className,
}: ScalarPlotProps) {
  // S6 interactive legend: per-series show/hide. Hidden series are dropped from
  // the render AND from y-autoscale so the axis reframes to what's visible.
  //
  // The key LIST is held ref-stable: `useSeriesVisibility` prunes stale keys in
  // an effect keyed on it, and a live poller hands us a fresh `series` array on
  // every tick, so a fresh array here would fire that effect — and cost a
  // second full render of a chart that has not changed shape — on every append.
  const seriesKeysRef = useRef<string[]>([]);
  const seriesKeys = useMemo(() => {
    const next = series.map((s) => s.key);
    const prev = seriesKeysRef.current;
    if (prev.length === next.length && prev.every((k, i) => k === next[i])) return prev;
    seriesKeysRef.current = next;
    return next;
  }, [series]);
  const visibility = useSeriesVisibility(seriesKeys);

  // ── Prepared series ──
  // One typed-array copy per series, extended in place on append. Identity is
  // the memo key downstream: preparing unchanged points returns the very same
  // object, so the row build below is skipped on a re-render that changed
  // nothing. The tuple prop is spread into scalar deps so a fresh
  // `[0, 100]` literal from the host does not bust the memo every render, and
  // the result itself is held ref-stable (below) so a host that hands us a
  // fresh `series` ARRAY of the same series does not either.
  const cacheRef = useRef(new PreparedSeriesCache());
  const preparedRef = useRef<Prepared | null>(null);
  const logX = xScale === "log";
  const outLo = outlierPct?.[0] ?? 0;
  const outHi = outlierPct?.[1] ?? 100;
  const prepared = useMemo(() => {
    const cache = cacheRef.current;
    const opts = {
      smoothing: smoothing ?? 0,
      outlierPct: [outLo, outHi] as [number, number],
      logX,
    };
    const main: PreparedSeries[] = [];
    const all: PreparedSeries[] = [];
    // Series whose faint overlay comes from the LEGACY pre-smoothed contract.
    const legacyRaw = new Set<string>();
    for (const s of series) {
      const p = cache.prepare(s, opts);
      main.push(p);
      all.push(p);
      if (smoothing === undefined && s.rawPoints) {
        // Legacy input: `points` is already smoothed (prepared with smoothing
        // 0, so no `rawYs`) and the overlay rides on the host's `rawPoints`,
        // prepared and pixel-reduced as a series of its own, under the
        // `${key}__raw` dataKey the faint <Line> already asks for.
        legacyRaw.add(s.key);
        all.push(cache.prepare({ ...s, key: `${s.key}__raw`, points: s.rawPoints }, opts));
      }
    }
    // `prepare` returns the SAME object while a series is unchanged, so an
    // all-identical result means nothing downstream can have changed: hand
    // back the previous wrapper and the row build memo below stays hit even
    // when the caller's `series` array identity churns.
    const prev = preparedRef.current;
    if (prev && prev.all.length === all.length && prev.all.every((p, i) => p === all[i])) {
      return prev;
    }
    const next: Prepared = { main, all, legacyRaw, liveKeys: new Set(all.map((p) => p.key)) };
    preparedRef.current = next;
    return next;
  }, [series, smoothing, outLo, outHi, logX]);

  // The cache outlives every render, so a series that leaves the data would
  // otherwise pin its typed arrays forever (run selection changes are common).
  const liveKeys = prepared.liveKeys;
  const droppedKeysRef = useRef<Set<string>>(liveKeys);
  useEffect(() => {
    const cache = cacheRef.current;
    for (const key of droppedKeysRef.current) if (!liveKeys.has(key)) cache.drop(key);
    droppedKeysRef.current = liveKeys;
  }, [liveKeys]);

  const xDomain = resolveAxisDomain(
    xRange[0], xRange[1], view.xMin, view.xMax, xScale,
  );
  const yDomain = resolveAxisDomain(
    yRange[0], yRange[1], view.yMin, view.yMax, yScale,
  );

  const dataXs = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of prepared.main) {
      if (p.n === 0) continue;
      if (p.xMin < lo) lo = p.xMin;
      if (p.xMax > hi) hi = p.xMax;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1] as const;
    if (lo === hi) return [lo - 0.5, hi + 0.5] as const;
    return [lo, hi] as const;
  }, [prepared]);

  const dataYs = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of prepared.main) {
      if (p.n === 0 || visibility.isHidden(p.key)) continue;
      // Autoscale to what is DRAWN: clipped-away outliers must not widen the
      // axis (`lo`/`hi` are ±Infinity when `outlierPct` clips nothing).
      const yLo = Math.max(p.yMin, p.lo);
      const yHi = Math.min(p.yMax, p.hi);
      if (yLo < lo) lo = yLo;
      if (yHi > hi) hi = yHi;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1] as const;
    if (lo === hi) return [lo - 0.5, hi + 0.5] as const;
    return [lo, hi] as const;
  }, [prepared, visibility]);

  const effectiveX: [number, number] = [
    typeof xDomain[0] === "number" ? xDomain[0] : dataXs[0],
    typeof xDomain[1] === "number" ? xDomain[1] : dataXs[1],
  ];
  const effectiveY: [number, number] = [
    typeof yDomain[0] === "number" ? yDomain[0] : dataYs[0],
    typeof yDomain[1] === "number" ? yDomain[1] : dataYs[1],
  ];

  // Edge padding for the HOME position only: when a domain is fully auto
  // (both ends are the "dataMin"/"dataMax"/"auto" sentinels — no explicit
  // range and no zoom/pan view), pass a ~5%-padded numeric domain so the
  // line doesn't touch the frame. An explicit range or a view (numbers)
  // passes through untouched. Log domains aren't padded (linear padding could
  // push a bound ≤ 0).
  const padAutoDomain = (
    domain: [number | string, number | string],
    data: readonly [number, number],
    scale: AxisScale,
  ): [number | string, number | string] => {
    if (typeof domain[0] === "number" || typeof domain[1] === "number") return domain;
    if (scale === "log") return domain;
    return paddedDomain(data[0], data[1]);
  };
  const xDomainPadded = padAutoDomain(xDomain, dataXs, xScale);
  const yDomainPadded = padAutoDomain(yDomain, dataYs, yScale);

  // ── Refs shared with the gesture state machine ──
  // `plotOffsetRef` is written by the <Customized> component below with the
  // Recharts plot rect (container-local coords); the gesture hook reads it.
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const plotOffsetRef = useRef<PlotOffset | null>(null);
  const effectiveRef = useRef({ x: effectiveX, y: effectiveY });
  effectiveRef.current = { x: effectiveX, y: effectiveY };

  const altDown = useModifierKey();
  const altDownRef = useRef(altDown);
  altDownRef.current = altDown;

  // ── Hover emphasis, applied to the DOM ──
  // Hover must not re-render: a re-render rebuilds every path string. Recharts
  // forwards `data-*` props to the curve `<path>` (`className` would land on
  // the wrapping `<g class="recharts-line">`), so the hovered key is written
  // onto those paths as `data-emph` and two rules in `public/theme/plot.css`
  // do the rest. React never sees the hovered key; only `hoveredSeriesRef`,
  // read by the click handler, does.
  const hoveredSeriesRef = useRef<string | null>(null);
  // Legend hover is emphasis WITHOUT a hovered plot series — kept apart so it
  // never arms the run-selection click, but still remembered, or the next
  // commit's repaint below would wipe the emphasis mid-hover.
  const legendHoverRef = useRef<string | null>(null);
  /** Repaint `data-emph` for `key`. Pure DOM; nothing about hover is state. */
  const paintEmphasis = useCallback((key: string | null) => {
    const root = chartBoxRef.current;
    if (!root) return;
    root.querySelectorAll<SVGPathElement>("path[data-series-key]").forEach((el) => {
      // The faint raw overlay dims with its series but never takes the "on"
      // emphasis — being thickened to full opacity is the opposite of faint.
      const isRaw = el.dataset.seriesRole === "raw";
      el.dataset.emph = el.dataset.seriesKey === key
        ? (isRaw ? "" : "on")
        : key ? "dim" : "";
    });
    // The cursor is React-rendered from `altDown`; only the hover half of it
    // is imperative, so an Alt-pan cursor is never stolen by a hover.
    if (!altDownRef.current) root.style.cursor = key ? "pointer" : "crosshair";
  }, []);
  /**
   * Emphasise the series the pointer is over IN THE PLOT. Only this records
   * the key for the click handler — legend hover paints but must NOT arm a
   * run-selection click, or pointing at a chip and clicking it would select
   * a run as well as toggling its visibility.
   */
  const applyEmphasis = useCallback((key: string | null) => {
    hoveredSeriesRef.current = key;
    // The pointer is demonstrably in the plot, so a legend hover is over.
    if (key !== null) legendHoverRef.current = null;
    paintEmphasis(key);
  }, [paintEmphasis]);
  // Recharts rebuilds the curve <path> elements on every render, and React
  // does not manage `data-emph` (it is never a prop), so a new path would come
  // up unemphasised mid-hover. Repaint from the ref after each commit.
  useLayoutEffect(() => {
    paintEmphasis(hoveredSeriesRef.current ?? legendHoverRef.current);
  });

  /** Legend hover: paint only, and remember it for the post-commit repaint. */
  const onLegendHover = useCallback((key: string | null) => {
    legendHoverRef.current = key;
    paintEmphasis(key);
  }, [paintEmphasis]);

  // ── Render data ──
  // How many screen columns the reduction may spend: the <Customized> plot
  // rect (the real drawing area, ~54 px narrower than the container once the
  // y-axis and margins are taken out), captured during the chart's own render.
  // ResponsiveContainer's onResize only feeds a REF — it fires before the
  // chart renders, so committing it too would cost a second render per resize
  // for a width the plot rect is about to correct anyway; it is the fallback
  // for the first frame. Changes below 8 px are ignored so a resize drag does
  // not rebuild the rows on every pixel. 800 until either has spoken.
  const [plotWidth, setPlotWidth] = useState(0);
  const containerWidthRef = useRef(0);
  const resizeFrameRef = useRef(0);
  const commitPlotWidth = useCallback(() => {
    const o = plotOffsetRef.current;
    const width = o && o.width > 0 ? o.width : containerWidthRef.current;
    if (width > 0) setPlotWidth((prev) => (Math.abs(width - prev) >= 8 ? width : prev));
  }, []);
  const onContainerResize = useCallback((width: number) => {
    containerWidthRef.current = width;
    // onResize fires BEFORE the chart renders at the new size, so committing
    // this width would only be corrected by the plot rect a render later. Wait
    // one frame instead — by then <Customized> has written the real rect — and
    // commit that, so a resize costs ONE render.
    cancelAnimationFrame(resizeFrameRef.current);
    resizeFrameRef.current = requestAnimationFrame(commitPlotWidth);
  }, [commitPlotWidth]);
  useEffect(() => () => cancelAnimationFrame(resizeFrameRef.current), []);
  // Our own renders can move the plot rect too (a wider y-axis label, say).
  useLayoutEffect(commitPlotWidth);
  const columns = Math.max(64, Math.round(plotWidth || 800));

  const [x0, x1] = effectiveX;
  const data = useMemo(() => {
    const hidden = visibility.hidden;
    const { all, legacyRaw } = prepared;
    const isVisible = (key: string) => !hidden.has(
      key.endsWith("__raw") && legacyRaw.has(key.slice(0, -5)) ? key.slice(0, -5) : key,
    );
    return buildRenderRows(all, isVisible, x0, x1, columns, logX);
  }, [prepared, visibility, x0, x1, columns, logX]);

  // ── Toolbar controller ──
  // Bridge the ChartViewState substrate onto the renderer-agnostic PlotController the
  // <PlotToolbar> drives. `dataBounds` (the full data extent) seeds zoomIn/Out
  // when the view is still auto; `dragMode` feeds the gesture base mode.
  const dataBounds = useMemo(
    () => ({
      x: [dataXs[0], dataXs[1]] as [number, number],
      y: [dataYs[0], dataYs[1]] as [number, number],
    }),
    [dataXs, dataYs],
  );
  const controller = useScalarController({
    view,
    onViewChange,
    rootRef: chartBoxRef,
    dataBounds,
  });

  const {
    selection,
    wasDragRef,
    onChartPointerDown,
    onChartPointerMove,
    onChartPointerUp,
    onChartDoubleClick,
    clearDrag,
  } = usePlotGestures({
    chartBoxRef,
    plotOffsetRef,
    effectiveRef,
    onViewChange,
    baseDragMode: controller.dragMode === "pan" ? "pan" : "zoom",
  });

  // ── Render ──
  return (
    <div
      ref={chartBoxRef}
      className={`group relative overflow-hidden ${className ?? ""}`}
      style={{
        touchAction: "none",
        cursor: altDown ? "move" : "crosshair",
        userSelect: "none",
        WebkitUserSelect: "none",
      } as CSSProperties}
      aria-label="Scalar plot. Drag to box-zoom. Alt+drag to pan. Wheel to zoom. Double-click to reset."
      onPointerDown={onChartPointerDown}
      onPointerMove={onChartPointerMove}
      onPointerUp={onChartPointerUp}
      onPointerCancel={onChartPointerUp}
      onDoubleClick={onChartDoubleClick}
      onClick={() => {
        if (wasDragRef.current) { wasDragRef.current = false; return; }
        const hk = hoveredSeriesRef.current;
        if (hk) onSeriesClick?.(hk);
      }}
      onLostPointerCapture={clearDrag}
    >
      <ResponsiveContainer width="100%" height="100%" onResize={onContainerResize}>
        <LineChart
          data={data}
          margin={CHART_MARGIN}
          onMouseMove={(state: any) => {
            if (state?.activePayload?.length) {
              const payload = state.activePayload as Array<{
                dataKey: string;
                value: number;
                type?: string;
              }>;
              const po = plotOffsetRef.current;
              if (po && state.chartY != null) {
                const fracFromTop = Math.max(
                  0,
                  Math.min(
                    1,
                    (state.chartY - po.top) / Math.max(1, po.height),
                  ),
                );
                let closestKey: string | null = null;
                let closestScreenDist = Infinity;
                for (const p of payload) {
                  if (p.value == null) continue;
                  // The faint overlay is a graphical item like any other, so
                  // Recharts puts it in `activePayload` despite tooltipType
                  // "none". It is not a hoverable series.
                  if (p.type === "none" || p.dataKey.endsWith("__raw")) continue;
                  const [yMin, yMax] = effectiveRef.current.y;
                  const valueFrac =
                    1 - (p.value - yMin) / Math.max(1e-10, yMax - yMin);
                  const dist = Math.abs(valueFrac - fracFromTop);
                  if (dist < closestScreenDist) {
                    closestScreenDist = dist;
                    closestKey = p.dataKey;
                  }
                }
                applyEmphasis(closestKey);
              } else {
                const only = payload.filter(
                  (p) => p.type !== "none" && !p.dataKey.endsWith("__raw"),
                );
                if (only.length === 1) applyEmphasis(only[0]!.dataKey);
              }
            }
          }}
          onMouseLeave={() => applyEmphasis(null)}
        >
          {/* Recharts axes/grid are token-styled (NOT migrated off Recharts —
              that would risk the zoom/pan gesture code) so they visually match
              the SVG renderers' shared <Axis>. */}
          <CartesianGrid stroke={GRID.color} strokeDasharray={GRID.dash} />
          <XAxis
            dataKey="x"
            type="number"
            scale={xScale === "log" ? "log" : "linear"}
            domain={xDomainPadded}
            allowDataOverflow
            stroke={AXIS.lineColor}
            tick={{
              fontSize: AXIS.tickFontSize,
              fontFamily: AXIS.tickFontFamily,
              fill: AXIS.tickColor,
            }}
            tickFormatter={(v: number) => formatXTick(v, xAxis)}
          />
          <YAxis
            yAxisId="__left__"
            scale={yScale === "log" ? "log" : "linear"}
            domain={yDomainPadded}
            allowDataOverflow
            stroke={AXIS.lineColor}
            tick={{
              fontSize: AXIS.tickFontSize,
              fontFamily: AXIS.tickFontFamily,
              fill: AXIS.tickColor,
            }}
            width={46}
          />
          {/* All tooltip chrome (rounded corners, bg, border, shadow, font)
              lives in CustomTooltip via the shared TOOLTIP_CHROME_CLASS, so no
              contentStyle/labelStyle override here (Recharts ignores them when
              a custom `content` is supplied anyway). */}
          <Tooltip
            isAnimationActive={false}
            content={
              <CustomTooltip
                seriesByKey={Object.fromEntries(
                  series.map((s) => [s.key, s]),
                )}
                xAxis={xAxis}
                showContext={tooltip?.showContext ?? true}
                showWallTime={tooltip?.showWallTime ?? true}
              />
            }
          />
          {showLegend && series.length > 0 && (
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              content={
                <CustomLegend
                  series={series}
                  onSelect={(key) => onSeriesClick?.(key)}
                  onHover={onLegendHover}
                  selectedKeys={selectedSeriesKeys}
                  visibility={visibility}
                />
              }
            />
          )}
          {series.map((s, i) => {
            // S6: a hidden series renders no lines at all (Plotly legend hide).
            if (visibility.isHidden(s.key)) return null;
            // Run-selection dimming stays React state (it is a prop, and it
            // never changes on mouse move). Hover dimming rides `data-emph`,
            // and the "on" rule's `stroke-opacity: 1` deliberately beats this
            // attribute so hovering a non-selected series still highlights it.
            const isSelDimmed =
              (selectedSeriesKeys?.size ?? 0) > 0 && !selectedSeriesKeys!.has(s.key);
            // The overlay reads `${key}__raw`, filled either by this series'
            // own `rawYs` (smoothing here) or by a legacy `${key}__raw` series
            // prepared from the host's pre-smoothed `rawPoints`.
            const hasRaw = prepared.main[i]?.rawYs != null || prepared.legacyRaw.has(s.key);
            return [
              hasRaw && (
                <Line
                  key={`${s.key}__raw`}
                  type={lineType}
                  dataKey={`${s.key}__raw`}
                  stroke={s.color}
                  strokeWidth={1}
                  strokeOpacity={isSelDimmed ? 0.05 : 0.2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                  yAxisId="__left__"
                  legendType="none"
                  tooltipType="none"
                  data-series-key={s.key}
                  data-series-role="raw"
                />
              ),
              <Line
                key={s.key}
                type={lineType}
                name={s.label}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={1.5}
                strokeOpacity={isSelDimmed ? 0.15 : 1}
                dot={false}
                isAnimationActive={false}
                connectNulls
                yAxisId="__left__"
                data-series-key={s.key}
              />,
            ];
          })}
          <Customized
            component={
              ((props: unknown) => {
                const p = props as {
                  offset?: {
                    top?: number;
                    left?: number;
                    width?: number;
                    height?: number;
                    right?: number;
                  };
                };
                const o = p.offset;
                if (!o || o.width == null || o.height == null) return null;
                plotOffsetRef.current = {
                  top: o.top ?? 0,
                  left: o.left ?? 0,
                  width: o.width,
                  height: o.height,
                };
                return null;
              }) as unknown as React.FunctionComponent
            }
          />
        </LineChart>
      </ResponsiveContainer>
      {selection && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: Math.min(selection.x0, selection.x1),
            top: Math.min(selection.y0, selection.y1),
            width: Math.abs(selection.x1 - selection.x0),
            height: Math.abs(selection.y1 - selection.y0),
            border: "1px solid #0969da",
            background: "rgba(83, 155, 245, 0.12)",
            pointerEvents: "none",
          }}
        />
      )}
      <PlotToolbar controller={controller} />
    </div>
  );
}
