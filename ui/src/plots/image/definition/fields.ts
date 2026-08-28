export type ImageFieldDomain = "light" | "signed" | "nonnegative" | "unbounded";
export type ImageDisplayRange = "unit" | "signed" | "relative";
export type ImageFieldArity = number | "source";

/** Semantic output of an image operation. It deliberately contains no texture,
 * canvas, shader, precision, or backend allocation details. */
export interface ImageFieldSchema {
  readonly arity: ImageFieldArity;
  readonly domain: ImageFieldDomain;
}

export function resolveFieldArity(field: ImageFieldSchema, sourceArity: number): number {
  return field.arity === "source" ? sourceArity : field.arity;
}
