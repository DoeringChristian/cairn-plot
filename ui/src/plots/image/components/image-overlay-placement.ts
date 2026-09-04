import type { OverlayBox } from "../../types";
import type { ViewportQuad } from "./region-select.ts";

/** A detection box's pane-local rect (CSS px) on the current viewport quad. */
export function placeBox(
  box: OverlayBox,
  quad: ViewportQuad,
  natural: { w: number; h: number },
): { left: number; top: number; width: number; height: number } {
  const fx = box.domain === "pixel" ? quad.width / natural.w : quad.width;
  const fy = box.domain === "pixel" ? quad.height / natural.h : quad.height;
  const left = quad.left + box.position.minX * fx;
  const top = quad.top + box.position.minY * fy;
  return {
    left,
    top,
    width: (box.position.maxX - box.position.minX) * fx,
    height: (box.position.maxY - box.position.minY) * fy,
  };
}
