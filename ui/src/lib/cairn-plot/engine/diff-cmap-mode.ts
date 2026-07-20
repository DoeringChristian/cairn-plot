/**
 * `resolveDiffCmapMode` — the ONE pure decision for how a diff RESULT value is
 * indexed into the colormap LUT, derived from BOTH the kernel's `displayRange`
 * AND whether the chosen colormap is DIVERGING.
 *
 * The blit's three index modes (`DiffCmapMode`, consumed by
 * `diff-engine.ts`'s display shader):
 *   - `"signed"`   — index == the display value (which the blit has already
 *                    remapped `(v+1)/2` for signed/relative ranges), so ZERO
 *                    error lands on the LUT midpoint. Used for signed/relative
 *                    kernels.
 *   - `"positive"` — push the unit `[0,1]` value into the LUT's UPPER half
 *                    (`0.5 + v*0.5`), so ZERO error lands on the midpoint of a
 *                    DIVERGING map (its neutral color) and error grows toward
 *                    one end.
 *   - `"linear"`   — index == the unit `[0,1]` value directly, using the FULL
 *                    LUT. Correct for a SEQUENTIAL map (viridis/plasma/magma):
 *                    ZERO error = the dark end, max error = the bright end,
 *                    matching how the reference FLIP tools magma-color their
 *                    maps. Pushing a sequential map into its upper half (the old
 *                    always-`"positive"` behavior) used only half the ramp and
 *                    looked wrong vs. the reference — the reported bug.
 *
 * Pure + dependency-light on purpose (only the `DIVERGING_COLORMAPS` set), so it
 * unit-tests without any GPU/engine imports.
 */
import { DIVERGING_COLORMAPS } from "../colormaps/lut.ts";
import type { DisplayRange } from "./kernels/kernel-registry.ts";

/** Colormap index mode the diff display shader applies (see module doc). */
export type DiffCmapMode = "linear" | "signed" | "positive";

/**
 * Decide the diff colormap index mode from the kernel's `displayRange` and the
 * colormap name (`null`/`"none"` = no LUT; the returned mode is then moot but
 * still well-defined). See the module doc for the full rationale.
 */
export function resolveDiffCmapMode(
  displayRange: DisplayRange,
  colormapName: string | null | undefined,
): DiffCmapMode {
  // Signed/relative ranges are centered on zero: the blit remaps them to
  // `(v+1)/2`, and `"signed"` (linear index of that remapped value) puts zero on
  // the LUT midpoint — the diverging-map convention, and harmless on a
  // sequential map (it just uses the full ramp about the middle).
  if (displayRange === "signed" || displayRange === "relative") return "signed";
  // Unit range (zero error = 0): a DIVERGING map must fold `[0,1]` into its upper
  // half so zero sits on the neutral midpoint; a SEQUENTIAL map uses its FULL
  // range linearly.
  return resolveColormapMode(colormapName);
}

/**
 * The sequential-vs-diverging rule in ONE place: a DIVERGING colormap folds a
 * unit `[0,1]` value into its upper half (`"positive"`, so zero lands on the
 * neutral midpoint); a SEQUENTIAL map indexes the full ramp linearly
 * (`"linear"`). Shared by `resolveDiffCmapMode`'s unit branch (GPU diff blit)
 * and the CPU false-color / diff paths (`applyColormap`'s `mode`), so the two
 * pipelines never disagree. `null`/`"none"`/unknown → `"linear"`.
 */
export function resolveColormapMode(
  colormapName: string | null | undefined,
): "positive" | "linear" {
  return DIVERGING_COLORMAPS.has(colormapName ?? "") ? "positive" : "linear";
}
