import type { PlotSpec, PlotNode } from "../../../../packages/spec/src/spec.ts";
import type { PlotSessionTopology } from "./PlotSessionController.ts";
import { gridCellKeys, gridCellPath } from "../../layout/grid-cell-key.ts";
import { comparisonType } from "../../plots/registry.ts";
import { expandImageComparison } from "../../plots/image/runtime/comparison-plan.ts";

/**
 * The session ids a spec WILL register once mounted — used to prune a restored
 * session and to fan `patchCellSettings` out over authored cells.
 *
 * It must walk the tree exactly as `PlotNodeView` dispatches it, because the ids
 * are derived from the path each node is rendered at:
 *   - grid children take the identity-derived cell path (`gridCellKeys` /
 *     `gridCellPath`), the SAME derivation `GridView` uses, so a reordered run
 *     set keeps its saved settings. Keying either side by index alone would be
 *     enough to break prune/restore; keying them differently silently drops
 *     every grid cell from the topology.
 *   - an image `compare` with more than one output is expanded into a grid and
 *     dispatched at `<path>/comparison`, so its cells live one level deeper.
 */
export function compileSessionTopology(spec: PlotSpec): PlotSessionTopology {
  const cellIds = new Set<string>();
  const grids = new Map<string, { count: number; defaultLayout: "grid" | "stack" }>();
  const visit = (node: PlotNode, path: string): void => {
    if (node.kind === "compare" && comparisonType(node) === "image") {
      // Mirrors PlotNodeView's expansion. A plan that cannot be built has no
      // cells at all (the view renders the error), so treat it as unexpanded.
      let expanded = null;
      try {
        expanded = expandImageComparison(node);
      } catch {
        expanded = null;
      }
      if (expanded) {
        visit(expanded, `${path}/comparison`);
        return;
      }
    }
    if (node.kind !== "grid") {
      cellIds.add(`cell:${path}`);
      return;
    }
    grids.set(`grid:${path}`, {
      count: node.children.length,
      defaultLayout: node.initialLayout ?? "grid",
    });
    // The stacked viewport is ONE cell per grid, at the grid's own path — it is
    // deliberately shared by every slot, so it is not identity-derived.
    if (node.children.length > 0) cellIds.add(`stack:${path}`);
    const keys = gridCellKeys(node.children);
    node.children.forEach((child, index) => visit(child, gridCellPath(path, keys[index]!)));
  };
  visit(spec.root, "root");
  return { cellIds, grids };
}
