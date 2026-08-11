/**
 * `renderers/region-select.ts` — the PURE screen→texel mapping behind the deep
 * pane's "select depth from region" marquee.
 *
 * This is the SAME object-contain letterbox math `primitives/PixelValueOverlay`
 * uses to place per-pixel numbers (image element's on-screen rect → source
 * texel): the overlay derives its screen↔texel mapping from {@link computeFit}
 * here (see its `draw()`), so the region marquee and the overlay provably
 * agree, and so it can be unit-tested without a DOM. Given the displayed image
 * element's
 * `getBoundingClientRect()` box, the source dimensions, and the displayed
 * `[0,1]` crop window (the GPU pane's uvRect; the whole image otherwise), it maps
 * a client-space point to a (possibly fractional / out-of-range) source texel.
 */
import { clampInt } from "../util/clamp.ts";

/** The displayed [0,1] crop of the source that fills `box` (GPU uvRect). */
export interface SourceWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_WINDOW: SourceWindow = { x: 0, y: 0, w: 1, h: 1 };

export interface ScreenToTexelParams {
  /** `getBoundingClientRect()` of the displayed image element (client space). */
  box: { left: number; top: number; width: number; height: number };
  naturalWidth: number;
  naturalHeight: number;
  /** Displayed crop window (default: the whole image). */
  sourceWindow?: SourceWindow;
}

/** Integer, image-clamped texel rect. */
export interface TexelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The object-contain fit for a mapping: on-screen scale, the displayed image's
 * top-left in CLIENT space, the source-texel origin of the displayed crop, and
 * the crop's size in source texels. `PixelValueOverlay` consumes this directly
 * (translating `imgLeft/imgTop` into its own canvas-local space) so its
 * screen↔texel math is literally the region marquee's.
 */
export interface Fit {
  scale: number;
  imgLeft: number;
  imgTop: number;
  srcOriginX: number;
  srcOriginY: number;
  /** Displayed crop size in source texels (`sourceWindow.w/h * natural…`). */
  visibleW: number;
  visibleH: number;
}

/** The object-contain fit of `sourceWindow` into `box` — the shared primitive
 *  behind every screen↔texel mapping here and in the pixel-value overlay. */
export function computeFit(p: ScreenToTexelParams): Fit {
  const sw = p.sourceWindow ?? FULL_WINDOW;
  const srcOriginX = sw.x * p.naturalWidth;
  const srcOriginY = sw.y * p.naturalHeight;
  const visibleW = sw.w * p.naturalWidth;
  const visibleH = sw.h * p.naturalHeight;
  const scale = Math.min(p.box.width / visibleW, p.box.height / visibleH);
  const dispW = visibleW * scale;
  const dispH = visibleH * scale;
  return {
    scale,
    imgLeft: p.box.left + (p.box.width - dispW) / 2,
    imgTop: p.box.top + (p.box.height - dispH) / 2,
    srcOriginX,
    srcOriginY,
    visibleW,
    visibleH,
  };
}

/** On-screen pixels per source texel (object-contain scale). */
export function screenPerTexel(p: ScreenToTexelParams): number {
  return computeFit(p).scale;
}

/**
 * Map a client-space point to a source texel (fractional; may fall outside
 * `[0,naturalWidth) × [0,naturalHeight)` when the point is off the image). Mirrors
 * `PixelValueOverlay`'s `srcOrigin + (client - imgTopLeft) / scale`.
 */
export function screenToTexel(
  clientX: number,
  clientY: number,
  p: ScreenToTexelParams,
): { x: number; y: number } {
  const f = computeFit(p);
  return {
    x: f.srcOriginX + (clientX - f.imgLeft) / f.scale,
    y: f.srcOriginY + (clientY - f.imgTop) / f.scale,
  };
}

/** Inverse of {@link screenToTexel}: a source texel → its client-space point. */
export function texelToScreen(tx: number, ty: number, p: ScreenToTexelParams): { x: number; y: number } {
  const f = computeFit(p);
  return {
    x: f.imgLeft + (tx - f.srcOriginX) * f.scale,
    y: f.imgTop + (ty - f.srcOriginY) * f.scale,
  };
}

/**
 * The fill-stretch placement of a SAMPLED source of `sourceDims` inside the
 * framing quad that {@link computeFit} establishes for `p` — the shared math the
 * TEV overlay uses to place per-texel numbers when the sampled source's
 * resolution differs from the FRAMING dims (`p.naturalWidth/Height`).
 *
 * The framing quad (the on-screen rect where the full framing image renders,
 * letterbox + zoom/pan baked into `p.box`/`p.sourceWindow`) is ONE object-contain
 * fit. WITHIN that quad, whichever source is sampled is spread across its OWN
 * `sourceDims.w × sourceDims.h` grid: the compare split/blend shader samples both
 * operands through ONE normalized uv window, each scaled by its own
 * `textureDimensions`, so a mismatched-resolution side fills the SAME quad with
 * its own texel count (and its cells go rectangular when the two aspects differ).
 *
 * When `sourceDims` is omitted or equals the framing dims (the single-image pane
 * and the compare foreground/primary side) this collapses EXACTLY to the
 * isotropic {@link computeFit}/{@link texelToScreen} mapping — `sxPerTexel ===
 * syPerTexel === scale`, and {@link sourceTexelCenter} equals the overlay's
 * historical `imgLeft + (px - srcOriginX + 0.5) * scale`.
 */
