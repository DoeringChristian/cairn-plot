import type { CompareNode, PlotLeafNode, SharedProps } from "../../../../../packages/spec/src/spec.ts";
import {
  treeHasSelectableChannels,
  type ChannelMenuTree,
  type ChannelSelection,
} from "../components/channel-menu.ts";
import { syntheticChannelTree } from "../resources/channel-slice.ts";
import type {
  ImageCompareAlign,
  ImageCompareFit,
  ImageComparisonContent,
  ImageSource,
} from "../definition/content.ts";
import type { PlotSettings } from "../../../settings/schema.ts";
import { resolveDisplayOperator } from "./tonemap.ts";

function authoredSourceEncoding(node: PlotLeafNode | CompareNode): string {
  const value = node.settings?.["image.encoding"];
  return typeof value === "string" ? value : resolveDisplayOperator(undefined);
}

export interface ImageComparisonHostInput {
  readonly node: CompareNode;
  readonly cellDefaults: PlotSettings;
  readonly align?: ImageCompareAlign;
  readonly fit?: ImageCompareFit;
  readonly referenceLabel?: string;
  readonly foregroundLabel?: string;
}

/** Lower a resolved image comparison into the retained image backend contract. */
export function composeImageComparisonPresentation(args: {
  readonly leaf: PlotLeafNode;
  readonly resolved: Readonly<Record<string, unknown>>;
  readonly comparison: ImageComparisonHostInput;
}): Record<string, unknown> {
  const { leaf, resolved, comparison } = args;
  if (resolved.__diffB === undefined) return {};
  const props = (comparison.node.props ?? {}) as Record<string, unknown>;
  const content: ImageComparisonContent = {
    foreground: resolved.__diffB as ImageSource,
    presentation: comparison.node.presentation === "difference" ? "difference" : "split",
    defaultOperation: typeof props.operation === "string" ? props.operation : "absolute",
    defaultSplit: typeof props.splitPosition === "number" ? props.splitPosition : 0.5,
    align: comparison.align,
    fit: comparison.fit,
    contentKeyA: resolved.__diffContentKeyA as string,
    contentKeyB: resolved.__diffContentKeyB as string,
    referenceLabel: comparison.referenceLabel,
    foregroundLabel: comparison.foregroundLabel,
  };
  return {
    ...(leaf.props ?? {}),
    source: resolved.source,
    comparison: content,
    authoredSourceEncoding: authoredSourceEncoding(comparison.node),
    ...(resolved.__diffOverlay ? { overlay: resolved.__diffOverlay } : {}),
  };
}

export function composeSingleImagePresentation(args: {
  readonly leaf: PlotLeafNode;
  readonly resolved: Readonly<Record<string, unknown>>;
  readonly shared?: SharedProps;
  readonly channelSelection: ChannelSelection | null;
  readonly baseChannelTree?: ChannelMenuTree;
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
    hostProps.channelTree = channelTree;
    hostProps.authoredChannelSelection = effectiveSelection;
  }
  return {
    presentation: {
      ...hostProps,
      ...(args.leaf.props ?? {}),
      ...args.resolved,
      authoredSourceEncoding: authoredSourceEncoding(args.leaf),
    },
    baseChannelTree,
  };
}
