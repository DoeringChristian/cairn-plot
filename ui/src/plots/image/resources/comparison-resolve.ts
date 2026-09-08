import type { DataSpec } from "../../../../../packages/spec/src/spec.ts";
import type { DataSource } from "../../../resources/data/data-source.ts";
import type { ImageSource } from "../definition/content.ts";
import type { ImageOverlayData } from "../../types.ts";
import { resolveImageData } from "./resolve-data.ts";

/** What ONE compare operand resolves to: the unified image source plus its
 *  overlay. There is no second resolver here — every operand goes through
 *  `resolveImageData`, the single image leaf resolver, so a `format`-tagged
 *  hash (`.npy`/`.exr`/…) decodes for a compare exactly as it does for a
 *  single-image leaf. */
interface ComparisonOperand {
  source: ImageSource | null;
  overlay?: ImageOverlayData;
}

async function resolveOperandSource(
  data: DataSpec,
  source: DataSource,
): Promise<ComparisonOperand> {
  if (data.kind !== "image" && data.kind !== "url" && data.kind !== "imghdr") {
    return { source: null };
  }
  const resolved = await resolveImageData(data, source);
  const imageSource = (resolved.source ?? null) as ImageSource | null;
  // A uint8 source that resolved to no URL is "nothing", not an image.
  if (imageSource && imageSource.dtype === "uint8" && !imageSource.url) {
    return { source: null, overlay: resolved.overlay as ImageOverlayData | undefined };
  }
  return { source: imageSource, overlay: resolved.overlay as ImageOverlayData | undefined };
}

function contentKey(operand: ComparisonOperand, fallback: string): string {
  return operand.source?.contentKey ?? fallback;
}

/** Resolve ordered image operands into the unified retained image presentation. */
export async function resolveImageComparisonPair(
  reference: DataSpec,
  foreground: DataSpec,
  source: DataSource,
): Promise<Record<string, unknown>> {
  const [referenceOperand, foregroundOperand] = await Promise.all([
    resolveOperandSource(reference, source),
    resolveOperandSource(foreground, source),
  ]);
  const primary = referenceOperand.source;
  const secondary = foregroundOperand.source;
  if (!primary) throw new Error("compare reference did not resolve to an image source");
  if (!secondary) throw new Error("compare foreground did not resolve to an image source");
  return {
    source: primary,
    __diffB: secondary,
    __diffContentKeyA: contentKey(referenceOperand, "diff:a"),
    __diffContentKeyB: contentKey(foregroundOperand, "diff:b"),
    __diffOverlay: foregroundOperand.overlay,
  };
}
