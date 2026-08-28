import { getImageOperation, type ImageOperationDefinition } from "../definition/index.ts";
import type { MultipassImageOperationProgram } from "./operation-pass.ts";
import { flipLdrForcedProgram, flipProgram } from "./kernels/flip.wgsl.ts";
import { hdrFlipProgram } from "./kernels/hdr-flip.ts";
import { ssimProgram } from "./kernels/ssim.wgsl.ts";

export type WebGpuImageOperation =
  | {
      readonly definition: ImageOperationDefinition;
      readonly kind: "inline";
      readonly scope: "pointwise" | "compositor";
      readonly wgsl: string;
    }
  | { readonly definition: ImageOperationDefinition; readonly kind: "multipass"; readonly program: MultipassImageOperationProgram };

const inline = (
  id: string,
  wgsl: string,
  scope: "pointwise" | "compositor" = "pointwise",
): WebGpuImageOperation => ({
  definition: getImageOperation(id)!, kind: "inline", scope, wgsl,
});
const multipass = (id: string, program: MultipassImageOperationProgram): WebGpuImageOperation => ({
  definition: getImageOperation(id)!, kind: "multipass", program,
});

export const WEBGPU_IMAGE_OPERATIONS: readonly WebGpuImageOperation[] = [
  inline("identity", `
    return a;
  `),
  inline("absolute", `
    return vec4<f32>(abs(a.rgb - b.rgb), 1.0);
  `),
  inline("signed", `
    return vec4<f32>(a.rgb - b.rgb, 1.0);
  `),
  inline("squared", `
    let delta = a.rgb - b.rgb;
    return vec4<f32>(delta * delta, 1.0);
  `),
  inline("relative_absolute", `
    let denominator = max(a.rgb, vec3<f32>(1.0 / 255.0));
    return vec4<f32>(abs(a.rgb - b.rgb) / denominator, 1.0);
  `),
  inline("relative_signed", `
    let denominator = max(a.rgb, vec3<f32>(1.0 / 255.0));
    return vec4<f32>((a.rgb - b.rgb) / denominator, 1.0);
  `),
  inline("relative_squared", `
    let delta = a.rgb - b.rgb;
    let denominator = max(a.rgb, vec3<f32>(1.0 / 255.0));
    return vec4<f32>((delta * delta) / (denominator * denominator), 1.0);
  `),
  inline("split", `
    return select(b, a, uv.x < param.x);
  `, "compositor"),
  multipass("flip", flipProgram),
  multipass("hdr-flip", hdrFlipProgram),
  multipass("flip-ldr-forced", flipLdrForcedProgram),
  multipass("ssim", ssimProgram),
];

const implementations = new Map(WEBGPU_IMAGE_OPERATIONS.map((operation) => [operation.definition.id, operation]));
export function getWebGpuImageOperation(id: string): WebGpuImageOperation | undefined {
  return implementations.get(id);
}

export function getWebGpuMultipassOperation(id: string): Extract<WebGpuImageOperation, { kind: "multipass" }> | undefined {
  const operation = implementations.get(id);
  return operation?.kind === "multipass" ? operation : undefined;
}

export function requireWebGpuInlineOperation(
  id: string | null | undefined,
): Extract<WebGpuImageOperation, { kind: "inline" }> {
  const operation = getWebGpuImageOperation(id ?? "identity");
  if (!operation || operation.kind !== "inline") {
    throw new Error(`unknown inline WebGPU image operation ${JSON.stringify(id)}`);
  }
  return operation;
}

/** Compile exactly one content operation into a render pipeline. */
export function buildImageOperationWGSL(
  operation: Extract<WebGpuImageOperation, { kind: "inline" }>,
): string {
  return `fn cairnContent(a: vec4<f32>, b: vec4<f32>, uv: vec2<f32>, param: vec4<f32>) -> vec4<f32> {
${operation.wgsl.trim()}
}`;
}
