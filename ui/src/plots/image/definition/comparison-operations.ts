/** Public comparison-operation selection and source-dependent resolution.
 * Implementations themselves live in the image-operation registry; this module
 * only defines the menu projection and maps public selections to concrete ids. */
import { getImageOperation, listImageOperations } from "./image-operations.ts";

/**
 * A selectable diff MODE for the compare toolbar menu. Unlike raw
 * `listComparisonOperations()`, the FLIP family collapses to a single "FLIP"
 * entry (public `flip`); HDR-FLIP/forced-LDR are backend implementations and
 * are never shown directly. `id` is
 * the selection token the pane stores (== the descriptor `operation` /
 * Python `mode`); resolve it to a concrete kernel id with `resolveComparisonOperationId`.
 */
export interface ComparisonOperationOption {
  id: string;
  label: string;
}
export function listComparisonOperationOptions(): ComparisonOperationOption[] {
  const out: ComparisonOperationOption[] = [];
  for (const operation of listImageOperations()) {
    if (operation.cache === "never" && operation.inputs === 2 && operation.id !== "split") {
      out.push({ id: operation.id, label: operation.label });
    }
  }
  const flip = getImageOperation("flip");
  if (flip) out.push({ id: flip.id, label: flip.label });
  // SSIM is a plain 1:1 mode (no LDR/HDR collapse), so surface it directly.
  const ssim = getImageOperation("ssim");
  if (ssim) out.push({ id: ssim.id, label: ssim.label });
  return out;
}

/**
 * Auto-dispatch (spec addendum DECISION): resolve a menu selection token +
 * whether the compare sources are FLOAT (HDR: imghdr arrays / f32 EXR) into the
 * concrete registered kernel id to run.
 *   - `flip` + HDR → `hdr-flip` for float sources
 *   - `flip` + SDR → `flip-sdr-float` for float sources
 *   - `flip` on u8 → `flip` (the mode toggle is immaterial)
 *   - any pointwise id → itself.
 */
export type FlipMode = "hdr" | "sdr";

export function resolveComparisonOperationId(
  selection: string,
  sourcesAreFloat: boolean,
  flipMode: FlipMode = "hdr",
): string {
  if (selection === "flip") {
    if (!sourcesAreFloat) return "flip";
    return flipMode === "hdr" ? "hdr-flip" : "flip-sdr-float";
  }
  return selection;
}

/** Map a flat public name (`abs`, `rel_signed`, `flip`, …) → internal kernel id. */
export function operationIdForPublicName(publicName: string): string | undefined {
  const pointwise = listImageOperations().find(
    (operation) => operation.cache === "never" && operation.publicName === publicName,
  );
  if (pointwise) return pointwise.id;
  for (const operation of listImageOperations()) if (operation.cache === "global-lru" && operation.publicName === publicName) return operation.id;
  return undefined;
}

/**
 * Auto-dispatch-only kernel public names — reached ONLY by `resolveComparisonOperationId`
 * under a user-facing mode, never offered as a `cp.Compare(mode=)` value or a
 * menu entry. `hdr-flip` (`flip_hdr`) is dispatched from the public `flip` mode
 * on FLOAT sources; users never name it directly. Excluded from
 * {@link listComparisonOperationPublicNames} so that list == the PUBLIC compare-mode set
 * (== Python `_COMPARE_OPERATION_MODES` keys == `schema/cairn-plot-contracts.json`'s
 * `comparisonOperationPublicNames`).
 *
 * The user-facing `flip` token remains stable. The backend implementation id is
 * resolved from source representation and `compare.flipMode` at render time.
 */
const AUTO_DISPATCH_ONLY_PUBLIC_NAMES = new Set<string>(["flip_hdr"]);

/**
 * The flat PUBLIC compare-mode name list (the `cp.Compare(mode=)` diff enum),
 * minus the auto-dispatch-only names (see {@link AUTO_DISPATCH_ONLY_PUBLIC_NAMES}).
 * Pinned to `schema/cairn-plot-contracts.json` by `contracts.test.ts` and mirrored
 * by Python `_COMPARE_OPERATION_MODES` (a pytest asserts the two match as sets).
 */
export function listComparisonOperationPublicNames(): string[] {
  const pointwise = listImageOperations()
    .filter((operation) => operation.cache === "never" && operation.inputs === 2 && operation.id !== "split")
    .flatMap((operation) => operation.publicName ? [operation.publicName] : []);
  return [...pointwise, ...listImageOperations().filter((operation) => operation.cache === "global-lru")
    .flatMap((operation) => operation.publicName ? [operation.publicName] : [])
    .filter((name) => !AUTO_DISPATCH_ONLY_PUBLIC_NAMES.has(name))];
}
