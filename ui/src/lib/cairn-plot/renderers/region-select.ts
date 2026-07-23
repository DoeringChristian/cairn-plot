/**
 * `renderers/region-select.ts` — the PURE screen→texel mapping behind the deep
 * pane's "select depth from region" marquee.
 *
 * This is the SAME object-contain letterbox math `primitives/PixelValueOverlay`
 * uses to place per-pixel numbers (image element's on-screen rect → source
 * texel), factored out so the region marquee and the overlay agree and so it can
 * be unit-tested without a DOM. Given the displayed image element's
 * `getBoundingClientRect()` box, the source dimensions, and the displayed
 * `[0,1]` crop window (the GPU pane's uvRect; the whole image otherwise), it maps
 * a client-space point to a (possibly fractional / out-of-range) source texel.
 */

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

/** The object-contain fit for a mapping: on-screen scale + image top-left. */
interface Fit {
  scale: number;
  imgLeft: number;
  imgTop: number;
  srcOriginX: number;
  srcOriginY: number;
}

function computeFit(p: ScreenToTexelParams): Fit {
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

const clampInt = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.floor(v)));

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
