// ---------------------------------------------------------------------------
// useSplitFlipKeys — in SPLIT ("slide") compare mode, snap the divider fully to
// one edge, flipping between the two images:
//   left  → split = 0  (divider hard left  → foreground fills the pane)
//   right → split = 1  (divider hard right → reference fills the pane)
// Keys: `[` (left) / `]` (right) are the DEDICATED slide-flip keys — they work
// everywhere and never collide with anything. `←`/`→` (and `h`/`l` aliases) ALSO
// flip, but ONLY when NOT inside a stacked grid — there arrows/hjkl drive the tab
// strip, so the divider is reached with `[`/`]` (distinct keys, no collision).
// Shared by BOTH compare panes (CPU `MediaComparePane` + `GpuComparePane`).
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
import { useContext, useEffect } from "react";
import type { RefObject } from "react";
import { InFullscreenOverlayContext } from "../primitives/FullscreenOverlayShell";
import { InStackedGridContext } from "../../../layout/stack/stack-context";

export function useSplitFlipKeys(
  paneRef: RefObject<HTMLElement | null>,
  mode: string,
  onSplitPositionChange?: (pos: number) => void,
  opts?: { inStackedGrid?: boolean; inOverlay?: boolean },
): void {
  // `inOverlay` / `inStackedGrid` are resolved from React context by CORE callers
  // (e.g. the CPU `MediaComparePane`). But the GPU `GpuComparePane` ships in a
  // SEPARATE bundle: its copy of these context objects is a DIFFERENT identity
  // than the one the core `StackedPanes` / `FullscreenOverlayShell` providers use,
  // so a cross-bundle `useContext` here silently returns the DEFAULT (`false`) —
  // which made `→` both flip the slider AND change the tab inside a stacked grid.
  // The fix: the CORE adapter (`CompositeMediaPane`) reads the contexts on the
  // correct side of the boundary and threads the booleans in via `opts`, exactly
  // as `settingsSyncGroupId` is threaded. `opts` wins; the context read is only a
  // fallback for callers that don't thread (kept so behaviour is unchanged there).
  const ctxOverlay = useContext(InFullscreenOverlayContext);
  const ctxStacked = useContext(InStackedGridContext);
  const inOverlay = opts?.inOverlay ?? ctxOverlay;
  // Inside a STACKED grid, plain arrows/hjkl drive the tab strip, so the slide-
  // flip is reached with the DEDICATED `[`/`]` keys (distinct from the tab keys,
  // no collision); arrows/hjkl no longer flip here.
  const inStackedGrid = opts?.inStackedGrid ?? ctxStacked;
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
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser/OS shortcuts alone
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      // `[`/`]` are DEDICATED — always flip. Arrows/hjkl also flip, but not in a
      // stacked grid (there they drive the tab strip), so there's no collision.
      const isLeft = k === "[" || (!inStackedGrid && (k === "ArrowLeft" || k === "h"));
      const isRight = k === "]" || (!inStackedGrid && (k === "ArrowRight" || k === "l"));
      if (!isLeft && !isRight) return;
      const active = document.activeElement as HTMLElement | null;
      // Never steal keys from a text field / editable control.
      if (active && active !== el && active.closest?.('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      const focusedWithin = !!active && el.contains(active);
      if (!hovered && !focusedWithin && !inOverlay) return;
      e.preventDefault();
      onSplitPositionChange(isLeft ? 0 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
      if (!hadTabIndex) el.removeAttribute("tabindex");
    };
  }, [paneRef, mode, onSplitPositionChange, inOverlay, inStackedGrid]);
}
