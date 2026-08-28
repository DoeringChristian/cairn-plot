/**
 * Display-encoding registry bootstrap (mirrors `model/comparison-operations.ts`).
 * Importing this module has the SIDE EFFECT of registering every built-in
 * encoding — `image/tonemap.ts`, `engine/image-engine.ts`, and the shader
 * modules import it for that. Re-exports the registry API + the GPU WGSL
 * assembler + the CPU scalar-curve helpers (the single source of truth
 * `tonemap.ts` re-exports under its historical names).
 */
import { registerCurveEncodings } from "./curves.ts";
import { registerLutEncodings } from "./luts.ts";

registerCurveEncodings();
registerLutEncodings();

export * from "./registry.ts";
export * from "./curves.ts";
export * from "./luts.ts";
export * from "./wgsl.ts";
