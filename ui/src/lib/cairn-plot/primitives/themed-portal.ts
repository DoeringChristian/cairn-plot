/**
 * `primitives/themed-portal.ts` — carry an origin element's THEME onto a
 * `document.body`-portaled container.
 *
 * ## The problem
 * cairn-plot chrome is theme-aware through CSS custom properties (`--color-*`)
 * routed into utility classes by descendant selectors scoped under a
 * `.cairn-plot-doc` ancestor (see `styles/tokens.css`):
 *
 *   .cairn-plot-doc .bg-bg-elevated { background-color: var(--color-bg-elevated); }
 *
 * A `createPortal(..., document.body)` element is NOT a descendant of the pane
 * it came from. That breaks theme inheritance in two ways when the app/embedder
 * scopes the theme on a CONTAINER (not `<html>`):
 *   1. no `.cairn-plot-doc` ANCESTOR ⇒ the token utility rules don't match, so
 *      `.bg-bg-elevated` etc. fall back to Tailwind's bare (often transparent)
 *      color instead of the token;
 *   2. the `--color-*` VALUES the pane resolved (dark, say) live on that
 *      container and do NOT cascade to a body-level node ⇒ the portal inherits
 *      the document root's values (usually the light default) — so a popover /
 *      overlay opened from a DARK pane renders LIGHT.
 *
 * ## The fix
 * When opening a body portal, snapshot the origin pane's theme and stamp the
 * equivalent onto the portal container:
 *   - add the `.cairn-plot-doc` scope CLASS (so the token utility descendant
 *     selectors match inside the portal);
 *   - copy the RESOLVED `--color-*` custom properties as inline vars (so their
 *     VALUES equal the origin's, regardless of where the theme was scoped);
 *   - copy `color-scheme` (form controls / scrollbars / UA canvas match);
 *   - copy the nearest `[data-theme]` value (for anything keying off it).
 *
 * Both the toolbar's portaled popovers (`PlotToolbar`) and the enlarge overlay
 * (`ImagePaneShell`) use this one helper, so there is no duplicated theme-copy.
 */
import { useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";

/** The token custom properties the cairn-plot chrome reads (kept in sync with
 *  `styles/tokens.css`). Copied from the origin's computed style onto the portal
 *  so its VALUES match the origin even when the theme was scoped on a container
 *  the body portal can't inherit from. */
export const THEME_TOKEN_VARS: readonly string[] = [
  "--color-bg",
  "--color-bg-elevated",
  "--color-bg-hover",
  "--color-fg",
  "--color-fg-muted",
  "--color-fg-subtle",
  "--color-border",
  "--color-border-subtle",
  "--color-accent",
  "--color-accent-hover",
  "--color-checkerboard-a",
  "--color-checkerboard-b",
  "--color-selection-band",
  "--color-bg-rgb",
  "--color-bg-elevated-rgb",
  "--color-bg-hover-rgb",
  "--color-fg-rgb",
  "--color-fg-muted-rgb",
  "--color-fg-subtle-rgb",
  "--color-border-rgb",
  "--color-border-subtle-rgb",
  "--color-accent-rgb",
  "--color-accent-hover-rgb",
  "--color-checkerboard-a-rgb",
  "--color-checkerboard-b-rgb",
];

/** Props to spread onto a body-portaled container so it inherits `origin`'s
 *  theme. `className` MUST be merged with the container's own classes. */
export interface OriginThemeProps {
  /** Includes the `cairn-plot-doc` scope class; merge with the element's own. */
  className: string;
  /** Inline `--color-*` vars + `colorScheme`; merge with the element's own. */
  style: CSSProperties;
  /** The nearest ancestor `[data-theme]` value (or `undefined`). */
  "data-theme": string | undefined;
}

/**
 * Snapshot `origin`'s theme into props for a body-portaled container. Pure DOM
 * read (no side effects); returns the scope class, the resolved token vars, the
 * origin's `color-scheme`, and its nearest `[data-theme]`. Returns just the
 * scope class when `origin` is null or there is no `window` (SSR).
 */
export function readOriginTheme(origin: HTMLElement | null): OriginThemeProps {
  const base: OriginThemeProps = {
    className: "cairn-plot-doc",
    style: {},
    "data-theme": undefined,
  };
  if (!origin || typeof window === "undefined") return base;

  const cs = window.getComputedStyle(origin);
  const style: CSSProperties & Record<string, string> = {};
  for (const name of THEME_TOKEN_VARS) {
    const v = cs.getPropertyValue(name).trim();
    if (v) style[name] = v;
  }
  const colorScheme = cs.colorScheme || cs.getPropertyValue("color-scheme").trim();
  if (colorScheme) style.colorScheme = colorScheme;

  const themed = origin.closest("[data-theme]");
  const dataTheme = themed?.getAttribute("data-theme") ?? undefined;

  return { className: base.className, style, "data-theme": dataTheme };
}

/**
 * React hook form of {@link readOriginTheme}: recomputes when `active` flips
 * true (the portal opens) so the snapshot reflects the origin's CURRENT theme,
 * committed BEFORE paint (`useLayoutEffect`) so there is no wrong-theme flash.
 * Returns the scope-class-only default while inactive.
 */
export function useOriginTheme(
  active: boolean,
  originRef: React.RefObject<HTMLElement | null>,
): OriginThemeProps {
  const [props, setProps] = useState<OriginThemeProps>(() => ({
    className: "cairn-plot-doc",
    style: {},
    "data-theme": undefined,
  }));
  useLayoutEffect(() => {
    if (!active) return;
    setProps(readOriginTheme(originRef.current));
  }, [active, originRef]);
  return props;
}
