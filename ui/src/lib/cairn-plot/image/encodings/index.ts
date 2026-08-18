/**
 * Display-encoding registry bootstrap (mirrors `engine/kernels/index.ts`).
 * Importing this module has the SIDE EFFECT of registering every built-in
 * encoding — `image/tonemap.ts`, `engine/image-engine.ts`, and the shader
 * modules import it for that. Re-exports the registry API + the GPU WGSL
 * assembler + the CPU scalar-curve helpers (the single source of truth
 * `tonemap.ts` re-exports under its historical names).
 */
import { registerCurveEncodings } from "./curves.ts";
import { listEncodings } from "./registry.ts";

registerCurveEncodings();

/**
 * The `operatorId` uniform value for each encoding id — the map
 * `engine/image-engine.ts` packs into `u_bind2.y` (was a hand-maintained
 * `OPERATOR_ID` literal, now GENERATED from the registry so the shader dispatch
 * — also assembled from the registry — and the CPU packing can never drift).
 */
export const OPERATOR_ID: Record<string, number> = Object.fromEntries(
  listEncodings().map((e) => [e.id, e.operatorId]),
);

export * from "./registry.ts";
export * from "./curves.ts";
export * from "./wgsl.ts";
