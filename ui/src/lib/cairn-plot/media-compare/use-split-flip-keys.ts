// ---------------------------------------------------------------------------
// useSplitFlipKeys — in SPLIT ("slide") compare mode, Left/Right arrow snaps the
// divider fully to one edge, flipping between the two images:
//   ArrowLeft  → split = 0  (divider hard left  → foreground fills the pane)
//   ArrowRight → split = 1  (divider hard right → reference fills the pane)
// Shared by BOTH compare panes (CPU `MediaComparePane` + `GpuComparePane`) so
// the gesture is identical and lives in ONE place.
//
// Scope: listeners live on the PANE element (via `paneRef`), not `window`, so on
// a page with many compare panes the arrows only flip the pane the user is
// working in. The pane is made focusable (`tabindex=-1`, kept out of the tab
// order) and focused on the first pointerdown — captured so even a press that
// begins on the divider (which stops propagation) still focuses the pane. Once
// focused, arrow keydowns bubble to the pane and flip the split. Arrows typed
// into a toolbar input/menu are never hijacked.
// ---------------------------------------------------------------------------
import { useEffect } from "react";
import type { RefObject } from "react";

export function useSplitFlipKeys(
  paneRef: RefObject<HTMLElement | null>,
  mode: string,
  onSplitPositionChange?: (pos: number) => void,
): void {
  useEffect(() => {
    const el = paneRef.current;
    if (!el || mode !== "split" || !onSplitPositionChange) return;

    // Make the pane focusable without inserting it into the tab order.
    const hadTabIndex = el.hasAttribute("tabindex");
    if (!hadTabIndex) el.tabIndex = -1;

    const focusPane = () => {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* best-effort */
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser/OS shortcuts alone
      // Never steal arrows from a text field / editable control (e.g. a menu).
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== el && active.closest?.('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      e.preventDefault();
      onSplitPositionChange(e.key === "ArrowLeft" ? 0 : 1);
    };

    // Capture the pointerdown so a press starting on the divider (which
    // stopPropagations in the bubble phase) still focuses the pane.
    el.addEventListener("pointerdown", focusPane, true);
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerdown", focusPane, true);
      el.removeEventListener("keydown", onKey);
      if (!hadTabIndex) el.removeAttribute("tabindex");
    };
  }, [paneRef, mode, onSplitPositionChange]);
}
