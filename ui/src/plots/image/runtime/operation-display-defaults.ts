import type { PlotSettings } from "../../../settings/schema.ts";
import { getImageOperation } from "../definition/image-operations.ts";
import { resolveComparisonOperationId, type FlipMode } from "../definition/comparison-operations.ts";
import { resolveDisplayOperator } from "./tonemap.ts";

export interface RecommendedImageEncodingOptions {
  operation?: string;
  authoredSourceEncoding?: string | null;
  flipMode?: FlipMode;
}

/** Concrete display default for one source/comparison operation. */
export function recommendedImageEncoding({
  operation,
  authoredSourceEncoding,
  flipMode = "sdr",
}: RecommendedImageEncodingOptions): string {
  const sourceDefault = authoredSourceEncoding ?? resolveDisplayOperator(undefined);
  if (!operation || operation === "split") return sourceDefault;
  const definition = getImageOperation(
    resolveComparisonOperationId(operation, flipMode),
  ) ?? getImageOperation(operation);
  return definition?.defaultDisplayOperation ?? sourceDefault;
}

export interface ComparisonOperationSettingsPatchOptions {
  previousOperation?: string;
  nextOperation: string;
  currentEncoding?: string;
  authoredSourceEncoding?: string | null;
  flipMode?: FlipMode;
}

/**
 * Change comparison content and its default presentation atomically. A display
 * value that differs from the previous recommendation is treated as a user
 * customization and preserved.
 */
export function comparisonOperationSettingsPatch({
  previousOperation,
  nextOperation,
  currentEncoding,
  authoredSourceEncoding,
  flipMode = "sdr",
}: ComparisonOperationSettingsPatchOptions): Pick<PlotSettings, "compare.operation" | "image.encoding"> {
  const previousEncoding = recommendedImageEncoding({
    operation: previousOperation,
    authoredSourceEncoding,
    flipMode,
  });
  const nextEncoding = recommendedImageEncoding({
    operation: nextOperation,
    authoredSourceEncoding,
    flipMode,
  });
  return {
    "compare.operation": nextOperation,
    "image.encoding": currentEncoding == null || currentEncoding === previousEncoding
      ? nextEncoding
      : currentEncoding,
  };
}
