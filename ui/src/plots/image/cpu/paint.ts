/**
 * `cpu/paint.ts` — the CPU backend's ONE presentation paint.
 *
 * Every CPU image (plain, transfer, false-color, diff, tone-mapped HDR) becomes
 * an `ImageBitmap` once per content version; putting it on screen at the current
 * zoom/pan is this pure-ish pass: an identity-transform `drawImage` from a
 * source rect on INTEGER texels into a destination rect in DEVICE pixels,
 * derived entirely from the shared `ImageViewport` (spec §3.4). No CSS
 * transform, no `image-rendering`, no `object-fit` — the geometry is the one the
 * overlays read, so numbers and pixels can never disagree.
 *
 * Why the source rect is clipped: at deep zoom the full-image destination quad
 * is tens of millions of CSS px wide, and Skia's destination rects are float32 —
 * a whole-image `drawImage` there drifts visibly (and rasterizes an enormous
 * rect). Clipping the source to the texels the box actually shows keeps both
 * rects small, and because the clip is on integer texel boundaries the mapping
 * stays exact.
 */
import type { ImageViewport } from "../components/image-viewport.ts";
import type { ViewportQuad } from "../components/region-select.ts";

/** A ready-to-blit CPU frame: the decoded/processed bitmap plus its grid. */
export interface PaintSource {
  bitmap: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * The integer texel window of `grid` that intersects `box`, when the FULL image
 * occupies `quad` (pane-local CSS px). Half-open (`x1`/`y1` exclusive). Null
 * when the quad lies entirely outside the box (nothing to draw).
 */
export function visibleTexelWindow(
  quad: ViewportQuad,
  box: { width: number; height: number },
  grid: { w: number; h: number },
): { x0: number; y0: number; x1: number; y1: number } | null {
  if (grid.w <= 0 || grid.h <= 0 || quad.width <= 0 || quad.height <= 0) return null;
  const sx = quad.width / grid.w;
  const sy = quad.height / grid.h;
  const x0 = Math.max(0, Math.floor(-quad.left / sx));
  const y0 = Math.max(0, Math.floor(-quad.top / sy));
  const x1 = Math.min(grid.w, Math.ceil((box.width - quad.left) / sx));
  const y1 = Math.min(grid.h, Math.ceil((box.height - quad.top) / sy));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Paint `source` into a presentation canvas whose backing store is
 * `viewport.backing` device px. The destination is computed in doubles from the
 * viewport quad and scaled to device px; the source rect rides the integer texel
 * window above.
 *
 * `grid` lets a foreground of a DIFFERENT resolution fill the same (reference)
 * quad with its own texel count — the compare split's framing, matching the GPU
 * compositor. `clipFraction` restricts the paint to a horizontal band of the box
 * (the split's two halves). `clear: false` composites over what is already
 * there (the split's second pass).
 */
export function paintViewport(
  ctx: CanvasRenderingContext2D,
  viewport: ImageViewport,
  source: PaintSource,
  opts: { clipFraction?: [number, number]; grid?: { w: number; h: number }; clear?: boolean } = {},
): void {
  const { quad, box, backing, filter } = viewport;
  const grid = opts.grid ?? { w: source.width, h: source.height };
  const sx = backing.width / box.width;
  const sy = backing.height / box.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.clear !== false) ctx.clearRect(0, 0, backing.width, backing.height);
  const win = visibleTexelWindow(quad, box, grid);
  if (!win) return;
  // Magnification filter comes from the ONE shared rule (`magnificationFilter`),
  // so the CPU canvas switches to nearest at exactly the zoom the GPU sampler
  // does — and at which the per-texel numbers appear.
  ctx.imageSmoothingEnabled = filter === "linear";
  ctx.imageSmoothingQuality = "high";
  const tx = quad.width / grid.w;
  const ty = quad.height / grid.h;
  ctx.save();
  if (opts.clipFraction) {
    const [a, b] = opts.clipFraction;
    ctx.beginPath();
    ctx.rect(a * backing.width, 0, (b - a) * backing.width, backing.height);
    ctx.clip();
  }
  ctx.drawImage(
    source.bitmap,
    win.x0,
    win.y0,
    win.x1 - win.x0,
    win.y1 - win.y0,
    (quad.left + win.x0 * tx) * sx,
    (quad.top + win.y0 * ty) * sy,
    (win.x1 - win.x0) * tx * sx,
    (win.y1 - win.y0) * ty * sy,
  );
  ctx.restore();
}
