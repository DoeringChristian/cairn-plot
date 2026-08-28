import type { CompareNode, PlotLeafNode, SharedProps } from "../../../packages/spec/src/spec.ts";
import type { PlotSettings } from "../settings/schema.ts";
import { getPlotType } from "./registry.ts";

/** Resolve HOME settings without teaching the host about concrete plot types. */
export function defaultSettingsForNode(
  node: PlotLeafNode | CompareNode,
  shared?: SharedProps,
): PlotSettings {
  return {
    ...(getPlotType(node.type)?.defaults(node) ?? {}),
    ...(shared?.settings ?? {}),
    ...(node.settings ?? {}),
  } as PlotSettings;
}
