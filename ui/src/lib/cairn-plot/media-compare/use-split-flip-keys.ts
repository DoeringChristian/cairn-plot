// ---------------------------------------------------------------------------
// useSplitFlipKeys — in SPLIT ("slide") compare mode, Left/Right arrow snaps the
// divider fully to one edge, flipping between the two images:
//   ArrowLeft  → split = 0  (divider hard left  → foreground fills the pane)
//   ArrowRight → split = 1  (divider hard right → reference fills the pane)
// Shared by BOTH compare panes (CPU `MediaComparePane` + `GpuComparePane`) so
// the gesture is identical and lives in ONE place.
//
// Scope: a `window` keydown listener that acts ONLY when the user is POINTING AT
// (`:hover`) or FOCUSED WITHIN this pane — no click-to-focus required, which is
// the natural expectation (you're hovering the slider, you press an arrow). On a
// page with many compare panes, only the pane under the cursor reacts. Arrows
// typed into a text field / menu are never hijacked. The pane is made focusable
// (`tabindex=-1`, out of the tab order) so the focus path also works for keyboard
// users and deterministic tests.
// ---------------------------------------------------------------------------
import { useEffect } from "react";
import type { RefObject } from "react";

export function useSplitFlipKeys(
  paneRef: RefObject<HTMLElement | null>,
  mode: string,
  onSplitPositionChange?: (pos: number) => void,
): void {
  useEffect(() => {
    if (mode !== "split" || !onSplitPositionChange) return;
    if (typeof window === "undefined") return;
    const el = paneRef.current;
    // Focusable (out of the tab order) so the focus path works too; hover is the
    // primary trigger and needs no tabindex.
    const hadTabIndex = el?.hasAttribute("tabindex") ?? true;
    if (el && !hadTabIndex) el.tabIndex = -1;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser/OS shortcuts alone
      const pane = paneRef.current;
      if (!pane) return;
      const active = document.activeElement as HTMLElement | null;
      // Never steal arrows from a text field / editable control / open menu.
      if (active?.closest?.('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"]')) {
        return;
      }
      // Act on the pane the user is pointing at OR focused within.
      const pointed = pane.matches(":hover");
      const focused = active ? pane.contains(active) : false;
      if (!pointed && !focused) return;
      e.preventDefault();
      onSplitPositionChange(e.key === "ArrowLeft" ? 0 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (el && !hadTabIndex) el.removeAttribute("tabindex");
    };
  }, [paneRef, mode, onSplitPositionChange]);
}
