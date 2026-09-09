import { createContext, useContext } from "react";

import type { DataSource } from "../resources/data/data-source.ts";
import type { PlotSettings } from "../settings/schema.ts";
import type { SharedProps } from "../../../packages/spec/src/spec.ts";

/** Host data shared by every node in one authored plot tree. */
export interface SharedPlotCtx {
  source: DataSource;
  shared?: SharedProps;
  viewSettingsGroupId?: string | null;
  settingsGroupId?: string | null;
}

export const SharedPlotContext = createContext<SharedPlotCtx | null>(null);

export function useSharedPlot(): SharedPlotCtx {
  const ctx = useContext(SharedPlotContext);
  if (!ctx) throw new Error("PlotNodeView used outside a SharedPlotContext");
  return ctx;
}

/** Viewport-owned settings exposed to the content mounted in that viewport. */
export interface CellSettingsContextValue {
  syncedSettings?: PlotSettings | null;
  cellDefaults?: PlotSettings | null;
  setSyncedSettings?: (patch: PlotSettings) => void;
  resetSyncedSettings?: (settings: PlotSettings) => void;
}

export const CellSettingsContext = createContext<CellSettingsContextValue | null>(null);

/**
 * Whether the pane rendering this subtree is at/near the viewport, as reported
 * by the `LazyGate` that mounted it. Consumers pass it to `resolveCached` so the
 * preparation scheduler runs on-screen work first within a priority band.
 *
 * DEFAULT `false` = "no viewport evidence". Only a gate that has actually
 * mounted its child claims visibility; work scheduled from outside a gate
 * (blind prefetch, the stacked-slot dispatch) must never outrank a pane the
 * user is looking at.
 */
export const PaneVisibilityContext = createContext<boolean>(false);

/** The current pane's viewport answer — see {@link PaneVisibilityContext}. */
export function usePaneVisible(): boolean {
  return useContext(PaneVisibilityContext);
}
