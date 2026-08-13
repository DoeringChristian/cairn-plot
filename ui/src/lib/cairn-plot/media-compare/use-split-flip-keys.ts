// ---------------------------------------------------------------------------
// useSplitFlipKeys — in SPLIT ("slide") compare mode, Left/Right arrow snaps the
// divider fully to one edge, flipping between the two images:
//   ArrowLeft  → split = 0  (divider hard left  → foreground fills the pane)
//   ArrowRight → split = 1  (divider hard right → reference fills the pane)
// Shared by BOTH compare panes (CPU `MediaComparePane` + `GpuComparePane`) so
// the gesture is identical and lives in ONE place.
//
// Scope: a `window` keydown listener.
//   - Inside a FULLSCREEN compare/enlarge overlay (a modal with ONE active
//     compare context) the arrows act unconditionally — no hover and no
//     click-to-focus needed. This is the natural expectation there: open the
//     slide view, press Left/Right. (A compare GRID in the overlay is
//     settings-synced, so every pane's `splitPosition` flips together.)
//   - INLINE (a compare card on a report page with possibly many panes) the
//     arrows act ONLY when the pointer is over THIS pane or focus is within it,
//     so a lone pane still responds on hover but sibling panes never all move at
//     once. Hover is tracked with explicit `pointerenter`/`pointerleave` on the
//     pane element (subtree-aware and deterministic — unlike a `:hover` match,
//     which the browser derives from the real pointer and cannot be observed/
//     tested reliably).
// Arrows typed into a text field are never hijacked. The pane is also made
// focusable (`tabindex=-1`, out of the tab order) so the focus path works for
// keyboard users and tests.
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
      // Inside a fullscreen compare/enlarge overlay the arrows always act (modal,
      // one active compare) — no hover/focus needed. Inline, require hover/focus.
      const inOverlay = !!el.closest?.(
        "[data-cairn-plot-stage-frame], [data-cairn-plot-enlarge-frame]",
      );
      if (!hovered && !focusedWithin && !inOverlay) return;
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
