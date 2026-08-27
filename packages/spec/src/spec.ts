import type { JsonValue } from "./json.ts";

export type PaneId = string;
export type SettingKey = string;
export type SettingsPatch = Record<SettingKey, JsonValue>;

/** Durable, authored reference. Bytes and decoded resources never live here. */
export interface SourceSpec {
  kind: string;
  [key: string]: JsonValue;
}

export interface PaneSpec {
  id: PaneId;
  kind: string;
  sources: SourceSpec[];
  settings?: SettingsPatch;
  props?: Record<string, JsonValue>;
}

export type LayoutSpec =
  | { kind: "pane"; pane: PaneId }
  | {
      kind: "grid";
      children: LayoutSpec[];
      columns?: number;
      gap?: number | string;
      mode?: "normal" | "stacked";
    };

export interface LinkSpec {
  id: string;
  panes: PaneId[];
  keys: string[];
}

/** Authored truth: deliberately excludes selection, mounts and resources. */
export interface PlotSpec {
  version: 1;
  layout: LayoutSpec;
  panes: Record<PaneId, PaneSpec>;
  links?: LinkSpec[];
}
