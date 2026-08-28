import type { PlotSpec, PlotNode } from "../../../../packages/spec/src/spec.ts";
import type { PlotSessionTopology } from "./PlotSessionController.ts";

export function compileSessionTopology(descriptor: PlotSpec): PlotSessionTopology {
  const cellIds = new Set<string>();
  const grids = new Map<string, { count: number; defaultMode: "normal" | "stacked" }>();
  const visit = (node: PlotNode, path: string): void => {
    if (node.kind !== "grid") {
      cellIds.add(`cell:${path}`);
      return;
    }
    grids.set(`grid:${path}`, {
      count: node.children.length,
      defaultMode: node.mode ?? "normal",
    });
    if (node.children.length > 0) cellIds.add(`stack:${path}`);
    node.children.forEach((child, index) => visit(child, `${path}/${index}`));
  };
  visit(descriptor.root, "root");
  return { cellIds, grids };
}
