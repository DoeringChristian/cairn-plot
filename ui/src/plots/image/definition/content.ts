/** A floating-point pixel payload whose representation travels with its bytes. */
export type FloatPixels =
  | { readonly kind: "values"; readonly values: Float32Array | Float64Array }
  | { readonly kind: "f16-bits"; readonly bits: Uint16Array };

export interface DeepGpuCsrData {
  readonly width: number;
  readonly height: number;
  readonly total: number;
  readonly offsets: Uint32Array;
  readonly colors: Float32Array;
  readonly zs: Float32Array;
}

export interface DeepZRangeData {
  readonly zMin: number;
  readonly zMax: number;
  readonly count: number;
}

/** Runtime lease exposed by deep decoded content. Its implementation belongs to
 * resources; the content contract only describes what consumers may request. */
export interface DeepFlattenController {
  readonly zMin: number;
  readonly zMax: number;
  flatten(zNear: number, zFar: number): Promise<Float32Array | Uint16Array>;
  getGpuCsr(): Promise<DeepGpuCsrData>;
  zRangeInRect(x0: number, y0: number, x1: number, y1: number): Promise<DeepZRangeData>;
  dispose(): void;
}

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

/** Resolved, backend-neutral meaning of an image comparison. */
export interface ImageComparisonContent {
  readonly foreground: ImageSource;
  readonly presentation: "split" | "difference";
  readonly defaultOperation: string;
  readonly defaultSplit: number;
  readonly align?: ImageCompareAlign;
  readonly fit?: ImageCompareFit;
  readonly contentKeyA?: string;
  readonly contentKeyB?: string;
  readonly referenceLabel?: string;
  readonly foregroundLabel?: string;
}

/** Float operand used while resolving an authored image comparison. */
export interface ResolvedFloatImage {
  readonly pixels: FloatPixels;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly contentKey?: string;
}
