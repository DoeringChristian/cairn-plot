/**
 * The ONE place a comparison selection is resolved.
 *
 * Three separate facts decide what a compare pane shows, and every one of them
 * used to be recomputed — differently — at each seam:
 *
 *   1. WHAT THE STORE SAYS (`compare.operation`), which is also what "modified"
 *      and every write callback must reason about. A read-time capability
 *      projection must never leak into it.
 *   2. WHAT HOME MEANS. The public builders MOVE the authored `operation` /
 *      `splitPosition` props into the cell's settings seed, so the presentation
 *      props are NOT the defaults — the cell defaults the host already computes
 *      (`defaultSettingsForNode`) are. Deriving defaults from the props made
 *      every cell permanently "modified" and reset the menu to `absolute`.
 *   3. WHAT THE ACTIVE BACKEND CAN RUN. An id the backend lacks is projected
 *      onto `split` for RENDERING only (see `definition/core.ts`), and the
 *      kernel the pane seeds for a later switch INTO diff has to be a member of
 *      the menu the pane was handed — otherwise the menu shows a selection it
 *      does not contain.
 *
 * Pure and backend-agnostic: it takes the capability probe and the already-built
 * menu, never a backend object or a React tree, so both callers
 * (`runtime/view.tsx`, `runtime/compare-compositor.tsx`) and the unit tests
 * exercise the identical rule.
 */
import {
  FALLBACK_COMPARISON_OPERATION,
  projectComparisonOperation,
  type CapabilityFallback,
  type ImageOperationSupport,
} from "../definition/core.ts";
import type { ComparisonMenuOption } from "./comparison-menu.ts";

/** The catalogue-wide HOME split position when nothing is authored. */
export const DEFAULT_COMPARE_SPLIT = 0.5;

/** The comparison slice of a cell's HOME settings (`defaultSettingsForNode`). */
export interface ComparisonCellDefaults {
  readonly "compare.operation"?: string;
  readonly "compare.split"?: number;
}

export interface ComparisonSelectionInput {
  /** The RAW store selection (`settings["compare.operation"]`); absent = HOME. */
  readonly selected: string | undefined;
  /** The authored comparison presentation (`cp.Compare(...)`'s kind). */
  readonly presentation: "split" | "difference";
  /** The cell's HOME settings — where the builders put the authored operation. */
  readonly cellDefaults: ComparisonCellDefaults;
  /** The RAW store split (`settings["compare.split"]`); absent = HOME. */
  readonly splitSetting: number | undefined;
  /** The menu the pane is handed (catalogue ∩ backend, 2-input, non-split). */
  readonly options: readonly ComparisonMenuOption[];
  /** The ACTIVE backend's capability probe. */
  readonly capabilities: ImageOperationSupport;
}

export interface ComparisonSelection {
  /** What the store/authoring says — NEVER a projected value. Write callbacks
   *  and the "modified" check reason about this. */
  readonly raw: string;
  /** What actually renders: `raw`, or `split` when the backend lacks `raw`. */
  readonly effective: string;
  /** The compare MODE that follows from `effective`. */
  readonly mode: "split" | "diff";
  /** The diff kernel the pane seeds — always a member of `options` (or `split`
   *  when the menu is empty), so the menu can never show an absent selection. */
  readonly operationId: string;
  /** The substitution to report as a chip, when one happened. */
  readonly fallback: CapabilityFallback | null;
  /** True when the user moved the selection or the divider off HOME. */
  readonly compareModified: boolean;
  /** HOME's operation and split, resolved from the cell defaults. */
  readonly authoredDefault: string;
  readonly defaultSplit: number;
}

export function resolveComparisonSelection(
  input: ComparisonSelectionInput,
): ComparisonSelection {
  const { selected, presentation, cellDefaults, splitSetting, options, capabilities } = input;
  // HOME comes from the cell defaults; the presentation kind is only the last
  // resort for a caller (the offscreen compositor) that has no settings seed.
  const authoredDefault = cellDefaults["compare.operation"] ??
    (presentation === "split"
      ? FALLBACK_COMPARISON_OPERATION
      : options[0]?.id ?? FALLBACK_COMPARISON_OPERATION);
  const defaultSplit = cellDefaults["compare.split"] ?? DEFAULT_COMPARE_SPLIT;
  const raw = selected ?? authoredDefault;
  const { effective, fallback } = projectComparisonOperation(raw, capabilities);
  const offered = effective !== FALLBACK_COMPARISON_OPERATION &&
    options.some((option) => option.id === effective);
  const operationId = offered
    ? effective
    : options[0]?.id ?? FALLBACK_COMPARISON_OPERATION;
  return {
    raw,
    effective,
    mode: offered ? "diff" : "split",
    operationId,
    fallback,
    compareModified: raw !== authoredDefault ||
      (splitSetting ?? defaultSplit) !== defaultSplit,
    authoredDefault,
    defaultSplit,
  };
}
