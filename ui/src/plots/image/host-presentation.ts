import type { CompareNode, PlotLeafNode, SharedProps } from "../../../../packages/spec/src/spec.ts";
import {
  channelToolbarButton,
  treeHasSelectableChannels,
  type ChannelMenuTree,
  type ChannelSelection,
} from "./model/channel-menu.ts";
import { syntheticChannelTree } from "./model/channel-slice.ts";
import type {
  CompareAlign,
  CompareFit,
  CompareSource,
  DecodedSource,
} from "./runtime/contracts.ts";
import type { PlotSettings } from "../../settings/schema.ts";
import type { CompareViewMode } from "./use-comparison-control.ts";

export interface ImageComparisonHostInput {
  readonly node: CompareNode;
  readonly mode: CompareViewMode;
  readonly comparisonOperationId: string;
  readonly colormap: CompareSource["colormap"];
  readonly cellDefaults: PlotSettings;
  readonly splitPosition: number;
  readonly align?: CompareAlign;
  readonly fit?: CompareFit;
  readonly referenceLabel?: string;
  readonly foregroundLabel?: string;
  readonly inStackedGrid: boolean;
  readonly inOverlay: boolean;
  readonly onComparisonOperationChange: (id: string) => void;
  readonly onCompareModeChange: (mode: CompareViewMode) => void;
  readonly onSplitPositionChange: (position: number) => void;
  readonly compareModified: boolean;
}

/** Lower a resolved image comparison into the retained image backend contract. */
export function composeImageComparisonPresentation(args: {
  readonly leaf: PlotLeafNode;
  readonly resolved: Readonly<Record<string, unknown>>;
  readonly comparison: ImageComparisonHostInput;
  readonly enlargeControl: { enlarged: boolean; setEnlarged(value: boolean): void };
}): Record<string, unknown> {
  const { leaf, resolved, comparison, enlargeControl } = args;
  if (resolved.__diffB === undefined) return {};
  const compareSource: CompareSource = {
    b: resolved.__diffB as DecodedSource,
    opId: comparison.comparisonOperationId,
    mode: comparison.mode,
    colormap: comparison.colormap,
    align: comparison.align,
    fit: comparison.fit,
    contentKeyA: resolved.__diffContentKeyA as string,
    contentKeyB: resolved.__diffContentKeyB as string,
    referenceLabel: comparison.referenceLabel,
    foregroundLabel: comparison.foregroundLabel,
    splitPosition: comparison.splitPosition,
    inStackedGrid: comparison.inStackedGrid,
    inOverlay: comparison.inOverlay,
    onComparisonOperationChange: comparison.onComparisonOperationChange,
    onCompareModeChange: comparison.onCompareModeChange,
    onSplitPositionChange: comparison.onSplitPositionChange,
    compareModified: comparison.compareModified,
  };
  return {
    ...(leaf.props ?? {}),
    source: resolved.source,
    compareSource,
    enlargeControl,
    ...(resolved.__diffOverlay ? { overlay: resolved.__diffOverlay } : {}),
  };
}

export function composeSingleImagePresentation(args: {
  readonly leaf: PlotLeafNode;
  readonly resolved: Readonly<Record<string, unknown>>;
  readonly shared?: SharedProps;
  readonly channelSelection: ChannelSelection | null;
  readonly baseChannelTree?: ChannelMenuTree;
  readonly selectChannels: (selection: ChannelSelection) => void;
  readonly enlargeControl: { enlarged: boolean; setEnlarged(value: boolean): void };
  readonly inStackedGrid: boolean;
}): { presentation: Record<string, unknown>; baseChannelTree?: ChannelMenuTree } {
  const hostProps: Record<string, unknown> = {};
  const described = args.resolved.exrTree as ChannelMenuTree | undefined;
  const resolvedTree =
    (described && treeHasSelectableChannels(described) ? described : undefined) ??
    (syntheticChannelTree(args.resolved.source as never) as ChannelMenuTree | null) ??
    undefined;
  const baseChannelTree = args.channelSelection == null && resolvedTree
    ? resolvedTree
    : args.baseChannelTree;
  const channelTree = resolvedTree ?? (args.channelSelection != null ? baseChannelTree : undefined);
  if (channelTree) {
    const effectiveSelection: ChannelSelection = args.channelSelection ??
      (args.leaf.data.kind === "image"
        ? { part: args.leaf.data.part, layer: args.leaf.data.layer }
        : {});
    const menu = channelToolbarButton(channelTree, effectiveSelection, (selection) => {
      args.selectChannels(selection ?? {});
    });
    if (menu) {
      hostProps.channelMenu = menu;
      hostProps.channelModified = args.channelSelection != null;
      hostProps.onChannelReset = () => args.selectChannels({});
    }
  }
  hostProps.enlargeControl = args.enlargeControl;
  return {
    presentation: {
      ...hostProps,
      ...(args.leaf.props ?? {}),
      ...args.resolved,
      inStackedGrid: args.inStackedGrid,
    },
    baseChannelTree,
  };
}
