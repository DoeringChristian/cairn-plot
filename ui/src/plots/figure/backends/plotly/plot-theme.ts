/**
 * `plot-theme.ts` — how a plotly figure borrows the HOST page's theme.
 *
 * ## Why this exists
 * The figure renders with `paper_bgcolor`/`plot_bgcolor` set to `"transparent"`,
 * so it sits directly on whatever background the host provides — the cairn app's
 * card, a `cp.Report` page in light or dark, a notebook cell. That is the right
 * call (a figure boxed in its own white rectangle looks pasted onto a dark
 * report), but it has a consequence that was previously missed: once the
 * BACKGROUND comes from the host, every FOREGROUND colour must come from the
 * host too.
 *
 * The old code did half of it — a constant literally named `DARK_LAYOUT` that
 * made the backgrounds transparent and then pinned `font.color` to `#1f2328`,
 * the LIGHT theme's foreground, leaving grid and zero lines to plotly's light
 * template (`"white"`). The figure was legible only on a white page:
 *
 *   - dark host  → `#1f2328` text on `#0d1117`  — black on black (reported)
 *   - light host → `"white"` grid on `#ffffff`  — an invisible plot area
 *
 * ## The contract
 * {@link themedLayout} supplies host-derived colours as DEFAULTS and lets the
 * figure author override every one of them: anything already present in the
 * incoming `figure.layout` wins. (The old constant clobbered author colours
 * instead.) The palette itself is read off the mounted container by
 * {@link readPlotPalette}, so the figure tracks whatever the host's CSS
 * currently resolves to — including a live light/dark toggle — rather than
 * guessing between two hardcoded themes.
 *
 * The merge is kept pure and DOM-free here so it unit-tests without plotly or a
 * browser; only {@link readPlotPalette} touches the DOM.
 */

/** The host-derived colours a figure needs to be legible on its page. */
export interface PlotPalette {
  /** Primary text colour — the host's resolved `color`. */
  fg: string;
  /** De-emphasized text/icons (modebar at rest). */
  muted: string;
  /** Grid, zero lines, axis lines, borders. */
  border: string;
  /** Raised surfaces that must be opaque over the page (hover labels). */
  elevated: string;
}

/**
 * Re-express a resolved `rgb()`/`rgba()` colour at a new alpha.
 *
 * Used to derive a faint grid colour from the host's text colour when the host
 * exposes no border token — a fade of the text colour is legible against any
 * background the text itself is legible against, which is exactly the property
 * a hardcoded grey lacks. Anything that is not a parseable `rgb()`/`rgba()`
 * string (a hex literal, a keyword, an empty string) is returned unchanged
 * rather than turned into an invalid colour.
 */
export function withAlpha(color: string, alpha: number): string {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color);
  if (!m) return color;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}

/** The palette used when there is no element to measure (SSR, unmounted, or a
 *  test harness). Deliberately mid-contrast so it is never invisible either
 *  way; a mounted figure always replaces it on its first effect. */
export const FALLBACK_PALETTE: PlotPalette = {
  fg: "rgb(127, 127, 127)",
  muted: "rgb(127, 127, 127)",
  border: "rgba(127, 127, 127, 0.25)",
  elevated: "rgba(127, 127, 127, 0.15)",
};

/**
 * Read the host palette off a mounted element.
 *
 * `color` is inherited from the host, so it is the honest source for text. The
 * remaining roles prefer the app's CSS custom properties when the host defines
 * them (`--color-border`, `--color-fg-muted`, `--color-bg-elevated` — the cairn
 * app and the `cp.Report` theme both do, so a figure matches the surrounding
 * page exactly), and otherwise derive from the text colour so an unknown host
 * still gets something legible.
 */
export function readPlotPalette(el: Element | null | undefined): PlotPalette {
  if (!el || typeof getComputedStyle !== "function") return FALLBACK_PALETTE;
  const cs = getComputedStyle(el);
  const token = (name: string) => cs.getPropertyValue(name).trim();
  const fg = cs.color || FALLBACK_PALETTE.fg;
  return {
    fg,
    muted: token("--color-fg-muted") || withAlpha(fg, 0.65),
    border: token("--color-border") || withAlpha(fg, 0.2),
    elevated: token("--color-bg-elevated") || withAlpha(fg, 0.12),
  };
}

/** Shallow-merge `defaults` UNDER `authored` — authored keys always win. */
function under(
  authored: unknown,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const a = (authored ?? {}) as Record<string, unknown>;
  return { ...defaults, ...a };
}

const AXIS_KEY = /^[xyz]axis\d*$/;

/** The colour defaults for one cartesian axis. */
function axisTheme(p: PlotPalette): Record<string, unknown> {
  return { gridcolor: p.border, zerolinecolor: p.border, linecolor: p.border };
}

/**
 * The figure layout to hand plotly: the author's `layout` with host-derived
 * colours filled in underneath it.
 *
 * Every axis already present in the layout is themed (`xaxis2`, `yaxis3`, …),
 * and `xaxis`/`yaxis` are themed even when absent, since plotly creates them
 * implicitly for any cartesian trace. A 3D `scene` is themed only when the
 * author actually has one — injecting `scene` into a 2D figure would be noise.
 *
 * Fixed `width`/`height` are dropped (with `autosize: true`) so the figure fills
 * its container; that behaviour is inherited from the constant this replaced.
 */
export function themedLayout(
  base: Record<string, unknown>,
  palette: PlotPalette,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };

  out.paper_bgcolor = base.paper_bgcolor ?? "transparent";
  out.plot_bgcolor = base.plot_bgcolor ?? "transparent";
  out.autosize = true;
  delete out.width;
  delete out.height;

  out.font = under(base.font, { color: palette.fg });

  const axisKeys = new Set(["xaxis", "yaxis"]);
  for (const k of Object.keys(base)) if (AXIS_KEY.test(k)) axisKeys.add(k);
  for (const k of axisKeys) out[k] = under(base[k], axisTheme(palette));

  if (base.scene != null) {
    const scene = { ...(base.scene as Record<string, unknown>) };
    for (const k of ["xaxis", "yaxis", "zaxis"]) {
      scene[k] = under(scene[k], {
        ...axisTheme(palette),
        // A 3D scene paints opaque axis walls; transparent lets the host show
        // through, matching the 2D `plot_bgcolor` treatment above.
        backgroundcolor: "transparent",
        showbackground: false,
      });
    }
    out.scene = scene;
  }

  out.legend = under(base.legend, {
    bgcolor: "transparent",
    bordercolor: palette.border,
  });
  // Hover labels must be OPAQUE — they float over the data, so a transparent
  // one is unreadable whatever the theme.
  out.hoverlabel = under(base.hoverlabel, {
    bgcolor: palette.elevated,
    bordercolor: palette.border,
    font: under((base.hoverlabel as Record<string, unknown>)?.font, {
      color: palette.fg,
    }),
  });
  out.modebar = under(base.modebar, {
    bgcolor: "transparent",
    color: palette.muted,
    activecolor: palette.fg,
  });

  return out;
}
