import type { Invalidation } from "../../spec/src/settings.ts";

export interface GpuImageUpdatePlan {
  uniforms: boolean;
  rebuildLut: boolean;
  encode: boolean;
  decode: boolean;
  remount: boolean;
}

/** Image-engine refinement of the runtime's deliberately coarse invalidation. */
export function planGpuImageUpdate(
  invalidation: Invalidation,
  changedKeys: ReadonlySet<string>,
): GpuImageUpdatePlan {
  return {
    uniforms: invalidation === "presentation",
    rebuildLut: changedKeys.has("image.encoding"),
    encode: invalidation === "content" && !changedKeys.has("image.channelSelect"),
    decode: changedKeys.has("image.channelSelect"),
    remount: invalidation === "remount",
  };
}
