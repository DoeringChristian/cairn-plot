/**
 * Diff-kernel registry bootstrap: registers every built-in kernel (the six
 * pointwise diffs migrated from the old `diffChannel` switch, plus FLIP) and
 * re-exports the registry API. Importing this module has the side effect of
 * populating the registry — the diff engine (`../diff-engine.ts`) and the pane
 * import it for that.
 *
 * Registration order == menu order (`listDiffKernels()`).
 */
import { registerDiffKernel, listDiffKernels, getDiffKernel } from "./kernel-registry";
import { signedKernel } from "./signed.wgsl";
import { absoluteKernel } from "./absolute.wgsl";
import { squaredKernel } from "./squared.wgsl";
import { relativeSignedKernel } from "./relative-signed.wgsl";
import { relativeAbsoluteKernel } from "./relative-absolute.wgsl";
import { relativeSquaredKernel } from "./relative-squared.wgsl";
import { flipKernel } from "./flip.wgsl";

let registered = false;
function registerBuiltins(): void {
  if (registered) return;
  registered = true;
  // Pointwise diffs (menu order), then multi-pass FLIP.
  registerDiffKernel(absoluteKernel);
  registerDiffKernel(signedKernel);
  registerDiffKernel(squaredKernel);
  registerDiffKernel(relativeAbsoluteKernel);
  registerDiffKernel(relativeSignedKernel);
  registerDiffKernel(relativeSquaredKernel);
  registerDiffKernel(flipKernel);
}
registerBuiltins();

/** Map a flat public name (`abs`, `rel_signed`, `flip`, …) → internal kernel id. */
export function kernelIdForPublicName(publicName: string): string | undefined {
  for (const k of listDiffKernels()) if (k.publicName === publicName) return k.id;
  return undefined;
}

/** The flat public-name list (Python `mode=` diff enum + toolbar menu order). */
export function listDiffKernelPublicNames(): string[] {
  return listDiffKernels().map((k) => k.publicName);
}

export * from "./kernel-registry";
export { getDiffKernel };
