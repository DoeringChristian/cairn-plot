import type { CompareNode, PlotLeafNode, SharedProps } from "../../../packages/spec/src/spec.ts";
import type { PlotSettings } from "../settings/schema.ts";
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
