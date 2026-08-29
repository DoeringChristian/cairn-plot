import type { ImageFieldSchema } from "./fields.ts";

export type ImageOperationCachePolicy = "never" | "global-lru";
export type ImageOperationParameter =
  | "split"
  | "ppd"
  | "flip-mode"
  | "max-exposures"
  | "exposure-min"
  | "exposure-max";

export interface ImageOperationDefinition {
  readonly id: string;
  readonly label: string;
  readonly publicName?: string;
  readonly inputs: 1 | 2;
  readonly output: ImageFieldSchema;
  readonly cache: ImageOperationCachePolicy;
  readonly parameters: readonly ImageOperationParameter[];
}

const pointwise = (
  id: string,
  label: string,
  publicName: string,
  domain: "signed" | "nonnegative",
): ImageOperationDefinition => ({
  id, label, publicName, inputs: 2,
  output: { arity: "source", domain },
  cache: "never",
  parameters: [],
});

export const IMAGE_OPERATIONS: readonly ImageOperationDefinition[] = [
  { id: "identity", label: "Identity", inputs: 1, output: { arity: "source", domain: "light" }, cache: "never", parameters: [] },
  pointwise("absolute", "Absolute Error", "abs", "nonnegative"),
  pointwise("signed", "Signed Error", "signed", "signed"),
  pointwise("squared", "Squared Error", "square", "nonnegative"),
  pointwise("relative_absolute", "Relative Absolute", "rel_abs", "nonnegative"),
  pointwise("relative_signed", "Relative Signed", "rel_signed", "signed"),
  pointwise("relative_squared", "Relative Squared", "rel_square", "nonnegative"),
  { id: "split", label: "Split", inputs: 2, output: { arity: 3, domain: "light" }, cache: "never", parameters: ["split"] },
  { id: "flip", label: "FLIP", publicName: "flip", inputs: 2, output: { arity: 1, domain: "nonnegative" }, cache: "global-lru", parameters: ["ppd", "flip-mode", "max-exposures"] },
  { id: "hdr-flip", label: "HDR-FLIP", inputs: 2, output: { arity: 1, domain: "nonnegative" }, cache: "global-lru", parameters: ["ppd", "exposure-min", "exposure-max"] },
  { id: "flip-sdr", label: "FLIP SDR implementation", inputs: 2, output: { arity: 1, domain: "nonnegative" }, cache: "global-lru", parameters: ["ppd"] },
  { id: "ssim", label: "SSIM", publicName: "ssim", inputs: 2, output: { arity: 1, domain: "nonnegative" }, cache: "global-lru", parameters: [] },
];

const operations = new Map(IMAGE_OPERATIONS.map((operation) => [operation.id, operation]));

export function getImageOperation(id: string | null | undefined): ImageOperationDefinition | undefined {
  return id ? operations.get(id) : undefined;
}

export function listImageOperations(): readonly ImageOperationDefinition[] {
  return IMAGE_OPERATIONS;
}
