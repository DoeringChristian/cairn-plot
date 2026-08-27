import type { PaneId, PlotSpec, SettingsPatch } from "../../spec/src/spec.ts";
import type { Invalidation } from "../../spec/src/settings.ts";

export type PlotCommand =
  | { type: "settings.patch"; panes: PaneId[]; patch: SettingsPatch }
  | { type: "settings.reset"; panes: PaneId[]; keys?: string[] }
  | { type: "selection.set"; panes: PaneId[] }
  | { type: "selection.toggle"; pane: PaneId }
  | { type: "reference.set"; pane: PaneId | null }
  | { type: "stage.open"; panes: PaneId[]; mode: "enlarge" | "compare" }
  | { type: "stage.close" }
  | { type: "spec.replace"; spec: PlotSpec };

export interface CommandMetadata {
  origin?: "gesture" | "host" | "restore" | "init";
  phase?: "stream" | "commit";
  sourcePane?: PaneId;
}

export interface PlotChange {
  command: PlotCommand;
  metadata: CommandMetadata;
  specChanged: boolean;
  sessionChanged: boolean;
  affectedPanes: PaneId[];
  invalidation: Invalidation;
}
