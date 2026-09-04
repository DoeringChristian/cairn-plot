import type { ImageFieldSchema } from "./fields.ts";

export type ImageOperationCachePolicy = "never" | "global-lru";
export type ImageOperationParameter =
  | "split"
  | "ppd"
  | "exposure-min"
  | "exposure-max";

export interface ImageOperationDefinition {
  readonly id: string;
  readonly label: string;
  readonly publicName?: string;
  readonly inputs: 1 | 2;
  readonly output: ImageFieldSchema;
  /** Settings-layer recommendation; backends only consume concrete encoding. */
  readonly defaultDisplayOperation?: string;
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
  defaultDisplayOperation: domain === "signed" ? "red-green" : "magma",
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
  { id: "flip", label: "FLIP", publicName: "flip", inputs: 2, output: { arity: 1, domain: "nonnegative" }, defaultDisplayOperation: "magma", cache: "global-lru", parameters: ["ppd"] },
  { id: "flip-hdr", label: "HDR-FLIP", publicName: "flip_hdr", inputs: 2, output: { arity: 1, domain: "nonnegative" }, defaultDisplayOperation: "magma", cache: "global-lru", parameters: ["ppd", "exposure-min", "exposure-max"] },
  { id: "ssim", label: "SSIM", publicName: "ssim", inputs: 2, output: { arity: 1, domain: "nonnegative" }, defaultDisplayOperation: "magma", cache: "global-lru", parameters: [] },
];

/** Every public image-operation id; backends declare their capabilities from this. */
export const IMAGE_OPERATION_IDS: readonly string[] = IMAGE_OPERATIONS.map((operation) => operation.id);

const operations = new Map(IMAGE_OPERATIONS.map((operation) => [operation.id, operation]));

export function getImageOperation(id: string | null | undefined): ImageOperationDefinition | undefined {
  return id ? operations.get(id) : undefined;
}

export function listImageOperations(): readonly ImageOperationDefinition[] {
  return IMAGE_OPERATIONS;
}

/**
 * The flat PUBLIC compare-mode names (`cp.Compare(mode=)`), pinned to
 * `schema/cairn-plot-contracts.json` by `testing/contracts.test.ts` and
 * mirrored by Python `_COMPARE_OPERATION_MODES`.
 */
export function listComparisonOperationPublicNames(): string[] {
  return IMAGE_OPERATIONS
    .filter((operation) => operation.inputs === 2 && operation.id !== "split" && !!operation.publicName)
    .map((operation) => operation.publicName!);
}

/** Lower an authored public name (`abs`, `flip_hdr`, …) to its registry id. */
export function operationIdForPublicName(publicName: string): string | undefined {
  return IMAGE_OPERATIONS.find((operation) => operation.publicName === publicName)?.id;
}
