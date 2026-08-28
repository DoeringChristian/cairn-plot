import { getImageOperation, type ImageOperationDefinition } from "../definition/index.ts";

export interface CpuImageOperationContext {
  readonly uv: readonly [number, number];
  readonly parameter: number;
}

export interface CpuImageOperation {
  readonly definition: ImageOperationDefinition;
  evaluate(
    sources: readonly (readonly number[])[],
    channels: number,
    context?: CpuImageOperationContext,
  ): number[];
}

const RELATIVE_EPSILON = 1 / 255;
const rgb = (value: readonly number[] | undefined): [number, number, number] =>
  [value?.[0] ?? 0, value?.[1] ?? 0, value?.[2] ?? 0];

function pointwise(id: string, evaluate: (a: number, b: number) => number): CpuImageOperation {
  return {
    definition: getImageOperation(id)!,
    evaluate(sources) {
      const a = rgb(sources[0]);
      const b = rgb(sources[1]);
      return a.map((value, channel) => evaluate(value, b[channel]!));
    },
  };
}

export const CPU_IMAGE_OPERATIONS: readonly CpuImageOperation[] = [
  { definition: getImageOperation("identity")!, evaluate: (sources) => [...(sources[0] ?? [])] },
  pointwise("absolute", (a, b) => Math.abs(a - b)),
  pointwise("signed", (a, b) => a - b),
  pointwise("squared", (a, b) => (a - b) ** 2),
  pointwise("relative_absolute", (a, b) => Math.abs(a - b) / Math.max(a, RELATIVE_EPSILON)),
  pointwise("relative_signed", (a, b) => (a - b) / Math.max(a, RELATIVE_EPSILON)),
  pointwise("relative_squared", (a, b) => ((a - b) / Math.max(a, RELATIVE_EPSILON)) ** 2),
  {
    definition: getImageOperation("split")!,
    evaluate(sources, _channels, context) {
      return [...((context?.uv[0] ?? 0) < (context?.parameter ?? 0) ? sources[0] : sources[1]) ?? []];
    },
  },
];

const implementations = new Map(CPU_IMAGE_OPERATIONS.map((operation) => [operation.definition.id, operation]));
export function getCpuImageOperation(id: string): CpuImageOperation | undefined {
  return implementations.get(id);
}
