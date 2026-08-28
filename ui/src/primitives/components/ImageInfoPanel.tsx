/**
 * ImageInfoPanel — the pane's INFO PANEL: a small, self-contained sectioned
 * overlay pinned to the TOP-RIGHT of an image pane, BELOW the toolbar seam
 * (formerly `ImageHistogramOverlay`; see
 * `docs/superpowers/specs/2026-08-25-image-info-panel-design.md`).
 *
 * Sections (top → bottom):
 *   - per-channel STATS row (min / mean / max — tev's footer numbers);
 *   - the VALUE HISTOGRAM: tev-parity binning (400 bins, symmetric-log₂ axis
 *     over the data's min→max, density + percentile-cap normalization) via the
 *     pure `renderers/image-histogram.ts` → `image/histogram-binning.ts` core;
 *   - the per-pixel-under-cursor read-out;
 *   - DEEP-Z: the cursor pixel's samples (value + depth Z), front → back.
 *   (M2 adds the alpha-weighted DEPTH histogram section for deep sources.)
 *
 * It bins the DECODED source the pane already holds (no server). Visibility is
 * OWNED BY THE PANE (a viewport setting with an auto-show rule — see
 * `ImagePaneShell`); this component only renders the open panel.
 *
 * Placement + stacking (design req 3):
 *  - a single `position:absolute` panel anchored top-right, `top` measured to
 *    sit just BELOW the pane's `PlotToolbar`; toolbar dropdowns portal to
 *    `document.body` at a higher z-index and always draw over it.
 *  - `pointer-events` are scoped to the panel box; it stops pointer/wheel
 *    propagation so interacting with it never starts a viewport pan/zoom.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeepGpuCsrData } from "../../plots/image/model/decoders.ts";
import { useDevicePixelRatio } from "../../host/hooks/use-device-pixel-ratio";
import { formatChannelValue, type PixelValueScale } from "./PixelValueOverlay";
import {
  computeDepthHistogramCpu,
  computeTevHistograms,
  deepPixelSamples,
  luminance,
  resolveHistogramSeries,
  type DepthHistogramResult,
  type HistogramChannel,
  type HistogramGroupMode,
  type HistogramSeriesSpec,
  type TevHistogramsResult,
} from "../../plots/image/components/image-histogram.ts";
import { symmetricLog2, tevBinOfValue, TEV_HISTOGRAM_BINS } from "../../plots/image/model/histogram-binning.ts";

/**
 * The pane-supplied data the panel bins. The pane closes `readChannel` over
 * its OWN decoded buffer (`ImageData` / `Float32Array` / widened f16), so the
 * panel never re-decodes and stays backend-agnostic.
 */
export interface HistogramSource {
  /** Channels in `readChannel`'s index order (R/G/B[/A] + any aux). */
  channels: HistogramChannel[];
  width: number;
  height: number;
  /** Raw sample accessor (0..255 for `uint8`, scene value for `unit`). */
  readChannel: (pixelIndex: number, channel: number) => number;
  /** Value scale — drives the axis read-out formatting. */
  scale: PixelValueScale;
  /** Bumped when the decoded buffer changes (retriggers the recompute). */
  version: number;
  /** DEEP-Z only: fetch the deep sample CSR (cached here) for the per-pixel
   *  depth read-out. Omitted for non-deep sources. */
  getDeepCsr?: () => Promise<DeepGpuCsrData | null>;
  /**
   * GPU value-histogram compute (M2, full pixel coverage) — GPU panes wire
   * this to `PaneHandle.computeHistogram` + `tevResultFromRawHistogram`.
   * Resolving `null` (no kernel / >4 channels / GPU failure) falls the panel
   * back to the CPU reader loop above. Omitted = CPU-only (subsampled).
   */
  computeTev?: (series: HistogramSeriesSpec[]) => Promise<TevHistogramsResult | null>;
  /**
   * GPU depth-histogram compute (DEEP-Z only) — `PaneHandle.
   * computeDepthHistogram` de-quantized + normalized. Resolving `null` falls
   * back to the CPU twin over `getDeepCsr`'s CSR (which is also the whole
   * path when this is omitted — CPU panes).
   */
  computeDepthHistogram?: () => Promise<DepthHistogramResult | null>;
}

