/**
 * `enlarge-intercept.ts` — a tiny React context that lets an OUTER wrapper
 * override what a pane's ENLARGE toolbar button does.
 *
 * `ImagePaneShell`'s enlarge button normally promotes THIS one pane to a
 * fullscreen overlay (the single-pane enlarge). But when the pane is part of a
 * page-wide ≥2 SELECTION, the intent is different: enlarge should open the
 * page-level SELECTION STAGE — a grid of ALL selected panes — not just this one.
 *
 * The pane (in the framework-agnostic library) must not know about the selection
 * store or the app-level stage. So `PaneSelectionFrame` (the app wrapper around
 * every pane) provides an intercept here; `ImagePaneShell` consults it on click.
 * `onEnlarge()` returns `true` when it HANDLED the request (the multi stage was
 * opened) — the shell then skips its local single-pane enlarge; `false` (or no
 * provider) falls through to today's single-pane behaviour.
 */
import { createContext } from "react";

export interface EnlargeIntercept {
  /** Called when a pane's enlarge button is pressed to OPEN (not close) the
   *  overlay. Return `true` if handled (a multi-pane stage was opened), so the
   *  pane suppresses its own single-pane enlarge; `false` to fall through. */
  onEnlarge(): boolean;
}

export const EnlargeInterceptContext = createContext<EnlargeIntercept | null>(null);
