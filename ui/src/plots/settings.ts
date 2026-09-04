import type { CompareNode, PlotLeafNode, SharedProps } from "../../../packages/spec/src/spec.ts";
import type { PlotSettings } from "../settings/schema.ts";
import type { SettingsRecord } from "./contracts.ts";
import { getPlotType } from "./registry.ts";

/** Resolve HOME settings without teaching the host about concrete plot types. */
export function defaultSettingsForNode(
  node: PlotLeafNode | CompareNode,
  shared?: SharedProps,
): PlotSettings {
  const definition = getPlotType(node.type);
  const merged = {
    ...(definition?.defaults(node) ?? {}),
    ...(shared?.settings ?? {}),
    ...(node.settings ?? {}),
  };
  // LAST, over the merged record: authored node settings win over the defaults,
  // so a kind that migrates only inside `defaults()` would still let a retired
  // key reach the cell store — where the store's patch merge would keep reading
  // it beside every later choice the user makes.
  return (definition?.migrateSettings?.(merged) ?? merged) as PlotSettings;
}

/**
 * Same migration, for settings that arrive from OUTSIDE the seed — a restored
 * session snapshot or a host `patchSettings` call. A snapshot written before a
 * key was retired is replayed verbatim by the session controller, so without
 * this the retired key lands in the cell store exactly as an unmigrated seed
 * would: the read-side `project` renders it, but it also sits beside every
 * later patch and keeps coercing it. The controller stays ignorant of plot
 * semantics — the cell wraps its own registered `replace` with this.
 */
export function migrateSettingsForNode(
  node: PlotLeafNode | CompareNode,
  settings: PlotSettings,
): PlotSettings {
  const definition = getPlotType(node.type);
  const record = settings as unknown as SettingsRecord;
  return (definition?.migrateSettings?.(record) ?? record) as PlotSettings;
}
