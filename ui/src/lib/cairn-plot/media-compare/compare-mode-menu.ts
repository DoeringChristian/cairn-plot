/**
 * `buildCompareModeMenu` — the ONE builder for the compare/diff MODE toolbar
 * menu (side · slide · blend · <diff kernels>), shared by the two hosts that
 * render it: `CompareView` (`plot-node.tsx`, the side-view overlay toolbar) and
 * `GpuComparePane` (the composited-view shell toolbar). Both copy-pasted the
 * same option list, the same split↔slide label aliasing, and the same onSelect
 * switch; this is that logic written once.
 *
 * Deliberately engine-FREE — the caller passes `kernelOptions` (from
 * `listDiffMenuModes()` in the addon, or the window-published list `plot-node`
 * reads to keep `engine/kernels` out of `core.iife.js`), so this module never
 * imports the kernel registry and stays safe for the core bundle.
 */
import type { ToolbarButtonSpec } from "../controls/ToolbarConfig";

/** A `{id,label}` diff-kernel entry (the shape of `listDiffMenuModes()`). */
export interface CompareModeMenuOption {
  id: string;
  label: string;
}

export interface CompareModeMenuArgs {
  /**
   * The current view mode. `"split"` shows as "Slide"; `"side"` is only valid
   * when `onSide` is wired (the side layout is owned above the composited pane).
   */
  mode: "side" | "split" | "blend" | "diff";
  /** The selected diff kernel id — the menu value when `mode === "diff"`. */
  kernel: string;
  /** Diff-kernel entries to append after side/slide/blend (may be empty). */
  kernelOptions: CompareModeMenuOption[];
  /** Switch to slide (split) mode. */
  onSlide: () => void;
  /** Switch to blend mode. */
  onBlend: () => void;
  /** Switch to diff mode with the picked kernel id. */
  onKernel: (kernelId: string) => void;
  /** When provided, a leading "Side" entry delegates here; omit to hide it. */
  onSide?: () => void;
}

/**
 * Build the compare MODE menu spec. The menu VALUE aliases split→"slide" (the
 * label the user sees) and, in diff mode, shows the selected `kernel`.
 */
export function buildCompareModeMenu({
  mode,
  kernel,
  kernelOptions,
  onSlide,
  onBlend,
  onKernel,
  onSide,
}: CompareModeMenuArgs): ToolbarButtonSpec {
  const options: CompareModeMenuOption[] = [
    // "Side" leads the menu (matching the Python enum side · slide · blend ·
    // <kernels>) but only when an owner wired `onSide` to receive it.
    ...(onSide ? [{ id: "side", label: "Side" }] : []),
    { id: "slide", label: "Slide" },
    { id: "blend", label: "Blend" },
    ...kernelOptions,
  ];
  const value =
    mode === "side" ? "side" : mode === "split" ? "slide" : mode === "blend" ? "blend" : kernel;
  return {
    id: "compare-mode",
    title: "Compare / diff mode",
    menu: {
      options,
      value,
      onSelect: (id: string) => {
        if (id === "side") onSide?.();
        else if (id === "slide") onSlide();
        else if (id === "blend") onBlend();
        else onKernel(id);
      },
    },
  };
}
