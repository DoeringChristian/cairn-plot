import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
import type { Interpolation } from "../../types";
import { PIXEL_VALUE_MIN_SCREEN_PX } from "../../../primitives/components/pixel-value-size.ts";
import {
  magnificationFilter,
  screenPxPerTexel,
  viewToQuad,
  viewToUvRect,
  type MagnificationFilter,
  type SourceWindow,
  type ViewportQuad,
} from "./region-select.ts";

/** One pane's measured viewport plus everything derived from it. Immutable;
 *  a new object is produced only when an input changes. */
export interface ImageViewport {
  readonly box: { readonly width: number; readonly height: number };
  readonly backing: { readonly width: number; readonly height: number };
  readonly dpr: number;
  readonly natural: { readonly w: number; readonly h: number };
  readonly uv: SourceWindow;
  readonly quad: ViewportQuad;
  readonly pxPerTexel: number;
  readonly filter: MagnificationFilter;
}

export const MAX_BACKING_AXIS = 16384;
export const MAX_BACKING_AREA = 2 ** 28;

/** Clamp a device-pixel backing size to what a 2D canvas can allocate. */
export function clampBacking(w: number, h: number): { width: number; height: number } {
  let width = Math.max(1, Math.min(MAX_BACKING_AXIS, Math.round(w)));
  let height = Math.max(1, Math.min(MAX_BACKING_AXIS, Math.round(h)));
  if (width * height > MAX_BACKING_AREA) {
    const s = Math.sqrt(MAX_BACKING_AREA / (width * height));
    width = Math.max(1, Math.floor(width * s));
    height = Math.max(1, Math.floor(height * s));
  }
  return { width, height };
}

export function deriveImageViewport(input: {
  box: { width: number; height: number };
  backing: { width: number; height: number };
  view: ImageViewState;
  natural: { w: number; h: number } | null;
  interpolation: Interpolation;
}): ImageViewport | null {
  const { box, view, natural, interpolation } = input;
  if (!natural || box.width <= 0 || box.height <= 0) return null;
  const quad = viewToQuad(view, box, natural.w, natural.h);
  if (!quad) return null;
  const backing = clampBacking(input.backing.width, input.backing.height);
  const uv = viewToUvRect(view, box, natural.w, natural.h);
  const pxPerTexel = screenPxPerTexel(uv, box, natural.w, natural.h);
  return Object.freeze({
    box: Object.freeze({ width: box.width, height: box.height }),
    backing: Object.freeze(backing),
    dpr: backing.width / box.width,
    natural: Object.freeze({ w: natural.w, h: natural.h }),
    uv: Object.freeze(uv),
    quad: Object.freeze(quad),
    pxPerTexel,
    filter: magnificationFilter(interpolation, pxPerTexel, PIXEL_VALUE_MIN_SCREEN_PX),
  });
}
