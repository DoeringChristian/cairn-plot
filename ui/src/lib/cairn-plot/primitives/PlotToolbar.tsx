/**
 * `primitives/PlotToolbar.tsx` — the cairn-plot answer to Plotly's modebar (S1).
 *
 * A hover-reveal cluster of icon buttons anchored inside a chart's plot area.
 * Its SOLE meaningful input is a {@link PlotController}: every button group is
 * capability-gated off `controller.capabilities`, and every click delegates to
 * a controller method, so the toolbar is renderer-agnostic and holds no chart
 * state of its own. An optional {@link ToolbarConfig} tunes placement / reveal /
 * per-button visibility without touching the controller.
 *
 * Reveal model mirrors CardHeader's grip: the toolbar sits at `opacity-0` and
 * fades to `opacity-100` on `group-hover` (the renderer's root carries the
 * `group` class). Button chrome matches CardHeader's sizing (`h-[22px]
 * min-w-[22px] …`), but the icons are inline SVG (see `ICON_PATHS` below) —
 * the self-contained plot bundle can't depend on the app's CDN Font Awesome.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { DragMode, PlotController } from "../controls/types";
import type {
  ToolbarConfig,
  ToolbarMenuSpec,
  ToolbarButtonSpec,
  ToolbarSliderSpec,
} from "../controls/ToolbarConfig";
import { downloadBlob } from "./plot-to-png";
import { computeToolbarFold, selectedMenuIndex } from "./toolbar-fold";

export interface PlotToolbarProps {
  /** The imperative facade this modebar drives (the only real input). */
  controller: PlotController;
  /** Optional per-mount tuning (placement / reveal / per-button hiding). */
  config?: ToolbarConfig;
}

const POSITION_STYLE: Record<
  NonNullable<ToolbarConfig["position"]>,
  CSSProperties
> = {
  "top-right": { top: 6, right: 6 },
  "top-left": { top: 6, left: 6 },
  "bottom-right": { bottom: 6, right: 6 },
  "bottom-left": { bottom: 6, left: 6 },
};

