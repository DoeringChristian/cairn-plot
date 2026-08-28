import { getDisplayOperation, type ReduceMode } from "../definition/display-operations.ts";
import { defaultReduceMode } from "../runtime/display-settings.ts";
import { getWebGpuDisplayOperation } from "./display.ts";
import type { ImageParams } from "./image-engine.ts";

/** The image engine's private binding for one registered display operation.
 * Callers select an operation by id; whether it needs auxiliary LUT data or an
 * analytic shader branch is resolved here and never becomes host policy. */
export type PreparedDisplayOperation = Pick<
  ImageParams,
  "displayOperationId" | "isScalar" | "colormap" | "hdrOut"
>;

export function prepareDisplayOperation(
  id: string,
  options: { hdrSurface: boolean },
): PreparedDisplayOperation {
  const operation = getWebGpuDisplayOperation(id);
  if (!operation) throw new Error(`unknown display operation ${JSON.stringify(id)}`);

  const implementation = operation.implementation;
  if (implementation.kind === "per-channel") {
    return {
      displayOperationId: id,
      isScalar: false,
      hdrOut: options.hdrSurface,
    };
  }

  return {
    displayOperationId: id,
    isScalar: true,
    hdrOut: implementation.kind === "analytic" ? options.hdrSurface : false,
    ...(implementation.kind === "lut"
      ? { colormap: implementation.table }
      : {}),
  };
}

/** Operation-owned default for reducing a multi-channel field before display. */
export function defaultReduceForDisplayOperation(id: string, channels: number): ReduceMode {
  const operation = getDisplayOperation(id);
  if (!operation) throw new Error(`unknown display operation ${JSON.stringify(id)}`);
  return operation.defaultReduce ?? defaultReduceMode(channels);
}
