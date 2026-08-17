/**
 * STACKED grid view: shows ONE child at a time with a keyboard-driven tab strip
 * to flip between them. A pure *view* over the grid's own children — every child
 * stays MOUNTED (inactive ones `display:none`) so flipping is instant and the
 * grid's viewport-sync carries over (a synced stacked grid flips as a true A/B).
 *
 * Keys (when the stack is the target — hovered/focused inline, or inside a
 * fullscreen overlay): `←/↑/h/k` prev, `→/↓/l/j` next, `1`–`9`/`0` and `a`–`z`
 * jump. See `stack-keys.ts`. Never steals keys from a text field.
 */
import { useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { stackKeyAction, applyStackAction, stackTabBadge } from "./stack-keys";
import { GridUniformAspectContext, VIEWPORT_HEIGHT_MARGIN } from "../renderers/grid-uniform-aspect";
import { InFullscreenOverlayContext } from "../primitives/FullscreenOverlayShell";

export function StackedView({
  panes,
  labels,
  active,
  onActiveChange,
}: {
  /** One rendered child per tab, in order (kept mounted; only `active` shown). */
  panes: ReactNode[];
  /** Tab labels (one per pane). */
  labels: string[];
  active: number;
  onActiveChange: (i: number) => void;
}) {
  const count = panes.length;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inOverlay = useContext(InFullscreenOverlayContext);
  // The single-view page-height cap: like a 1-cell grid, cap the visible pane so
  // a tall image stays viewable in one screenful (the pane fills this box).
  const uniformAspect = useContext(GridUniformAspectContext)?.uniformAspect;

  // Latest active/count/callback via refs so the keydown effect subscribes ONCE
  // (not per navigation) — the listener + hover state must survive an active
  // change, else every flip re-seeds `hovered` and further keys stop working.
  const activeRef = useRef(active);
  activeRef.current = active;
  const countRef = useRef(count);
  countRef.current = count;
  const onChangeRef = useRef(onActiveChange);
  onChangeRef.current = onActiveChange;

  // Keyboard: hovered/focused (inline) OR inside a fullscreen overlay.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined") return;
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
      if (
        activeEl &&
        activeEl !== el &&
        activeEl.closest?.('input, textarea, select, [contenteditable="true"]')
      ) {
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
  }, [inOverlay]);

  const viewStyle =
    uniformAspect != null && uniformAspect > 0
      ? { maxWidth: `calc((100vh - ${VIEWPORT_HEIGHT_MARGIN}px) * ${uniformAspect})`, marginInline: "auto" as const }
      : undefined;

  return (
    <div ref={rootRef} data-cairn-stacked="" style={{ minWidth: 0 }}>
      <StackTabStrip labels={labels} active={active} onSelect={onActiveChange} />
      <div data-cairn-stacked-view="" style={{ minWidth: 0, ...viewStyle }}>
        {panes.map((pane, i) => (
          <div
            key={i}
            data-cairn-stacked-pane={i === active ? "active" : "hidden"}
            style={{ display: i === active ? "block" : "none", minWidth: 0 }}
          >
            {pane}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The horizontal tab strip: one tab per child (`<badge> <label>`), active
 *  highlighted, click-to-select, horizontally scrollable. */
function StackTabStrip({
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
      className="flex items-center gap-1 overflow-x-auto pb-1"
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
 * `stacked`. Subtle by default (fades in on hover of its enclosing `group`), so
 * it's discoverable without cluttering a clean report.
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
        "inline-flex gap-0.5 rounded border border-border bg-bg-elevated/90 p-0.5 opacity-40 transition-opacity group-hover:opacity-100 focus-within:opacity-100 " +
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
