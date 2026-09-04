import type { PlotSettings } from "../../../settings/schema.ts";
import { getImageOperation } from "../definition/image-operations.ts";
import { resolveDisplayOperator } from "./tonemap.ts";

export interface RecommendedImageEncodingOptions {
  operation?: string;
  authoredSourceEncoding?: string | null;
}

/** Concrete display default for one source/comparison operation. */
export function recommendedImageEncoding({
  operation,
  authoredSourceEncoding,
}: RecommendedImageEncodingOptions): string {
  const sourceDefault = authoredSourceEncoding ?? resolveDisplayOperator(undefined);
  if (!operation || operation === "split") return sourceDefault;
  return getImageOperation(operation)?.defaultDisplayOperation ?? sourceDefault;
}

export interface ComparisonOperationSettingsPatchOptions {
  previousOperation?: string;
  nextOperation: string;
  currentEncoding?: string;
  authoredSourceEncoding?: string | null;
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
}: ComparisonOperationSettingsPatchOptions): Pick<PlotSettings, "compare.operation" | "image.encoding"> {
  const previousEncoding = recommendedImageEncoding({
    operation: previousOperation,
    authoredSourceEncoding,
  });
  const nextEncoding = recommendedImageEncoding({
    operation: nextOperation,
    authoredSourceEncoding,
  });
  return {
    "compare.operation": nextOperation,
    "image.encoding": currentEncoding == null || currentEncoding === previousEncoding
      ? nextEncoding
      : currentEncoding,
  };
}
