import { colormapFloatLUT } from "../../../settings/colormaps/lut.ts";
import type { Colormap } from "../../types.ts";
import { defaultReduceMode, getEncoding, type ReduceMode } from "../model/encodings/index.ts";
import type { ImageParams } from "./image-engine.ts";

/** The image engine's private binding for one registered display operation.
 * Callers select an operation by id; whether it needs auxiliary LUT data or an
 * analytic shader branch is resolved here and never becomes host policy. */
export type PreparedDisplayBinding = Pick<
  ImageParams,
  "displayOperationId" | "isScalar" | "analytic" | "turbo" | "colormap" | "hdrOut"
>;

export function prepareDisplayBinding(
  id: string,
  options: { hdrSurface: boolean },
): PreparedDisplayBinding {
  const operation = getEncoding(id);
  if (!operation) throw new Error(`unknown display operation ${JSON.stringify(id)}`);

  if (operation.kind !== "lut") {
    return {
      displayOperationId: id,
      isScalar: false,
      hdrOut: options.hdrSurface,
    };
  }

  return {
    displayOperationId: "linear",
    isScalar: true,
    hdrOut: operation.analytic ? options.hdrSurface : false,
    ...(operation.analytic ? { analytic: true } : {}),
    ...(operation.turbo ? { turbo: true } : {}),
    ...(operation.needsLut
      ? { colormap: colormapFloatLUT((operation.lutName ?? operation.id) as Colormap) }
      : {}),
  };
}

/** Operation-owned default for reducing a multi-channel field before display. */
export function defaultReduceForDisplayOperation(id: string, channels: number): ReduceMode {
  const operation = getEncoding(id);
  if (!operation) throw new Error(`unknown display operation ${JSON.stringify(id)}`);
  return operation.turbo ? "mean" : defaultReduceMode(channels);
}
