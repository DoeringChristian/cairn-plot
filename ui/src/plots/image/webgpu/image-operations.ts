import { getImageOperation, type ImageOperationDefinition } from "../definition/index.ts";
import type { MultipassImageOperationProgram } from "./operation-pass.ts";
import { flipLdrForcedProgram, flipProgram } from "./kernels/flip.wgsl.ts";
import { hdrFlipProgram } from "./kernels/hdr-flip.ts";
import { ssimProgram } from "./kernels/ssim.wgsl.ts";

export type WebGpuImageOperation =
  | { readonly definition: ImageOperationDefinition; readonly kind: "inline"; readonly expression: string }
  | { readonly definition: ImageOperationDefinition; readonly kind: "multipass"; readonly program: MultipassImageOperationProgram };

const inline = (id: string, expression: string): WebGpuImageOperation => ({
  definition: getImageOperation(id)!, kind: "inline", expression,
});
const multipass = (id: string, program: MultipassImageOperationProgram): WebGpuImageOperation => ({
  definition: getImageOperation(id)!, kind: "multipass", program,
});

export const WEBGPU_IMAGE_OPERATIONS: readonly WebGpuImageOperation[] = [
  inline("identity", "a"),
  inline("absolute", "vec4<f32>(abs(a.rgb - b.rgb), 1.0)"),
  inline("signed", "vec4<f32>(a.rgb - b.rgb, 1.0)"),
  inline("squared", "vec4<f32>((a.rgb - b.rgb) * (a.rgb - b.rgb), 1.0)"),
  inline("relative_absolute", "vec4<f32>(abs(a.rgb - b.rgb) / max(a.rgb, vec3<f32>(1.0 / 255.0)), 1.0)"),
  inline("relative_signed", "vec4<f32>((a.rgb - b.rgb) / max(a.rgb, vec3<f32>(1.0 / 255.0)), 1.0)"),
  inline("relative_squared", "vec4<f32>(((a.rgb - b.rgb) * (a.rgb - b.rgb)) / (max(a.rgb, vec3<f32>(1.0 / 255.0)) * max(a.rgb, vec3<f32>(1.0 / 255.0))), 1.0)"),
  inline("split", "select(b, a, uv.x < param.x)"),
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

const inlineOperations = WEBGPU_IMAGE_OPERATIONS.filter(
  (operation): operation is Extract<WebGpuImageOperation, { kind: "inline" }> => operation.kind === "inline",
);
const inlineIds = new Map(inlineOperations.map((operation, id) => [operation.definition.id, id]));

export function imageOperationId(id: string): number | undefined {
  return inlineIds.get(id);
}

export function buildImageOperationWGSL(): string {
  const identity = getWebGpuImageOperation("identity");
  if (!identity || identity.kind !== "inline") throw new Error("missing WebGPU identity operation");
  const branches = inlineOperations
    .filter((operation) => operation.definition.id !== "identity")
    .map((operation) => `  if (opId == ${inlineIds.get(operation.definition.id)}) { return ${operation.expression}; }`)
    .join("\n");
  return `fn cairnContent(a: vec4<f32>, b: vec4<f32>, uv: vec2<f32>, param: vec4<f32>, opId: i32) -> vec4<f32> {
${branches}
  return ${identity.expression};
}`;
}
