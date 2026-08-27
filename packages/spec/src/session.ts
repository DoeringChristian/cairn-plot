import type { PaneId, SettingsPatch } from "./spec.ts";

export interface SelectionState {
  order: PaneId[];
  reference: PaneId | null;
}

/** Interactive state. It may be persisted as a workspace, never as PlotSpec. */
export interface PlotSession {
  overrides: Record<PaneId, SettingsPatch>;
  selection: SelectionState;
  stage: { mode: "enlarge" | "compare"; panes: PaneId[] } | null;
}

export function emptyPlotSession(): PlotSession {
  return { overrides: {}, selection: { order: [], reference: null }, stage: null };
}
