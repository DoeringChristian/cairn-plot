import type { DisplayOperationDefinition } from "../definition/display-operations.ts";

export type WebGpuDisplayImplementation =
  | { readonly kind: "per-channel"; readonly wgsl: string }
  | { readonly kind: "lut"; readonly table: Float32Array; readonly index: { readonly wgsl: string } }
  | { readonly kind: "analytic"; readonly wgsl: string };

export interface WebGpuDisplayOperation {
  readonly definition: DisplayOperationDefinition;
  readonly implementation: WebGpuDisplayImplementation;
}

const operations = new Map<string, WebGpuDisplayOperation>();

export function registerWebGpuDisplayOperation(operation: WebGpuDisplayOperation): void {
  const id = operation.definition.id;
  if (operations.has(id)) throw new Error(`duplicate WebGPU display operation "${id}"`);
  operations.set(id, operation);
}

export function getWebGpuDisplayOperation(id: string | null | undefined): WebGpuDisplayOperation | undefined {
  return id ? operations.get(id) : undefined;
}

export function listWebGpuDisplayOperations(): readonly WebGpuDisplayOperation[] {
  return [...operations.values()];
}

export const REDUCE_ID = { luminance: 1, mean: 2 } as const;
export const NORM_ID = { linear: 0, log: 1, power: 2 } as const;
