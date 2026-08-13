/**
 * `FullscreenOverlayShell` — the shared CHROME for a `document.body`-portaled,
 * fixed, full-viewport overlay. ONE implementation of the backdrop + centered
 * elevated frame + ✕ + Escape + backdrop-click + page-scroll-lock + themed
 * portal, so the two overlays that need it do not each hand-roll it:
 *
 *   - the per-pane ENLARGE (`renderers/ImagePaneShell.tsx`) — one pane promoted
 *     to fullscreen (its `<canvas>` reparented into the frame);
 *   - the page-level SELECTION STAGE (`src/selection-stage.tsx`) — a GRID of the
 *     selected panes (enlarge) or of comparison panes (compare).
 *
 * ## What it owns
 *   - a `createPortal(..., document.body)` FIXED / full-viewport / high-z /
 *     `isolation: isolate` backdrop with a dim scrim + blur (inline geometry so
 *     it escapes ALL host CSS unconditionally);
 *   - THEME follow-through: the portal is not a DOM descendant of the origin
 *     pane, so `useOriginTheme(open, originRef)` snapshots the origin's
 *     `.cairn-plot-doc` scope + resolved `--color-*` vars + `data-theme` /
 *     `color-scheme` onto the backdrop (the shared themed-portal helper);
 *   - a centered `bg-bg-elevated` dialog frame holding `children`;
 *   - a ✕ button in the backdrop GUTTER (outside the frame), Escape, and a
 *     backdrop click — all call `onClose`;
 *   - focus management: focus the ✕ on open, restore the trigger's focus on
 *     close;
 *   - page-scroll lock on the REAL scroll root (`document.scrollingElement`) for
 *     the overlay's lifetime, WITHOUT blanket wheel-preventDefault (so scrollable
 *     UI inside the overlay still scrolls) — restored exactly on close/unmount.
 *
 * The default `data-*` markers match the historical enlarge overlay
 * (`data-cairn-plot-enlarge-*`) so `ImagePaneShell` keeps its exact test seam;
 * the stage passes its own markers.
 */
import { createContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";
import { useOriginTheme } from "./themed-portal";

/**
 * `true` for any subtree rendered inside a `FullscreenOverlayShell` — the per-pane
 * ENLARGE or the selection STAGE. A modal-scoped affordance (e.g. the split-flip
 * arrows) reads this to act globally within the ONE active overlay, instead of
 * reaching UP the DOM for the owner's marker attributes. Default `false` (inline).
 */
export const InFullscreenOverlayContext = createContext(false);

export interface FullscreenOverlayShellProps {
  /** Whether the overlay is mounted. */
  open: boolean;
  /** Close request (✕ / Escape / backdrop click). */
  onClose: () => void;
  /** The in-tree element whose THEME the body-portaled overlay copies. MUST stay
   *  inside the origin theme scope (do not pass an element that gets reparented
   *  INTO the overlay, or the theme resolves against document.body). */
  originRef: RefObject<HTMLElement | null>;
  /** aria-label for the dialog frame. */
  ariaLabel: string;
  /** Overlay body — rendered inside the centered elevated frame. */
  children: ReactNode;
  /** `data-*` marker (bare attribute) for the backdrop. Default matches the
   *  historical enlarge overlay so existing selectors keep working. */
  backdropAttr?: string;
  /** `data-*` marker for the centered frame. */
  frameAttr?: string;
  /** `data-*` marker for the ✕ close button. */
  closeAttr?: string;
}

export default function FullscreenOverlayShell({
  open,
  onClose,
  originRef,
  ariaLabel,
  children,
  backdropAttr = "data-cairn-plot-enlarge-backdrop",
  frameAttr = "data-cairn-plot-enlarge-frame",
  closeAttr = "data-cairn-plot-enlarge-close",
}: FullscreenOverlayShellProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Snapshot the origin pane's theme onto the body portal (dark/light follow).
  const theme = useOriginTheme(open, originRef);

  // Escape closes + focus management: capture the previously-focused element on
  // open, focus the ✕, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      const prev = prevFocusRef.current;
      prevFocusRef.current = null;
      if (prev && prev.isConnected) prev.focus?.();
    };
  }, [open, onClose]);

  // Page-scroll lock on the REAL scroll root (usually <html> in standards mode).
  // Do NOT preventDefault wheel — that would swallow wheel bubbling up from
  // scrollable UI INSIDE the overlay; locking the root already stops the page.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const scroller = (document.scrollingElement as HTMLElement | null) ?? document.body;
    const prevOverflow = scroller.style.overflow;
    const prevOverscroll = scroller.style.overscrollBehavior;
    scroller.style.overflow = "hidden";
    scroller.style.overscrollBehavior = "none";
    return () => {
      scroller.style.overflow = prevOverflow;
      scroller.style.overscrollBehavior = prevOverscroll;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`${theme.className} motion-safe:transition-opacity`}
      data-theme={theme["data-theme"]}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        isolation: "isolate",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(8px, 2.5vw, 40px)",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        pointerEvents: "auto",
        ...theme.style,
      }}
      {...{ [backdropAttr]: "" }}
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-lg border border-border bg-bg-elevated shadow-2xl"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        {...{ [frameAttr]: "" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <InFullscreenOverlayContext.Provider value={true}>{children}</InFullscreenOverlayContext.Provider>
      </div>
      {/* ✕ in the backdrop's top-right gutter (OUTSIDE the frame) — visible,
          focusable, theme-aware; Escape and a backdrop click also close. */}
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Exit fullscreen (Esc)"
        title="Exit fullscreen (Esc)"
        className="border border-border bg-bg-elevated/90 text-fg-muted shadow-sm hover:text-fg hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-accent"
        {...{ [closeAttr]: "" }}
        style={{
          position: "absolute",
          right: 6,
          top: 6,
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 9999,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
