import { createContext, useContext } from "react";

import type { DataSource } from "../resources/data/data-source.ts";
import type { PlotSettings } from "../state/settings/viewport-settings.ts";
import type { SharedProps } from "./descriptor-resolver.ts";

/** Host data shared by every node in one authored plot tree. */
export interface SharedPlotCtx {
  source: DataSource;
  shared?: SharedProps;
  viewSettingsGroupId?: string | null;
}

export const SharedPlotContext = createContext<SharedPlotCtx | null>(null);

export function useSharedPlot(): SharedPlotCtx {
  const ctx = useContext(SharedPlotContext);
  if (!ctx) throw new Error("PlotNodeView used outside a SharedPlotContext");
  return ctx;
}

/** Viewport-owned settings exposed to the content mounted in that viewport. */
export interface PaneSyncCtx {
  syncedSettings?: PlotSettings | null;
  viewportDefaults?: PlotSettings | null;
  setSyncedSettings?: (patch: PlotSettings) => void;
  resetSyncedSettings?: (settings: PlotSettings) => void;
}

export const PaneSyncContext = createContext<PaneSyncCtx | null>(null);
