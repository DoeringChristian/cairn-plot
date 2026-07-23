/**
 * `renderers/region-edit.ts` — the PURE geometry behind editing the persistent
 * deep region rectangle (move + resize, and screen-space handle hit-testing).
 *
 * The rect lives in IMAGE-TEXEL space (so it stays glued to the same pixels
 * across zoom/pan — see `region-select.ts`'s `texelRectToScreenRect`). Edits
 * apply texel-space deltas (a screen drag divided by the object-contain scale)
 * and clamp to the image bounds + a minimum size. Hit-testing is done in
 * SCREEN space (the handles are a fixed pixel size). Both are DOM-free and
 * unit-tested.
 */
import type { TexelRect } from "./region-select";

/** Which part of the rect a pointer grabbed. `move` = the interior. */
export type RegionHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "move";

/** All eight resize handles, in render order. */
export const RESIZE_HANDLES: readonly Exclude<RegionHandle, "move">[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Apply a texel-space edit to `rect`. `handle:"move"` translates (size
 * preserved, clamped so it stays fully inside the image); a resize handle moves
 * the touched edge(s), clamped to the image bounds and a minimum inclusive size
 * of `minSize` texels. `dx`/`dy` are texel deltas (rounded here). Returns a NEW
 * inclusive integer rect (`x0≤x1`, `y0≤y1`).
 */
export function applyRectEdit(
  rect: TexelRect,
  handle: RegionHandle,
  dx: number,
  dy: number,
  bounds: { w: number; h: number },
  minSize = 1,
): TexelRect {
  const maxX = bounds.w - 1;
  const maxY = bounds.h - 1;
  const idx = Math.round(dx);
  const idy = Math.round(dy);

  if (handle === "move") {
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    const x0 = clamp(rect.x0 + idx, 0, maxX - w);
    const y0 = clamp(rect.y0 + idy, 0, maxY - h);
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  }

  let { x0, y0, x1, y1 } = rect;
  const west = handle === "nw" || handle === "w" || handle === "sw";
  const east = handle === "ne" || handle === "e" || handle === "se";
  const north = handle === "nw" || handle === "n" || handle === "ne";
  const south = handle === "sw" || handle === "s" || handle === "se";

  // Move the touched edge, clamped to the image and keeping ≥ minSize (the
  // OPPOSITE edge is the pivot).
  if (west) x0 = clamp(x0 + idx, 0, x1 - (minSize - 1));
  if (east) x1 = clamp(x1 + idx, x0 + (minSize - 1), maxX);
  if (north) y0 = clamp(y0 + idy, 0, y1 - (minSize - 1));
  if (south) y1 = clamp(y1 + idy, y0 + (minSize - 1), maxY);
  return { x0, y0, x1, y1 };
}

/** A screen-space box (client px). */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Screen-space hit test against the rect's edges/corners and interior. `pad` is
 * the half-size (px) of a handle's hit area (coarse pointers pass a larger
 * value); a point within `pad` of a corner grabs that corner, within `pad` of an
 * edge grabs that edge, else inside the box → `move`, else `null`. Corners win
 * over edges. Works even for a small/inverted box.
 */
export function hitTestRect(box: ScreenBox, px: number, py: number, pad: number): RegionHandle | null {
  const { left, top, width, height } = box;
  const right = left + width;
  const bottom = top + height;
  // Outside the padded bounds entirely → miss.
  if (px < left - pad || px > right + pad || py < top - pad || py > bottom + pad) return null;
  const nearL = Math.abs(px - left) <= pad;
  const nearR = Math.abs(px - right) <= pad;
  const nearT = Math.abs(py - top) <= pad;
  const nearB = Math.abs(py - bottom) <= pad;
  // Corners first.
  if (nearT && nearL) return "nw";
  if (nearT && nearR) return "ne";
  if (nearB && nearL) return "sw";
  if (nearB && nearR) return "se";
  // Edges (must be within the perpendicular span).
  const inX = px >= left - pad && px <= right + pad;
  const inY = py >= top - pad && py <= bottom + pad;
  if (nearT && inX) return "n";
  if (nearB && inX) return "s";
  if (nearL && inY) return "w";
  if (nearR && inY) return "e";
  // Interior.
  if (px >= left && px <= right && py >= top && py <= bottom) return "move";
  return null;
}
