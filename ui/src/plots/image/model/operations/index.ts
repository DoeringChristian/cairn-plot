/**
 * Content-op registry bootstrap (mirrors `image/encodings/index.ts`). Importing
 * this module has the SIDE EFFECT of registering every built-in image operation — the
 * image shader (`engine/shaders/image.wgsl.ts`) and the CPU pane
 * (`renderers/CpuImagePane.tsx`) import it for that. Re-exports the registry API
 * + the GPU WGSL assembler.
 */
import { registerImageOperations } from "./ops.ts";

registerImageOperations();

export * from "./registry.ts";
export * from "./ops.ts";
export * from "./wgsl.ts";
