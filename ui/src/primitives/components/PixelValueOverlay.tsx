/**
 * PixelValueOverlay — a TEV-style per-pixel numeric value overlay.
 *
 * When the user zooms in far enough that ONE source pixel covers at least
 * `PIXEL_VALUE_MIN_SCREEN_PX` screen px, this draws each VISIBLE pixel's
 * value(s) centred on the pixel — exactly like the EXR/HDR viewer TEV. Below
 * that threshold it draws nothing (zero cost). The threshold is a single
 * screen-px-per-texel figure (see `pixelValueNumbersVisible`), independent of
 * the string, notation, and channel count, so numbers pop in ALL AT ONCE at one
 * zoom level — never shorter values before longer ones.
 *
 * Design (self-contained; data-in-props):
 *  - It is a single absolutely-positioned <canvas> filling the pane's ONE
 *    viewport element, so its text stays crisp at any zoom (no raster
 *    up-scaling). It NEVER measures anything itself: both the CSS box and the
 *    device-pixel backing store come from the shared `ImageViewport`
 *    (`plots/image/components/image-viewport.ts`), the same geometry the pane's
 *    own paint uses — so the numbers can never disagree with the pixels.
 *  - `viewport.quad` is the image's on-screen rect (pane-local CSS px) under the
 *    current zoom/pan; the sampled grid (`sourceDims`, default `viewport.natural`)
 *    is spread across it, giving the per-source-pixel screen size (== the
 *    trigger metric).
 *  - Font size: ONE size for the whole frame (every number identical in height),
 *    derived from the on-screen pixel-cell size, the channel count, and the
 *    WIDEST value in view (measured in pass 1; see `pixel-value-size.ts`) — so
 *    the size shrinks just enough that even the longest number sits INSIDE the
 *    pixel it describes rather than spilling across the boundary onto its
 *    neighbours. It never depends on which string a given cell draws.
 *  - Only the on-screen pixel window is iterated (clipped to the canvas rect),
 *    so the drawn count is bounded (each pixel is >= ~30px, so a few hundred at
 *    most). Redraws on zoom / pan / resize / source-data change.
 *  - `pointer-events: none` so wheel-zoom, drag-pan and the split divider under
 *    it keep working untouched.
 *  - Legibility (TEV convention): text colours are FIXED intensity — the R/G/B
 *    channel tints and the neutral single-value colour never change with the
 *    pixel under them — and every glyph is drawn over a single CONSTANT soft
 *    dark drop shadow. Because the tints are bright and fixed, they read on dark
 *    pixels unaided; the dark shadow supplies the edge on bright pixels. (This
 *    replaced the old per-pixel adaptive black-on-light / white-on-dark flip
 *    plus opposite-luminance halo stroke.)
 */
import { useCallback, useLayoutEffect, useRef } from "react";
import { formatNum } from "../format";
import type { ImageViewport } from "../../plots/image/components/image-viewport";
import {
  pixelValueClipRect,
  pixelValueFontHeight,
  pixelValueNumbersVisible,
  PIXEL_VALUE_LINE_H_FRAC,
  PIXEL_VALUE_MIN_FONT_PX,
  PIXEL_VALUE_MIN_SCREEN_PX,
} from "./pixel-value-size";

// Re-exported here (its historical home) so the GPU panes that gate their
// nearest/linear sampling on it keep importing it from `PixelValueOverlay`; the
// value + its docs now live in `pixel-value-size.ts` next to the pure
// visibility rule (`pixelValueNumbersVisible`) it defines.
export { PIXEL_VALUE_MIN_SCREEN_PX };

/**
 * Per-channel tint colours for R / G / B digits. Vivid, FIXED intensity: they
 * are the same on every pixel (TEV convention) and read on dark backgrounds
 * unaided. The constant dark drop shadow drawn behind every glyph (see `draw()`)
 * supplies the edge that keeps them legible on bright pixels — even when a
 * channel's tint matches the underlying pixel (e.g. a red digit over a red one).
 */
export const CHANNEL_COLORS = ["#ff5a5a", "#39d353", "#5b9bff", "#ffffff"] as const;

