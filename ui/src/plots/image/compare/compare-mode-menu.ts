/**
 * `buildCompareModeMenu` — the ONE builder for the compare/diff MODE toolbar
 * menu (split · <diff operations>), shared by the two hosts that
 * render it: `CompareView` (`plot-node.tsx`, the compare overlay toolbar) and
 * `GpuComparePane` (the composited-view shell toolbar). Both copy-pasted the
 * same option list and the same onSelect
 * switch; this is that logic written once.
 *
 * Deliberately registry-FREE — the caller passes `kernelOptions` in. Both hosts
 * get that list from the SAME place: the image host adapter
 * (`runtime/view.tsx`) builds it once via `comparisonMenuOptions()` — registry
 * order and labels, filtered by the active backend's capabilities — and hands
 * it down as `ImageComparisonInput.operationOptions`. Because this module never
 * imports the operation registry it stays safe for `core.iife.js`.
 */
import type { ToolbarButtonSpec } from "../../../primitives/controls/ToolbarConfig";

/** A `{id,label}` diff-operation entry (the shape `comparisonMenuOptions()` emits). */
export interface CompareModeMenuOption {
  id: string;
  label: string;
}

export interface CompareModeMenuArgs {
  /** The current view mode. `"split"` shows as "Split". */
  mode: "split" | "diff";
  /** The selected diff operation id — the menu value when `mode === "diff"`. */
  operation: string;
  /** Diff-operation entries to append after split (may be empty). */
  kernelOptions: CompareModeMenuOption[];
  /** Switch to split mode. */
  onSplit: () => void;
  /** Switch to diff mode with the picked operation id. */
  onOperation: (operationId: string) => void;
}

/**
 * Build the compare MODE menu spec. The menu VALUE is "split" in split mode
 * and, in diff mode, the selected `operation`.
 */
export function buildCompareModeMenu({
  mode,
  operation,
  kernelOptions,
  onSplit,
  onOperation,
}: CompareModeMenuArgs): ToolbarButtonSpec {
  const options: CompareModeMenuOption[] = [
    // Split leads the menu (matching the public enum split · <operations>).
    { id: "split", label: "Split" },
    ...kernelOptions,
  ];
  const value = mode === "split" ? "split" : operation;
  return {
    id: "compare-mode",
    title: "Compare / diff mode",
    menu: {
      options,
      value,
      onSelect: (id: string) => {
        if (id === "split") onSplit();
        else onOperation(id);
      },
    },
  };
}
