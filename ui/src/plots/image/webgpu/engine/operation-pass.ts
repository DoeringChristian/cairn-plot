import type { BindGroupEntry } from "./webgpu/device-contract.ts";

export interface ImageOperationComputeContext {
  hdrExposures?: { startExposure: number; stopExposure: number; numExposures: number } | null;
}

export interface ImageOperationSourceMap {
  fill: boolean;
  offsetA: { x: number; y: number };
  offsetB: { x: number; y: number };
}

export interface ImageOperationBuildContext {
  width: number;
  height: number;
  params: Record<string, number>;
  sourceMap?: ImageOperationSourceMap;
}

export interface ImageOperationPass {
  name: string;
  shader: string;
  inputs: string[];
  output: string;
  uniforms?: (context: ImageOperationBuildContext) => BindGroupEntry[];
}

export interface ImageOperationPassGraph {
  passes: ImageOperationPass[];
  final: string;
}

export interface MultipassImageOperationProgram {
  params?: Readonly<Record<string, number>>;
  computeParams?: (context: ImageOperationComputeContext) => Readonly<Record<string, number>> | undefined;
  buildPasses(context: ImageOperationBuildContext): ImageOperationPassGraph;
}

/** How a scalar operation field is normalized before a display operation. */
export type ImageOperationDisplayRange = "unit" | "signed" | "relative";