/**
 * Fixed fill for a single-value (grayscale / colormapped / scalar-metric) line —
 * the neutral counterpart to {@link CHANNEL_COLORS}. Constant intensity like TEV:
 * a bright near-white that reads on dark pixels, kept legible on bright pixels by
 * the same constant dark shadow. (Replaced the old per-pixel black/white flip.)
 */
export const NEUTRAL_LABEL_COLOR = "#ffffff";

/** Constant soft dark drop shadow behind every glyph (TEV's legibility device):
 *  colour, and blur / vertical offset as fractions of the glyph height. */
const LABEL_SHADOW_COLOR = "rgba(0,0,0,0.9)";
const LABEL_SHADOW_BLUR_FRAC = 0.15;
const LABEL_SHADOW_OFFSET_FRAC = 0.06;

/**
 * How the overlay prints a channel value.
 *  - `"decimal"` — float where **1.0 = SDR white** (HDR floats exceed 1.0).
 *  - `"int"`     — integer scale where **255 = 1.0 = SDR white** (HDR exceeds 255).
 * The convention maps consistently across the 8-bit (`uint8`) and float
 * (`unit`) pipelines: a stored `uint8` value is `v/255` in decimal; a `unit`
 * float value is `v*255` in int. HDR values > 1.0 are shown, never clamped.
 *
 * DERIVED (audit M5): the notation set has ONE runtime source of truth —
 * `PIXEL_VALUE_NOTATIONS` in `builder/validate.ts` (the same list the cross-
 * language contract pins to Python). This union is a type-only projection of
 * that tuple via `typeof import(...)` — no runtime import, so the primitive
 * pulls nothing from the builder layer and the two can never drift.
 */
export type PixelValueNotation =
  (typeof import("../../public/builder/validate"))["PIXEL_VALUE_NOTATIONS"][number];

/** Value scale of a raw sample: `uint8` = 0..255 stored bytes; `unit` = float
 *  scene value where 1.0 is SDR white (the HDR pipeline). */
export type PixelValueScale = "uint8" | "unit";

/**
 * Compact float formatting for one printed channel value: 3 sig figs,
 * scientific for tiny/huge magnitudes. Delegates to the chart-wide `formatNum`
 * (at `precision: 3`) so the TEV per-pixel numbers and chart tooltips/colorbars
 * obey the SAME rounding + exponential-threshold rules.
 */
function formatFloat(v: number): string {
  return formatNum(v, { precision: 3 });
}

/**
 * Format one raw channel value for display under the current notation.
 * Shared by every sampler so int↔decimal stays consistent for both pipelines.
 */
export function formatChannelValue(
  value: number,
  scale: PixelValueScale,
  notation: PixelValueNotation,
): string {
  if (scale === "uint8") {
    // Stored 0..255. int → as-is; decimal → v/255 (255 → 1.0 = white).
    return notation === "int" ? String(Math.round(value)) : formatFloat(value / 255);
  }
  // `unit`: float scene value, 1.0 = white. int → v*255 (255 = white, HDR > 255);
  // decimal → the float as-is (HDR > 1.0 shown, not clamped).
  return notation === "int" ? formatFloat(value * 255) : formatFloat(value);
}

export interface PixelSample {
  /** One text line per value (e.g. `["255","128","0"]` or `["1.23e+02"]`). */
  lines: string[];
  /**
   * Optional per-line fill colours (index-aligned to `lines`). A non-null entry
   * tints that line (channel-coloured R/G/B digits); `null`/`undefined` falls
   * back to the fixed {@link NEUTRAL_LABEL_COLOR}. All fills are fixed-intensity
   * (TEV convention); the constant dark shadow behind the glyphs — drawn the
   * same regardless of this — is what keeps them legible on any background.
   */
  colors?: (string | null)[];
}

/**
 * Build a {@link PixelSample} from one pixel's channel values, the ONE place the
 * "1 value = a single untinted line, N values = N CHANNEL_COLORS-tinted lines"
 * convention lives. Every pane sampler (CPU SDR/HDR, GPU compare u8/float/diff)
 * formats through here so int↔decimal + channel-tinting stay identical.
 *
 *  - `values.length === 1` → one line, no `colors` (fixed neutral fill).
 *  - otherwise → one line per value, each tinted by its `CHANNEL_COLORS` slot
 *    (RGBA uses the fourth, neutral-white alpha entry).
 */
