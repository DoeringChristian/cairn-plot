import type { ImageOperationDefinition } from "./image-operations.ts";

export type ImageComparisonStrategy = "reference";
export type ImageComparisonPresentation = "split" | "difference";

export interface ImageComparisonDefinition {
  readonly strategy: ImageComparisonStrategy;
  readonly presentations: readonly ImageComparisonPresentation[];
  readonly operations: readonly ImageOperationDefinition[];
}
