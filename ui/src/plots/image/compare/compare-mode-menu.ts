/**
 * `buildCompareModeMenu` — the ONE builder for the compare/diff MODE toolbar
 * menu (split · <diff kernels>), shared by the two hosts that
 * render it: `CompareView` (`plot-node.tsx`, the compare overlay toolbar) and
 * `GpuComparePane` (the composited-view shell toolbar). Both copy-pasted the
 * same option list and the same onSelect
 * switch; this is that logic written once.
 *
 * Deliberately engine-FREE — the caller passes `kernelOptions` (from
 * `listDiffMenuModes()` in the addon, or the window-published list `plot-node`
 * reads to keep `engine/kernels` out of `core.iife.js`), so this module never
 * imports the kernel registry and stays safe for the core bundle.
 */
import type { ToolbarButtonSpec } from "../../../primitives/controls/ToolbarConfig";

/** A `{id,label}` diff-kernel entry (the shape of `listDiffMenuModes()`). */
export interface CompareModeMenuOption {
  id: string;
  label: string;
}

export interface CompareModeMenuArgs {
  /** The current view mode. `"split"` shows as "Split". */
  mode: "split" | "diff";
  /** The selected diff kernel id — the menu value when `mode === "diff"`. */
  kernel: string;
  /** Diff-kernel entries to append after split (may be empty). */
  kernelOptions: CompareModeMenuOption[];
  /** Switch to split mode. */
  onSplit: () => void;
  /** Switch to diff mode with the picked kernel id. */
  onKernel: (kernelId: string) => void;
}

/**
 * Build the compare MODE menu spec. The menu VALUE is "split" in split mode
 * and, in diff mode, the selected `kernel`.
 */
export function buildCompareModeMenu({
  mode,
  kernel,
  kernelOptions,
  onSplit,
  onKernel,
}: CompareModeMenuArgs): ToolbarButtonSpec {
  const options: CompareModeMenuOption[] = [
    // Split leads the menu (matching the public enum split · <kernels>).
    { id: "split", label: "Split" },
    ...kernelOptions,
  ];
  const value = mode === "split" ? "split" : kernel;
  return {
    id: "compare-mode",
    title: "Compare / diff mode",
    menu: {
      options,
      value,
      onSelect: (id: string) => {
        if (id === "split") onSplit();
        else onKernel(id);
      },
    },
  };
}