export function buildChannelSample(
  values: number[],
  scale: PixelValueScale,
  notation: PixelValueNotation,
): PixelSample {
  if (values.length === 1) {
    return { lines: [formatChannelValue(values[0]!, scale, notation)] };
  }
  return {
    lines: values.map((v) => formatChannelValue(v, scale, notation)),
    colors: values.map((_, i) => CHANNEL_COLORS[i] ?? null),
  };
}

export type PixelSampler = (
  px: number,
  py: number,
  notation: PixelValueNotation,
) => PixelSample | null;

export interface PixelValueOverlayProps {
  /**
   * The pane's ONE measured viewport geometry (`useImageViewport`): the CSS box,
   * the device-pixel backing size, the natural source dims, and `quad` — the
   * image's pane-local on-screen rect under the current zoom/pan. Everything the
   * overlay draws is derived from this; it measures nothing itself, so its
   * numbers land on exactly the texels the pane painted.
   */
  viewport: ImageViewport;
  /** Per-pixel value accessor over the RAW source buffer. The current notation
   *  is passed so the sampler formats its lines consistently. */
  sample: PixelSampler;
  /** Notation for the printed values (`decimal` = 1.0 white / `int` = 255 white). */
  notation?: PixelValueNotation;
  /** Bump to force a redraw when the underlying source buffer changes. */
  version?: number;
  /** Called when the overlay's active state changes (true once zoomed in far
   *  enough that per-pixel numbers are being drawn). Lets the host show a
   *  notation toggle only while the numbers are visible. */
  onActiveChange?: (active: boolean) => void;
  /** Called once geometry is zoomed far enough to request samples, even when
   *  the sampler is not ready yet. Expensive asynchronous samplers use this to
   *  start lazy preparation without creating an active/readiness deadlock. */
  onSampleDemandChange?: (demanded: boolean) => void;
  /**
   * The SAMPLED source's own grid resolution, when it differs from the FRAMING
   * dims (`viewport.natural`). Default = the framing dims (the single-image pane
   * and the compare foreground/primary side — an isotropic, unchanged mapping).
   *
   * Needed by the compare split pane's NON-primary (reference) side: both
   * operands are drawn stretched into the SAME framing quad (the shader samples
   * each through one normalized uv window, scaled by its own
   * `textureDimensions`), so the reference side fills that quad with ITS OWN
   * texel count. Without this the reference numbers map through the primary's
   * grid — misplaced whenever the two resolutions differ, drifting further off
   * their pixels with texel index (worst at large resolution).
   */
  sourceDims?: { w: number; h: number };
}

