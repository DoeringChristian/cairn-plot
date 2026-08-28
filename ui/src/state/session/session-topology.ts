import type { PlotDescriptor, PlotNode } from "../../../../packages/spec/src/spec.ts";
import type { PlotSessionTopology } from "./PlotSessionController.ts";

export function compileSessionTopology(descriptor: PlotDescriptor): PlotSessionTopology {
  const viewportIds = new Set<string>();
  const grids = new Map<string, { count: number; defaultMode: "normal" | "stacked" }>();
  const visit = (node: PlotNode, path: string): void => {
    if (node.kind !== "grid") {
      viewportIds.add(`cell:${path}`);
      return;
    }
    grids.set(`grid:${path}`, {
      count: node.children.length,
      defaultMode: node.mode ?? "normal",
    });
    if (node.children.length > 0) viewportIds.add(`stack:${path}`);
    node.children.forEach((child, index) => visit(child, `${path}/${index}`));
  };
  visit(descriptor.root, "root");
  return { viewportIds, grids };
}
