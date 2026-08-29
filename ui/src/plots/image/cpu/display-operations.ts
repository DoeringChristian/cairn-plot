import { colormapFloatLUT } from "../../../settings/colormaps/lut.ts";
import { clamp01 } from "../../../primitives/util/clamp.ts";
import {
  getDisplayOperation,
  type DisplayOperationDefinition,
  type ReduceMode,
} from "../definition/display-operations.ts";
import {
  DEFAULT_DISPLAY_PARAMETERS,
  defaultReduceMode,
  type DisplayParameters,
} from "../runtime/display-settings.ts";
import { computeDataIndex, reduceToScalar, signedAnalyticColor, turboDataIndex } from "./display-math.ts";

type Rgb = [number, number, number];

export interface CpuDisplayOperation {
  readonly definition: DisplayOperationDefinition;
  readonly kind: "curve" | "lut" | "analytic";
  evaluate(values: readonly number[], channels: number, parameters: DisplayParameters): Rgb;
}

const perChannel = (
  id: string,
  transform: (value: number, parameters: DisplayParameters) => number,
): CpuDisplayOperation => ({
  definition: getDisplayOperation(id)!,
  kind: "curve",
  evaluate(values, _channels, parameters) {
    const scalar = _channels <= 1 ? values[0] ?? 0 : undefined;
    return [0, 1, 2].map((channel) => transform(scalar ?? values[channel] ?? 0, parameters)) as Rgb;
  },
});

const clampToPeak = (value: number, parameters: DisplayParameters): number =>
  Math.min(Math.max(value, 0), Math.max(parameters.peak, 1e-6));

const lut = (id: string, index: (value: number, parameters: DisplayParameters) => number): CpuDisplayOperation => ({
  definition: getDisplayOperation(id)!,
  kind: "lut",
  evaluate(values, channels, parameters) {
    const definition = getDisplayOperation(id)!;
    const scalar = reduceToScalar(values, channels, parameters.reduce ?? definition.defaultReduce ?? defaultReduceMode(channels));
    const row = Math.round(clamp01(index(scalar, parameters)) * 255);
    const table = colormapFloatLUT(id);
    return [table[row * 4]!, table[row * 4 + 1]!, table[row * 4 + 2]!];
  },
});

export const CPU_DISPLAY_OPERATIONS: readonly CpuDisplayOperation[] = [
  perChannel("linear", clampToPeak),
  perChannel("srgb", clampToPeak),
  perChannel("gamma", clampToPeak),
  perChannel("reinhard", (value, parameters) => {
    const positive = Math.max(value, 0);
    return positive / (1 + positive / Math.max(parameters.peak, 1e-6));
  }),
  perChannel("aces", (value, parameters) => {
    const peak = Math.max(parameters.peak, 1e-6);
    const normalized = Math.max(value, 0) / peak;
    return peak * clamp01((normalized * (2.51 * normalized + 0.03)) / (normalized * (2.43 * normalized + 0.59) + 0.14));
  }),
  perChannel("normal", (value) => clamp01((value + 1) * 0.5)),
  lut("turbo", turboDataIndex),
  lut("plasma", computeDataIndex),
  lut("magma", computeDataIndex),
  {
    definition: getDisplayOperation("red-green")!,
    kind: "analytic",
    evaluate(values, channels, parameters) {
      const scalar = reduceToScalar(values, channels, parameters.reduce ?? defaultReduceMode(channels));
      return signedAnalyticColor(scalar);
    },
  },
  lut("red-blue", computeDataIndex),
];

const operations = new Map(CPU_DISPLAY_OPERATIONS.map((operation) => [operation.definition.id, operation]));

export function getCpuDisplayOperation(id: string | null | undefined): CpuDisplayOperation | undefined {
  return id ? operations.get(id) : undefined;
}

export function evaluateDisplayOperation(
  operation: CpuDisplayOperation,
  values: readonly number[],
  channels: number,
  parameters: DisplayParameters = DEFAULT_DISPLAY_PARAMETERS,
): Rgb {
  return operation.evaluate(values, channels, parameters);
}

export type { DisplayParameters, ReduceMode };
export { DEFAULT_DISPLAY_PARAMETERS };