export default function PixelValueOverlay({
  viewport,
  sample,
  notation = "decimal",
  version = 0,
  onActiveChange,
  onSampleDemandChange,
  sourceDims,
}: PixelValueOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(false);
  const sampleDemandRef = useRef(false);
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  const reportActive = useCallback((active: boolean) => {
    if (active === activeRef.current) return;
    activeRef.current = active;
    onActiveChangeRef.current?.(active);
  }, []);
  const onSampleDemandChangeRef = useRef(onSampleDemandChange);
  onSampleDemandChangeRef.current = onSampleDemandChange;
  const reportSampleDemand = useCallback((demanded: boolean) => {
    if (demanded === sampleDemandRef.current) return;
    sampleDemandRef.current = demanded;
    onSampleDemandChangeRef.current?.(demanded);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Sizing comes from the SHARED viewport, never from this canvas's own
    // measurement: `backing` is the device-pixel store, `box` the CSS box, and
    // the transform between them lets everything below draw in CSS px.
    const { box, backing } = viewport;
    if (box.width <= 0 || box.height <= 0) {
      reportSampleDemand(false);
      reportActive(false);
      return;
    }
    if (canvas.width !== backing.width) canvas.width = backing.width;
    if (canvas.height !== backing.height) canvas.height = backing.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(backing.width / box.width, 0, 0, backing.height / box.height, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    const cssW = box.width;
    const cssH = box.height;

    // The FRAMING QUAD is `viewport.quad` — the image's pane-local on-screen rect
    // under the current zoom/pan, already letterbox-fitted by the shared
    // geometry. `sourceDims` (default = the framing dims) is the SAMPLED source's
    // own grid spread across that quad (fill-stretch), which places a
    // mismatched-resolution compare side on ITS own texels — the split shader
    // draws both operands into one quad, each scaled by its own
    // `textureDimensions`.
    const gridW = sourceDims?.w ?? viewport.natural.w;
    const gridH = sourceDims?.h ?? viewport.natural.h;
    const quadLeft = viewport.quad.left;
    const quadTop = viewport.quad.top;
    const quadW = viewport.quad.width;
    const quadH = viewport.quad.height;
    const sxPerTexel = quadW / gridW;
    const syPerTexel = quadH / gridH;
    const visibleW = gridW;
    const visibleH = gridH;
    if (visibleW <= 0 || visibleH <= 0 || gridW <= 0 || gridH <= 0) {
      reportSampleDemand(false);
      reportActive(false);
      return;
    }

    // The SINGLE global visibility gate. Rectangular cells (mismatched aspect):
    // the TIGHTER axis governs legibility/containment; for square cells this is
    // exactly `scale`. It alone decides whether numbers appear — never any
    // string's width, never the channel count — so at a given zoom every cell in
    // view draws or none does (numbers pop in ALL AT ONCE). See
    // `pixelValueNumbersVisible`.
    const cellScale = Math.min(sxPerTexel, syPerTexel);
    if (!pixelValueNumbersVisible(cellScale)) {
      reportSampleDemand(false);
      reportActive(false); // below threshold: nothing drawn.
      return;
    }

    // Visible SAMPLED-texel window (clip the sampled grid to the canvas viewport).
    const x0 = Math.max(0, Math.floor((0 - quadLeft) / sxPerTexel));
    const x1 = Math.min(gridW, Math.ceil((cssW - quadLeft) / sxPerTexel));
    const y0 = Math.max(0, Math.floor((0 - quadTop) / syPerTexel));
    const y1 = Math.min(gridH, Math.ceil((cssH - quadTop) / syPerTexel));
    if (x1 <= x0 || y1 <= y0) {
      reportSampleDemand(false);
      reportActive(false);
      return;
    }
    // Geometry is eligible for numeric labels. Signal demand before reading any
    // samples: a lazy asynchronous source initially returns null and must be
    // allowed to prepare itself before a later version bump redraws the labels.
    reportSampleDemand(true);

    // Pass 1 — collect the visible samples and measure the frame's widest line
    // and tallest stack. The font size is derived from these (never from any one
    // cell's own string), so every number in the frame renders at the SAME size
    // yet the size is chosen so the LONGEST value still fits INSIDE its pixel —
    // no number spills across the pixel boundary onto its neighbours (the
    // alignment regression this restores). Samples are cached here so pass 2 does
    // not re-`sample()`; the window is bounded (each cell ≥ PIXEL_VALUE_MIN_SCREEN_PX
    // so a few hundred cells at most).
    const cells: { px: number; py: number; s: PixelSample }[] = [];
    let maxLineChars = 1;
    let maxLineCount = 1;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        if (px < 0 || py < 0 || px >= gridW || py >= gridH) continue;
        const s = sample(px, py, notation);
        if (!s || s.lines.length === 0) continue;
        if (s.lines.length > maxLineCount) maxLineCount = s.lines.length;
        for (const ln of s.lines) if (ln.length > maxLineChars) maxLineChars = ln.length;
        cells.push({ px, py, s });
      }
    }
    if (cells.length === 0) {
      reportActive(false);
      return;
    }

    // The ONE font height for the whole frame — sized to the widest value in
    // view (`maxLineChars`) so it is CONTAINED, and to the tallest stack
    // (`maxLineCount`) so an RGB triple fits vertically. Below the legibility
    // floor the numbers are too small to read: draw nothing (all-or-nothing,
    // matching the single visibility threshold — never a partial frame).
    const fontH = pixelValueFontHeight(cellScale, maxLineCount, maxLineChars);
    if (fontH < PIXEL_VALUE_MIN_FONT_PX) {
      reportActive(false);
      return;
    }
    reportActive(true); // zoomed in far enough — numbers are being drawn.

    // Q19: clip ALL drawing to the DISPLAYED IMAGE's own on-screen rect — the
    // FRAMING QUAD (where the full image renders; the sampled source fills the
    // SAME quad). The canvas covers the WHOLE viewport, which at low zoom is
    // bigger than the image — without this clip, a halo/shadow drawn near the
    // image border could bleed onto the checkerboard.
    // Bug 5: clip to the image rect EXPANDED by ~one font-height, NOT the exact
    // rect — a number centred on an EDGE/CORNER texel legitimately reaches the
    // image boundary (its outer half + drop shadow), and the tight clip truncated
    // it. The margin bounds any spill to under one cell (see `pixelValueClipRect`).
    const clip = pixelValueClipRect(
      {
        left: quadLeft,
        top: quadTop,
        right: quadLeft + quadW,
        bottom: quadTop + quadH,
      },
      fontH,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(clip.left, clip.top, clip.right - clip.left, clip.bottom - clip.top);
    ctx.clip();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Uniform for the whole frame (the size is fixed above), so the font and the
    // TEV convention's single CONSTANT soft dark shadow — fixed-intensity fills
    // over one dark drop shadow, no per-pixel colour flip / halo stroke — are
    // set ONCE, not per cell. The shadow scales with the glyph so it stays
    // proportional at any zoom; the bright fills read on dark pixels unaided and
    // this dark edge carries them on bright pixels.
    const lineH = fontH * PIXEL_VALUE_LINE_H_FRAC;
    ctx.font = `${fontH}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.shadowColor = LABEL_SHADOW_COLOR;
    ctx.shadowBlur = Math.max(2, fontH * LABEL_SHADOW_BLUR_FRAC);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, fontH * LABEL_SHADOW_OFFSET_FRAC);

    // Pass 2 — draw the cached samples, each centred on the pixel it describes
    // (`cx`/`cy` = the texel centre in canvas-local px, the same transform the
    // region marquee uses; see region-select.test.ts).
    for (const { px, py, s } of cells) {
      const lc = s.lines.length;
      const cx = quadLeft + (px + 0.5) * sxPerTexel;
      const cy = quadTop + (py + 0.5) * syPerTexel;
      let ly = cy - (lc * lineH) / 2 + lineH / 2;
      for (let k = 0; k < s.lines.length; k++) {
        const ln = s.lines[k]!;
        ctx.fillStyle = s.colors?.[k] ?? NEUTRAL_LABEL_COLOR;
        ctx.fillText(ln, cx, ly);
        ly += lineH;
      }
    }
    ctx.restore(); // matches the ctx.save()/clip() above.
  }, [
    viewport,
    sample,
    notation,
    reportActive,
    reportSampleDemand,
    sourceDims,
  ]);

  // Geometry must update in the same commit as the pane's own paint. A passive
  // effect paints one frame later, which makes labels visibly trail the texels
  // during a pan (often by about half a texel). Draw before paint. There is no
  // ResizeObserver here: `viewport` is a fresh object whenever the pane's box,
  // dpr, or view changes, so a new geometry IS the redraw trigger.
  useLayoutEffect(() => {
    draw();
  }, [draw, viewport, version, notation, sourceDims]);

  return (
    <canvas
      ref={canvasRef}
      data-pixel-value-overlay=""
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      // Structural, not cosmetic: the viewport element measures itself, so this
      // canvas must stay OUT of flow even on a page with no Tailwind.
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      aria-hidden
    />
  );
}

/**
 * A tiny toggle for the pixel-value notation. Controlled: the host owns the
 * `notation` state (seeded from a prop) so the overlay stays self-contained.
 * Render it only while the overlay is active (zoomed in) — the host tracks
 * that via `PixelValueOverlay`'s `onActiveChange`.
 */
export function PixelNotationToggle({
  notation,
  onChange,
  className = "",
}: {
  notation: PixelValueNotation;
  onChange: (n: PixelValueNotation) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(notation === "int" ? "decimal" : "int");
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`absolute top-1 right-1 z-20 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-mono text-fg-muted backdrop-blur-sm hover:text-fg ${className}`}
      title="Pixel-value notation: 0–255 integer (255 = white) vs 0–1 float (1.0 = white)"
    >
      {notation === "int" ? "0–255" : "0–1"}
    </button>
  );
}
