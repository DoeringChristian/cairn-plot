/** Parse Cairn-compatible image annotation metadata without host dependencies. */
import type { ImageOverlayData, OverlayMask } from "../../plots/types";

export function parseOverlay(
  raw: string | null | undefined,
): ImageOverlayData | null {
  if (!raw) return null;
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const boxes = Array.isArray(meta.boxes)
    ? (meta.boxes as ImageOverlayData["boxes"])
    : undefined;
  const masksObj =
    meta.masks && typeof meta.masks === "object"
      ? (meta.masks as Record<
          string,
          { png_b64: string; class_labels?: Record<string, string> }
        >)
      : undefined;
  const masks: OverlayMask[] | undefined = masksObj
    ? Object.entries(masksObj).map(([name, mask]) => ({
        name,
        png_b64: mask.png_b64,
        class_labels: mask.class_labels,
      }))
    : undefined;
  const class_labels =
    meta.class_labels && typeof meta.class_labels === "object"
      ? (meta.class_labels as Record<string, string>)
      : undefined;
  if (!boxes?.length && !masks?.length) return null;
  return { boxes, masks, class_labels };
}
