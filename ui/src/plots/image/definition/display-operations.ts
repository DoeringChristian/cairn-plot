export type DisplayOperationCategory = "curve" | "colormap" | "remap";
export type DisplayParameter = "exposure" | "offset" | "peak" | "gamma" | "min" | "max" | "reduce";
export type ReduceMode = "luminance" | "mean";

export interface DisplayOperationDefinition {
  readonly id: string;
  readonly label: string;
  readonly category: DisplayOperationCategory;
  readonly arities: readonly number[];
  readonly parameters: readonly DisplayParameter[];
  readonly defaultReduce?: ReduceMode;
}

const curveArities = [1, 2, 3, 4] as const;
export const DISPLAY_OPERATIONS: readonly DisplayOperationDefinition[] = [
  { id: "linear", label: "Linear", category: "curve", arities: curveArities, parameters: ["exposure", "offset", "peak"] },
  { id: "srgb", label: "sRGB", category: "curve", arities: curveArities, parameters: ["exposure", "offset", "peak"] },
  { id: "gamma", label: "Gamma", category: "curve", arities: curveArities, parameters: ["exposure", "offset", "gamma", "peak"] },
  { id: "reinhard", label: "Reinhard", category: "curve", arities: curveArities, parameters: ["exposure", "offset", "peak"] },
  { id: "aces", label: "ACES", category: "curve", arities: curveArities, parameters: ["exposure", "offset", "peak"] },
  { id: "normal", label: "Normal map", category: "remap", arities: [3], parameters: [] },
  { id: "turbo", label: "Turbo", category: "colormap", arities: curveArities, parameters: ["exposure", "offset", "reduce"], defaultReduce: "mean" },
  { id: "plasma", label: "Plasma", category: "colormap", arities: curveArities, parameters: ["exposure", "offset", "min", "max", "reduce"] },
  { id: "magma", label: "Magma", category: "colormap", arities: curveArities, parameters: ["exposure", "offset", "min", "max", "reduce"] },
  { id: "red-green", label: "Red–Green", category: "colormap", arities: curveArities, parameters: ["exposure", "offset", "reduce"] },
  { id: "red-blue", label: "Red–Blue", category: "colormap", arities: curveArities, parameters: ["exposure", "offset", "min", "max", "reduce"] },
];

const operations = new Map(DISPLAY_OPERATIONS.map((operation) => [operation.id, operation]));

export function getDisplayOperation(id: string | null | undefined): DisplayOperationDefinition | undefined {
  return id ? operations.get(id) : undefined;
}

export function listDisplayOperations(category?: DisplayOperationCategory): readonly DisplayOperationDefinition[] {
  return category ? DISPLAY_OPERATIONS.filter((operation) => operation.category === category) : DISPLAY_OPERATIONS;
}
