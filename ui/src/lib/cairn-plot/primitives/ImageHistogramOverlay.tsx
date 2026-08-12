/**
 * ImageHistogramOverlay — a small, self-contained histogram panel pinned to the
 * TOP-RIGHT of an image pane, BELOW the toolbar seam.
 *
 * It bins the DECODED source the pane already holds (no server) via the pure
 * `renderers/image-histogram.ts` core, and draws the per-series bin counts on a
 * small canvas. A compact control lets the user pick which CHANNELS to show and
 * how to GROUP them (each channel separately, or combined into one Rec.709-luma
 * / mean series). For DEEP-Z sources it additionally lists the samples (value +
 * DEPTH/Z) of the pixel currently under the cursor.
 *
 * Placement + stacking (design req 3):
 *  - It is a single `position:absolute` panel anchored to the pane's top-right,
 *    with its `top` measured to sit just BELOW the pane's `PlotToolbar` (so it
 *    never overlaps the button/slider rows). The toolbar's own overflow/settings
 *    dropdowns PORTAL to `document.body` at a HIGHER z-index, so an opened menu
 *    always draws OVER this panel — they never fight for the same pixels.
 *  - `pointer-events` are scoped to the panel box alone (the rest of the pane is
 *    untouched), and the panel STOPS pointer/wheel propagation so interacting
 *    with it never starts a viewport pan/zoom. Wheel/drag over the image proper
 *    still reach the viewport.
 *
 * Self-contained (per the library convention): it owns its channel-selection +
 * grouping state, measures its own placement, and tracks dpr for a crisp canvas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeepGpuCsrData } from "../image/decoders.ts";
import { useDevicePixelRatio } from "../hooks/use-device-pixel-ratio";
import { formatChannelValue, type PixelValueScale } from "./PixelValueOverlay";
import {
  binIndexOf,
  computeHistograms,
  deepPixelSamples,
  DEFAULT_HISTOGRAM_BINS,
  luminance,
  resolveHistogramSeries,
  type HistogramChannel,
  type HistogramGroupMode,
  type HistogramResult,
} from "../renderers/image-histogram.ts";

/**
 * The pane-supplied data the histogram bins. The pane closes `readChannel` over
 * its OWN decoded buffer (`ImageData` / `Float32Array` / widened f16), so the
 * overlay never re-decodes and stays backend-agnostic.
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
}

export interface ImageHistogramOverlayProps {
  source: HistogramSource;
  /** The integer texel under the cursor (or null when off-image). */
  cursor: { px: number; py: number } | null;
  /** Close the panel (the toolbar toggle mirrors this). */
  onClose: () => void;
}

const PANEL_W = 224;
const CANVAS_H = 84;
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

export default function ImageHistogramOverlay({
  source,
  cursor,
  onClose,
}: ImageHistogramOverlayProps) {
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

  // The binned histogram. Recomputes on data version / selection / grouping.
  const result = useMemo<HistogramResult>(
    () =>
      computeHistograms({
        readChannel: source.readChannel,
        pixelCount: source.width * source.height,
        series,
        bins: DEFAULT_HISTOGRAM_BINS,
      }),
    // `source.readChannel` closes over the live buffer; `source.version` is the
    // freshness key (the closure identity may be stable across data swaps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, source.version, source.width, source.height],
  );

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

  // Draw the overlaid per-series histograms + a cursor-bin marker.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.clientWidth || PANEL_W - 16;
    const cssH = CANVAS_H;
    const px = Math.round(cssW * dpr);
    const py = Math.round(cssH * dpr);
    if (canvas.width !== px) canvas.width = px;
    if (canvas.height !== py) canvas.height = py;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const peak = Math.max(1, ...result.series.map((s) => s.peak));
    const bins = result.bins;
    const bw = cssW / bins;
    for (const s of result.series) {
      // Filled area (faint) + top polyline in the series tint.
      ctx.beginPath();
      ctx.moveTo(0, cssH);
      for (let i = 0; i < bins; i++) {
        const h = (s.counts[i]! / peak) * (cssH - 2);
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
      const bi = binIndexOf(cv, result.min, result.max, bins);
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
  const isDeep = !!source.getDeepCsr;

  return (
    <div
      ref={panelRef}
      data-cairn-histogram=""
      data-hist-series={result.series.length}
      data-hist-bins={result.bins}
      data-hist-total={totalSamples}
      data-hist-channels={channelCount}
      data-hist-deep={isDeep ? "true" : "false"}
      data-hist-deep-count={deepSamples.length}
      data-hist-cursor={cursor ? `${cursor.px},${cursor.py}` : ""}
      data-hist-cursor-values={cursorValues ? cursorValues.map((v) => v.toFixed(4)).join(",") : ""}
      className="absolute rounded border border-border bg-bg-elevated/95 shadow-md backdrop-blur-sm text-fg"
      // z-index inline (not a Tailwind class) so it always resolves: BELOW the
      // toolbar (z-30) and its body-portaled menus, ABOVE the pixel overlay
      // (z-10) — the toolbar + any opened menu always win the stacking.
      style={{ top, right: GAP_BELOW_TOOLBAR, width: PANEL_W, zIndex: 15, pointerEvents: "auto" }}
      // Scope interactions: never let a panel click/scroll start a viewport
      // pan/zoom (the viewport's pointer handlers live on an ancestor).
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/60">
        <span className="text-[10px] font-mono uppercase tracking-wide text-fg-muted">Histogram</span>
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
            title="Hide histogram"
            aria-label="Hide histogram"
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

      <div className="px-2 pt-1.5">
        <canvas ref={canvasRef} className="block w-full" style={{ height: CANVAS_H }} aria-hidden />
        <div className="flex justify-between text-[9px] font-mono text-fg-muted pt-0.5">
          <span>{fmt(result.min)}</span>
          <span>{fmt(result.max)}</span>
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

/** Compact Z formatting (small/large magnitudes → scientific). */
function fmtZ(z: number): string {
  const a = Math.abs(z);
  return a >= 1000 || (a < 0.01 && z !== 0) ? z.toExponential(2) : z.toFixed(3);
}
