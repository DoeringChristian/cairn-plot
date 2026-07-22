/**
 * Diff-kernel registry bootstrap: registers every built-in kernel (the six
 * pointwise diffs migrated from the old `diffChannel` switch, plus FLIP) and
 * re-exports the registry API. Importing this module has the side effect of
 * populating the registry — the diff engine (`../diff-engine.ts`) and the pane
 * import it for that.
 *
 * Registration order == menu order (`listDiffKernels()`).
 */
import { registerDiffKernel, listDiffKernels, getDiffKernel } from "./kernel-registry.ts";
import { signedKernel } from "./signed.wgsl.ts";
import { absoluteKernel } from "./absolute.wgsl.ts";
import { squaredKernel } from "./squared.wgsl.ts";
import { relativeSignedKernel } from "./relative-signed.wgsl.ts";
import { relativeAbsoluteKernel } from "./relative-absolute.wgsl.ts";
import { relativeSquaredKernel } from "./relative-squared.wgsl.ts";
import { flipKernel, flipLdrForcedKernel } from "./flip.wgsl.ts";
import { hdrFlipKernel } from "./hdr-flip.ts";
import { ssimKernel } from "./ssim.wgsl.ts";

let registered = false;
function registerBuiltins(): void {
  if (registered) return;
  registered = true;
  // Pointwise diffs (menu order), then the multi-pass FLIP family (LDR, HDR,
  // forced-LDR). HDR-FLIP + forced-LDR are reached via auto-dispatch under the
  // single public `flip` menu entry (+ `flip_ldr`), never listed on their own —
  // see `listDiffMenuModes` / `resolveDiffKernelId`.
  registerDiffKernel(absoluteKernel);
  registerDiffKernel(signedKernel);
  registerDiffKernel(squaredKernel);
  registerDiffKernel(relativeAbsoluteKernel);
  registerDiffKernel(relativeSignedKernel);
  registerDiffKernel(relativeSquaredKernel);
  registerDiffKernel(flipKernel);
  registerDiffKernel(hdrFlipKernel);
  registerDiffKernel(flipLdrForcedKernel);
  // SSIM (Wang et al.) — a self-contained multi-pass kernel with its own public
  // menu entry (unlike the auto-dispatched FLIP family, it maps 1:1 to a mode).
  registerDiffKernel(ssimKernel);
}
registerBuiltins();

/**
 * A selectable diff MODE for the compare toolbar menu. Unlike raw
 * `listDiffKernels()`, the FLIP family collapses to a single "FLIP (perceptual)"
 * entry (public `flip`, auto-dispatched LDR/HDR by source type) plus "FLIP (LDR
 * forced)" (`flip_ldr`); HDR-FLIP/forced-LDR are never shown directly. `id` is
 * the selection token the pane stores (== the descriptor `diffSubmode` /
 * Python `mode`); resolve it to a concrete kernel id with `resolveDiffKernelId`.
 */
export interface DiffMenuMode {
  id: string;
  label: string;
}
export function listDiffMenuModes(): DiffMenuMode[] {
  const out: DiffMenuMode[] = [];
  for (const k of listDiffKernels()) {
    if (k.kind === "pointwise") out.push({ id: k.id, label: k.label });
  }
  out.push({ id: "flip", label: "FLIP (perceptual)" });
  out.push({ id: "flip_ldr", label: "FLIP (LDR forced)" });
  // SSIM is a plain 1:1 mode (no LDR/HDR collapse), so surface it directly.
  const ssim = getDiffKernel("ssim");
  if (ssim) out.push({ id: ssim.id, label: ssim.label });
  return out;
}

/**
 * Auto-dispatch (spec addendum DECISION): resolve a menu selection token +
 * whether the compare sources are FLOAT (HDR: imghdr arrays / f32 EXR) into the
 * concrete registered kernel id to run.
 *   - `flip`     → `hdr-flip` (float) | `flip` (u8)
 *   - `flip_ldr` → `flip-ldr-forced` (float: tone-map-first) | `flip` (u8)
 *   - any pointwise id → itself.
 */
export function resolveDiffKernelId(selection: string, sourcesAreFloat: boolean): string {
  if (selection === "flip") return sourcesAreFloat ? "hdr-flip" : "flip";
  if (selection === "flip_ldr" || selection === "flip-ldr-forced") {
    return sourcesAreFloat ? "flip-ldr-forced" : "flip";
  }
  return selection;
}

/** Map a flat public name (`abs`, `rel_signed`, `flip`, …) → internal kernel id. */
export function kernelIdForPublicName(publicName: string): string | undefined {
  for (const k of listDiffKernels()) if (k.publicName === publicName) return k.id;
  return undefined;
}

/** The flat public-name list (Python `mode=` diff enum + toolbar menu order). */
export function listDiffKernelPublicNames(): string[] {
  return listDiffKernels().map((k) => k.publicName);
}

export * from "./kernel-registry.ts";
export { getDiffKernel };