// Inline SVG icons. The standalone / self-contained plot bundle can't use the
// app's Font Awesome (it's loaded from a CDN stylesheet, and the emitted HTML's
// CSP blocks external requests), so the modebar ships its own icons. Each uses
// `currentColor` so it inherits the button's text color (active/hover states).
const ICON_PATHS: Record<string, ReactNode> = {
  boxZoom: <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="4 3" />,
  // Box-select: a dashed marquee with a filled cursor arrow tucked in a corner.
  select: (
    <>
      <rect x="3" y="3" width="11" height="11" rx="1" strokeDasharray="3 2.5" />
      <path
        d="M12 12l8.5 3.3-3.4 1-1 3.4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </>
  ),
  // Lasso: a closed freeform loop with a short rope tail + knot.
  lasso: (
    <>
      <path d="M12 4c4.4 0 7.3 2.9 6.6 6.4-0.7 3.5-4.9 5.3-8.8 4.5C6.4 14.2 4.6 11.4 5.7 8.7 6.8 6 9.2 4 12 4z" />
      <path d="M8.7 15.2c-1.3 0.9-1.8 2.3-1.2 3.5" />
      <circle cx="7.7" cy="19.6" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  pan: (
    <>
      <path d="M12 2v20M2 12h20" />
      <path d="M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M21 21l-5.2-5.2M7.5 10.5h6" />
    </>
  ),
  autoscale: (
    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
  ),
  home: (
    <path d="M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5M9.5 21v-6h5v6" />
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.3" />
    </>
  ),
  // A small down-caret for the menu (dropdown) button face.
  caret: <path d="M6 9l6 6 6-6" />,
  // Overflow ("⋯") — the folded-toolbar trigger.
  ellipsis: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Sun (EXPOSURE slider) — a disc with short rays.
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  // Plus/minus (OFFSET slider).
  plusminus: (
    <>
      <path d="M4 7h6M7 4v6" />
      <path d="M14 17h6" />
      <path d="M6 20l12-16" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

function ToolbarButton({
  icon,
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  /** Inline-SVG icon name; used when `label` is absent. */
  icon?: string;
  /** Short text label (e.g. "0–255"); rendered instead of an icon. */
  label?: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        // The toolbar floats over the plot surface; keep clicks from reaching
        // the chart's pointer/gesture handlers underneath.
        e.stopPropagation();
        // A disabled button (e.g. the always-shown "home" button while the view
        // is already at home) must never fire its action.
        if (disabled) return;
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={title}
      aria-pressed={active}
      aria-disabled={disabled}
      title={title}
      className={[
        // Fixed box size so the toolbar width never changes and buttons don't
        // shift under the cursor (a disabled button keeps its footprint). A
        // text-label button gets horizontal padding + a mono font instead.
        "h-[22px] min-w-[22px] inline-flex items-center justify-center rounded",
        label ? "px-1.5 text-[10px] font-mono" : "text-xs",
        disabled
          ? "opacity-40 cursor-default text-fg-muted"
          : active
            ? "bg-bg-hover text-accent"
            : "text-fg-muted hover:text-fg hover:bg-bg-hover",
      ].join(" ")}
    >
      {label ? <span aria-hidden="true">{label}</span> : <Icon name={icon ?? ""} />}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-border" />;
}

/**
 * The MENU (dropdown) variant of a leading toolbar button. Self-contained: it
 * owns its open/highlight state and closes on select / outside-click / Escape,
 * with arrow-key + Enter keyboarding. The button face shows the current
 * option's label (or the spec's `icon`) + a caret; the option list is
 * absolutely positioned below it (`z-40`, above the `z-30` toolbar) and styled
 * like the tooltip chrome (rounded / bordered / elevated bg / shadow). No
 * portal / no external dependency — it lives in the toolbar's own DOM subtree.
 */
function ToolbarMenu({
  icon,
  title,
  menu,
}: {
  icon?: string;
  title: string;
  menu: ToolbarMenuSpec;
}) {
  const { options, value, onSelect } = menu;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = selectedMenuIndex(options, value);
  const face = icon ? undefined : (options[selectedIndex]?.label ?? "");

  // Open toward the current selection so the highlight starts where the user
  // expects (Plotly / native <select> behavior).
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setHighlight(selectedIndex);
      return next;
    });
  }, [selectedIndex]);

  const choose = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );

  // Close on outside-click / Escape while open (self-contained — no parent
  // wiring). Both listeners are torn down when the menu closes/unmounts.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setHighlight(selectedIndex);
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) choose(opt.id);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-flex" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={title}
        title={title}
        className={[
          "h-[22px] min-w-[22px] inline-flex items-center gap-0.5 rounded",
          face ? "px-1.5 text-[10px] font-mono" : "px-1 text-xs",
          open ? "bg-bg-hover text-accent" : "text-fg-muted hover:text-fg hover:bg-bg-hover",
        ].join(" ")}
      >
        {face ? <span aria-hidden="true">{face}</span> : <Icon name={icon ?? ""} />}
        <Icon name="caret" />
      </button>
      {open && (
        <ul
          role="listbox"
          className={[
            // Above the toolbar (z-30); tooltip-like chrome.
            "absolute left-0 top-full z-40 mt-1 min-w-[7rem] max-h-64 overflow-auto",
            "rounded border border-border bg-bg-elevated py-0.5 shadow-md",
          ].join(" ")}
        >
          {options.map((opt, i) => {
            const isSelected = opt.id === value;
            const isHi = i === highlight;
            return (
              <li key={opt.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(opt.id);
                  }}
                  onPointerEnter={() => setHighlight(i)}
                  className={[
                    "block w-full text-left px-2 py-1 text-[11px] whitespace-nowrap",
                    isHi ? "bg-bg-hover" : "",
                    isSelected ? "text-accent font-medium" : "text-fg",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Normalized action descriptor — the ONE source both the expanded button row
 *  and the folded overflow menu render from, so the two never diverge. */
interface ActionItem {
  id: string;
  icon?: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const sliderFmt = (s: ToolbarSliderSpec) => (s.format ? s.format(s.value) : String(s.value));

/**
 * A compact slider for the toolbar's SECOND row (image panes' EXPOSURE /
 * OFFSET). Icon (or short label) + native range input + a tiny value read-out.
 * Controlled — holds no state. `stopPropagation` on the pointer events keeps a
 * drag from reaching the plot surface underneath (same as `ToolbarButton`).
 */
function ToolbarSlider({ spec }: { spec: ToolbarSliderSpec }) {
  return (
    <label
      className="inline-flex items-center gap-1 text-fg-muted"
      title={spec.title}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (spec.defaultValue !== undefined) spec.onChange(spec.defaultValue);
      }}
    >
      {spec.icon ? (
        <span aria-hidden="true" className="inline-flex">
          <Icon name={spec.icon} />
        </span>
      ) : (
        <span aria-hidden="true" className="text-[9px] font-mono">
          {spec.label}
        </span>
      )}
      <input
        type="range"
        aria-label={spec.title}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={spec.value}
        onChange={(e) => spec.onChange(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        className="cairn-plot-toolbar-slider h-1 w-16 cursor-pointer accent-accent"
      />
      <span aria-hidden="true" className="w-8 text-right text-[9px] font-mono tabular-nums">
        {sliderFmt(spec)}
      </span>
    </label>
  );
}

/**
 * A leading MENU rendered INSIDE the folded overflow popover, as an inline
 * expandable group (a header row that toggles its options open BELOW it, in
 * normal document flow).
 *
 * ## Why not reuse `<ToolbarMenu>` here
 * `<ToolbarMenu>`'s option list is `position:absolute`. The overflow popover is
 * an `overflow:auto` scroll container, and an absolutely-positioned descendant
 * of a scroll container is CLIPPED to that container's padding box. The menu
 * button sits at the RIGHT edge of the right-aligned popover, so the list —
 * anchored `left-0` and `min-w-[7rem]` — overhangs the popover's right edge by
 * ~50px and its right portion (the option text) is neither painted nor
 * hit-testable: the leading menus (compare MODE / COLORMAP) were unusable when
 * folded. Rendering the options as INLINE rows instead makes them part of the
 * popover's own (scrollable) content, so every option stays visible and
 * clickable. Selecting closes the whole overflow, mirroring an action pick.
 */
function OverflowMenuGroup({
  icon,
  title,
  menu,
  onClose,
}: {
  icon?: string;
  title: string;
  menu: ToolbarMenuSpec;
  onClose: () => void;
}) {
  const { options, value, onSelect } = menu;
  const [expanded, setExpanded] = useState(false);
  const selectedIndex = selectedMenuIndex(options, value);
  const faceLabel = options[selectedIndex]?.label ?? "";
  return (
    <div>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className={[
          "flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",
          expanded ? "text-accent" : "text-fg hover:bg-bg-hover",
        ].join(" ")}
      >
        {icon ? <Icon name={icon} /> : <span className="w-[13px]" />}
        <span className="flex-1">{title}</span>
        <span className="font-mono text-[10px] text-fg-muted">{faceLabel}</span>
        <span className={expanded ? "rotate-180 transition-transform" : "transition-transform"}>
          <Icon name="caret" />
        </span>
      </button>
      {expanded &&
        options.map((opt) => {
          const isSelected = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={isSelected}
              data-menu-option=""
              onClick={(e) => {
                e.stopPropagation();
                onSelect(opt.id);
                onClose();
              }}
              className={[
                "flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-[11px]",
                isSelected ? "text-accent font-medium bg-bg-hover/40" : "text-fg hover:bg-bg-hover",
              ].join(" ")}
            >
              <span aria-hidden="true" className="w-3 text-center text-accent">
                {isSelected ? "✓" : ""}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
    </div>
  );
}

/**
 * The FOLDED toolbar: a single "⋯" button that opens a panel containing every
 * action (as rows), the leading menus (as inline expandable groups — see
 * `OverflowMenuGroup`) and the second-row sliders (as rows). Self-contained
 * open/close (outside-click / Escape), mirroring `ToolbarMenu`.
 */
function OverflowMenu({
  actions,
  leading,
  sliders,
}: {
  actions: ActionItem[];
  leading: ToolbarButtonSpec[];
  sliders: ToolbarSliderSpec[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More controls"
        title="More controls"
        className={[
          "h-[22px] min-w-[22px] inline-flex items-center justify-center rounded text-xs",
          open ? "bg-bg-hover text-accent" : "text-fg-muted hover:text-fg hover:bg-bg-hover",
        ].join(" ")}
      >
        <Icon name="ellipsis" />
      </button>
      {open && (
        <div
          role="menu"
          className={[
            "absolute right-0 top-full z-40 mt-1 min-w-[10rem] max-h-80 overflow-auto",
            "rounded border border-border bg-bg-elevated py-1 shadow-md",
          ].join(" ")}
        >
          {leading.map((b) =>
            b.menu ? (
              <OverflowMenuGroup
                key={b.id}
                icon={b.icon}
                title={b.title}
                menu={b.menu}
                onClose={() => setOpen(false)}
              />
            ) : (
              <button
                key={b.id}
                type="button"
                disabled={b.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (b.disabled) return;
                  b.onClick?.();
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",
                  b.disabled ? "opacity-40 cursor-default text-fg-muted" : "text-fg hover:bg-bg-hover",
                  b.active ? "text-accent" : "",
                ].join(" ")}
              >
                {b.icon ? <Icon name={b.icon} /> : <span className="w-[13px]" />}
                <span>{b.label ?? b.title}</span>
              </button>
            ),
          )}

          {leading.length > 0 && actions.length > 0 && (
            <div aria-hidden="true" className="my-1 h-px bg-border" />
          )}

          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (a.disabled) return;
                a.onClick();
                setOpen(false);
              }}
              className={[
                "flex w-full items-center gap-2 px-2 py-1 text-left text-[11px]",
                a.disabled ? "opacity-40 cursor-default text-fg-muted" : "text-fg hover:bg-bg-hover",
                a.active ? "text-accent" : "",
              ].join(" ")}
            >
              {a.icon ? <Icon name={a.icon} /> : <span className="w-[13px]" />}
              <span>{a.title}</span>
            </button>
          ))}

          {sliders.length > 0 && (actions.length > 0 || leading.length > 0) && (
            <div aria-hidden="true" className="my-1 h-px bg-border" />
          )}

          {sliders.map((s) => (
            <div key={s.id} className="px-2 py-1">
              <ToolbarSlider spec={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The modebar. Renders nothing when disabled or when no capability-backed
 * button survives gating (e.g. a controller that advertises nothing).
 */
export default function PlotToolbar({ controller, config }: PlotToolbarProps) {
  // --- responsive fold (requirement A) -----------------------------------
  // Collapse the whole toolbar into one "⋯" overflow button when the pane is
  // too narrow to hold the expanded row (see `toolbar-fold.ts` for the pure
  // decision + hysteresis rationale). Measured against the toolbar's own
  // positioned parent (the pane/chart root) via a ResizeObserver — fully
  // self-contained, no host wiring.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [folded, setFolded] = useState(false);
  const foldedRef = useRef(folded);
  foldedRef.current = folded;
  const expandedWidthRef = useRef(0);

  // Re-observe (and re-measure) whenever the toolbar's CONTENT could change its
  // expanded width — leading menus / notation button / sliders appearing.
  const foldKey = `${config?.leadingButtons?.length ?? 0}:${config?.sliders?.length ?? 0}:${
    config?.visibility ?? "hover"
  }`;
  useEffect(() => {
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!parent) return;
    const measure = () => {
      const containerWidth = parent.clientWidth;
      // Cache the expanded width only WHILE expanded — measuring the collapsed
      // "⋯" button would say "fits" and oscillate (see toolbar-fold.ts).
      if (!foldedRef.current && rootRef.current) {
        const w = rootRef.current.scrollWidth;
        if (w > 0) expandedWidthRef.current = w;
      }
      setFolded(computeToolbarFold(containerWidth, expandedWidthRef.current, foldedRef.current));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    measure();
    return () => ro.disconnect();
  }, [foldKey]);

  if (config?.enabled === false) return null;

  const caps = controller.capabilities;
  const btn = config?.buttons;
  // A button shows when its capability is on AND it isn't explicitly hidden by
  // config. `shown("id", cap)` folds both checks.
  const shown = (id: string, cap: boolean) => cap && btn?.[id] !== false;

  const setMode = (m: DragMode) => () => controller.setDragMode(m);
  const doScreenshot = () => {
    // Rasterize the chart and trigger a browser download. Swallow any failure so
    // a rejected export never throws an unhandled rejection.
    controller
      .toPNG({ filename: "plot" })
      .then((b) => downloadBlob(b, "plot.png"))
      .catch(() => {});
  };

  // Build the capability-gated action groups ONCE — the expanded button row and
  // the folded overflow menu both render from these, so they never diverge.
  const dragActions: ActionItem[] = [];
  if (shown("zoom", caps.zoom))
    dragActions.push({ id: "zoom", icon: "boxZoom", title: "Box zoom", active: controller.dragMode === "zoom", onClick: setMode("zoom") });
  if (shown("pan", caps.pan))
    dragActions.push({ id: "pan", icon: "pan", title: "Pan", active: controller.dragMode === "pan", onClick: setMode("pan") });
  if (shown("select", caps.select))
    dragActions.push({ id: "select", icon: "select", title: "Box select", active: controller.dragMode === "select", onClick: setMode("select") });
  if (shown("lasso", caps.lasso))
    dragActions.push({ id: "lasso", icon: "lasso", title: "Lasso select", active: controller.dragMode === "lasso", onClick: setMode("lasso") });

  const zoomActions: ActionItem[] = [];
  if (shown("zoomIn", caps.zoom))
    zoomActions.push({ id: "zoomIn", icon: "zoomIn", title: "Zoom in", onClick: () => controller.zoomIn() });
  if (shown("zoomOut", caps.zoom))
    zoomActions.push({ id: "zoomOut", icon: "zoomOut", title: "Zoom out", onClick: () => controller.zoomOut() });

  const viewActions: ActionItem[] = [];
  if (shown("autoscale", caps.autoscale))
    viewActions.push({ id: "autoscale", icon: "autoscale", title: "Autoscale", onClick: () => controller.autoscale() });
  // The reset ("home") button is ALWAYS present when reset is available (it just
  // renders disabled when the view is already at home), so the group's presence
  // never flips on `isModified` and buttons don't shift under the cursor.
  if (shown("reset", caps.reset))
    viewActions.push({
      id: "reset",
      icon: "home",
      title: controller.isModified ? "Reset view" : "Reset view (at home)",
      disabled: !controller.isModified,
      onClick: () => controller.reset(),
    });

  const exportActions: ActionItem[] = [];
  if (shown("screenshot", caps.screenshot))
    exportActions.push({ id: "screenshot", icon: "camera", title: "Download plot as PNG", onClick: doScreenshot });

  const groups = [dragActions, zoomActions, viewActions, exportActions].filter((g) => g.length > 0);
  const flatActions = groups.flat();
  const leading = config?.leadingButtons ?? [];
  const sliders = config?.sliders ?? [];

  if (!leading.length && flatActions.length === 0 && sliders.length === 0) return null;

  const position = config?.position ?? "top-right";
  const alwaysOn = config?.visibility === "always";
  // Anchor the fold trigger / slider row to the same corner the toolbar uses.
  const rightAligned = position === "top-right" || position === "bottom-right";

  const revealClass = alwaysOn ? "opacity-100" : "opacity-0 group-hover:opacity-100";
  const chromeClass = [
    // z-30 keeps the toolbar ABOVE the pixel-value number overlay (z-10) AND the
    // compare pane's split-slider divider (z-20) — the modebar must always be
    // clickable, even with the slider dragged beneath it.
    "z-30 rounded border border-border bg-bg-elevated/90 shadow-sm backdrop-blur-sm transition-opacity",
    revealClass,
  ].join(" ");

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    // pointer-events re-enabled here even if a parent disabled them (Heatmap
    // overlays an SVG with pointer-events:none); the toolbar must stay live.
    pointerEvents: "auto",
    ...POSITION_STYLE[position],
  };

  // --- FOLDED: one "⋯" button opening a menu with every control ------------
  if (folded) {
    return (
      <div ref={rootRef} style={wrapperStyle} className={`${chromeClass} inline-flex px-0.5 py-0.5`} role="toolbar" aria-label="Plot controls">
        <OverflowMenu actions={flatActions} leading={leading} sliders={sliders} />
      </div>
    );
  }

  // --- EXPANDED: the button row, plus an optional second slider row --------
  return (
    <div
      ref={rootRef}
      style={wrapperStyle}
      className={`${chromeClass} flex flex-col gap-0.5 px-1 py-0.5`}
      role="toolbar"
      aria-label="Plot controls"
    >
      <div className={`flex items-center gap-0.5 ${rightAligned ? "justify-end" : "justify-start"}`}>
        {leading.length > 0 && (
          <>
            {leading.map((b) =>
              b.menu ? (
                <ToolbarMenu key={b.id} icon={b.icon} title={b.title} menu={b.menu} />
              ) : (
                <ToolbarButton
                  key={b.id}
                  icon={b.icon}
                  label={b.label}
                  title={b.title}
                  active={b.active}
                  disabled={b.disabled}
                  onClick={b.onClick ?? (() => {})}
                />
              ),
            )}
            {groups.length > 0 && <Divider />}
          </>
        )}

        {groups.map((group, gi) => (
          <span key={group[0]!.id} className="inline-flex items-center gap-0.5">
            {gi > 0 && <Divider />}
            {group.map((a) => (
              <ToolbarButton
                key={a.id}
                icon={a.icon}
                title={a.title}
                active={a.active}
                disabled={a.disabled}
                onClick={a.onClick}
              />
            ))}
          </span>
        ))}
      </div>

      {sliders.length > 0 && (
        <div className={`flex items-center gap-2 ${rightAligned ? "justify-end" : "justify-start"}`}>
          {sliders.map((s) => (
            <ToolbarSlider key={s.id} spec={s} />
          ))}
        </div>
      )}
    </div>
  );
}
