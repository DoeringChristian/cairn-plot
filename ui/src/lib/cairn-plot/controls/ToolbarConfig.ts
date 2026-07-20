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

export interface ToolbarConfig {
  /** Master switch. Default: on. */
  enabled?: boolean;
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
