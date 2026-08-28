import type { DeepFlattenController } from "../resources/decoders.ts";
import type { FloatPixels } from "../runtime/pixel-buffer.ts";

/** Decoded floating-point image content retained by the image runtime. */
export interface FloatImageSource {
  readonly dtype: "float";
  readonly pixels: FloatPixels;
  readonly shape: number[];
  readonly numpyDtype?: string;
  readonly deep?: DeepFlattenController;
}

/** Browser-decodable eight-bit image content retained by the image runtime. */
export interface Uint8ImageSource {
  readonly dtype: "uint8";
  readonly url: string | null;
}

/** Backend-neutral decoded content. Backend selection must not change this value. */
export type ImageSource = FloatImageSource | Uint8ImageSource;

export type ImageCompareAlign =
  | "top-left"
  | "center"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ImageCompareFit = "crop" | "fill";

/** Float operand used while resolving an authored image comparison. */
export interface ResolvedFloatImage {
  readonly pixels: FloatPixels;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly contentKey?: string;
}
