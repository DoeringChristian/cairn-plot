// ---------------------------------------------------------------------------
// useSplitFlipKeys — in SPLIT ("slide") compare mode, Left/Right arrow snaps the
// divider fully to one edge, flipping between the two images:
//   ArrowLeft  → split = 0  (divider hard left  → foreground fills the pane)
//   ArrowRight → split = 1  (divider hard right → reference fills the pane)
// Shared by BOTH compare panes (CPU `MediaComparePane` + `GpuComparePane`) so
// the gesture is identical and lives in ONE place.
//
// Scope: a `window` keydown listener that acts ONLY when the pointer is over
// THIS pane, or focus is within it — no click-to-focus needed, which is the
// natural expectation (hover the slider, press an arrow). Hover is tracked with
// explicit `pointerenter`/`pointerleave` on the pane element (subtree-aware and
// deterministic — unlike a `:hover` match, which the browser derives from the
// real pointer and cannot be observed/tested reliably). On a page of many
// compare panes only the pane under the cursor reacts; arrows typed into a text
// field are never hijacked. The pane is also made focusable (`tabindex=-1`, out
// of the tab order) so the focus path works for keyboard users and tests.
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
    if (!el) return;

    // Explicit hover tracking (pointerenter/leave are subtree-aware and do NOT
    // bubble, so `hovered` reflects the pointer being anywhere inside the pane).
    // SEED from the live hover state so a re-run of this effect (its deps change
    // whenever the split-change callback's identity does) does not reset
    // `hovered` to false mid-hover — otherwise a stationary pointer (no new
    // pointerenter) would silently stop the arrows working.
    let hovered = false;
    try {
      hovered = el.matches(":hover");
    } catch {
      /* :hover unsupported — rely on pointerenter/leave below */
    }
    const onEnter = () => {
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    // Focusable without entering the tab order (keyboard-user / test path).
    const hadTabIndex = el.hasAttribute("tabindex");
    if (!hadTabIndex) el.tabIndex = -1;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser/OS shortcuts alone
      const active = document.activeElement as HTMLElement | null;
      // Never steal arrows from a text field / editable control.
      if (active && active !== el && active.closest?.('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      const focusedWithin = !!active && el.contains(active);
      if (!hovered && !focusedWithin) return;
      e.preventDefault();
      onSplitPositionChange(e.key === "ArrowLeft" ? 0 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
      if (!hadTabIndex) el.removeAttribute("tabindex");
    };
  }, [paneRef, mode, onSplitPositionChange]);
}
