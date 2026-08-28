/**
 * P2 — viewport-lazy pane mounting: the PURE decision half.
 *
 * Today every leaf in a descriptor tree mounts at load — all images decode, all
 * WebGPU pipelines compile, all 3D scenes build — even for panes far below the
 * fold. `LazyGate` (plot-node.tsx) gates leaf/compare mounting behind a viewport
 * `IntersectionObserver` so a pane only does its work as it nears the viewport.
 *
 * There are three EAGER escape hatches that force everything to mount up front:
 *   1. `?eager=1` (or `?eager`/`?eager=true`) in the page URL,
 *   2. `window.__cairnPlotEagerMount === true` set before mount, and
 *   3. print media (`matchMedia("print").matches` / `beforeprint`) — a print
 *      must render EVERY section, not just what's on-screen.
 *
 * This module is the DOM-free, side-effect-free core of that decision so it
 * unit-tests under Node's `--experimental-strip-types` runner. The DOM-reading
 * wrapper (`readEagerMountSignals`) and the `LazyGate` React component that
 * drives the observer both live in plot-node.tsx.
 */

/** The ambient signals that force EAGER mounting, gathered from the live page. */
export interface EagerMountSignals {
  /** `window.location.search` — e.g. `"?eager=1"`. */
  search?: string | null;
  /** `window.__cairnPlotEagerMount` — the imperative opt-out flag. */
  windowFlag?: unknown;
  /** `window.matchMedia("print").matches` — true while a print is in flight. */
  printMedia?: boolean;
}

/**
 * True when the URL carries `?eager` with a truthy value: the bare flag
 * (`?eager`), `?eager=1`, or `?eager=true` (case-insensitive). An explicit
 * falsy value (`?eager=0`, `?eager=false`) is NOT eager, so a URL can force
 * lazy even if some future default flips.
 */
export function hasEagerQueryParam(search: string | null | undefined): boolean {
  if (!search) return false;
  const qs = search.startsWith("?") ? search : `?${search}`;
  const params = new URLSearchParams(qs);
  if (!params.has("eager")) return false;
  const v = (params.get("eager") ?? "").toLowerCase();
  return v === "" || v === "1" || v === "true";
}

/**
 * The whole eager-vs-lazy decision, pure. Mount EAGERLY (immediately, no
 * viewport gate) when ANY escape hatch fires: the window flag, print media, or
 * the `?eager` query param. Otherwise mount LAZILY (gated on the viewport).
 */
export function isEagerMount(signals: EagerMountSignals): boolean {
  if (signals.windowFlag === true) return true;
  if (signals.printMedia === true) return true;
  return hasEagerQueryParam(signals.search);
}

/** Generous rootMargin so a pane mounts well BEFORE it scrolls into view — the
 *  real renderer is usually already painted by the time the pane is visible. */
export const LAZY_ROOT_MARGIN = "600px 0px";
