/**
 * Diff-kernel registry bootstrap: registers every built-in kernel (the six
 * pointwise diffs migrated from the old `diffChannel` switch, plus FLIP) and
 * re-exports the registry API. Importing this module has the side effect of
 * populating the registry — the diff engine (`../diff-engine.ts`) and the pane
 * import it for that.
 *
 * Registration order == menu order (`listDiffKernels()`).
 */
import { getImageOperation, listImageOperations, listMultipassImageOperations } from "../../model/content-ops/index.ts";

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
  for (const operation of listImageOperations()) {
    if (operation.implementation.kind === "inline" && operation.inputCount === 2 && operation.outputArity === 1) {
      out.push({ id: operation.id, label: operation.label });
    }
  }
  out.push({ id: "flip", label: "FLIP (perceptual)" });
  out.push({ id: "flip_ldr", label: "FLIP (LDR forced)" });
  // SSIM is a plain 1:1 mode (no LDR/HDR collapse), so surface it directly.
  const ssim = getImageOperation("ssim");
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
  const pointwise = listImageOperations().find(
    (operation) => operation.implementation.kind === "inline" && operation.publicName === publicName,
  );
  if (pointwise) return pointwise.id;
  for (const operation of listMultipassImageOperations()) if (operation.publicName === publicName) return operation.id;
  return undefined;
}

/**
 * Auto-dispatch-only kernel public names — reached ONLY by `resolveDiffKernelId`
 * under a user-facing mode, never offered as a `cp.Compare(mode=)` value or a
 * menu entry. `hdr-flip` (`flip_hdr`) is dispatched from the public `flip` mode
 * on FLOAT sources; users never name it directly. Excluded from
 * {@link listDiffKernelPublicNames} so that list == the PUBLIC compare-mode set
 * (== Python `_COMPARE_KERNEL_MODES` keys == `schema/cairn-plot-contracts.json`'s
 * `compareKernelPublicNames`).
 *
 * NAMESPACE NOTE (menu token vs kernel id): the user-facing tokens (`flip`,
 * `flip_ldr`, `abs`, …) are a DIFFERENT namespace from the internal kernel ids
 * (`flip`, `flip-ldr-forced`, `absolute`, …). `flip_ldr` (menu token) resolves
 * to the `flip-ldr-forced` kernel id CLIENT-SIDE via `resolveDiffKernelId` on
 * float sources (and to plain `flip` on u8). Python's `_COMPARE_KERNEL_MODES`
 * maps each public token → the descriptor `diffSubmode` it carries.
 */
const AUTO_DISPATCH_ONLY_PUBLIC_NAMES = new Set<string>(["flip_hdr"]);

/**
 * The flat PUBLIC compare-mode name list (the `cp.Compare(mode=)` diff enum),
 * minus the auto-dispatch-only names (see {@link AUTO_DISPATCH_ONLY_PUBLIC_NAMES}).
 * Pinned to `schema/cairn-plot-contracts.json` by `contracts.test.ts` and mirrored
 * by Python `_COMPARE_KERNEL_MODES` (a pytest asserts the two match as sets).
 */
export function listDiffKernelPublicNames(): string[] {
  const pointwise = listImageOperations()
    .filter((operation) => operation.implementation.kind === "inline" && operation.inputCount === 2 && operation.outputArity === 1)
    .flatMap((operation) => operation.publicName ? [operation.publicName] : []);
  return [...pointwise, ...listMultipassImageOperations()
    .flatMap((operation) => operation.publicName ? [operation.publicName] : [])
    .filter((name) => !AUTO_DISPATCH_ONLY_PUBLIC_NAMES.has(name))];
}