export interface ImageInfoPanelProps {
  source: HistogramSource;
  /** The integer texel under the cursor (or null when off-image). */
  cursor: { px: number; py: number } | null;
  /** DEEP-Z only: the LIVE depth window `[zNear, zFar]` (toolbar sliders /
   *  region select) — drawn as limit marks on the depth histogram. */
  depthWindow?: { zNear: number; zFar: number };
  /** Close the panel (the toolbar toggle mirrors this). */
  onClose: () => void;
}

/** The panel's fixed width — ALSO the auto-show rule's footprint: the shell
 *  shows the panel by default iff `INFO_PANEL_W ≤ 25% of the pane width`. */
export const INFO_PANEL_W = 224;
const CANVAS_H = 84;
const DEPTH_CANVAS_H = 48;
const DEPTH_SERIES_COLOR = "#8ab4ff";
/** The depth-window LIMIT marks (matches the aux-channel amber tint family). */
const DEPTH_LIMIT_COLOR = "#f0a83a";
const GAP_BELOW_TOOLBAR = 6;

/** Measure the pane's toolbar and return this panel's `top` (px, in the pane
 *  box's local coords) so it sits just below the toolbar rows. Falls back to a
 *  fixed offset when no toolbar is present (host-driven panes). */
function useTopBelowToolbar(panelRef: React.RefObject<HTMLElement | null>): number {
  const [top, setTop] = useState(40);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const offsetParent = panel.offsetParent as HTMLElement | null;
    // Climb to the first ancestor that CONTAINS the toolbar (a sibling of the
    // viewport box under the pane root).
    let toolbar: Element | null = null;
    let node: HTMLElement | null = panel.parentElement;
    while (node && !toolbar) {
      toolbar = node.querySelector(".cairn-plot-toolbar");
      node = node.parentElement;
    }
    const measure = () => {
      if (!offsetParent) return;
      const base = offsetParent.getBoundingClientRect();
      if (toolbar) {
        const tb = toolbar.getBoundingClientRect();
        setTop(Math.max(GAP_BELOW_TOOLBAR, tb.bottom - base.top + GAP_BELOW_TOOLBAR));
      } else {
        setTop(GAP_BELOW_TOOLBAR);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (toolbar) ro.observe(toolbar);
    if (offsetParent) ro.observe(offsetParent);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [panelRef]);
  return top;
}

/** Sensible default channel selection: the first up-to-3 channels (RGB) — a
 *  4th (alpha) or any aux channel starts hidden and can be toggled on. */
function defaultSelection(channelCount: number): number[] {
  return Array.from({ length: Math.min(channelCount, 3) }, (_, i) => i);
}

export default function ImageInfoPanel({ source, cursor, depthWindow, onClose }: ImageInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const top = useTopBelowToolbar(panelRef);
  const dpr = useDevicePixelRatio();

  const channelCount = source.channels.length;
  const [selected, setSelected] = useState<number[]>(() => defaultSelection(channelCount));
  const [mode, setMode] = useState<HistogramGroupMode>("separate");
  const [controlsOpen, setControlsOpen] = useState(false);

  // Re-seed the selection if the source's channel COUNT changes (new image).
  const seededForRef = useRef(channelCount);
  useEffect(() => {
    if (seededForRef.current !== channelCount) {
      seededForRef.current = channelCount;
      setSelected(defaultSelection(channelCount));
    }
  }, [channelCount]);

  const series = useMemo(
    () => resolveHistogramSeries(source.channels, selected, mode),
    [source.channels, selected, mode],
  );

  // The tev-parity histogram + per-channel stats. Recomputes on data version /
  // selection / grouping. `computeCpu` is the CPU reader loop (subsampled —
  // the instant paint AND the fallback); when the pane supplies a GPU compute
  // (`source.computeTev`, full pixel coverage) its result replaces the CPU one
  // asynchronously — the previous result stays on screen meanwhile (no blank
  // flash on data changes).
  const computeCpu = useCallback(
    () =>
      computeTevHistograms({
        readChannel: source.readChannel,
        pixelCount: source.width * source.height,
        series,
        bins: TEV_HISTOGRAM_BINS,
        channelCount,
      }),
    // `source.readChannel` closes over the live buffer; `source.version` is the
    // freshness key (the closure identity may be stable across data swaps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, source.version, source.width, source.height, channelCount],
  );
  const [result, setResult] = useState<TevHistogramsResult>(computeCpu);
  useEffect(() => {
    let cancelled = false;
    const gpu = source.computeTev;
    if (!gpu) {
      setResult(computeCpu());
      return;
    }
    setResult(computeCpu());
    gpu(series)
      .then((r) => {
        if (!cancelled && r) setResult(r);
      })
      .catch(() => {
        /* CPU result already shown */
      });
    return () => {
      cancelled = true;
    };
    // `computeCpu`'s identity already tracks series/version/dims.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeCpu, source.computeTev]);

  // The cursor pixel's per-channel raw values (numeric) — the per-pixel readout.
  const cursorValues = useMemo<number[] | null>(() => {
    if (!cursor) return null;
    if (cursor.px < 0 || cursor.py < 0 || cursor.px >= source.width || cursor.py >= source.height) {
      return null;
    }
    const idx = cursor.py * source.width + cursor.px;
    return source.channels.map((_, c) => source.readChannel(idx, c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor?.px, cursor?.py, source.version, source.width, source.height, channelCount]);

  // DEEP-Z: fetch the CSR once per data version, then slice the cursor pixel.
  const [deepCsr, setDeepCsr] = useState<DeepGpuCsrData | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDeepCsr(null);
    const getCsr = source.getDeepCsr;
    if (!getCsr) return;
    getCsr()
      .then((csr) => {
        if (!cancelled) setDeepCsr(csr);
      })
      .catch(() => {
        if (!cancelled) setDeepCsr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [source.getDeepCsr, source.version]);

  const deepSamples = useMemo(
    () => (deepCsr && cursor ? deepPixelSamples(deepCsr, cursor.px, cursor.py) : []),
    [deepCsr, cursor?.px, cursor?.py],
  );

  // DEEP-Z: the alpha-weighted DEPTH histogram (M2). GPU kernel when the pane
  // provides it (`computeDepthHistogram`), else — and on a GPU `null` — the
  // CPU twin over the exported CSR. Z-window independent (full sample set).
  const isDeep = !!source.getDeepCsr;
  const [depth, setDepth] = useState<DepthHistogramResult | null>(null);
  useEffect(() => {
    if (!isDeep) {
      setDepth(null);
      return;
    }
    let cancelled = false;
    const viaCpu = async (): Promise<DepthHistogramResult | null> => {
      const csr = await source.getDeepCsr!();
      return csr ? computeDepthHistogramCpu(csr) : null;
    };
    const gpu = source.computeDepthHistogram;
    (gpu ? gpu().then((r) => r ?? viaCpu()) : viaCpu())
      .then((r) => {
        if (!cancelled) setDepth(r);
      })
      .catch(() => {
        if (!cancelled) setDepth(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeep, source.computeDepthHistogram, source.getDeepCsr, source.version]);

  // Draw the depth histogram (one series; same clamp-at-1 as the value plot),
  // plus the LIVE depth-window LIMITS (dim the excluded outside regions, mark
  // both edges) and — like the value plot's cursor marker — a line per deep
  // sample of the hovered pixel at its Z bin.
  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = depthCanvasRef.current;
    if (!canvas || !depth) return;
    const cssW = canvas.clientWidth || INFO_PANEL_W - 16;
    const cssH = DEPTH_CANVAS_H;
    const px = Math.round(cssW * dpr);
    const py = Math.round(cssH * dpr);
    if (canvas.width !== px) canvas.width = px;
    if (canvas.height !== py) canvas.height = py;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const bins = depth.mapping.bins;
    const bw = cssW / bins;
    ctx.beginPath();
    ctx.moveTo(0, cssH);
    for (let i = 0; i < bins; i++) {
      const h = Math.min(depth.values[i]!, 1) * (cssH - 2);
      const x = i * bw;
      ctx.lineTo(x, cssH - h);
      ctx.lineTo(x + bw, cssH - h);
    }
    ctx.lineTo(cssW, cssH);
    ctx.closePath();
    ctx.fillStyle = DEPTH_SERIES_COLOR;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = DEPTH_SERIES_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Depth-window LIMITS: continuous symlog x positions (limits are values,
    // not bins), the outside regions dimmed, both edges marked.
    if (depthWindow) {
      const xOf = (z: number) => {
        const t = (symmetricLog2(z) - depth.mapping.minLog) / depth.mapping.diffLog;
        return Math.max(0, Math.min(1, t)) * cssW;
      };
      const xNear = Number.isFinite(depthWindow.zNear) ? xOf(depthWindow.zNear) : 0;
      const xFar = Number.isFinite(depthWindow.zFar) ? xOf(depthWindow.zFar) : cssW;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      if (xNear > 0) ctx.fillRect(0, 0, xNear, cssH);
      if (xFar < cssW) ctx.fillRect(xFar, 0, cssW - xFar, cssH);
      ctx.strokeStyle = DEPTH_LIMIT_COLOR;
      ctx.lineWidth = 1;
      for (const x of [xNear, xFar]) {
        const cx = Math.max(0.5, Math.min(cssW - 0.5, x));
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, cssH);
        ctx.stroke();
      }
    }

    // Cursor markers: one line per deep sample of the hovered pixel, at the
    // bin its Z falls in (the value plot's marker, generalized to a sample
    // list — a deep pixel has one depth per sample).
    for (const s of deepSamples) {
      const bi = tevBinOfValue(depth.mapping, s.z);
      if (bi < 0) continue;
      const x = (bi + 0.5) * bw;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
  }, [depth, depthWindow, deepSamples, dpr]);

  // Draw the overlaid per-series histograms + a cursor-bin marker. Series
  // values are tev display-normalized densities (≈[0,1]; hot bins may exceed 1
  // — clamped here, exactly as tev's plot clips them).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.clientWidth || INFO_PANEL_W - 16;
    const cssH = CANVAS_H;
    const px = Math.round(cssW * dpr);
    const py = Math.round(cssH * dpr);
    if (canvas.width !== px) canvas.width = px;
    if (canvas.height !== py) canvas.height = py;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const bins = result.mapping.bins;
    const bw = cssW / bins;
    for (const s of result.series) {
      ctx.beginPath();
      ctx.moveTo(0, cssH);
      for (let i = 0; i < bins; i++) {
        const h = Math.min(s.values[i]!, 1) * (cssH - 2);
        const x = i * bw;
        ctx.lineTo(x, cssH - h);
        ctx.lineTo(x + bw, cssH - h);
      }
      ctx.lineTo(cssW, cssH);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cursor-bin marker: a vertical line at the bin the cursor's luma falls in.
    if (cursorValues && cursorValues.length > 0) {
      const cv = cursorValues.length >= 3 ? luminance(cursorValues.slice(0, 3)) : cursorValues[0]!;
      const bi = tevBinOfValue(result.mapping, cv);
      if (bi >= 0) {
        const x = (bi + 0.5) * bw;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssH);
        ctx.stroke();
      }
    }
  }, [result, cursorValues, dpr]);

  const fmt = useCallback(
    (v: number) => formatChannelValue(v, source.scale, source.scale === "uint8" ? "int" : "decimal"),
    [source.scale],
  );

  const toggleChannel = useCallback((c: number) => {
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].sort((a, b) => a - b)));
  }, []);

  const totalSamples = result.series.reduce((a, s) => a + s.total, 0);
  // Stats rows for the SELECTED channels (the ones the histogram shows). The
  // async result can briefly lag a channel-count change — index defensively.
  const statRows = selected
    .filter((c) => c < channelCount && (result.channelStats[c]?.count ?? 0) > 0)
    .map((c) => ({ channel: source.channels[c]!, stats: result.channelStats[c]! }));

  return (
    <div
      ref={panelRef}
      data-cairn-info-panel=""
      data-cairn-histogram=""
      data-hist-series={result.series.length}
      data-hist-bins={result.mapping.bins}
      data-hist-total={totalSamples}
      data-hist-channels={channelCount}
      data-hist-deep={isDeep ? "true" : "false"}
      data-hist-deep-count={deepSamples.length}
      data-hist-depth-bins={depth ? depth.mapping.bins : 0}
      data-hist-depth-weight={depth ? depth.totalWeight.toFixed(3) : ""}
      data-hist-depth-window={depthWindow ? `${depthWindow.zNear},${depthWindow.zFar}` : ""}
      data-hist-cursor={cursor ? `${cursor.px},${cursor.py}` : ""}
      data-hist-cursor-values={cursorValues ? cursorValues.map((v) => v.toFixed(4)).join(",") : ""}
      className="absolute rounded border border-border bg-bg-elevated/95 shadow-md backdrop-blur-sm text-fg"
      // z-index inline (not a Tailwind class) so it always resolves: BELOW the
      // toolbar (z-30) and its body-portaled menus, ABOVE the pixel overlay
      // (z-10) — the toolbar + any opened menu always win the stacking.
      style={{ top, right: GAP_BELOW_TOOLBAR, width: INFO_PANEL_W, zIndex: 15, pointerEvents: "auto" }}
      // Scope interactions: never let a panel click/scroll start a viewport
      // pan/zoom (the viewport's pointer handlers live on an ancestor).
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/60">
        <span className="text-[10px] font-mono uppercase tracking-wide text-fg-muted">Info</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-hist-controls-toggle=""
            title="Channels & grouping"
            aria-label="Channels and grouping"
            onClick={() => setControlsOpen((v) => !v)}
            className={`rounded px-1 text-[11px] leading-none ${controlsOpen ? "text-fg" : "text-fg-muted"} hover:text-fg`}
          >
            ⚙
          </button>
          <button
            type="button"
            data-hist-close=""
            title="Hide info panel"
            aria-label="Hide info panel"
            onClick={onClose}
            className="rounded px-1 text-[11px] leading-none text-fg-muted hover:text-fg"
          >
            ×
          </button>
        </div>
      </div>

      {controlsOpen && (
        <div className="px-2 py-1.5 border-b border-border/60 flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            {source.channels.map((ch, c) => {
              const on = selected.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  data-hist-channel={c}
                  data-hist-channel-on={on ? "true" : "false"}
                  onClick={() => toggleChannel(c)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                    on ? "border-transparent text-black" : "border-border text-fg-muted"
                  }`}
                  style={on ? { background: ch.color ?? "#888" } : undefined}
                  title={`${on ? "Hide" : "Show"} channel ${ch.name}`}
                >
                  {ch.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {(["separate", "luminance", "mean"] as HistogramGroupMode[]).map((m) => (
              <button
                key={m}
                type="button"
                data-hist-mode={m}
                data-hist-mode-on={mode === m ? "true" : "false"}
                onClick={() => setMode(m)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                  mode === m ? "border-accent text-fg bg-accent/20" : "border-border text-fg-muted"
                }`}
                title={
                  m === "separate"
                    ? "One series per selected channel"
                    : m === "luminance"
                      ? "Combine selected channels as Rec.709 luminance"
                      : "Combine selected channels as their mean"
                }
              >
                {m === "separate" ? "Split" : m === "luminance" ? "Luma" : "Mean"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per-channel STATS (min / mean / max — tev's footer numbers). */}
      {statRows.length > 0 && (
        <div className="px-2 pt-1 text-[9px] font-mono" data-info-stats="">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 text-fg-muted">
            <span />
            <span className="text-right">min</span>
            <span className="text-right">mean</span>
            <span className="text-right">max</span>
            {statRows.map(({ channel, stats }, i) => (
              <StatRow key={i} name={channel.name} color={channel.color} stats={stats} fmt={fmt} />
            ))}
          </div>
        </div>
      )}

      <div className="px-2 pt-1.5">
        <canvas ref={canvasRef} className="block w-full" style={{ height: CANVAS_H }} aria-hidden />
        <div className="flex justify-between text-[9px] font-mono text-fg-muted pt-0.5">
          <span>{fmt(result.mapping.min)}</span>
          <span>{fmt(result.mapping.max)}</span>
        </div>
      </div>

      {/* Per-pixel-under-cursor read-out. */}
      <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-mono" data-hist-cursor-readout="">
        {cursorValues ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {cursorValues.map((v, c) => (
              <span key={c} style={{ color: source.channels[c]!.color ?? "#ccc" }}>
                {source.channels[c]!.name}:{fmt(v)}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-fg-muted">hover a pixel…</span>
        )}
      </div>

      {/* DEEP-Z: the alpha-weighted depth histogram over ALL samples (symlog
          Z axis, tev normalization — GPU kernel on WebGPU panes, CPU twin
          otherwise). */}
      {isDeep && (
        <div className="px-2 pb-1 border-t border-border/60 pt-1" data-hist-depth-section="">
          <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
            <span className="uppercase tracking-wide text-fg-muted">depth (α-weighted)</span>
            {/* The LIVE window limits, numeric — shown once the window is
                narrower than the full z range (the axis row already prints the
                full-range endpoints). */}
            {depthWindow &&
              depth &&
              (depthWindow.zNear > depth.mapping.min || depthWindow.zFar < depth.mapping.max) && (
                <span style={{ color: DEPTH_LIMIT_COLOR }} data-hist-depth-limits="">
                  {fmtZ(depthWindow.zNear)}–{fmtZ(depthWindow.zFar)}
                </span>
              )}
          </div>
          {depth ? (
            <>
              <canvas
                ref={depthCanvasRef}
                className="block w-full"
                style={{ height: DEPTH_CANVAS_H }}
                aria-hidden
              />
              <div className="flex justify-between text-[9px] font-mono text-fg-muted pt-0.5">
                <span>{fmtZ(depth.mapping.min)}</span>
                <span>{fmtZ(depth.mapping.max)}</span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-fg-muted">computing…</div>
          )}
        </div>
      )}

      {/* DEEP-Z: the cursor pixel's samples (value + depth Z), front → back. */}
      {isDeep && (
        <div className="px-2 pb-1.5 border-t border-border/60 pt-1" data-hist-deep-readout="">
          <div className="text-[9px] uppercase tracking-wide text-fg-muted mb-0.5">
            deep samples{cursor ? ` @ ${cursor.px},${cursor.py}` : ""} ({deepSamples.length})
          </div>
          {deepSamples.length === 0 ? (
            <div className="text-[10px] text-fg-muted">{cursor ? "no samples" : "hover a pixel…"}</div>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
              {deepSamples.slice(0, 12).map((s, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className="text-fg-muted">Z {fmtZ(s.z)}</span>
                  <span>{fmt(luminance([s.rgba[0], s.rgba[1], s.rgba[2]]))}</span>
                </div>
              ))}
              {deepSamples.length > 12 && (
                <div className="text-[9px] text-fg-muted">+{deepSamples.length - 12} more…</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({
  name,
  color,
  stats,
  fmt,
}: {
  name: string;
  color?: string;
  stats: { min: number; mean: number; max: number };
  fmt: (v: number) => string;
}) {
  return (
    <>
      <span style={{ color: color ?? "#ccc" }}>{name}</span>
      <span className="text-right text-fg">{fmt(stats.min)}</span>
      <span className="text-right text-fg">{fmt(stats.mean)}</span>
      <span className="text-right text-fg">{fmt(stats.max)}</span>
    </>
  );
}

/** Compact Z formatting (small/large magnitudes → scientific). */
function fmtZ(z: number): string {
  const a = Math.abs(z);
  return a >= 1000 || (a < 0.01 && z !== 0) ? z.toExponential(2) : z.toFixed(3);
}
