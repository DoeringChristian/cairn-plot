import type { PlotSettings } from "../../../settings/schema.ts";
import { getImageOperation } from "../definition/image-operations.ts";
import type { ImageFieldSchema } from "../definition/fields.ts";
import { resolveComparisonOperationId, type FlipMode } from "../definition/comparison-operations.ts";
import { DEFAULT_COMPARISON_DISPLAY_OPERATION_ID } from "./display-settings.ts";
import { resolveDisplayOperator } from "./tonemap.ts";

export interface RecommendedImageEncodingOptions {
  operation?: string;
  field?: ImageFieldSchema;
  authoredSourceEncoding?: string | null;
  flipMode?: FlipMode;
}

/** Concrete display default for one source/comparison operation. */
export function recommendedImageEncoding({
  operation,
  field,
  authoredSourceEncoding,
  flipMode = "sdr",
}: RecommendedImageEncodingOptions): string {
  const sourceDefault = authoredSourceEncoding ?? resolveDisplayOperator(undefined);
  if (!operation || operation === "split") return sourceDefault;
  const resolvedField = field ?? getImageOperation(
    resolveComparisonOperationId(operation, flipMode),
  )?.output ?? getImageOperation(operation)?.output;
  switch (resolvedField?.domain) {
    case "signed":
      return "red-blue";
    case "nonnegative":
    case "unbounded":
      return "magma";
    case "light":
    default:
      return operation ? DEFAULT_COMPARISON_DISPLAY_OPERATION_ID : sourceDefault;
  }
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