export interface SourceFit {
  /** Framing px per FRAMING texel (isotropic) — drives the letterbox/quad. */
  scale: number;
  /** Framing-quad top-left in `p.box`'s client space. */
  quadLeft: number;
  quadTop: number;
  /** On-screen size of the FULL framing image (the quad extent). */
  quadW: number;
  quadH: number;
  /** Screen px per SAMPLED-source texel (per axis; equal iff aspects match). */
  sxPerTexel: number;
  syPerTexel: number;
  /** The sampled source's grid resolution (== framing dims when unspecified). */
  gridW: number;
  gridH: number;
  /** Framing crop size in framing texels (`computeFit`'s `visibleW/H`). */
  visibleW: number;
  visibleH: number;
}

/** Fill-stretch fit of `sourceDims` into `computeFit(p)`'s framing quad. See
 *  {@link SourceFit}. `sourceDims` defaults to the framing dims (identity). */
export function computeSourceFit(
  p: ScreenToTexelParams,
  sourceDims?: { w: number; h: number },
): SourceFit {
  const f = computeFit(p);
  const gridW = sourceDims?.w ?? p.naturalWidth;
  const gridH = sourceDims?.h ?? p.naturalHeight;
  // The framing quad, expressed as its top-left + on-screen extent. `srcOriginX`
  // is the crop origin in framing texels, so `imgLeft - srcOriginX*scale` is
  // where framing texel 0 sits (== the full image's left edge on screen).
  const quadLeft = f.imgLeft - f.srcOriginX * f.scale;
  const quadTop = f.imgTop - f.srcOriginY * f.scale;
  const quadW = p.naturalWidth * f.scale;
  const quadH = p.naturalHeight * f.scale;
  return {
    scale: f.scale,
    quadLeft,
    quadTop,
    quadW,
    quadH,
    sxPerTexel: gridW > 0 ? quadW / gridW : f.scale,
    syPerTexel: gridH > 0 ? quadH / gridH : f.scale,
    gridW,
    gridH,
    visibleW: f.visibleW,
    visibleH: f.visibleH,
  };
}

/**
 * A sampled-source texel's CENTER → its client-space screen point, under the
 * fill-stretch model (generalizes the overlay's `imgLeft + (px - srcOriginX +
 * 0.5) * scale` to a source whose resolution differs from the framing dims).
 * `px`/`py` are integer texel indices; `sourceDims` defaults to the framing dims.
 */
export function sourceTexelCenter(
  px: number,
  py: number,
  p: ScreenToTexelParams,
  sourceDims?: { w: number; h: number },
): { x: number; y: number } {
  const sf = computeSourceFit(p, sourceDims);
  return {
    x: sf.quadLeft + (px + 0.5) * sf.sxPerTexel,
    y: sf.quadTop + (py + 0.5) * sf.syPerTexel,
  };
}

/**
 * Map an INCLUSIVE integer texel rect to its client-space screen box. Texel
 * `x0..x1` covers pixel centers, so the drawn box spans `[x0, x1+1)` texels
 * (the full pixels), giving a rect that stays glued to the image region under
 * any zoom/pan (the mapping already encodes the live viewport via `box`).
 */
export function texelRectToScreenRect(
  rect: TexelRect,
  p: ScreenToTexelParams,
): { left: number; top: number; width: number; height: number } {
  const a = texelToScreen(rect.x0, rect.y0, p);
  const b = texelToScreen(rect.x1 + 1, rect.y1 + 1, p);
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}

/**
 * Map two client-space corner points to an integer, image-clamped texel rect
 * (`x0≤x1`, `y0≤y1`, inclusive). Returns `null` when the rect lies entirely
 * outside the image (nothing to query).
 */
export function screenRectToTexelRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  p: ScreenToTexelParams,
): TexelRect | null {
  const a = screenToTexel(ax, ay, p);
  const b = screenToTexel(bx, by, p);
  const maxX = p.naturalWidth - 1;
  const maxY = p.naturalHeight - 1;
  const loX = Math.min(a.x, b.x);
  const hiX = Math.max(a.x, b.x);
  const loY = Math.min(a.y, b.y);
  const hiY = Math.max(a.y, b.y);
  // Fully outside the image on any axis → no region.
  if (hiX < 0 || loX > maxX || hiY < 0 || loY > maxY) return null;
  return {
    x0: clampInt(loX, 0, maxX),
    y0: clampInt(loY, 0, maxY),
    x1: clampInt(hiX, 0, maxX),
    y1: clampInt(hiY, 0, maxY),
  };
}
