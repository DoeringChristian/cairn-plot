/**
 * STACKED grid view pieces: a keyboard hook + a tab strip + a panes container +
 * the mode toggle. A grid in `stacked` mode shows ONE child at a time; the OWNER
 * (`GridView` / the stage) composes a thin HEADER (tab strip + toggle) ABOVE the
 * viewports (so the toggle never overlaps pane controls) and the panes below.
 *
 * Every child stays MOUNTED (inactive ones `display:none`) so flipping is instant
 * and the grid's viewport-sync carries over (a synced stacked grid flips A/B).
 *
 * Keys (via `useStackKeyboard`, when the stack is hovered/focused or inside a
 * fullscreen overlay): `←/↑/h/k` prev, `→/↓/l/j` next (wrap), `1`–`9`/`0` and
 * `a`–`z` jump. Never steals keys from a text field.
 */
import { useContext, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { stackKeyAction, applyStackAction, stackTabBadge } from "./stack-keys";
import { InFullscreenOverlayContext } from "../primitives/FullscreenOverlayShell";

/**
 * Window keydown → stack navigation, scoped to `rootRef` (hovered/focused inline,
 * or inside a fullscreen overlay). Reads active/count/onChange via refs so the
 * listener subscribes ONCE — the hover state must survive a flip. No-op when
 * `enabled` is false.
 */
export function useStackKeyboard(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  active: number,
  count: number,
  onActiveChange: (i: number) => void,
  opts?: { inOverlay?: boolean },
): void {
  // In a fullscreen overlay the tab keys act UNCONDITIONALLY (no hover/focus
  // needed — one active view), exactly like the slide-flip. The compare/enlarge
  // STAGE calls this hook ABOVE its own `FullscreenOverlayShell` provider, so a
  // `useContext` here would read `false`; it passes `inOverlay` explicitly. An
  // INLINE `cp.Grid` passes nothing and gets the context value (false → requires
  // hover), which is correct there.
  const ctxOverlay = useContext(InFullscreenOverlayContext);
  const inOverlay = opts?.inOverlay ?? ctxOverlay;
  const activeRef = useRef(active);
  activeRef.current = active;
  const countRef = useRef(count);
  countRef.current = count;
  const onChangeRef = useRef(onActiveChange);
  onChangeRef.current = onActiveChange;

  useEffect(() => {
    const el = rootRef.current;
    if (!enabled || !el || typeof window === "undefined") return;
    let hovered = false;
    try {
      hovered = el.matches(":hover");
    } catch {
      /* :hover unsupported — rely on pointer events */
    }
    const onEnter = () => (hovered = true);
    const onLeave = () => (hovered = false);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    if (!el.hasAttribute("tabindex")) el.tabIndex = -1;

    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl !== el && activeEl.closest?.('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      const focusedWithin = !!activeEl && el.contains(activeEl);
      if (!hovered && !focusedWithin && !inOverlay) return;
      const action = stackKeyAction(e.key, e, countRef.current);
      if (!action) return;
      e.preventDefault();
      onChangeRef.current(applyStackAction(action, activeRef.current, countRef.current));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, inOverlay, rootRef]);
}

/** The horizontal tab strip: one tab per child (`<badge> <label>`), active
 *  highlighted, click-to-select, horizontally scrollable. */
export function StackTabStrip({
  labels,
  active,
  onSelect,
}: {
  labels: string[];
  active: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div
      data-cairn-stack-tabs=""
      role="tablist"
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      {labels.map((label, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-cairn-stack-tab={isActive ? "active" : ""}
            title={`${label} — press ${stackTabBadge(i)}`}
            onClick={() => onSelect(i)}
            className={
              "flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs " +
              (isActive
                ? "bg-accent/15 text-fg ring-1 ring-accent"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg")
            }
          >
            <span
              className={
                "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold " +
                (isActive ? "bg-accent text-white" : "bg-bg-hover text-fg-muted")
              }
            >
              {stackTabBadge(i)}
            </span>
            <span className="max-w-40 truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The `▦ | ▭` segmented control that toggles a grid between `normal` and
 * `stacked`. Lives in the grid's header row (never overlapping pane controls).
 */
export function GridModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: "normal" | "stacked";
  onChange: (m: "normal" | "stacked") => void;
  className?: string;
}) {
  const btn = (m: "normal" | "stacked", icon: ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      aria-pressed={mode === m}
      data-cairn-grid-mode={m}
      data-active={mode === m ? "true" : undefined}
      onClick={() => onChange(m)}
      className={
        "flex h-6 w-6 items-center justify-center rounded " +
        (mode === m ? "bg-accent/20 text-fg ring-1 ring-accent" : "text-fg-muted hover:bg-bg-hover hover:text-fg")
      }
    >
      {icon}
    </button>
  );
  const svg = (children: ReactNode) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
  return (
    <div
      data-cairn-grid-mode-toggle=""
      className={
        "inline-flex shrink-0 gap-0.5 rounded border border-border bg-bg-elevated/90 p-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100 " +
        (className ?? "")
      }
    >
      {btn(
        "normal",
        svg(
          <>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </>,
        ),
        "Grid view",
      )}
      {btn(
        "stacked",
        svg(
          <>
            <rect x="4" y="4" width="16" height="10" rx="1" />
            <path d="M6 17h12M7 20h10" />
          </>,
        ),
        "Stacked view (flip with arrows / hjkl / number / letter)",
      )}
    </div>
  );
}

/** A stable per-tab label from a child descriptor: its own caption if present,
 *  else a positional "View N". */
export function stackLabelFor(node: unknown, index: number): string {
  const p =
    node && typeof node === "object" && "props" in node
      ? (node as { props?: Record<string, unknown> }).props
      : undefined;
  const label =
    (typeof p?.label === "string" && p.label) ||
    (typeof p?.labelB === "string" && p.labelB) ||
    (typeof p?.labelA === "string" && p.labelA) ||
    "";
  return label || `View ${index + 1}`;
}
