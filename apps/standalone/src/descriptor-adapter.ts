import type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotDescriptor,
  PlotNode,
} from "../../../ui/src/plot-descriptor.ts";
import type { JsonValue } from "../../../packages/spec/src/json.ts";
import type { LayoutSpec, PaneSpec, PlotSpec, SettingsPatch, SourceSpec } from "../../../packages/spec/src/spec.ts";

function jsonRecord(value: Record<string, unknown> | undefined): Record<string, JsonValue> | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>;
}

function source(data: DataSpec): SourceSpec {
  return JSON.parse(JSON.stringify(data)) as SourceSpec;
}

function authoredSettings(node: PlotNode, inherited?: SettingsPatch): SettingsPatch | undefined {
  const props = "props" in node ? node.props : undefined;
  const settings = jsonRecord(props?.settings as Record<string, unknown> | undefined);
  const merged = { ...inherited, ...settings };
  return Object.keys(merged).length ? merged : undefined;
}

function sharedSettings(grid: GridNode): SettingsPatch | undefined {
  if (!grid.shared) return undefined;
  const out: SettingsPatch = {};
  if (grid.shared.colormap !== undefined) out["image.encoding"] = grid.shared.colormap;
  if (grid.shared.colorRange !== undefined) {
    out["image.colorRange"] = {
      min: grid.shared.colorRange[0],
      max: grid.shared.colorRange[1],
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function visit(
  node: PlotNode,
  path: string,
  panes: Record<string, PaneSpec>,
  inherited?: SettingsPatch,
): LayoutSpec {
  if (node.kind === "grid") {
    const nextInherited = { ...inherited, ...sharedSettings(node) };
    return {
      kind: "grid",
      children: node.children.map((child, index) =>
        visit(child, `${path}.${index}`, panes, nextInherited)),
      columns: node.cols,
      gap: node.gap,
      mode: node.mode,
    };
  }

  const id = `pane:${path}`;
  if (node.kind === "compare") {
    const compare = node as CompareNode;
    panes[id] = {
      id,
      kind: "compare",
      sources: [source(compare.a), source(compare.b)],
      settings: {
        ...authoredSettings(node, inherited),
        "compare.operation": compare.mode === "split"
          ? "split"
          : (compare.diffSubmode ?? "absolute"),
      },
      props: jsonRecord(compare.props),
    };
  } else {
    panes[id] = {
      id,
      kind: node.renderer,
      sources: [source(node.data)],
      settings: authoredSettings(node, inherited),
      props: jsonRecord(node.props),
    };
  }
  return { kind: "pane", pane: id };
}

/**
 * Compatibility bridge for the existing recursive descriptor. Stable explicit
 * pane keys can replace path ids in a later wire version without changing the
 * runtime model.
 */
export function plotSpecFromDescriptor(descriptor: PlotDescriptor): PlotSpec {
  const panes: Record<string, PaneSpec> = {};
  return {
    version: 1,
    layout: visit(descriptor.root, "0", panes),
    panes,
  };
}
