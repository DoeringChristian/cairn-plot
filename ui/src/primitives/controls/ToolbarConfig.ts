/**
 * `controls/ToolbarConfig.ts` — optional, per-mount configuration for the
 * cairn-plot `<PlotToolbar>` (S1). Lets a card/host enable-disable the toolbar,
 * hide individual buttons, and choose corner + reveal behavior without touching
 * the controller. All fields optional; the toolbar supplies defaults.
 */
/**
 * A single option in a {@link ToolbarMenuSpec} dropdown. `id` is the value
 * passed back through `onSelect`; `label` is the human-readable menu text.
 */
export interface ToolbarMenuOption {
  id: string;
  label: string;
  /** Optional CHECKED marker for menu rows that behave like a direct multi-pick
   *  list. Purely presentational; the owning menu still handles `onSelect`. */
  checked?: boolean;
  /** A non-interactive SECTION HEADER row (not selectable, skipped in keyboard
   *  nav / the `onSelect` path). Lets a flat menu emulate grouped sections — the
   *  unified DISPLAY encoding menu uses it for CURVES / COLORMAPS / REMAPS
   *  dividers. A header's `id` must never collide with a real option id. */
  header?: boolean;
}

/**
 * The MENU variant of a leading toolbar button (diff-kernels toolbar-selection
 * track). When a {@link ToolbarButtonSpec} carries this, `<PlotToolbar>` renders
 * a self-contained dropdown instead of a plain button: the button FACE shows the
 * currently-selected option's label (or the spec's `icon`) with a caret, and
 * clicking it opens an absolutely-positioned option list (token-styled like the
 * tooltip chrome) that closes on select / outside-click / Escape and supports
 * arrow-key + Enter keyboarding. No external dependency — pure inline React.
 */
export interface ToolbarMenuSpec {
  /** Options in menu (== display) order. */
  options: ToolbarMenuOption[];
  /** The currently-selected option id (drives the button face + highlight). */
  value: string;
  /** Called with the chosen option id when the user picks one. */
  onSelect(id: string): void;
  /** Whether picking an option closes the menu. Default true. Set false for
   *  direct-toggle menus such as arbitrary image-channel subset selection. */
  closeOnSelect?: boolean;
}

/**
 * A host-supplied extra button (not tied to a controller capability). Rendered
 * at the LEADING edge of the toolbar so a renderer/method can inject its own
 * controls (e.g. the image pane's pixel-value notation toggle, or the
 * compare pane's diff-mode / colormap dropdowns). Either a short text `label`
 * (e.g. "0–255"), an inline-SVG `icon` (an ICON_PATHS key), or — when `menu`
 * is set — a dropdown whose face is the current option's label (or `icon`).
 */
export interface ToolbarButtonSpec {
  /** Stable identity (React key). */
  id: string;
  /** Short text label — rendered when `icon` is absent. */
  label?: string;
  /** Inline-SVG icon name (ICON_PATHS key) — rendered when `label` is absent. */
  icon?: string;
  /** Tooltip / aria-label. */
  title: string;
  /** Highlighted (pressed) state. */
  active?: boolean;
  /** Greyed + non-interactive. */
  disabled?: boolean;
  /** When present, this is a DROPDOWN (see {@link ToolbarMenuSpec}); `onClick`
   *  is then ignored (the menu owns interaction). */
  menu?: ToolbarMenuSpec;
  /** Plain-button click handler. Optional — a `menu` button doesn't use it. */
  onClick?(): void;
}

/**
 * A compact SLIDER control rendered as a SECOND toolbar row (image panes only —
 * the EXPOSURE / OFFSET display adjustments). Like {@link ToolbarButtonSpec} it
 * holds no state of its own: `value` is the current value and `onChange` is
 * called with the next one. `<PlotToolbar>` renders these under the button row
 * (same hover-reveal), and folds them into the overflow menu as rows when the
 * pane is too narrow (see the toolbar's fold behavior).
 */
export interface ToolbarSliderSpec {
  /** Stable identity (React key). */
  id: string;
  /** Minimal on-toolbar label (e.g. "EV", "OFF") — kept tiny. */
  label: string;
  /** Inline-SVG icon name (ICON_PATHS key) shown before the slider, if any. */
  icon?: string;
  /** Tooltip / aria-label (the full human description). */
  title: string;
  min: number;
  max: number;
  step: number;
  /** Current value (controlled). */
  value: number;
  /** Called with the next value as the user drags. */
  onChange(value: number): void;
  /** Formats `value` for the tiny read-out next to the slider. Default: as-is. */
  format?(value: number): string;
}

/**
 * A compact SEGMENTED control rendered in the toolbar's SECOND row alongside the
 * {@link ToolbarSliderSpec}s (image panes' DATA-encoding norm + multi-channel
 * reduce pickers). A tiny leading `label` + a row of small option buttons, the
 * active one highlighted — the second-row idiom for a SMALL discrete choice (2–3
 * options) that reads inline next to the sliders, rather than a dropdown next to
 * the DISPLAY menu. Like the slider spec it holds no state: `value` is the current
 * option id and `onSelect` is called with the next. `<PlotToolbar>` renders these
 * before the sliders in the second row (same hover-reveal) and folds them into the
 * overflow menu as rows when the pane is too narrow.
 */
export interface ToolbarSegmentSpec {
  /** Stable identity (React key). */
  id: string;
  /** Minimal on-toolbar label (e.g. "norm", "reduce") — kept tiny. */
  label: string;
  /** Tooltip / aria-label (the full human description). */
  title: string;
  /** Options in display order — `id` is passed back through `onSelect`, `label`
   *  is the tiny button face. */
  options: { id: string; label: string }[];
  /** Current option id (controlled — drives the highlighted segment). */
  value: string;
  /** Called with the chosen option id when the user picks a segment. */
  onSelect(id: string): void;
}

export interface ToolbarConfig {
  /** Master switch. Default: on. */
  enabled?: boolean;
  /** Second-row slider controls (image panes' EXPOSURE / OFFSET). Rendered
   *  under the button row with the same hover-reveal; folded into the overflow
   *  menu when the pane is too narrow. */
  sliders?: ToolbarSliderSpec[];
  /** Second-row SEGMENTED controls (image panes' DATA-encoding norm + reduce),
   *  rendered at the LEADING edge of the second row BEFORE the sliders, with the
   *  same hover-reveal + overflow fold. See {@link ToolbarSegmentSpec}. */
  segments?: ToolbarSegmentSpec[];
  /** Per-button overrides keyed by button id (e.g. "zoom", "pan", "reset").
   *  Omitted buttons follow capability-gating. */
  buttons?: Partial<Record<string, boolean>>;
  /** Which corner of the plot to anchor the modebar. Default: "top-right". */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** "hover" reveals on pointer-over (Plotly default); "always" pins it. */
  visibility?: "hover" | "always";
  /** Extra host-supplied buttons rendered at the LEADING (left) edge, before
   *  the standard capability groups and separated by a divider. Because the
   *  toolbar anchors by a corner, leading buttons that appear/disappear never
   *  shift the standard buttons under the cursor. */
  leadingButtons?: ToolbarButtonSpec[];
}
